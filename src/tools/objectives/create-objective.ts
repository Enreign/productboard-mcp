import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface CreateObjectiveParams {
  name: string;
  description: string;
  owner_email?: string;
}

export class CreateObjectiveTool extends BaseTool<CreateObjectiveParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_objective_create',
      'Create a new objective',
      {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: {
            type: 'string',
            description: 'Objective name',
          },
          description: {
            type: 'string',
            description: 'Objective description',
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

  protected async executeInternal(params: CreateObjectiveParams): Promise<unknown> {
    this.logger.info('Creating objective', { name: params.name });

    const { owner_email, ...rest } = params;
    const fields: Record<string, unknown> = { ...rest };
    if (fields.description) fields.description = (fields.description as string).startsWith('<') ? fields.description : `<p>${fields.description}</p>`;
    if (owner_email) fields.owner = { email: owner_email };
    const response = await this.apiClient.post('/entities', { data: { type: 'objective', fields } });

    return {
      success: true,
      data: response,
    };
  }
}