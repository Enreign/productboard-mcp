import { Resource, ResourceContent } from '@core/types.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';

export class UserResource implements Resource {
  public readonly name = 'pb_users';
  public readonly description = 'Provides access to Productboard users and team information as a structured resource';
  public readonly uri = 'productboard://users';
  public readonly mimeType = 'application/json';

  constructor(
    private apiClient: ProductboardAPIClient,
    private logger: Logger,
  ) {}

  async retrieve(): Promise<ResourceContent> {
    try {
      this.logger.debug('Retrieving users resource data');
      
      // Get current user data (most MCP use cases focus on current user context)
      const currentUser = await this.apiClient.get('/me') as any;
      
      // Get team users if available
      let teamUsers = [];
      try {
        const usersResponse = await this.apiClient.get('/users', { limit: 50 }) as any;
        teamUsers = usersResponse.data || [];
      } catch (error) {
        this.logger.debug('Team users not available or access restricted');
      }

      // Format the data for resource consumption
      const resourceData = {
        meta: {
          type: 'users',
          currentUser: currentUser.data ? true : false,
          teamCount: teamUsers.length,
          timestamp: new Date().toISOString(),
        },
        currentUser: currentUser.data || null,
        teamUsers: teamUsers,
        schema: {
          properties: {
            id: { type: 'string', description: 'User unique identifier' },
            email: { type: 'string', description: 'User email address' },
            name: { type: 'string', description: 'User display name' },
            role: { type: 'string', description: 'User role in organization' },
            permissions: { type: 'array', description: 'User permissions list' },
            status: { type: 'string', description: 'User account status' },
          },
        },
      };

      return {
        uri: this.uri,
        mimeType: this.mimeType,
        text: JSON.stringify(resourceData, null, 2),
      };
    } catch (error) {
      this.logger.error('Failed to retrieve users resource', error);
      
      // Return error information as resource content
      return {
        uri: this.uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          error: 'Failed to retrieve users data',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }, null, 2),
      };
    }
  }
}