import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface UpdateReleaseParams {
  id: string;
  name?: string;
  description?: string;
  status_id?: string;
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
          description: {
            type: 'string',
            description: 'Release description',
          },
          status_id: {
            type: 'string',
            description: 'Status ID (UUID from the status object on the release)',
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

  protected async executeInternal(params: UpdateReleaseParams): Promise<unknown> {
    this.logger.info('Updating release', { id: params.id });

    const { id, release_group_id, status_id, ...rest } = params;

    if (Object.keys(rest).length === 0 && !status_id && !release_group_id) {
      return { success: false, error: 'No update fields provided' };
    }

    const fields: Record<string, unknown> = { ...rest };
    if (fields.description) fields.description = (fields.description as string).startsWith('<') ? fields.description : `<p>${fields.description}</p>`;
    if (status_id) fields.status = { id: status_id };

    const relationships: Array<{ type: string; target: { id: string } }> = [];
    if (release_group_id) relationships.push({ type: 'parent', target: { id: release_group_id } });

    const requestData: Record<string, unknown> = { fields };
    if (relationships.length > 0) requestData.relationships = relationships;

    const response = await this.apiClient.patch(`/entities/${id}`, { data: requestData });

    return {
      success: true,
      data: response,
    };
  }
}