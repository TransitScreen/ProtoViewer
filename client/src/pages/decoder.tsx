import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Link as LinkIcon, Code, CheckCircle, XCircle, Loader2, Copy, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { DecodeResponse } from "@shared/schema";

export default function Decoder() {
  const [bindingsSource, setBindingsSource] = useState<"file" | "url">("file");
  const [bindingsFile, setBindingsFile] = useState<File | null>(null);
  const [bindingsUrl, setBindingsUrl] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [decodedOutput, setDecodedOutput] = useState("");
  const [decodeTime, setDecodeTime] = useState<number | null>(null);
  const { toast } = useToast();

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setBindingsFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.proto'],
      'application/octet-stream': ['.proto'],
    },
    multiple: false,
  });

  const decodeMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("bindingsSource", bindingsSource);
      formData.append("feedUrl", feedUrl);

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
      if (data.success && data.data) {
        const formatted = JSON.stringify(data.data, null, 2);
        setDecodedOutput(formatted);
        setDecodeTime(data.decodeTime || null);
        toast({
          title: "Decode Successful",
          description: `Protobuf decoded in ${data.decodeTime}ms`,
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
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>

          {/* Decode Action Card */}
          <Card data-testid="card-decode-action">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg">Decode</CardTitle>
              <CardDescription className="text-xs">Execute protobuf decoding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleDecode}
                disabled={!canDecode}
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
                    Decode Protobuf
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Decoded Output</h2>
              <p className="text-sm text-muted-foreground">JSON representation of the protobuf data</p>
            </div>
            {decodedOutput && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                data-testid="button-copy-output"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            )}
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
