import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListTagsParams {
  prefix?: string;
}

interface TagValue {
  id: string;
  fields?: { name?: string; color?: string };
  name?: string;
}

/**
 * List tag options (values on the default "tags" field) via
 * GET /entities/fields/tags/values. Supports an optional case-insensitive
 * name prefix filter (applied client-side) so callers can check a namespace
 * such as "importance:" or "theme:" before attaching tags to a note.
 */
export class ListTagsTool extends BaseTool<ListTagsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_tag_list',
      'List existing tag options (values on the "tags" field). Optional `prefix` filters by name prefix (e.g. "importance:", "theme:"). Use to verify which tag vocabulary already exists before attaching tags to notes.',
      {
        type: 'object',
        properties: {
          prefix: {
            type: 'string',
            description: 'Optional case-insensitive name prefix to filter by (e.g. "theme:").',
          },
        },
      },
      {
        requiredPermissions: [Permission.NOTES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListTagsParams): Promise<unknown> {
    const values = await this.apiClient.getAllPages<TagValue>('/entities/fields/tags/values');

    const names = values
      .map((v) => v.fields?.name ?? v.name)
      .filter((n): n is string => typeof n === 'string');

    const filtered = params.prefix
      ? names.filter((n) => n.toLowerCase().startsWith(params.prefix!.toLowerCase()))
      : names;

    filtered.sort((a, b) => a.localeCompare(b));

    return {
      success: true,
      data: { count: filtered.length, tags: filtered },
      summary: `${filtered.length} tag${filtered.length === 1 ? '' : 's'}${params.prefix ? ` matching "${params.prefix}"` : ''}: ${filtered.join(', ')}`,
    };
  }
}
