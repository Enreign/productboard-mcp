import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListNotesParams {
  feature_id?: string;
  customer_email?: string;
  company_name?: string;
  tags?: string[];
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export class ListNotesTool extends BaseTool<ListNotesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_list',
      'List customer feedback notes',
      {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Filter notes linked to a specific feature',
          },
          customer_email: {
            type: 'string',
            description: 'Filter by customer email',
          },
          company_name: {
            type: 'string',
            description: 'Filter by company',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Filter notes created after this date',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'Filter notes created before this date',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      },
      {
        requiredPermissions: [Permission.NOTES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to notes',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListNotesParams = {}): Promise<unknown> {
    this.logger.info('Listing notes');

    const queryParams: Record<string, any> = {
      limit: params.limit || 20,
    };
    
    if (params.feature_id) queryParams.feature_id = params.feature_id;
    if (params.customer_email) queryParams.customer_email = params.customer_email;
    if (params.company_name) queryParams.company_name = params.company_name;
    if (params.tags) queryParams.tags = params.tags;
    if (params.date_from) queryParams.date_from = params.date_from;
    if (params.date_to) queryParams.date_to = params.date_to;

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/notes',
      params: queryParams,
    });

    // Extract notes data
    let notes: any[] = [];
    if (response && (response as any).data) {
      notes = (response as any).data;
    } else if (Array.isArray(response)) {
      notes = response;
    }
    
    // Format response for MCP protocol
    const formattedNotes = notes.map((note: any) => ({
      id: note.id,
      title: note.title || note.content?.substring(0, 50) || 'Untitled Note',
      content: note.content || '',
      customer: note.customer?.email || 'Unknown',
      company: note.company?.name || 'Unknown',
      createdAt: note.created_at || note.createdAt,
      tags: note.tags || [],
    }));
    
    // Create a text summary of the notes
    const summary = formattedNotes.length > 0
      ? `Found ${formattedNotes.length} notes:\n\n` +
        formattedNotes.map((n, i) => 
          `${i + 1}. ${n.title}\n` +
          `   Customer: ${n.customer}\n` +
          `   Company: ${n.company}\n` +
          `   Content: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}\n` +
          `   Tags: ${n.tags.length > 0 ? n.tags.join(', ') : 'None'}\n`
        ).join('\n')
      : 'No notes found.';
    
    // Return in MCP expected format
    return {
      content: [
        {
          type: 'text',
          text: summary
        }
      ]
    };
  }
}