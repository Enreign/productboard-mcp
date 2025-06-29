export class MCPError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    Object.setPrototypeOf(this, MCPError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ToolNotFoundError extends MCPError {
  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, 'TOOL_NOT_FOUND', 404, { toolName });
    this.name = 'ToolNotFoundError';
    Object.setPrototypeOf(this, ToolNotFoundError.prototype);
  }
}

export class ToolExecutionError extends MCPError {
  public readonly cause?: Error;

  constructor(message: string, toolName: string, cause?: Error) {
    super(message, 'TOOL_EXECUTION_ERROR', 500, { toolName, cause: cause?.message });
    this.name = 'ToolExecutionError';
    this.cause = cause;
    Object.setPrototypeOf(this, ToolExecutionError.prototype);
  }
}

export class ProtocolError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROTOCOL_ERROR', 400, details);
    this.name = 'ProtocolError';
    Object.setPrototypeOf(this, ProtocolError.prototype);
  }
}

export class ServerError extends MCPError {
  constructor(message: string, cause?: Error) {
    super(message, 'SERVER_ERROR', 500, { cause: cause?.message });
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

export class ConfigurationError extends MCPError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', 500, details);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class ResourceNotFoundError extends MCPError {
  constructor(resourceName: string) {
    super(`Resource not found: ${resourceName}`, 'RESOURCE_NOT_FOUND', 404, { resourceName });
    this.name = 'ResourceNotFoundError';
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
  }
}

export class PromptNotFoundError extends MCPError {
  constructor(promptName: string) {
    super(`Prompt not found: ${promptName}`, 'PROMPT_NOT_FOUND', 404, { promptName });
    this.name = 'PromptNotFoundError';
    Object.setPrototypeOf(this, PromptNotFoundError.prototype);
  }
}

export function createErrorResponse(error: unknown): Record<string, unknown> {
  if (error instanceof MCPError) {
    return error.toJSON();
  }
  
  if (error instanceof Error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
      },
    };
  }
  
  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
    },
  };
}