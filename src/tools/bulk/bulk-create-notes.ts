import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface BulkNote {
  content: string;
  title?: string;
  customer_email?: string;
  company_name?: string;
  source?: 'email' | 'call' | 'meeting' | 'survey' | 'support' | 'social';
  tags?: string[];
  feature_ids?: string[];
}

interface BulkCreateNotesParams {
  notes: BulkNote[];
  batch_size?: number;
}

export class BulkCreateNotesTool extends BaseTool<BulkCreateNotesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_bulk_create',
      'Bulk create multiple customer notes',
      {
        type: 'object',
        required: ['notes'],
        properties: {
          notes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['content'],
              properties: {
                content: {
                  type: 'string',
                  description: 'Note content',
                },
                title: {
                  type: 'string',
                  description: 'Note title',
                },
                customer_email: {
                  type: 'string',
                  format: 'email',
                  description: 'Customer email',
                },
                company_name: {
                  type: 'string',
                  description: 'Company name',
                },
                source: {
                  type: 'string',
                  enum: ['email', 'call', 'meeting', 'survey', 'support', 'social'],
                  description: 'Feedback source',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Note tags',
                },
                feature_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Features to link',
                },
              },
            },
            minItems: 1,
            maxItems: 100,
            description: 'Notes to create',
          },
          batch_size: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Number of notes to create per batch',
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

  protected async executeInternal(params: BulkCreateNotesParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Bulk creating notes', { count: params.notes.length });

      const batchSize = params.batch_size || 10;
      const results = [];
      const errors = [];

      for (let i = 0; i < params.notes.length; i += batchSize) {
        const batch = params.notes.slice(i, i + batchSize);
        
        try {
          const response = await this.apiClient.post('/notes/bulk', {
            notes: batch,
          });
          
          results.push(...(response as any).created);
        } catch (error) {
          this.logger.error(`Failed to create batch ${i / batchSize + 1}`, error);
          errors.push({
            batch: i / batchSize + 1,
            error: (error as Error).message,
          });
        }
      }

      return {
        success: errors.length === 0,
        data: {
          created: results,
          total_created: results.length,
          total_requested: params.notes.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    } catch (error) {
      this.logger.error('Failed to bulk create notes', error);
      
      return {
        success: false,
        error: `Failed to bulk create notes: ${(error as Error).message}`,
      };
    }
  }
}