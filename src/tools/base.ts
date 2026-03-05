import { Tool } from '../core/types.js';
import { Schema, ValidationResult } from '../middleware/types.js';
import { Validator } from '../middleware/validator.js';
import { ProductboardAPIClient } from '../api/client.js';
import {
  APIAuthenticationError,
  APIAuthorizationError,
  APINotFoundError,
  APIRateLimitError,
  APIServerError,
  APIValidationError,
} from '../api/errors.js';
import { ValidationError as MCPValidationError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';
import { Permission, AccessLevel, UserPermissions, ToolPermissionMetadata } from '../auth/permissions.js';

export interface MCPToolContent {
  content: Array<{ type: 'text'; text: string }>;
}

export abstract class BaseTool<TParams = unknown> implements Tool {
  public readonly name: string;
  public readonly description: string;
  public readonly parameters: Schema;
  public readonly permissionMetadata: ToolPermissionMetadata;
  
  protected validator: Validator;
  protected apiClient: ProductboardAPIClient;
  protected logger: Logger;

  constructor(
    name: string,
    description: string,
    parameters: Schema,
    permissionMetadata: ToolPermissionMetadata,
    apiClient: ProductboardAPIClient,
    logger: Logger
  ) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
    this.permissionMetadata = permissionMetadata;
    this.apiClient = apiClient;
    this.logger = logger;
    this.validator = new Validator();
  }

  async execute(params: TParams): Promise<MCPToolContent> {
    // Validate parameters
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new MCPValidationError(
        `Invalid parameters for tool ${this.name}`,
        validation.errors,
      );
    }

    // Execute the tool-specific logic
    try {
      const result = await this.executeInternal(params);
      return this.toMCPContent(result);
    } catch (error) {
      this.logger.error(`Tool ${this.name} execution failed`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return this.toMCPContent({ success: false, error: this.sanitizeError(error) });
    }
  }

  protected toMCPContent(data: unknown): MCPToolContent {
    if (data && typeof data === 'object' && 'content' in data && Array.isArray((data as MCPToolContent).content)) {
      return data as MCPToolContent;
    }
    return {
      content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
    };
  }

  private sanitizeError(error: unknown): string {
    if (error instanceof APIAuthenticationError) return 'Authentication failed: invalid or expired API token';
    if (error instanceof APIAuthorizationError) return 'Authorization failed: insufficient permissions for this operation';
    if (error instanceof APINotFoundError) return 'Resource not found';
    if (error instanceof APIRateLimitError) return 'Productboard API rate limit exceeded, please try again later';
    if (error instanceof APIValidationError) return `Invalid request: ${error.message}`;
    if (error instanceof APIServerError) return 'Productboard API server error, please try again';
    if (error instanceof MCPValidationError) return error.message;
    return 'An unexpected error occurred';
  }

  protected abstract executeInternal(params: TParams): Promise<unknown>;

  protected async validate(params: TParams): Promise<void> {
    const validation = this.validateParams(params);
    if (!validation.valid) {
      throw new MCPValidationError(
        `Invalid parameters for tool ${this.name}`,
        validation.errors,
      );
    }
  }

  validateParams(params: unknown): ValidationResult {
    return this.validator.validateSchema(params || {}, this.parameters);
  }

  protected transformResponse(data: unknown): unknown {
    // Default implementation returns data as-is
    // Override in subclasses for custom transformations
    return data;
  }

  getMetadata(): { name: string; description: string; inputSchema: Schema; permissions: ToolPermissionMetadata } {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.parameters,
      permissions: this.permissionMetadata,
    };
  }

  /**
   * Check if this tool is available for the given user permissions
   */
  isAvailableForUser(userPermissions: UserPermissions): boolean {
    // Check minimum access level
    const accessLevelOrder = {
      [AccessLevel.READ]: 0,
      [AccessLevel.WRITE]: 1,
      [AccessLevel.DELETE]: 2,
      [AccessLevel.ADMIN]: 3,
    };

    const userAccessLevel = accessLevelOrder[userPermissions.accessLevel];
    const requiredAccessLevel = accessLevelOrder[this.permissionMetadata.minimumAccessLevel];

    if (userAccessLevel < requiredAccessLevel) {
      return false;
    }

    // Check specific permissions
    for (const requiredPermission of this.permissionMetadata.requiredPermissions) {
      if (!userPermissions.permissions.has(requiredPermission)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get a list of missing permissions for this tool
   */
  getMissingPermissions(userPermissions: UserPermissions): Permission[] {
    const missing: Permission[] = [];

    for (const requiredPermission of this.permissionMetadata.requiredPermissions) {
      if (!userPermissions.permissions.has(requiredPermission)) {
        missing.push(requiredPermission);
      }
    }

    return missing;
  }

  /**
   * Get the required access level for this tool
   */
  getRequiredAccessLevel(): AccessLevel {
    return this.permissionMetadata.minimumAccessLevel;
  }

  /**
   * Get all required permissions for this tool
   */
  getRequiredPermissions(): Permission[] {
    return [...this.permissionMetadata.requiredPermissions];
  }
}