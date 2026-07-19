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
  add_tags?: string[];
  remove_tags?: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UpdateNoteTool extends BaseTool<UpdateNoteParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_update',
      'Update an existing note: link it to features, add/remove tags, and/or mark it processed. Use this once you\'ve extracted insights from a note and identified which features it relates to. Tags are additive by default (add_tags / remove_tags) so existing tags are preserved. Missing tag options are created automatically, so namespaced labels like "importance:critical", "sentiment:neutral", or "theme:offline-payment-improvements" attach on first use.',
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
            description: 'List of feature UUIDs to link to this note. Each one is added (existing links are not removed). Use pb_note_unlink to remove a link.',
          },
          add_tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tag names to add to the note (additive — existing tags are preserved). Missing options are auto-created. Useful for namespaced labels such as "importance:critical", "sentiment:frustrated", "theme:invoice-export-reliability".',
          },
          remove_tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tag names to remove from the note.',
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

  /**
   * Ensure each tag name exists as an option on the "tags" field so it can be
   * attached. Creating an option that already exists is ignored (conflict).
   * Errors here are non-fatal — the subsequent addItems patch will surface any
   * genuine problem.
   */
  private async ensureTagsExist(names: string[]): Promise<void> {
    for (const name of names) {
      try {
        await this.apiClient.post('/entities/fields/tags/values', {
          data: { fields: { name } },
        });
      } catch {
        // Already exists or non-fatal — attach step validates.
      }
    }
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
    const addTags = params.add_tags ?? [];
    const removeTags = params.remove_tags ?? [];

    if (
      Object.keys(fields).length === 0 &&
      linkIds.length === 0 &&
      addTags.length === 0 &&
      removeTags.length === 0
    ) {
      return {
        success: false,
        error:
          'Nothing to update. Provide at least one of: processed, archived, name, owner_email, owner_id, link_feature_ids, add_tags, remove_tags.',
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

    // 2. Apply tag changes in their own PATCH using v2 JSON-patch operations.
    //    Missing options are auto-created first (ensureTagsExist) so new
    //    namespaced tags attach on first use. Additive list edits go through a
    //    `data.patch` array of {op,path,value} operations — NOT
    //    `data.fields.tags={addItems}`. Kept separate from the scalar-field
    //    PATCH because v2 forbids sending both `data.fields` and `data.patch`
    //    in one request, and so a tag failure never flips `processed` on its own.
    let tagsApplied = false;
    if (addTags.length > 0 || removeTags.length > 0) {
      if (addTags.length > 0) {
        await this.ensureTagsExist(addTags);
      }
      const patchOps: Array<Record<string, unknown>> = [];
      if (addTags.length > 0) {
        patchOps.push({ op: 'addItems', path: 'tags', value: addTags.map((name) => ({ name })) });
      }
      if (removeTags.length > 0) {
        patchOps.push({ op: 'removeItems', path: 'tags', value: removeTags.map((name) => ({ name })) });
      }
      try {
        await this.apiClient.patch(`/notes/${params.id}`, {
          data: { type: 'textNote', patch: patchOps },
        });
        tagsApplied = true;
        const parts: string[] = [];
        if (addTags.length > 0) parts.push(`added [${addTags.join(', ')}]`);
        if (removeTags.length > 0) parts.push(`removed [${removeTags.join(', ')}]`);
        summary.push(`Tags ${parts.join('; ')}`);
      } catch (err) {
        summary.push(
          `Failed to update tags: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 3. PATCH scalar fields only if all linking succeeded. If any link failed
    //    and fields were also requested, skip the PATCH so processed=true isn't
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
              tagsApplied,
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
        addedTags: tagsApplied ? addTags : [],
        removedTags: tagsApplied ? removeTags : [],
      },
      summary: summary.join('\n'),
    };
  }
}
