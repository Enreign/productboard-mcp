import { Tool } from '../core/types.js';
import { Schema, ValidationResult, Validator } from '../middleware/validator.js';
import { ProductboardAPIClient } from '../api/client.js';
import { ValidationError as MCPValidationError, ToolExecutionError } from '../utils/errors.js';
import { Logger } from '../utils/logger.js';
import { Permission, AccessLevel, UserPermissions, ToolPermissionMetadata } from '../auth/permissions.js';

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

  async execute(params: TParams): Promise<unknown> {
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
      return await this.executeInternal(params);
    } catch (error) {
      if (error instanceof Error) {
        throw new ToolExecutionError(
          `Tool ${this.name} execution failed: ${error.message}`,
          this.name,
          error,
        );
      }
      throw error;
    }
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

  protected handleError(error: Error): never {
    throw new ToolExecutionError(
      `${this.name} failed: ${error.message}`,
      this.name,
      error,
    );
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