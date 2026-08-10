import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListFeaturesParams {
  name?: string;
  status_name?: string;
  status_id?: string;
  owner_email?: string;
  owner_id?: string;
  parent_id?: string;
  metadata_source_system?: string;
  metadata_source_record_id?: string;
  archived?: boolean;
  compact?: boolean;
  limit?: number;
  offset?: number;
}

export class ListFeaturesTool extends BaseTool<ListFeaturesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_list',
      'List features with optional filtering and pagination. Returns each feature\'s status (name + id) and external source (e.g. its Jira issue key) so a sync can work from one call instead of fetching every feature individually. Filter by metadata_source_system="Jira" to get only Jira-linked features.',
      {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Filter by feature name',
          },
          status_name: {
            type: 'string',
            description: 'Filter by status name (e.g. "Scoping", "Development", "Released")',
          },
          status_id: {
            type: 'string',
            description: 'Filter by status UUID',
          },
          owner_email: {
            type: 'string',
            description: 'Filter by owner email',
          },
          owner_id: {
            type: 'string',
            description: 'Filter by owner UUID',
          },
          parent_id: {
            type: 'string',
            description: 'Filter by parent entity UUID (e.g. product or component ID)',
          },
          metadata_source_system: {
            type: 'string',
            description: 'Filter by external source system set on the feature (e.g. "Jira"). Use to select only features that have been linked to an external record.',
          },
          metadata_source_record_id: {
            type: 'string',
            description: 'Filter by external source record ID (e.g. a Jira issue key like "INT-4254").',
          },
          archived: {
            type: 'boolean',
            default: false,
            description: 'Include archived features (default false)',
          },
          compact: {
            type: 'boolean',
            default: false,
            description: 'Omit descriptions from the output. Useful when listing many features and only status/source matter.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 5000,
            default: 100,
            description: 'Maximum number of features to return',
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of features to skip',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListFeaturesParams): Promise<unknown> {
    // Build query parameters for v2 /entities endpoint
    const queryParams: Record<string, any> = { 'type[]': 'feature' };

    if (params.name) queryParams.name = params.name;
    if (params.status_name) queryParams['status[name]'] = params.status_name;
    if (params.status_id) queryParams['status[id]'] = params.status_id;
    if (params.owner_email) queryParams['owner[email]'] = params.owner_email;
    if (params.owner_id) queryParams['owner[id]'] = params.owner_id;
    if (params.parent_id) queryParams['parent[id]'] = params.parent_id;
    if (params.metadata_source_system) {
      queryParams['metadata[source][system]'] = params.metadata_source_system;
    }
    if (params.metadata_source_record_id) {
      queryParams['metadata[source][recordId]'] = params.metadata_source_record_id;
    }
    queryParams.archived = params.archived ?? false;

    const allFeatures = await this.apiClient.getAllPages<any>('/entities', queryParams);

    // Apply client-side pagination if requested
    const requestedLimit = params.limit || 100;
    const requestedOffset = params.offset || 0;
    const paginatedFeatures = allFeatures.slice(requestedOffset, requestedOffset + requestedLimit);

    // Helper function to strip HTML tags
    const stripHtml = (html: string): string => {
      return html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/&lt;/g, '<')   // Replace HTML entities
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();
    };

    // Format response for MCP protocol
    const formattedFeatures = paginatedFeatures.map((feature: any) => ({
      id: feature.id,
      name: feature.fields?.name || 'Untitled Feature',
      description: feature.fields?.description ? stripHtml(feature.fields.description) : '',
      status: feature.fields?.status?.name || 'Unknown',
      statusId: feature.fields?.status?.id || null,
      owner: feature.fields?.owner?.email || 'Unassigned',
      sourceSystem: feature.metadata?.source?.system || null,
      sourceRecordId: feature.metadata?.source?.recordId || null,
      createdAt: feature.createdAt,
      updatedAt: feature.updatedAt,
    }));

    // Create a text summary of the features
    const summary = formattedFeatures.length > 0
      ? `Found ${allFeatures.length} features total, showing ${formattedFeatures.length} features:\n\n` +
        formattedFeatures.map((f, i) => {
          const lines = [
            `${i + 1}. ${f.name}`,
            `   ID: ${f.id}`,
            `   Status: ${f.status}${f.statusId ? ` (${f.statusId})` : ''}`,
            `   Owner: ${f.owner}`,
          ];
          if (f.sourceRecordId) {
            lines.push(`   Source: ${f.sourceSystem || 'unknown'} ${f.sourceRecordId}`);
          }
          if (!params.compact) {
            lines.push(
              `   Description: ${f.description ? f.description.substring(0, 200) + (f.description.length > 200 ? '...' : '') : 'No description'}`
            );
          }
          return lines.join('\n') + '\n';
        }).join('\n')
      : 'No features found.';

    // Return in MCP expected format
    return {
      content: [
        {
          type: 'text',
          text: summary
        }
      ]
    };
  }
}
