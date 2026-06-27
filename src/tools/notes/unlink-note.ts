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
 * EXPERIMENTAL: remove a note<->feature link.
 *
 * The v2 relationship-delete contract is not yet confirmed. The link is
 * created via `POST /notes/{id}/relationships` with a target of the feature;
 * this tool attempts the symmetric `DELETE /notes/{id}/relationships/{featureId}`.
 * Note that update-note.ts historically claimed "the v2 API does not expose an
 * endpoint to remove note relationships" while src/api/endpoints.ts declares
 * `detachFromFeature: '/notes/:id/features/:featureId'`. Verify against a live
 * workspace and adjust the endpoint below if needed (it may instead require the
 * relationship's own id, discovered via a GET of the note's relationships).
 */
export class UnlinkNoteTool extends BaseTool<UnlinkNoteParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_unlink',
      'EXPERIMENTAL: remove a link between a note and a feature. Use when an insight was linked to the wrong feature. The exact v2 delete contract is unverified — confirm against your workspace before relying on it in automation.',
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
        `/notes/${params.id}/relationships/${params.feature_id}`
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
          `${err instanceof Error ? err.message : String(err)}. ` +
          `The v2 relationship-delete endpoint is unverified — see the note in unlink-note.ts.`,
      };
    }
  }
}
