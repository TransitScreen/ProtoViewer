import { z } from "zod";

// Protobuf decode request schema
export const decodeRequestSchema = z.object({
  bindingsSource: z.enum(["file", "url"]),
  bindingsContent: z.string().optional(), // File content when uploaded
  bindingsUrl: z.string().url().optional(), // URL to fetch bindings from
  feedUrl: z.string().url(), // URL of the protobuf feed to decode
  messageType: z.string().optional(), // Optional specific message type to decode
});

export type DecodeRequest = z.infer<typeof decodeRequestSchema>;

// Protobuf decode response schema
export const decodeResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(), // Decoded protobuf data
  error: z.string().optional(),
  decodeTime: z.number().optional(), // Time taken to decode in ms
});

export type DecodeResponse = z.infer<typeof decodeResponseSchema>;
