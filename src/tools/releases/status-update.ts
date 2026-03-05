import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ReleaseStatusUpdateParams {
  id: string;
  status_id: string;
  release_notes?: string;
}

export class ReleaseStatusUpdateTool extends BaseTool<ReleaseStatusUpdateParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_status_update',
      'Update release status and publish release notes',
      {
        type: 'object',
        required: ['id', 'status_id'],
        properties: {
          id: {
            type: 'string',
            description: 'Release ID',
          },
          status_id: {
            type: 'string',
            description: 'Status ID (UUID from the status object on the release, use pb_release_list to find current status IDs)',
          },
          release_notes: {
            type: 'string',
            description: 'Release notes',
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

  protected async executeInternal(params: ReleaseStatusUpdateParams): Promise<unknown> {
    this.logger.info('Updating release status', {
      id: params.id,
      status_id: params.status_id,
    });

    const fields: Record<string, unknown> = {
      status: { id: params.status_id },
    };
    if (params.release_notes) fields.release_notes = params.release_notes;

    const response = await this.apiClient.patch(`/entities/${params.id}`, {
      data: { fields },
    });

    return {
      success: true,
      data: response,
    };
  }
}