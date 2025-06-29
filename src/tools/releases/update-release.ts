import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface UpdateReleaseParams {
  id: string;
  name?: string;
  date?: string;
  description?: string;
  status?: 'planned' | 'in_progress' | 'released';
  release_group_id?: string;
}

export class UpdateReleaseTool extends BaseTool<UpdateReleaseParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_update',
      'Update an existing release',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Release ID to update',
          },
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
          status: {
            type: 'string',
            enum: ['planned', 'in_progress', 'released'],
            description: 'Release status',
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

  protected async executeInternal(params: UpdateReleaseParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Updating release', { id: params.id });

      const { id, ...updateData } = params;
      
      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: 'No update fields provided',
        };
      }

      const response = await this.apiClient.put(`/releases/${id}`, updateData);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to update release', error);
      
      return {
        success: false,
        error: `Failed to update release: ${(error as Error).message}`,
      };
    }
  }
}