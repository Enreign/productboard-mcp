import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface SearchNotesParams {
  feature_id?: string;
  customer_id?: string;
  tag?: string;
  processed?: boolean;
  archived?: boolean;
  created_from?: string;
  created_to?: string;
  limit?: number;
}

const stripHtml = (s: string): string =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export class SearchNotesTool extends BaseTool<SearchNotesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_search',
      'Search for notes filtered by their relationships (linked feature, linked customer) and/or attributes (tag, processed, created date). Use this to answer questions like "what insights are tagged to feature X?" (pass feature_id), "what has customer Y told us?" (pass customer_id, works for both user and company UUIDs), or "has anyone from this company given feedback on this feature?" (pass both). For finding unprocessed notes to work through, use pb_note_list instead — that one is for working the queue, this one is for investigating a specific relationship.',
      {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Filter to notes linked to this feature, component, or subfeature UUID.',
          },
          customer_id: {
            type: 'string',
            description: 'Filter to notes linked to this user or company UUID. Use pb_customer_lookup first to find the UUID.',
          },
          tag: {
            type: 'string',
            description: 'Filter to notes with this tag.',
          },
          processed: {
            type: 'boolean',
            description: 'Filter by processed state.',
          },
          archived: {
            type: 'boolean',
            description: 'Include archived notes (default false).',
          },
          created_from: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes created from this date-time onwards.',
          },
          created_to: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes created up to this date-time.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 200,
            default: 20,
            description: 'Maximum number of notes to return (default 20).',
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

  protected async executeInternal(params: SearchNotesParams = {}): Promise<unknown> {
    const filter: Record<string, any> = {};

    if (params.feature_id) {
      filter.relationships ??= {};
      filter.relationships.link = [{ id: params.feature_id }];
    }
    if (params.customer_id) {
      filter.relationships ??= {};
      filter.relationships.customer = [{ id: params.customer_id }];
    }
    if (params.tag) {
      filter.fields ??= {};
      filter.fields.tag = params.tag;
    }
    if (params.processed !== undefined) {
      filter.fields ??= {};
      filter.fields.processed = params.processed;
    }
    if (params.archived !== undefined) {
      filter.fields ??= {};
      filter.fields.archived = params.archived;
    }
    if (params.created_from || params.created_to) {
      filter.createdAt = {};
      if (params.created_from) filter.createdAt.from = params.created_from;
      if (params.created_to) filter.createdAt.to = params.created_to;
    }

    if (Object.keys(filter).length === 0) {
      return {
        success: false,
        error:
          'At least one filter is required. Provide feature_id, customer_id, tag, processed, archived, or a date range. For an unfiltered listing, use pb_note_list.',
      };
    }

    const limit = params.limit ?? 20;

    const response = await this.apiClient.post('/notes/search', {
      data: { filter },
    });

    const allNotes: any[] = (response as any).data ?? [];
    const notes = allNotes.slice(0, limit);

    const formatted = notes.map((n: any) => {
      const rels = n.relationships?.data ?? [];
      const customers = rels
        .filter((r: any) => r.type === 'customer')
        .map((r: any) => r.target?.id)
        .filter(Boolean);
      const linkedFeatures = rels
        .filter((r: any) => r.type === 'link')
        .map((r: any) => ({
          id: r.target?.id,
          type: r.target?.type,
        }))
        .filter((f: any) => f.id);

      const rawContent = n.fields?.content ? stripHtml(n.fields.content) : '';
      const title =
        n.fields?.name?.trim() ||
        (rawContent ? rawContent.slice(0, 60) : 'Untitled note');

      return {
        id: n.id,
        title,
        content: rawContent,
        owner: n.fields?.owner?.email ?? null,
        createdAt: n.createdAt,
        processed: n.fields?.processed ?? null,
        customers,
        linkedFeatures,
      };
    });

    if (notes.length === 0) {
      return {
        content: [
          { type: 'text', text: 'No notes matched the supplied filters.' },
        ],
      };
    }

    const lines: string[] = [
      `Found ${allNotes.length} note${allNotes.length === 1 ? '' : 's'}, showing ${notes.length}:`,
      '',
    ];

    for (const [i, n] of formatted.entries()) {
      lines.push(`${i + 1}. ${n.title}`);
      lines.push(`   ID: ${n.id}`);
      lines.push(`   Created: ${n.createdAt}`);
      if (n.processed !== null) lines.push(`   Processed: ${n.processed}`);
      if (n.owner) lines.push(`   Owner: ${n.owner}`);
      if (n.customers.length > 0)
        lines.push(`   Customer IDs: ${n.customers.join(', ')}`);
      if (n.linkedFeatures.length > 0) {
        const linkStrs = n.linkedFeatures.map(
          (f: any) => `${f.type}:${f.id}`,
        );
        lines.push(`   Linked: ${linkStrs.join(', ')}`);
      }
      lines.push(`   Content: ${n.content}`);
      lines.push('');
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }
}
