import { Schema } from '@middleware/validator.js';
import { ToolPermissionMetadata, UserPermissions } from '@auth/permissions.js';

export interface MCPRequest {
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Schema;
  permissionMetadata: ToolPermissionMetadata;
  execute(params: unknown): Promise<unknown>;
  isAvailableForUser(userPermissions: UserPermissions): boolean;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Schema;
  permissions?: ToolPermissionMetadata;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ServerMetrics {
  uptime: number;
  requestsTotal: number;
  requestsSuccess: number;
  requestsFailed: number;
  averageResponseTime: number;
  activeConnections: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    api: boolean;
    auth: boolean;
    rateLimit: boolean;
  };
}

export interface ProtocolHandler {
  parseRequest(input: string): MCPRequest;
  formatResponse(response: MCPResponse): string;
  validateRequest(request: MCPRequest): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// Resource types
export interface Resource {
  name: string;
  description: string;
  uri: string;
  mimeType?: string;
  retrieve(): Promise<ResourceContent>;
}

export interface ResourceDescriptor {
  name: string;
  description: string;
  uri: string;
  mimeType?: string;
}

export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// Prompt types
export interface Prompt {
  name: string;
  description: string;
  arguments?: PromptArgument[];
  execute(params: unknown): Promise<PromptMessage[]>;
}

export interface PromptDescriptor {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface PromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: {
    type: 'text' | 'image';
    text?: string;
    image_url?: {
      url: string;
    };
  };
}

// Sampling configuration types
export interface SamplingConfiguration {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
}

export interface ModelPreferences {
  hints?: {
    name?: string;
  };
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}