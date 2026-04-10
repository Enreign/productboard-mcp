import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListNotesParams {
  processed?: boolean;
  archived?: boolean;
  owner_email?: string;
  owner_id?: string;
  creator_email?: string;
  creator_id?: string;
  source_record_id?: string;
  metadata_source_system?: string;
  metadata_source_record_id?: string;
  created_from?: string;
  created_to?: string;
  updated_from?: string;
  updated_to?: string;
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
          processed: {
            type: 'boolean',
            description: 'Filter by processed state',
          },
          archived: {
            type: 'boolean',
            description: 'Filter by archived state. Note: archived notes always return processed=false regardless of actual state',
          },
          owner_email: {
            type: 'string',
            description: 'Filter by owner email address',
          },
          owner_id: {
            type: 'string',
            description: 'Filter by owner ID',
          },
          creator_email: {
            type: 'string',
            description: 'Filter by creator email address',
          },
          creator_id: {
            type: 'string',
            description: 'Filter by creator ID',
          },
          source_record_id: {
            type: 'string',
            description: 'Filter by source record ID',
          },
          metadata_source_system: {
            type: 'string',
            description: 'Filter by metadata source system',
          },
          metadata_source_record_id: {
            type: 'string',
            description: 'Filter by metadata source record ID',
          },
          created_from: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes created from this date-time',
          },
          created_to: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes created up to this date-time',
          },
          updated_from: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes updated from this date-time',
          },
          updated_to: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes updated up to this date-time',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 5000,
            default: 100,
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

    const queryParams: Record<string, any> = {};

    if (params.processed !== undefined) queryParams.processed = params.processed;
    if (params.archived !== undefined) queryParams.archived = params.archived;
    if (params.owner_email) queryParams['owner[email]'] = params.owner_email;
    if (params.owner_id) queryParams['owner[id]'] = params.owner_id;
    if (params.creator_email) queryParams['creator[email]'] = params.creator_email;
    if (params.creator_id) queryParams['creator[id]'] = params.creator_id;
    if (params.source_record_id) queryParams['source[recordId]'] = params.source_record_id;
    if (params.metadata_source_system) queryParams['metadata[source][system]'] = params.metadata_source_system;
    if (params.metadata_source_record_id) queryParams['metadata[source][recordId]'] = params.metadata_source_record_id;
    if (params.created_from) queryParams.createdFrom = params.created_from;
    if (params.created_to) queryParams.createdTo = params.created_to;
    if (params.updated_from) queryParams.updatedFrom = params.updated_from;
    if (params.updated_to) queryParams.updatedTo = params.updated_to;

    const allNotes = await this.apiClient.getAllPages<any>('/notes', queryParams);
    const limit = params.limit || 100;
    const notes = allNotes.slice(0, limit);

    const stripHtml = (s: string) => s
      .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

    // Format response for MCP protocol
    const formattedNotes = notes.map((note: any) => ({
      id: note.id,
      title: note.fields?.name || (note.fields?.content ? stripHtml(note.fields.content).substring(0, 60) : 'Untitled Note'),
      content: note.fields?.content ? stripHtml(note.fields.content) : '',
      owner: note.fields?.owner?.email || 'Unknown',
      createdAt: note.createdAt,
      tags: note.fields?.tags || [],
    }));

    // Create a text summary of the notes
    const summary = formattedNotes.length > 0
      ? `Found ${allNotes.length} notes total, showing ${formattedNotes.length}:\n\n` +
        formattedNotes.map((n, i) =>
          `${i + 1}. ${n.title}\n` +
          `   Owner: ${n.owner}\n` +
          `   Content: ${n.content}\n` +
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