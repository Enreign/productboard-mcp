import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListObjectivesParams {
  status?: 'active' | 'completed' | 'cancelled';
  owner_email?: string;
  period?: 'quarter' | 'year';
  limit?: number;
  offset?: number;
}

export class ListObjectivesTool extends BaseTool<ListObjectivesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_objective_list',
      'List objectives with optional filtering',
      {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'completed', 'cancelled'],
            description: 'Filter by objective status',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Filter by owner email',
          },
          period: {
            type: 'string',
            enum: ['quarter', 'year'],
            description: 'Filter by objective period',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of objectives to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of objectives to skip',
          },
        },
      },
      {
        requiredPermissions: [Permission.OBJECTIVES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to objectives',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListObjectivesParams = {}): Promise<unknown> {
    this.logger.info('Listing objectives');

    // Only pass filters supported by the API, not pagination params
    const queryParams: Record<string, any> = { 'type[]': 'objective' };
    if (params.status) queryParams.status = params.status;
    if (params.owner_email) queryParams.owner_email = params.owner_email;
    if (params.period) queryParams.period = params.period;

    const allObjectives: any[] = await this.apiClient.getAllPages<any>('/entities', queryParams);
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const objectives = allObjectives.slice(offset, offset + limit);

    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    const formatted = objectives.map((obj: any, i: number) =>
      `${offset + i + 1}. ${obj.fields?.name || 'Untitled Objective'}\n` +
      `   Status: ${obj.fields?.status?.name || (typeof obj.fields?.status === 'string' ? obj.fields.status : 'Unknown')}\n` +
      `   Owner: ${obj.fields?.owner?.email || 'Unassigned'}\n` +
      (obj.fields?.description ? `   Description: ${stripHtml(obj.fields.description).substring(0, 120)}\n` : '')
    );

    const summary = objectives.length > 0
      ? `Found ${allObjectives.length} objectives, showing ${objectives.length}:\n\n` + formatted.join('\n')
      : 'No objectives found.';

    return { content: [{ type: 'text', text: summary }] };
  }
}