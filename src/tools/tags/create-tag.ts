import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface CreateTagParams {
  names: string[];
  color?: string;
}

/**
 * Create tag options (select values on the default "tags" field) via the public
 * API: POST /entities/fields/tags/values with { data: { fields: { name, color? } } }.
 *
 * Tag options must exist before they can be attached to a note (pb_note_update
 * add_tags). This lets a vocabulary be seeded programmatically — e.g. the fixed
 * importance:* / sentiment:* namespaces, or new theme:* labels — instead of
 * creating them by hand in the UI. Safe to call with names that already exist:
 * a conflict is reported as "exists", not a failure.
 */
export class CreateTagTool extends BaseTool<CreateTagParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_tag_create',
      'Create one or more tag options (values on the "tags" field) so they can be attached to notes. Accepts a batch of names — useful for seeding a namespaced vocabulary like "importance:critical", "sentiment:frustrated", "theme:invoice-coding-ux". Names that already exist are reported as existing, not errors.',
      {
        type: 'object',
        required: ['names'],
        properties: {
          names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tag names to create (e.g. ["importance:critical", "sentiment:neutral"]).',
          },
          color: {
            type: 'string',
            description: 'Optional color for the tags (red, blue, green, yellow, purple, gray, lime, pink). If omitted, Productboard assigns one.',
          },
        },
      },
      {
        requiredPermissions: [Permission.NOTES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: CreateTagParams): Promise<unknown> {
    const created: { name: string; id?: string }[] = [];
    const existing: string[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const name of params.names) {
      const fields: Record<string, unknown> = { name };
      if (params.color) fields.color = params.color;
      try {
        const res = await this.apiClient.post<{ data?: { id?: string } }>(
          '/entities/fields/tags/values',
          { data: { fields } }
        );
        created.push({ name, id: (res as any)?.data?.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // A uniqueness conflict means the option already exists — that's fine.
        if (/409|conflict|already exists|unique/i.test(msg)) {
          existing.push(name);
        } else {
          failed.push({ name, error: msg });
        }
      }
    }

    const summary = [
      created.length ? `Created ${created.length}: ${created.map((c) => c.name).join(', ')}` : null,
      existing.length ? `Already existed ${existing.length}: ${existing.join(', ')}` : null,
      failed.length ? `Failed ${failed.length}: ${failed.map((f) => `${f.name} (${f.error})`).join('; ')}` : null,
    ].filter(Boolean).join('\n');

    return {
      success: failed.length === 0,
      data: { created, existing, failed },
      summary: summary || 'No tags provided.',
    };
  }
}
