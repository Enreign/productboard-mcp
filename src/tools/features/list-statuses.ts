import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListStatusesParams {
  entity_type?: string;
}

interface StatusValue {
  id: string;
  fields?: { name?: string; assignedEntityTypes?: string[] };
  name?: string;
}

/**
 * List the allowed values of the Status field via
 * GET /entities/fields/status/values (optionally scoped by entity type).
 *
 * `pb_feature_update` requires a `status_id` (UUID), but callers naturally know
 * the status by name ("Scoping", "Development", "Released"). This tool returns
 * the id↔name pairs so a workflow can resolve names to ids at runtime rather
 * than hardcoding UUIDs that differ per workspace.
 */
export class ListStatusesTool extends BaseTool<ListStatusesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_status_list',
      'List the available workflow Status values for features (id + name), e.g. Backlog, Scoping, Design, Development, QA, In beta, Release Ready, Released. Use this to resolve a status name to the status_id required by pb_feature_update.',
      {
        type: 'object',
        properties: {
          entity_type: {
            type: 'string',
            description: 'Entity type to scope statuses to (default "feature"). Status sets can differ per entity type.',
            default: 'feature',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListStatusesParams): Promise<unknown> {
    const entityType = params.entity_type ?? 'feature';

    const values = await this.apiClient.getAllPages<StatusValue>(
      '/entities/fields/status/values',
      { 'assignedEntityType[]': entityType }
    );

    const statuses = values
      .map((v) => ({ id: v.id, name: v.fields?.name ?? v.name }))
      .filter((s): s is { id: string; name: string } => typeof s.name === 'string');

    return {
      success: true,
      data: { entity_type: entityType, count: statuses.length, statuses },
      summary:
        `${statuses.length} status value${statuses.length === 1 ? '' : 's'} for ${entityType}:\n` +
        statuses.map((s) => `- ${s.name} (${s.id})`).join('\n'),
    };
  }
}
