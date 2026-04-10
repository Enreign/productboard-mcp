import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface CreateNoteParams {
  content: string;
  title?: string;
  customer_email?: string;
  customer_name?: string;
  company_name?: string;
  feature_ids?: string[];
  tags?: string[];
  source?: {
    origin?: string;
    record_id?: string;
    url?: string;
  };
  create_if_missing?: boolean;
}

export class CreateNoteTool extends BaseTool<CreateNoteParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_note_create',
      'Create a customer feedback note with automatic customer/company lookup',
      {
        type: 'object',
        required: ['content'],
        properties: {
          content: {
            type: 'string',
            description: 'Note content (supports HTML)',
          },
          title: {
            type: 'string',
            description: 'Note title/summary',
          },
          customer_email: {
            type: 'string',
            format: 'email',
            description: 'Customer email — used to look up existing user and company',
          },
          customer_name: {
            type: 'string',
            description: 'Customer display name (used if creating a new user)',
          },
          company_name: {
            type: 'string',
            description: 'Company name (used if creating a new company)',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Feature UUIDs to link this note to',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tag names to apply (must already exist in workspace)',
          },
          source: {
            type: 'object',
            properties: {
              origin: { type: 'string', description: 'Source system identifier' },
              record_id: { type: 'string', description: 'External record ID' },
              url: { type: 'string', description: 'URL back to source' },
            },
            description: 'Source metadata for audit trail',
          },
          create_if_missing: {
            type: 'boolean',
            default: false,
            description: 'If true, create user and company when no exact email match is found',
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

  protected async executeInternal(params: CreateNoteParams): Promise<unknown> {
    this.logger.info('Creating note');

    let customerId: string | undefined;
    let customerType: string | undefined;
    let companyId: string | undefined;

    if (params.customer_email) {
      const lookup = await this.lookupCustomer(params.customer_email, params.customer_name);

      if (lookup.userId) {
        customerId = lookup.userId;
        customerType = 'user';
        companyId = lookup.companyId;
      } else if (!params.create_if_missing) {
        return {
          content: [{
            type: 'text',
            text: `No user found with email "${params.customer_email}". ` +
              `To create the user${params.company_name ? ` and company "${params.company_name}"` : ''} ` +
              `and then create the note, call again with create_if_missing: true.`,
          }],
        };
      } else {
        const created = await this.createCustomerIfNeeded(params);
        customerId = created.userId;
        customerType = 'user';
        companyId = created.companyId;
      }
    }

    const relationships: any[] = [];

    if (customerId && customerType) {
      relationships.push({
        type: 'customer',
        target: { id: customerId, type: customerType },
      });
    }

    if (params.feature_ids) {
      for (const featureId of params.feature_ids) {
        relationships.push({
          type: 'link',
          target: { id: featureId, type: 'link' },
        });
      }
    }

    const toHtml = (text: string): string => {
      if (text.startsWith('<')) return text;

      const lines = text.split('\n');
      const htmlParts: string[] = [];
      let listItems: string[] = [];

      const flushList = () => {
        if (listItems.length > 0) {
          htmlParts.push(`<ul>${listItems.map(li => `<li>${li}</li>`).join('')}</ul>`);
          listItems = [];
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          flushList();
          continue;
        }

        const bulletMatch = trimmed.match(/^[*\-]\s+(.*)/);
        if (bulletMatch) {
          listItems.push(bulletMatch[1]);
        } else {
          flushList();
          const formatted = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          htmlParts.push(`<p>${formatted}</p>`);
        }
      }
      flushList();

      return htmlParts.join('');
    };

    const fields: Record<string, unknown> = {
      name: params.title || params.content.slice(0, 100),
      content: toHtml(params.content),
    };

    if (params.tags && params.tags.length > 0) {
      fields.tags = params.tags.map(name => ({ name }));
    }

    if (params.source) {
      fields.source = {
        ...(params.source.origin && { origin: params.source.origin }),
        ...(params.source.record_id && { recordId: params.source.record_id }),
        ...(params.source.url && { url: params.source.url }),
      };
    }

    const body: Record<string, unknown> = {
      data: {
        type: 'textNote',
        fields,
        ...(relationships.length > 0 && { relationships }),
      },
    };

    const response = await this.apiClient.post('/notes', body);

    const summary = [
      `Note created successfully.`,
      customerId ? `Linked to customer: ${params.customer_email}` : null,
      companyId ? `Company: ${params.company_name || '(from existing user)'}` : null,
      params.feature_ids?.length ? `Linked to ${params.feature_ids.length} feature(s)` : null,
      params.tags?.length ? `Tags: ${params.tags.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    return {
      content: [{
        type: 'text',
        text: summary,
      }],
      data: response,
    };
  }

  private async lookupCustomer(
    email: string,
    customerName?: string,
  ): Promise<{ userId?: string; companyId?: string }> {
    const extractCompany = (user: any): string | undefined => {
      const parentRel = user.relationships?.data?.find(
        (r: any) => r.type === 'parent' && r.target?.type === 'company'
      );
      return parentRel?.target?.id;
    };

    // 1. Search by email local part, match on exact email
    const byEmail = await this.apiClient.getAllPages<any>('/entities', {
      'type[]': 'user',
      'name': email.split('@')[0],
    });

    const emailMatch = byEmail.find((u: any) => {
      const userEmail = u.fields?.email?.toLowerCase().replace(/dat$/, '');
      return userEmail === email.toLowerCase();
    });

    if (emailMatch) {
      return { userId: emailMatch.id, companyId: extractCompany(emailMatch) };
    }

    // 2. Fallback: search by customer name, but only match if the user
    //    has no email set (avoids matching a different person with the same name)
    if (customerName) {
      const byName = await this.apiClient.getAllPages<any>('/entities', {
        'type[]': 'user',
        'name': customerName,
      });

      const nameMatch = byName.find((u: any) =>
        !u.fields?.email &&
        u.fields?.name?.toLowerCase() === customerName.toLowerCase()
      );

      if (nameMatch) {
        return { userId: nameMatch.id, companyId: extractCompany(nameMatch) };
      }
    }

    return {};
  }

  private async createCustomerIfNeeded(
    params: CreateNoteParams,
  ): Promise<{ userId: string; companyId?: string }> {
    let companyId: string | undefined;

    if (params.company_name) {
      const companies = await this.apiClient.getAllPages<any>('/entities', {
        'type[]': 'company',
        'name': params.company_name,
      });

      const exactMatch = companies.find(
        (c: any) => c.fields?.name?.toLowerCase() === params.company_name!.toLowerCase()
      );

      if (exactMatch) {
        companyId = exactMatch.id;
      } else {
        const created = await this.apiClient.post('/entities', {
          data: { type: 'company', fields: { name: params.company_name } },
        });
        companyId = (created as any).data?.id;
      }
    }

    const userRelationships = companyId
      ? [{ type: 'parent', target: { id: companyId, type: 'company' } }]
      : undefined;

    const userFields: Record<string, string> = {
      name: params.customer_name || params.customer_email!,
      email: params.customer_email!,
    };

    const created = await this.apiClient.post('/entities', {
      data: {
        type: 'user',
        fields: userFields,
        ...(userRelationships && { relationships: userRelationships }),
      },
    });

    return { userId: (created as any).data?.id, companyId };
  }
}
