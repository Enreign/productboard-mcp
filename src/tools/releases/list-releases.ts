import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListReleasesParams {
  release_group_id?: string;
  status?: 'planned' | 'in_progress' | 'released';
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export class ListReleasesTool extends BaseTool<ListReleasesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_release_list',
      'List releases with optional filtering',
      {
        type: 'object',
        properties: {
          release_group_id: {
            type: 'string',
            description: 'Filter by release group',
          },
          status: {
            type: 'string',
            enum: ['planned', 'in_progress', 'released'],
            description: 'Filter by release status',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Filter releases after this date',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'Filter releases before this date',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of releases to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of releases to skip',
          },
        },
      },
      {
        requiredPermissions: [Permission.RELEASES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to releases',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListReleasesParams = {}): Promise<unknown> {
    this.logger.info('Listing releases');

    // Only pass filters supported by the API - not limit/offset
    const queryParams: Record<string, any> = { 'type[]': 'release' };
    if (params.release_group_id) queryParams.release_group_id = params.release_group_id;
    if (params.status) queryParams.status = params.status;
    if (params.date_from) queryParams.date_from = params.date_from;
    if (params.date_to) queryParams.date_to = params.date_to;

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/entities',
      params: queryParams,
    });

    const allReleases: any[] = Array.isArray((response as any)?.data) ? (response as any).data : [];
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const releases = allReleases.slice(offset, offset + limit);

    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

    const formatted = releases.map((r: any, i: number) =>
      `${offset + i + 1}. ${r.fields?.name || 'Untitled Release'}\n` +
      `   ID: ${r.id}\n` +
      `   Status: ${r.fields?.state?.name || r.fields?.status?.name || r.fields?.status || 'Unknown'}\n` +
      (r.fields?.release_date ? `   Date: ${r.fields.release_date}\n` : '') +
      (r.fields?.description ? `   Description: ${stripHtml(r.fields.description).substring(0, 150)}\n` : '')
    );

    const summary = releases.length > 0
      ? `Found ${allReleases.length} releases, showing ${releases.length}:\n\n` + formatted.join('\n')
      : 'No releases found.';

    return { content: [{ type: 'text', text: summary }] };
  }
}