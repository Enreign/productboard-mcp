import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface NoteFeatureAttachment {
  note_id: string;
  feature_ids: string[];
}

interface BulkAttachNotesParams {
  attachments: NoteFeatureAttachment[];
  batch_size?: number;
}

export class BulkAttachNotesTool extends BaseTool<BulkAttachNotesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_bulk_attach',
      'Bulk attach notes to features',
      {
        type: 'object',
        required: ['attachments'],
        properties: {
          attachments: {
            type: 'array',
            items: {
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
                  description: 'Feature IDs to attach',
                },
              },
            },
            minItems: 1,
            maxItems: 100,
            description: 'Note-feature attachments',
          },
          batch_size: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Number of attachments to process per batch',
          },
        },
      },
      {
        requiredPermissions: [Permission.BULK_OPERATIONS],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access for bulk operations',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: BulkAttachNotesParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Bulk attaching notes to features', { count: params.attachments.length });

      const batchSize = params.batch_size || 10;
      const results = {
        attached: [] as { note_id: string; feature_ids: string[] }[],
        failed: [] as { note_id: string; error: string }[],
      };

      for (let i = 0; i < params.attachments.length; i += batchSize) {
        const batch = params.attachments.slice(i, i + batchSize);
        
        for (const attachment of batch) {
          try {
            await this.apiClient.post(`/notes/${attachment.note_id}/features`, {
              feature_ids: attachment.feature_ids,
            });
            
            results.attached.push({
              note_id: attachment.note_id,
              feature_ids: attachment.feature_ids,
            });
          } catch (error) {
            this.logger.error(`Failed to attach note ${attachment.note_id}`, error);
            results.failed.push({
              note_id: attachment.note_id,
              error: (error as Error).message,
            });
          }
        }
      }

      return {
        success: results.failed.length === 0,
        data: {
          attached: results.attached,
          total_attached: results.attached.length,
          total_failed: results.failed.length,
          failed: results.failed.length > 0 ? results.failed : undefined,
        },
      };
    } catch (error) {
      this.logger.error('Failed to bulk attach notes', error);
      
      return {
        success: false,
        error: `Failed to bulk attach notes: ${(error as Error).message}`,
      };
    }
  }
}