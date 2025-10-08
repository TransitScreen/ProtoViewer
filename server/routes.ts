import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import axios from "axios";
import protobuf from "protobufjs";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
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

      // Try to decode with all available message types
      const messageTypes = root.nestedArray.filter(
        (nested) => nested instanceof protobuf.Type
      ) as protobuf.Type[];

      if (messageTypes.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No message types found in protobuf schema",
        });
      }

      // Try decoding with each message type until one succeeds
      let decoded: any = null;
      let successfulType: string = "";

      for (const messageType of messageTypes) {
        try {
          decoded = messageType.decode(feedData);
          successfulType = messageType.name;
          break;
        } catch (error) {
          // Continue to next type
          continue;
        }
      }

      if (!decoded) {
        return res.status(400).json({
          success: false,
          error: "Failed to decode protobuf data with any available message type",
        });
      }

      const decodeTime = Date.now() - startTime;

      // Convert to plain object for JSON serialization
      const plainObject = messageTypes.find(t => t.name === successfulType)?.toObject(decoded, {
        longs: String,
        enums: String,
        bytes: String,
      }) || decoded;

      res.json({
        success: true,
        data: plainObject,
        decodeTime,
        messageType: successfulType,
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
  return httpServer;
}
