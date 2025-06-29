import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ReleaseStatusUpdateParams {
  id: string;
  status: 'planned' | 'in_progress' | 'released';
  release_notes?: string;
  actual_date?: string;
}

export class ReleaseStatusUpdateTool extends BaseTool<ReleaseStatusUpdateParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_status_update',
      'Update release status and publish release notes',
      {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: {
            type: 'string',
            description: 'Release ID',
          },
          status: {
            type: 'string',
            enum: ['planned', 'in_progress', 'released'],
            description: 'New release status',
          },
          release_notes: {
            type: 'string',
            description: 'Release notes (required when status is "released")',
          },
          actual_date: {
            type: 'string',
            format: 'date',
            description: 'Actual release date (for released status)',
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

  protected async executeInternal(params: ReleaseStatusUpdateParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Updating release status', { 
        id: params.id,
        status: params.status 
      });

      // Validate release notes for released status
      if (params.status === 'released' && !params.release_notes) {
        return {
          success: false,
          error: 'Release notes are required when status is "released"',
        };
      }

      const response = await this.apiClient.patch(`/releases/${params.id}/status`, {
        status: params.status,
        release_notes: params.release_notes,
        actual_date: params.actual_date,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to update release status', error);
      
      return {
        success: false,
        error: `Failed to update release status: ${(error as Error).message}`,
      };
    }
  }
}