import { Resource, ResourceDescriptor } from './types.js';
import { ResourceNotFoundError } from '@utils/errors.js';
import { Logger } from '@utils/logger.js';

export class ResourceRegistry {
  private resources: Map<string, Resource>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.resources = new Map();
    this.logger = logger;
  }

  registerResource(resource: Resource): void {
    if (this.resources.has(resource.name)) {
      this.logger.warn(`Resource ${resource.name} is already registered, overwriting`);
    }
    
    this.resources.set(resource.name, resource);
    this.logger.info(`Registered resource: ${resource.name}`);
  }

  unregisterResource(resourceName: string): void {
    if (!this.resources.has(resourceName)) {
      throw new ResourceNotFoundError(resourceName);
    }
    
    this.resources.delete(resourceName);
    this.logger.info(`Unregistered resource: ${resourceName}`);
  }

  getResource(resourceName: string): Resource | null {
    return this.resources.get(resourceName) || null;
  }

  hasResource(resourceName: string): boolean {
    return this.resources.has(resourceName);
  }

  listResources(): ResourceDescriptor[] {
    const descriptors: ResourceDescriptor[] = [];
    
    for (const resource of this.resources.values()) {
      descriptors.push({
        name: resource.name,
        description: resource.description,
        uri: resource.uri,
        mimeType: resource.mimeType,
      });
    }
    
    return descriptors;
  }

  getResourceByUri(uri: string): Resource | null {
    for (const resource of this.resources.values()) {
      if (resource.uri === uri) {
        return resource;
      }
    }
    return null;
  }

  clear(): void {
    this.resources.clear();
    this.logger.info('Cleared all registered resources');
  }

  size(): number {
    return this.resources.size;
  }

  getResourceNames(): string[] {
    return Array.from(this.resources.keys());
  }
}