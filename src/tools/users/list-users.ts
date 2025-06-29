import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListUsersParams {
  role?: 'admin' | 'contributor' | 'viewer';
  active?: boolean;
  search?: string;
}

export class ListUsersTool extends BaseTool<ListUsersParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_user_list',
      'List users in the workspace',
      {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['admin', 'contributor', 'viewer'],
            description: 'Filter by user role',
          },
          active: {
            type: 'boolean',
            description: 'Filter by active status',
          },
          search: {
            type: 'string',
            description: 'Search in user names and emails',
          },
        },
      },
      {
        requiredPermissions: [Permission.USERS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to users',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListUsersParams = {}): Promise<unknown> {
    this.logger.info('Listing users');

    const queryParams: Record<string, any> = {};
    if (params.role) queryParams.role = params.role;
    if (params.active !== undefined) queryParams.active = params.active;
    if (params.search) queryParams.search = params.search;

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/users',
      params: queryParams,
    });

    return {
      success: true,
      data: {
        users: response,
        total: Array.isArray(response) ? response.length : 0,
      },
    };
  }
}