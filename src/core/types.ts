import { Schema } from '@middleware/types.js';
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

export interface MCPToolContent {
  content: Array<{ type: 'text'; text: string }>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Schema;
  permissionMetadata: ToolPermissionMetadata;
  execute(params: unknown): Promise<MCPToolContent>;
  isAvailableForUser(userPermissions: UserPermissions): boolean;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Schema;
  permissions?: ToolPermissionMetadata;
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
  validateRequest(request: MCPRequest): import('@middleware/types.js').ValidationResult;
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