import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface UpdateNoteParams {
  id: string;
  processed?: boolean;
  archived?: boolean;
  name?: string;
  owner_email?: string;
  owner_id?: string;
  link_feature_ids?: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UpdateNoteTool extends BaseTool<UpdateNoteParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_update',
      'Update an existing note: link it to features and/or mark it processed. Use this once you\'ve extracted insights from a note and identified which features it relates to.',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Note UUID',
          },
          processed: {
            type: 'boolean',
            description: 'Set the note\'s processed flag (true to mark processed, false to mark unprocessed).',
          },
          archived: {
            type: 'boolean',
            description: 'Set the note\'s archived flag.',
          },
          name: {
            type: 'string',
            description: 'New title for the note.',
          },
          owner_email: {
            type: 'string',
            description: 'Reassign the note to an owner by email.',
          },
          owner_id: {
            type: 'string',
            description: 'Reassign the note to an owner by user UUID.',
          },
          link_feature_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of feature UUIDs to link to this note. Each one is added (existing links are not removed). The Productboard v2 API does not expose an endpoint to remove note relationships.',
          },
        },
      },
      {
        requiredPermissions: [Permission.NOTES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to notes',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: UpdateNoteParams): Promise<unknown> {
    if (!UUID_RE.test(params.id)) {
      return {
        success: false,
        error: `"${params.id}" is not a valid note UUID.`,
      };
    }

    const fields: Record<string, unknown> = {};
    if (params.processed !== undefined) fields.processed = params.processed;
    if (params.archived !== undefined) fields.archived = params.archived;
    if (params.name !== undefined) fields.name = params.name;
    if (params.owner_email !== undefined) fields.owner = { email: params.owner_email };
    if (params.owner_id !== undefined) fields.owner = { id: params.owner_id };

    const linkIds = params.link_feature_ids ?? [];

    if (Object.keys(fields).length === 0 && linkIds.length === 0) {
      return {
        success: false,
        error: 'Nothing to update. Provide at least one of: processed, archived, name, owner_email, owner_id, link_feature_ids.',
      };
    }

    const summary: string[] = [];

    // 1. POST a relationship per feature link first. If any link fails, we
    //    skip the field update so the note isn't marked processed for an
    //    incomplete linking. The v2 API doesn't support bulk add, so we
    //    issue one request per ID.
    const linked: string[] = [];
    const linkFailures: { id: string; error: string }[] = [];
    for (const featureId of linkIds) {
      if (!UUID_RE.test(featureId)) {
        linkFailures.push({ id: featureId, error: 'not a valid UUID' });
        continue;
      }
      try {
        await this.apiClient.post(`/notes/${params.id}/relationships`, {
          data: { type: 'link', target: { id: featureId, type: 'link' } },
        });
        linked.push(featureId);
      } catch (err) {
        linkFailures.push({
          id: featureId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (linked.length > 0) {
      summary.push(`Linked ${linked.length} feature${linked.length === 1 ? '' : 's'}: ${linked.join(', ')}`);
    }
    if (linkFailures.length > 0) {
      summary.push(
        `Failed to link ${linkFailures.length}: ${linkFailures
          .map((f) => `${f.id} (${f.error})`)
          .join('; ')}`
      );
    }

    // 2. PATCH fields only if all linking succeeded. If any link failed and
    //    fields were also requested, skip the PATCH so processed=true isn't
    //    set on a note whose feature linking was incomplete.
    let fieldsApplied = false;
    if (Object.keys(fields).length > 0) {
      if (linkFailures.length > 0) {
        summary.push(
          `Skipped field update (${Object.keys(fields).join(', ')}) because feature linking failed.`
        );
      } else {
        try {
          await this.apiClient.patch(`/notes/${params.id}`, {
            data: { type: 'textNote', fields },
          });
          fieldsApplied = true;
          const changed = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(', ');
          summary.push(`Updated fields: ${changed}`);
        } catch (err) {
          return {
            success: false,
            error: `Failed to update note fields: ${err instanceof Error ? err.message : String(err)}`,
            data: {
              id: params.id,
              linkedFeatureIds: linked,
              failedLinks: linkFailures,
            },
          };
        }
      }
    }

    return {
      success: linkFailures.length === 0,
      data: {
        id: params.id,
        updatedFields: fieldsApplied ? fields : {},
        linkedFeatureIds: linked,
        failedLinks: linkFailures,
      },
      summary: summary.join('\n'),
    };
  }
}
