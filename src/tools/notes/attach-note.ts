import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface AttachNoteParams {
  note_id: string;
  feature_ids: string[];
}

export class AttachNoteTool extends BaseTool<AttachNoteParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_attach',
      'Link a note to one or more features',
      {
        type: 'object',
        required: ['note_id', 'feature_ids'],
        properties: {
          note_id: {
            type: 'string',
            description: 'Note ID',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Feature IDs to link the note to',
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

  protected async executeInternal(params: AttachNoteParams): Promise<unknown> {
    this.logger.info('Attaching note to features', {
      noteId: params.note_id,
      featureCount: params.feature_ids.length,
    });

    const response = await this.apiClient.makeRequest({
      method: 'POST',
      endpoint: `/notes/${params.note_id}/attach`,
      data: { feature_ids: params.feature_ids },
    });

    return {
      success: true,
      data: response,
    };
  }
}