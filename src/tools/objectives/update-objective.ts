import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface UpdateObjectiveParams {
  id: string;
  name?: string;
  description?: string;
  status_id?: string;
  owner_email?: string;
}

export class UpdateObjectiveTool extends BaseTool<UpdateObjectiveParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_objective_update',
      'Update an existing objective',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Objective ID to update',
          },
          name: {
            type: 'string',
            description: 'Objective name',
          },
          description: {
            type: 'string',
            description: 'Objective description',
          },
          status_id: {
            type: 'string',
            description: 'Status ID (UUID from the status object on the objective)',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Objective owner',
          },
        },
      },
      {
        requiredPermissions: [Permission.OBJECTIVES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to objectives',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: UpdateObjectiveParams): Promise<unknown> {
    this.logger.info('Updating objective', { id: params.id });

    const { id, owner_email, status_id, ...rest } = params;

    if (Object.keys(rest).length === 0 && !owner_email && !status_id) {
      return { success: false, error: 'No update fields provided' };
    }

    const fields: Record<string, unknown> = { ...rest };
    if (fields.description) fields.description = (fields.description as string).startsWith('<') ? fields.description : `<p>${fields.description}</p>`;
    if (owner_email) fields.owner = { email: owner_email };
    if (status_id) fields.status = { id: status_id };

    const response = await this.apiClient.patch(`/entities/${id}`, { data: { fields } });

    return {
      success: true,
      data: response,
    };
  }
}