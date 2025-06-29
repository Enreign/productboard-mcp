import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface UpdateObjectiveParams {
  id: string;
  name?: string;
  description?: string;
  status?: 'active' | 'completed' | 'cancelled';
  owner_email?: string;
  due_date?: string;
  period?: 'quarter' | 'year';
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
          status: {
            type: 'string',
            enum: ['active', 'completed', 'cancelled'],
            description: 'Objective status',
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

  protected async executeInternal(params: UpdateObjectiveParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Updating objective', { id: params.id });

      const { id, ...updateData } = params;
      
      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          error: 'No update fields provided',
        };
      }

      const response = await this.apiClient.put(`/objectives/${id}`, updateData);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to update objective', error);
      
      return {
        success: false,
        error: `Failed to update objective: ${(error as Error).message}`,
      };
    }
  }
}