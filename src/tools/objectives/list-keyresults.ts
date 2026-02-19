import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListKeyResultsParams {
  objective_id?: string;
  metric_type?: 'number' | 'percentage' | 'currency';
  limit?: number;
  offset?: number;
}

export class ListKeyResultsTool extends BaseTool<ListKeyResultsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_keyresult_list',
      'List key results with optional filtering',
      {
        type: 'object',
        properties: {
          objective_id: {
            type: 'string',
            description: 'Filter by objective ID',
          },
          metric_type: {
            type: 'string',
            enum: ['number', 'percentage', 'currency'],
            description: 'Filter by metric type',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of key results to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of key results to skip',
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

  protected async executeInternal(params: ListKeyResultsParams = {}): Promise<unknown> {
    this.logger.info('Listing key results');

    // Only pass filters supported by the API - not limit/offset
    const queryParams: Record<string, any> = { type: 'keyResult' };
    if (params.objective_id) queryParams.objective_id = params.objective_id;
    if (params.metric_type) queryParams.metric_type = params.metric_type;

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/entities',
      params: queryParams,
    });

    const allKeyResults: any[] = Array.isArray((response as any)?.data) ? (response as any).data : [];
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const keyResults = allKeyResults.slice(offset, offset + limit);

    const formatted = keyResults.map((kr: any, i: number) =>
      `${offset + i + 1}. ${kr.name || 'Untitled Key Result'}\n` +
      `   Type: ${kr.metric_type || kr.type || 'Unknown'}\n` +
      (kr.current_value !== undefined ? `   Current: ${kr.current_value}\n` : '') +
      (kr.target_value !== undefined ? `   Target: ${kr.target_value}\n` : '') +
      (kr.objective_id ? `   Objective: ${kr.objective_id}\n` : '')
    );

    const summary = keyResults.length > 0
      ? `Found ${allKeyResults.length} key results, showing ${keyResults.length}:\n\n` + formatted.join('\n')
      : 'No key results found.';

    return { content: [{ type: 'text', text: summary }] };
  }
}