import { Resource, ResourceContent } from '@core/types.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';

export class FeatureResource implements Resource {
  public readonly name = 'pb_features';
  public readonly description = 'Provides access to Productboard features data as a structured resource';
  public readonly uri = 'productboard://features';
  public readonly mimeType = 'application/json';

  constructor(
    private apiClient: ProductboardAPIClient,
    private logger: Logger,
  ) {}

  async retrieve(): Promise<ResourceContent> {
    try {
      this.logger.debug('Retrieving features resource data');
      
      // Get features data from API
      const features = await this.apiClient.get('/features', {
        limit: 100,
        include: 'status,components,release',
      }) as any;

      // Format the data for resource consumption
      const resourceData = {
        meta: {
          type: 'features',
          count: features.data?.length || 0,
          timestamp: new Date().toISOString(),
        },
        data: features.data || [],
        schema: {
          properties: {
            id: { type: 'string', description: 'Feature unique identifier' },
            name: { type: 'string', description: 'Feature name' },
            description: { type: 'string', description: 'Feature description' },
            status: { type: 'object', description: 'Feature status information' },
            priority: { type: 'string', description: 'Feature priority level' },
            components: { type: 'array', description: 'Associated components' },
            release: { type: 'object', description: 'Target release information' },
          },
        },
      };

      return {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify(resourceData, null, 2),
      };
    } catch (error) {
      this.logger.error('Failed to retrieve features resource', error);
      
      // Return error information as resource content
      return {
        uri: this.uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          error: 'Failed to retrieve features data',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }, null, 2),
      };
    }
  }
}