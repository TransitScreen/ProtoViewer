import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Link as LinkIcon, Code, CheckCircle, XCircle, Loader2, Copy, FileText, RefreshCw, Download, History, Trash2, Clock, Radio, Square } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import type { DecodeResponse } from "@shared/schema";
import { useRef } from "react";

interface DecodeHistoryItem {
  id: string;
  timestamp: number;
  bindingsSource: "file" | "url";
  bindingsFileName?: string;
  bindingsUrl?: string;
  feedUrl: string;
  messageType?: string;
  outputFormat: "json" | "xml" | "text";
  output: string;
  decodeTime: number;
}

export default function Decoder() {
  const [bindingsSource, setBindingsSource] = useState<"file" | "url">("file");
  const [bindingsFile, setBindingsFile] = useState<File | null>(null);
  const [bindingsUrl, setBindingsUrl] = useState("https://gtfs.org/documentation/realtime/gtfs-realtime.proto");
  const [feedUrl, setFeedUrl] = useState("");
  const [messageType, setMessageType] = useState<string>("");
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [outputFormat, setOutputFormat] = useState<"json" | "xml" | "text">("json");
  const [decodedOutput, setDecodedOutput] = useState("");
  const [decodeTime, setDecodeTime] = useState<number | null>(null);
  const [history, setHistory] = useState<DecodeHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamInterval, setStreamInterval] = useState<number>(15);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("protobuf-decode-history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history:", e);
      }
    }
  }, []);

  // Save to history
  const saveToHistory = (data: DecodeResponse) => {
    if (!data.success || !data.output) return;

    const historyItem: DecodeHistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      bindingsSource,
      bindingsFileName: bindingsFile?.name,
      bindingsUrl: bindingsUrl || undefined,
      feedUrl,
      messageType: messageType || undefined,
      outputFormat,
      output: data.output,
      decodeTime: data.decodeTime || 0,
    };

    const newHistory = [historyItem, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem("protobuf-decode-history", JSON.stringify(newHistory));
  };

  // Restore from history
  const restoreFromHistory = (item: DecodeHistoryItem) => {
    // For file-based sessions, we can't restore the actual file, so switch to URL mode or show warning
    if (item.bindingsSource === "file") {
      // If URL is also available, use that
      if (item.bindingsUrl) {
        setBindingsSource("url");
        setBindingsUrl(item.bindingsUrl);
      } else {
        // Can only restore output, not decode again without file
        setDecodedOutput(item.output);
        setDecodeTime(item.decodeTime);
        setOutputFormat(item.outputFormat);
        setShowHistory(false);
        toast({
          title: "Session Partially Restored",
          description: "Output restored. Please re-upload bindings file to decode again.",
          variant: "default",
        });
        return;
      }
    } else {
      setBindingsSource(item.bindingsSource);
      if (item.bindingsUrl) {
        setBindingsUrl(item.bindingsUrl);
      }
    }
    
    setFeedUrl(item.feedUrl);
    setMessageType(item.messageType || "");
    setOutputFormat(item.outputFormat);
    setDecodedOutput(item.output);
    setDecodeTime(item.decodeTime);
    setShowHistory(false);
    toast({
      title: "Session Restored",
      description: "Previous decode session loaded successfully",
    });
  };

  // Clear history
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("protobuf-decode-history");
    toast({
      title: "History Cleared",
      description: "All decode history has been removed",
    });
  };

  // WebSocket streaming functions
  const startStreaming = async () => {
    // Validate inputs first
    if (!feedUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a feed URL first",
        variant: "destructive",
      });
      return;
    }

    // Validate bindings
    if (bindingsSource === "file" && !bindingsFile) {
      toast({
        title: "Error",
        description: "Please upload a bindings file first",
        variant: "destructive",
      });
      return;
    }
    
    if (bindingsSource === "url" && !bindingsUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a bindings URL first",
        variant: "destructive",
      });
      return;
    }

    // Establish WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/stream`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      setIsStreaming(true);
      
      // Prepare message payload
      const payload: any = {
        bindingsSource,
        feedUrl,
        messageType: messageType || undefined,
        outputFormat,
        interval: streamInterval * 1000, // Convert seconds to milliseconds
      };

      // Add bindings content or URL
      if (bindingsSource === "file" && bindingsFile) {
        payload.bindingsContent = await bindingsFile.text();
      } else if (bindingsSource === "url") {
        payload.bindingsUrl = bindingsUrl;
      }

      ws.send(JSON.stringify(payload));

      toast({
        title: "Streaming Started",
        description: `Decoding every ${streamInterval} seconds`,
      });
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.success) {
        setDecodedOutput(data.output);
        setDecodeTime(data.decodeTime);
      } else {
        toast({
          title: "Stream Error",
          description: data.error,
          variant: "destructive",
        });
      }
    };

    ws.onerror = () => {
      toast({
        title: "Connection Error",
        description: "Failed to establish streaming connection",
        variant: "destructive",
      });
      stopStreaming();
    };

    ws.onclose = () => {
      setIsStreaming(false);
    };
  };

  const stopStreaming = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsStreaming(false);
    toast({
      title: "Streaming Stopped",
      description: "Real-time decoding has been stopped",
    });
  };

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setBindingsFile(acceptedFiles[0]);
      setAvailableTypes([]);
      setMessageType("");
    }
  };

  // Clear message types when bindings source or URL changes
  useEffect(() => {
    setAvailableTypes([]);
    setMessageType("");
  }, [bindingsSource, bindingsUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.proto'],
      'application/octet-stream': ['.proto'],
    },
    multiple: false,
  });

  // Mutation to fetch available message types
  const fetchTypesMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("bindingsSource", bindingsSource);

      if (bindingsSource === "file" && bindingsFile) {
        formData.append("bindingsFile", bindingsFile);
      } else if (bindingsSource === "url" && bindingsUrl) {
        formData.append("bindingsUrl", bindingsUrl);
      } else {
        throw new Error("Please provide protobuf bindings");
      }

      const response = await fetch("/api/message-types", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch message types");
      }

      const data = await response.json();
      return data.messageTypes as string[];
    },
    onSuccess: (types) => {
      setAvailableTypes(types);
      // Reset or set message type
      if (types.length > 0) {
        if (!messageType || !types.includes(messageType)) {
          setMessageType(types[0]);
        }
      } else {
        setMessageType("");
      }
      toast({
        title: "Message Types Loaded",
        description: `Found ${types.length} message type(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const decodeMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("bindingsSource", bindingsSource);
      formData.append("feedUrl", feedUrl);

      if (messageType) {
        formData.append("messageType", messageType);
      }

      formData.append("outputFormat", outputFormat);

      if (bindingsSource === "file" && bindingsFile) {
        formData.append("bindingsFile", bindingsFile);
      } else if (bindingsSource === "url" && bindingsUrl) {
        formData.append("bindingsUrl", bindingsUrl);
      } else {
        throw new Error("Please provide protobuf bindings");
      }

      const response = await fetch("/api/decode", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to decode protobuf");
      }

      return response.json() as Promise<DecodeResponse>;
    },
    onSuccess: (data) => {
      if (data.success && data.output) {
        setDecodedOutput(data.output);
        setDecodeTime(data.decodeTime || null);
        saveToHistory(data);
        toast({
          title: "Decode Successful",
          description: `Protobuf decoded in ${data.decodeTime}ms as ${data.format?.toUpperCase()}`,
        });
      } else {
        toast({
          title: "Decode Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setDecodedOutput(`Error: ${error.message}`);
    },
  });

  const handleDecode = () => {
    if (!feedUrl) {
      toast({
        title: "Missing Feed URL",
        description: "Please provide a protobuf feed URL",
        variant: "destructive",
      });
      return;
    }

    if (bindingsSource === "file" && !bindingsFile) {
      toast({
        title: "Missing Bindings File",
        description: "Please upload a .proto file",
        variant: "destructive",
      });
      return;
    }

    if (bindingsSource === "url" && !bindingsUrl) {
      toast({
        title: "Missing Bindings URL",
        description: "Please provide a URL to the .proto file",
        variant: "destructive",
      });
      return;
    }

    decodeMutation.mutate();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(decodedOutput);
    toast({
      title: "Copied",
      description: "Output copied to clipboard",
    });
  };

  const downloadOutput = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = outputFormat === "json" ? "json" : outputFormat === "xml" ? "xml" : "txt";
    const filename = `protobuf-decoded-${timestamp}.${extension}`;

    const blob = new Blob([decodedOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: `Output saved as ${filename}`,
    });
  };

  const isBindingsValid = bindingsSource === "file" ? !!bindingsFile : !!bindingsUrl.trim();
  const isFeedUrlValid = !!feedUrl.trim();
  const canDecode = isBindingsValid && isFeedUrlValid && !decodeMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Code className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Protobuf Decoder</h1>
          </div>
          
          <Sheet open={showHistory} onOpenChange={setShowHistory}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-show-history">
                <History className="mr-2 h-4 w-4" />
                History {history.length > 0 && `(${history.length})`}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Decode History</SheetTitle>
                <SheetDescription>
                  View and restore previous decode sessions
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{history.length} session(s)</p>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearHistory} data-testid="button-clear-history">
                    <Trash2 className="mr-2 h-3 w-3" />
                    Clear All
                  </Button>
                )}
              </div>

              <ScrollArea className="mt-4 h-[calc(100vh-200px)]">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No decode history yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your decode sessions will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <Card
                        key={item.id}
                        className="cursor-pointer transition-colors hover-elevate active-elevate-2"
                        onClick={() => restoreFromHistory(item)}
                        data-testid={`history-item-${item.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {item.outputFormat.toUpperCase()}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {item.decodeTime}ms
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(item.timestamp).toLocaleString()}
                              </p>
                              <p className="truncate text-sm font-medium">{item.feedUrl}</p>
                              {item.messageType && (
                                <p className="text-xs text-muted-foreground">
                                  Type: {item.messageType}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 md:px-8">
        {/* Workflow Section */}
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          {/* Bindings Input Card */}
          <Card data-testid="card-bindings-input">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Protobuf Bindings</CardTitle>
              <CardDescription className="text-xs">Upload a .proto file or provide a URL</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={bindingsSource} onValueChange={(v) => setBindingsSource(v as "file" | "url")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file" data-testid="tab-bindings-file">File Upload</TabsTrigger>
                  <TabsTrigger value="url" data-testid="tab-bindings-url">URL</TabsTrigger>
                </TabsList>
                
                <TabsContent value="file" className="mt-4">
                  <div
                    {...getRootProps()}
                    className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                      isDragActive ? "border-primary bg-primary/5" : "border-border hover-elevate"
                    }`}
                    data-testid="dropzone-bindings"
                  >
                    <input {...getInputProps()} data-testid="input-bindings-file" />
                    {bindingsFile ? (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-5 w-5 text-chart-2" />
                        <span className="font-medium" data-testid="text-bindings-filename">{bindingsFile.name}</span>
                        <span className="text-muted-foreground">
                          ({(bindingsFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {isDragActive ? "Drop file here" : "Click or drag .proto file"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Accepts .proto files</p>
                      </>
                    )}
                  </div>
                  {bindingsFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBindingsFile(null);
                      }}
                      data-testid="button-clear-bindings-file"
                    >
                      Clear file
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="url" className="mt-4 space-y-2">
                  <Label htmlFor="bindings-url" className="text-xs font-medium uppercase tracking-wide">
                    Bindings URL
                  </Label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="bindings-url"
                      type="url"
                      placeholder="https://example.com/bindings.proto"
                      value={bindingsUrl}
                      onChange={(e) => setBindingsUrl(e.target.value)}
                      className="pl-9"
                      data-testid="input-bindings-url"
                    />
                    {bindingsUrl && (
                      <CheckCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chart-2" />
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Feed URL Card */}
          <Card data-testid="card-feed-url">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Protobuf Feed URL</CardTitle>
              <CardDescription className="text-xs">Enter the URL of the protobuf feed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="feed-url" className="text-xs font-medium uppercase tracking-wide">
                  Feed URL
                </Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="feed-url"
                    type="url"
                    placeholder="https://api.example.com/feed"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                    className="pl-9"
                    data-testid="input-feed-url"
                  />
                  {isFeedUrlValid && (
                    <CheckCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-chart-2" />
                  )}
                </div>
              </div>

              {/* Message Type Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message-type" className="text-xs font-medium uppercase tracking-wide">
                    Message Type {availableTypes.length > 0 && <span className="text-muted-foreground">({availableTypes.length} available)</span>}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchTypesMutation.mutate()}
                    disabled={!isBindingsValid || fetchTypesMutation.isPending}
                    data-testid="button-load-types"
                  >
                    <RefreshCw className={`h-3 w-3 ${fetchTypesMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                {availableTypes.length > 0 ? (
                  <Select value={messageType} onValueChange={setMessageType}>
                    <SelectTrigger data-testid="select-message-type">
                      <SelectValue placeholder="Select message type" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map((type) => (
                        <SelectItem key={type} value={type} data-testid={`option-type-${type}`}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="message-type"
                    placeholder="Optional: specify message type"
                    value={messageType}
                    onChange={(e) => setMessageType(e.target.value)}
                    data-testid="input-message-type"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Decode Action Card */}
          <Card data-testid="card-decode-action">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Decode</CardTitle>
              <CardDescription className="text-xs">Execute protobuf decoding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Streaming Toggle */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-3">
                  <Radio className={`h-4 w-4 ${isStreaming ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium">Real-time Streaming</p>
                    <p className="text-xs text-muted-foreground">
                      {isStreaming ? `Updating every ${streamInterval}ms` : "Continuous decode updates"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isStreaming}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      startStreaming();
                    } else {
                      stopStreaming();
                    }
                  }}
                  disabled={!canDecode}
                  data-testid="switch-streaming"
                />
              </div>

              {/* Streaming Interval Control */}
              {!isStreaming && (
                <div className="space-y-2">
                  <Label htmlFor="stream-interval" className="text-xs font-medium uppercase tracking-wide">
                    Update Interval (seconds)
                  </Label>
                  <Input
                    id="stream-interval"
                    type="number"
                    min={5}
                    max={300}
                    step={1}
                    value={streamInterval}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value)) {
                        setStreamInterval(15);
                      } else {
                        // Clamp value between 5 and 300 seconds
                        setStreamInterval(Math.min(Math.max(value, 5), 300));
                      }
                    }}
                    onBlur={(e) => {
                      // Re-clamp on blur to ensure valid value
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 5 || value > 300) {
                        setStreamInterval(Math.min(Math.max(value || 15, 5), 300));
                      }
                    }}
                    data-testid="input-stream-interval"
                  />
                </div>
              )}

              <Button
                onClick={handleDecode}
                disabled={!canDecode || isStreaming}
                className="w-full"
                size="lg"
                data-testid="button-decode"
              >
                {decodeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Decoding...
                  </>
                ) : (
                  <>
                    <Code className="mr-2 h-4 w-4" />
                    Decode Once
                  </>
                )}
              </Button>

              {/* Status Display */}
              <div className="rounded-lg border bg-muted/50 p-4">
                {decodeMutation.isPending ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">Fetching & decoding...</span>
                  </div>
                ) : decodeMutation.isSuccess ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-chart-2" />
                    <span className="font-medium">Decoded in {decodeTime}ms</span>
                  </div>
                ) : decodeMutation.isError ? (
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">Decode failed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Ready to decode</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Output Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">Decoded Output</h2>
              <p className="text-sm text-muted-foreground">Formatted protobuf data</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as "json" | "xml" | "text")}>
                <SelectTrigger className="w-32" data-testid="select-output-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json" data-testid="option-format-json">JSON</SelectItem>
                  <SelectItem value="xml" data-testid="option-format-xml">XML</SelectItem>
                  <SelectItem value="text" data-testid="option-format-text">Text</SelectItem>
                </SelectContent>
              </Select>
              {decodedOutput && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadOutput}
                    data-testid="button-download-output"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    data-testid="button-copy-output"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {decodedOutput ? (
                <Textarea
                  value={decodedOutput}
                  readOnly
                  className="min-h-96 resize-none rounded-lg border-0 font-mono text-sm focus-visible:ring-0"
                  data-testid="textarea-output"
                />
              ) : (
                <div className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
                  <Code className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium text-muted-foreground">No output yet</p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Provide protobuf bindings and a feed URL, then click "Decode Protobuf" to see the
                    decoded output here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
