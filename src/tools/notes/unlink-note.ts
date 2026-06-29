import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface UnlinkNoteParams {
  id: string;
  feature_id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Remove a note<->feature link.
 *
 * Links are created via `POST /notes/{id}/relationships` with
 * `{data:{type:"link",target:{id:featureId}}}`. The Productboard v2 Entities API
 * deletes a relationship at `DELETE /{id}/relationships/{type}/{targetId}` — the
 * `{type}` path segment is required. So the correct route is
 * `DELETE /notes/{id}/relationships/link/{featureId}`. (An earlier version
 * omitted the type segment and returned 404.)
 */
export class UnlinkNoteTool extends BaseTool<UnlinkNoteParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_unlink',
      'Remove a link between a note and a feature. Use when an insight was linked to the wrong feature.',
      {
        type: 'object',
        required: ['id', 'feature_id'],
        properties: {
          id: {
            type: 'string',
            description: 'Note UUID',
          },
          feature_id: {
            type: 'string',
            description: 'Feature UUID to unlink from the note',
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

  protected async executeInternal(params: UnlinkNoteParams): Promise<unknown> {
    if (!UUID_RE.test(params.id)) {
      return { success: false, error: `"${params.id}" is not a valid note UUID.` };
    }
    if (!UUID_RE.test(params.feature_id)) {
      return { success: false, error: `"${params.feature_id}" is not a valid feature UUID.` };
    }

    try {
      await this.apiClient.delete(
        `/notes/${params.id}/relationships/link/${params.feature_id}`
      );
      return {
        success: true,
        data: { id: params.id, unlinkedFeatureId: params.feature_id },
        summary: `Unlinked feature ${params.feature_id} from note ${params.id}.`,
      };
    } catch (err) {
      return {
        success: false,
        error:
          `Failed to unlink feature ${params.feature_id} from note ${params.id}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
