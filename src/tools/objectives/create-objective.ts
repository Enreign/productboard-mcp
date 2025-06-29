import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface CreateObjectiveParams {
  name: string;
  description: string;
  owner_email?: string;
  due_date?: string;
  period?: 'quarter' | 'year';
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
          due_date: {
            type: 'string',
            format: 'date',
            description: 'Target completion date',
          },
          period: {
            type: 'string',
            enum: ['quarter', 'year'],
            description: 'Objective period',
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

  protected async executeInternal(params: CreateObjectiveParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Creating objective', { name: params.name });

      const response = await this.apiClient.post('/objectives', params);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to create objective', error);
      
      return {
        success: false,
        error: `Failed to create objective: ${(error as Error).message}`,
      };
    }
  }
}