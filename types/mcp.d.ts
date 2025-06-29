// This file provides enhanced type definitions for the MCP SDK
// The actual SDK uses complex Zod schemas, so we provide simplified but compatible types

declare module '@modelcontextprotocol/sdk/types.js' {
  export enum ErrorCode {
    ConnectionClosed = -1,
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603
  }

  export class McpError extends Error {
    readonly code: number;
    readonly data?: unknown;
    constructor(code: number, message: string, data?: unknown);
  }

  export interface Implementation {
    name: string;
    version: string;
  }

  export interface ServerCapabilities {
    tools?: {};
    resources?: {};
    prompts?: {};
    logging?: {};
  }

  export interface ClientCapabilities {
    experimental?: Record<string, unknown>;
    sampling?: {};
  }

  export interface ToolsCapability {
    listChanged?: boolean;
  }

  export interface Request {
    method: string;
    params?: Record<string, unknown>;
  }

  export interface Result {
    [key: string]: unknown;
  }

  export interface Notification {
    method: string;
    params?: Record<string, unknown>;
  }

  // Request and response schemas - these are used by the server
  export const ListToolsRequestSchema: {
    method: 'tools/list';
    params?: {
      cursor?: string;
    };
  };

  export const CallToolRequestSchema: {
    method: 'tools/call';
    params: {
      name: string;
      arguments?: Record<string, unknown>;
    };
  };
}

declare module '@modelcontextprotocol/sdk/server/index.js' {
  import { Implementation, ServerCapabilities, Request, Notification, Result } from '@modelcontextprotocol/sdk/types.js';
  import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

  export interface ServerOptions {
    capabilities: ServerCapabilities;
  }

  export type RequestHandler<T = unknown> = (request: Request) => Promise<T>;

  export class Server<
    RequestT extends Request = Request,
    NotificationT extends Notification = Notification,
    ResultT extends Result = Result
  > {
    constructor(serverInfo: Implementation, options: ServerOptions);
    connect(transport: Transport): Promise<void>;
    close(): Promise<void>;
    setRequestHandler<T>(schema: T, handler: RequestHandler): void;
    oninitialized?: () => void;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

  export class StdioServerTransport implements Transport {
    constructor();
  }
}

declare module '@modelcontextprotocol/sdk/shared/transport.js' {
  export interface Transport {
    // Transport interface - implementation details handled by SDK
  }
}