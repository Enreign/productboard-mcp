import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface CreateReleaseParams {
  name: string;
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
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Release name/version',
          },
          description: {
            type: 'string',
            description: 'Release description',
          },
          release_group_id: {
            type: 'string',
            description: 'Parent release group ID (use pb_release_timeline to find release group IDs)',
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

  protected async executeInternal(params: CreateReleaseParams): Promise<unknown> {
    this.logger.info('Creating release', { name: params.name });

    const { release_group_id, ...rest } = params;
    const fields: Record<string, unknown> = { ...rest };
    if (fields.description) fields.description = (fields.description as string).startsWith('<') ? fields.description : `<p>${fields.description}</p>`;

    const relationships: Array<{ type: string; target: { id: string } }> = [];
    if (release_group_id) relationships.push({ type: 'parent', target: { id: release_group_id } });

    const requestData: Record<string, unknown> = { type: 'release', fields };
    if (relationships.length > 0) requestData.relationships = relationships;

    const response = await this.apiClient.post('/entities', { data: requestData });

    return {
      success: true,
      data: response,
    };
  }
}