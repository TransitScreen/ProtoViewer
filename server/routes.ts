import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import axios from "axios";
import protobuf from "protobufjs";
import { js2xml } from "xml-js";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper function to recursively collect all message types
  function collectMessageTypes(obj: protobuf.ReflectionObject, prefix = ""): { type: protobuf.Type; fullName: string }[] {
    const types: { type: protobuf.Type; fullName: string }[] = [];
    
    if (obj instanceof protobuf.Type) {
      const fullName = prefix ? `${prefix}.${obj.name}` : obj.name;
      types.push({ 
        type: obj, 
        fullName 
      });
      
      // Types can also have nested types (messages within messages)
      if (obj.nestedArray && obj.nestedArray.length > 0) {
        for (const nested of obj.nestedArray) {
          types.push(...collectMessageTypes(nested, fullName));
        }
      }
    } else if (obj instanceof protobuf.Namespace) {
      const nestedPrefix = prefix ? `${prefix}.${obj.name}` : obj.name;
      for (const nested of obj.nestedArray) {
        types.push(...collectMessageTypes(nested, nestedPrefix));
      }
    }
    
    return types;
  }

  // Get available message types from protobuf bindings
  app.post("/api/message-types", upload.single("bindingsFile"), async (req, res) => {
    try {
      const { bindingsSource, bindingsUrl } = req.body;

      let protoContent: string;

      if (bindingsSource === "file") {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: "Bindings file is required",
          });
        }
        protoContent = req.file.buffer.toString("utf-8");
      } else if (bindingsSource === "url") {
        if (!bindingsUrl) {
          return res.status(400).json({
            success: false,
            error: "Bindings URL is required",
          });
        }
        
        try {
          const bindingsResponse = await axios.get(bindingsUrl, {
            responseType: "text",
            timeout: 10000,
          });
          protoContent = bindingsResponse.data;
        } catch (error: any) {
          return res.status(400).json({
            success: false,
            error: `Failed to fetch bindings: ${error.message}`,
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid bindings source",
        });
      }

      // Parse the protobuf schema
      let root: protobuf.Root;
      try {
        root = protobuf.parse(protoContent).root;
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          error: `Failed to parse protobuf schema: ${error.message}`,
        });
      }

      const messageTypes = collectMessageTypes(root);

      res.json({
        success: true,
        messageTypes: messageTypes.map(mt => mt.fullName),
      });
    } catch (error: any) {
      console.error("Message types error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });

  // Protobuf decode endpoint
  app.post("/api/decode", upload.single("bindingsFile"), async (req, res) => {
    try {
      const { bindingsSource, bindingsUrl, feedUrl } = req.body;
      const startTime = Date.now();

      // Validate required fields
      if (!feedUrl) {
        return res.status(400).json({
          success: false,
          error: "Feed URL is required",
        });
      }

      let protoContent: string;

      // Get protobuf bindings based on source
      if (bindingsSource === "file") {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: "Bindings file is required when using file source",
          });
        }
        protoContent = req.file.buffer.toString("utf-8");
      } else if (bindingsSource === "url") {
        if (!bindingsUrl) {
          return res.status(400).json({
            success: false,
            error: "Bindings URL is required when using URL source",
          });
        }
        
        try {
          const bindingsResponse = await axios.get(bindingsUrl, {
            responseType: "text",
            timeout: 10000,
          });
          protoContent = bindingsResponse.data;
        } catch (error: any) {
          return res.status(400).json({
            success: false,
            error: `Failed to fetch bindings from URL: ${error.message}`,
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid bindings source",
        });
      }

      // Parse the protobuf schema
      let root: protobuf.Root;
      try {
        root = protobuf.parse(protoContent).root;
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          error: `Failed to parse protobuf schema: ${error.message}`,
        });
      }

      // Fetch the protobuf feed data
      let feedData: Buffer;
      try {
        const feedResponse = await axios.get(feedUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
        });
        feedData = Buffer.from(feedResponse.data);
      } catch (error: any) {
        return res.status(400).json({
          success: false,
          error: `Failed to fetch protobuf feed: ${error.message}`,
        });
      }

      const messageTypes = collectMessageTypes(root);

      if (messageTypes.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No message types found in protobuf schema",
        });
      }

      const { messageType: requestedMessageType, outputFormat = "json" } = req.body;

      let decoded: any = null;
      let successfulType: string = "";
      let messageTypeObj: protobuf.Type | null = null;

      // If user specified a message type, try to use it
      if (requestedMessageType) {
        const found = messageTypes.find(
          mt => mt.fullName === requestedMessageType || 
                mt.type.name === requestedMessageType ||
                mt.fullName.endsWith(`.${requestedMessageType}`)
        );
        
        if (found) {
          try {
            decoded = found.type.decode(feedData);
            successfulType = found.fullName;
            messageTypeObj = found.type;
          } catch (error: any) {
            return res.status(400).json({
              success: false,
              error: `Failed to decode with message type '${requestedMessageType}': ${error.message}`,
            });
          }
        } else {
          return res.status(400).json({
            success: false,
            error: `Message type '${requestedMessageType}' not found in schema`,
          });
        }
      } else {
        // Try decoding with each message type until one succeeds
        for (const { type, fullName } of messageTypes) {
          try {
            decoded = type.decode(feedData);
            successfulType = fullName;
            messageTypeObj = type;
            break;
          } catch (error) {
            continue;
          }
        }
      }

      if (!decoded || !messageTypeObj) {
        return res.status(400).json({
          success: false,
          error: "Failed to decode protobuf data with any available message type",
          availableTypes: messageTypes.map(mt => mt.fullName),
        });
      }

      const decodeTime = Date.now() - startTime;

      // Convert to plain object
      const plainObject = messageTypeObj.toObject(decoded, {
        longs: String,
        enums: String,
        bytes: String,
      });

      // Format output based on requested format
      let output: string;
      let responseData: any;

      switch (outputFormat) {
        case "xml":
          output = js2xml({ protobuf: plainObject }, { compact: true, spaces: 2 });
          responseData = plainObject;
          break;
        case "text":
          // Readable text format with indentation
          const formatAsText = (obj: any, indent = 0): string => {
            const spaces = "  ".repeat(indent);
            let result = "";
            
            for (const [key, value] of Object.entries(obj)) {
              if (value === null || value === undefined) continue;
              
              if (typeof value === "object" && !Array.isArray(value)) {
                result += `${spaces}${key}:\n`;
                result += formatAsText(value, indent + 1);
              } else if (Array.isArray(value)) {
                result += `${spaces}${key}:\n`;
                value.forEach((item, idx) => {
                  if (typeof item === "object") {
                    result += `${spaces}  [${idx}]:\n`;
                    result += formatAsText(item, indent + 2);
                  } else {
                    result += `${spaces}  [${idx}]: ${item}\n`;
                  }
                });
              } else {
                result += `${spaces}${key}: ${value}\n`;
              }
            }
            return result;
          };
          output = formatAsText(plainObject);
          responseData = plainObject;
          break;
        case "json":
        default:
          output = JSON.stringify(plainObject, null, 2);
          responseData = plainObject;
          break;
      }

      res.json({
        success: true,
        data: responseData,
        output,
        decodeTime,
        messageType: successfulType,
        format: outputFormat,
      });
    } catch (error: any) {
      console.error("Decode error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server for streaming decode
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/stream" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("WebSocket client connected");
    let streamInterval: NodeJS.Timeout | null = null;

    ws.on("message", async (message: string) => {
      try {
        const config = JSON.parse(message.toString());
        const { bindingsContent, feedUrl, messageType, outputFormat = "json", interval = 1000 } = config;

        if (!bindingsContent || !feedUrl) {
          ws.send(JSON.stringify({ 
            success: false, 
            error: "Missing bindings or feed URL" 
          }));
          return;
        }

        // Parse protobuf schema
        let root: protobuf.Root;
        try {
          root = protobuf.parse(bindingsContent).root;
        } catch (error: any) {
          ws.send(JSON.stringify({ 
            success: false, 
            error: `Failed to parse protobuf schema: ${error.message}` 
          }));
          return;
        }

        // Set up streaming interval
        streamInterval = setInterval(async () => {
          // Stop if socket is not open
          if (ws.readyState !== WebSocket.OPEN) {
            if (streamInterval) {
              clearInterval(streamInterval);
              streamInterval = null;
            }
            return;
          }
          try {
            const startTime = Date.now();
            
            // Fetch feed data
            const feedResponse = await axios.get(feedUrl, {
              responseType: "arraybuffer",
              timeout: 10000,
            });

            const feedBuffer = Buffer.from(feedResponse.data);
            const messageTypes = collectMessageTypes(root);

            let decodedMessage: any;
            let successfulType: string | undefined;

            if (messageType) {
              const messageTypeObj = messageTypes.find(mt => mt.fullName === messageType);
              if (!messageTypeObj) {
                throw new Error(`Message type "${messageType}" not found`);
              }
              decodedMessage = messageTypeObj.type.decode(feedBuffer);
              successfulType = messageType;
            } else {
              for (const { type, fullName } of messageTypes) {
                try {
                  decodedMessage = type.decode(feedBuffer);
                  successfulType = fullName;
                  break;
                } catch {
                  continue;
                }
              }

              if (!decodedMessage) {
                throw new Error("Could not decode with any available message type");
              }
            }

            const plainObject = decodedMessage.toJSON();
            const decodeTime = Date.now() - startTime;

            let output: string;
            switch (outputFormat) {
              case "xml":
                output = js2xml(JSON.stringify(plainObject), { compact: true, spaces: 2 });
                break;
              case "text":
                const formatAsText = (obj: any, indent = 0): string => {
                  let result = "";
                  const spaces = "  ".repeat(indent);
                  for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                      result += `${spaces}${key}:\n`;
                      result += formatAsText(value, indent + 1);
                    } else if (Array.isArray(value)) {
                      result += `${spaces}${key}:\n`;
                      value.forEach((item, idx) => {
                        if (typeof item === "object") {
                          result += `${spaces}  [${idx}]:\n`;
                          result += formatAsText(item, indent + 2);
                        } else {
                          result += `${spaces}  [${idx}]: ${item}\n`;
                        }
                      });
                    } else {
                      result += `${spaces}${key}: ${value}\n`;
                    }
                  }
                  return result;
                };
                output = formatAsText(plainObject);
                break;
              case "json":
              default:
                output = JSON.stringify(plainObject, null, 2);
                break;
            }

            ws.send(JSON.stringify({
              success: true,
              output,
              decodeTime,
              messageType: successfulType,
              format: outputFormat,
              timestamp: Date.now(),
            }));
          } catch (error: any) {
            ws.send(JSON.stringify({
              success: false,
              error: error.message,
            }));
          }
        }, interval);

      } catch (error: any) {
        ws.send(JSON.stringify({
          success: false,
          error: error.message,
        }));
      }
    });

    // Clean up on disconnect
    ws.on("close", () => {
      if (streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
      }
      console.log("WebSocket client disconnected");
    });

    ws.on("error", (error) => {
      if (streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
      }
      console.error("WebSocket error:", error);
    });
  });

  return httpServer;
}
