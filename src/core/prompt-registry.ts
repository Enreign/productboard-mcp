import { Prompt, PromptDescriptor } from './types.js';
import { PromptNotFoundError } from '@utils/errors.js';
import { Logger } from '@utils/logger.js';

export class PromptRegistry {
  private prompts: Map<string, Prompt>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.prompts = new Map();
    this.logger = logger;
  }

  registerPrompt(prompt: Prompt): void {
    if (this.prompts.has(prompt.name)) {
      this.logger.warn(`Prompt ${prompt.name} is already registered, overwriting`);
    }
    
    this.prompts.set(prompt.name, prompt);
    this.logger.info(`Registered prompt: ${prompt.name}`);
  }

  unregisterPrompt(promptName: string): void {
    if (!this.prompts.has(promptName)) {
      throw new PromptNotFoundError(promptName);
    }
    
    this.prompts.delete(promptName);
    this.logger.info(`Unregistered prompt: ${promptName}`);
  }

  getPrompt(promptName: string): Prompt | null {
    return this.prompts.get(promptName) || null;
  }

  hasPrompt(promptName: string): boolean {
    return this.prompts.has(promptName);
  }

  listPrompts(): PromptDescriptor[] {
    const descriptors: PromptDescriptor[] = [];
    
    for (const prompt of this.prompts.values()) {
      descriptors.push({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      });
    }
    
    return descriptors;
  }

  clear(): void {
    this.prompts.clear();
    this.logger.info('Cleared all registered prompts');
  }

  size(): number {
    return this.prompts.size;
  }

  getPromptNames(): string[] {
    return Array.from(this.prompts.keys());
  }
}