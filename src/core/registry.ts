import { Tool, ToolDescriptor } from './types.js';
import { Schema } from '@middleware/validator.js';
import { ToolNotFoundError } from '@utils/errors.js';
import { Logger } from '@utils/logger.js';

export class ToolRegistry {
  private tools: Map<string, Tool>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.tools = new Map();
    this.logger = logger;
  }

  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} is already registered, overwriting`);
    }
    
    this.tools.set(tool.name, tool);
    this.logger.info(`Registered tool: ${tool.name}`);
  }

  unregisterTool(toolName: string): void {
    if (!this.tools.has(toolName)) {
      throw new ToolNotFoundError(toolName);
    }
    
    this.tools.delete(toolName);
    this.logger.info(`Unregistered tool: ${toolName}`);
  }

  getTool(toolName: string): Tool | null {
    return this.tools.get(toolName) || null;
  }

  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  listTools(): ToolDescriptor[] {
    const descriptors: ToolDescriptor[] = [];
    
    for (const tool of this.tools.values()) {
      descriptors.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
        permissions: tool.permissionMetadata,
      });
    }
    
    return descriptors;
  }

  getToolSchema(toolName: string): Schema {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }
    
    return tool.parameters;
  }

  getToolDescription(toolName: string): string {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }
    
    return tool.description;
  }

  clear(): void {
    this.tools.clear();
    this.logger.info('Cleared all registered tools');
  }

  size(): number {
    return this.tools.size;
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}