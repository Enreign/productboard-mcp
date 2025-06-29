import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface CreateReleaseParams {
  name: string;
  date: string;
  description?: string;
  release_group_id?: string;
}

export class CreateReleaseTool extends BaseTool<CreateReleaseParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_create',
      'Create a new release',
      {
        type: 'object',
        required: ['name', 'date'],
        properties: {
          name: {
            type: 'string',
            description: 'Release name/version',
          },
          date: {
            type: 'string',
            format: 'date',
            description: 'Release date',
          },
          description: {
            type: 'string',
            description: 'Release description',
          },
          release_group_id: {
            type: 'string',
            description: 'Parent release group ID',
          },
        },
      },
      {
        requiredPermissions: [Permission.RELEASES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to releases',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: CreateReleaseParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Creating release', { name: params.name });

      const response = await this.apiClient.post('/releases', params);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to create release', error);
      
      return {
        success: false,
        error: `Failed to create release: ${(error as Error).message}`,
      };
    }
  }
}