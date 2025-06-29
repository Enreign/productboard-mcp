import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface CreateNoteParams {
  content: string;
  title?: string;
  customer_email?: string;
  company_name?: string;
  source?: 'email' | 'call' | 'meeting' | 'survey' | 'support' | 'social';
  tags?: string[];
  feature_ids?: string[];
}

export class CreateNoteTool extends BaseTool<CreateNoteParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_create',
      'Create a customer feedback note',
      {
        type: 'object',
        required: ['content'],
        properties: {
          content: {
            type: 'string',
            description: 'Note content (customer feedback)',
          },
          title: {
            type: 'string',
            description: 'Note title/summary',
          },
          customer_email: {
            type: 'string',
            format: 'email',
            description: 'Customer email address',
          },
          company_name: {
            type: 'string',
            description: 'Customer company name',
          },
          source: {
            type: 'string',
            enum: ['email', 'call', 'meeting', 'survey', 'support', 'social'],
            description: 'Feedback source',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Feature IDs to link this note to',
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

  protected async executeInternal(params: CreateNoteParams): Promise<ToolExecutionResult> {
    this.logger.info('Creating note');

    try {
      const response = await this.apiClient.post('/notes', params);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to create note', error);
      
      return {
        success: false,
        error: `Failed to create note: ${(error as Error).message}`,
      };
    }
  }
}