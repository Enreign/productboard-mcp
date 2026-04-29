import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/index.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface LookupCustomersParams {
  query: string;
  archived?: boolean;
  limit?: number;
}

export class LookupCustomersTool extends BaseTool<LookupCustomersParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_customer_lookup',
      'Search for customers (users and companies) by name. Use this to check whether a person or company already exists in Productboard before creating a note or new customer. The API does literal substring matching against user and company names — it does not normalize spaces, casing variations, or punctuation. If results look incomplete or wrong, try alternate phrasings (a shorter or more distinctive substring, removing spaces, dropping punctuation) before concluding the customer is missing. For each matched company, also lists users belonging to it.',
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search string. Matches as a literal substring against user and company names — case-insensitive but exact on whitespace and punctuation. "empty kitchen" will match "Empty Kitchens, Full Hearts" but not "Emptykitchens.co"; "empty" will match both.',
          },
          archived: {
            type: 'boolean',
            default: false,
            description: 'Include archived customers (default false)',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 500,
            default: 50,
            description: 'Maximum number of search results (companies + users) to return',
          },
        },
        required: ['query'],
      },
      {
        requiredPermissions: [Permission.NOTES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to customer data',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: LookupCustomersParams): Promise<unknown> {
    const archived = params.archived ?? false;
    const queryParams: Record<string, any> = {
      'type[]': ['user', 'company'],
      name: params.query,
      archived,
    };

    const allResults = await this.apiClient.getAllPages<any>('/entities', queryParams);
    const limit = params.limit ?? 50;
    const results = allResults.slice(0, limit);

    const users = results.filter((e: any) => e.type === 'user');
    const companies = results.filter((e: any) => e.type === 'company');

    // For each matched company, fetch users that belong to it (parent[id])
    const usersByCompany = new Map<string, any[]>();
    await Promise.all(
      companies.map(async (c: any) => {
        const companyUsers = await this.apiClient.getAllPages<any>('/entities', {
          'type[]': 'user',
          'parent[id]': c.id,
          archived,
        });
        usersByCompany.set(c.id, companyUsers);
      })
    );

    // Build company id -> name map for users with parent company (used in fallback display)
    const companyById = new Map<string, string>();
    for (const c of companies) {
      companyById.set(c.id, c.fields?.name ?? '');
    }

    if (allResults.length === 0) {
      return {
        content: [{ type: 'text', text: `No customers found matching "${params.query}".` }],
      };
    }

    const lines: string[] = [
      `Found ${allResults.length} customer${allResults.length === 1 ? '' : 's'} matching "${params.query}", showing ${results.length}:`,
      '',
    ];

    if (companies.length > 0) {
      lines.push(`Companies (${companies.length}):`);
      companies.forEach((c, i) => {
        lines.push(`  ${i + 1}. ${c.fields?.name ?? ''}`);
        lines.push(`     ID: ${c.id}`);
        if (c.fields?.domain) lines.push(`     Domain: ${c.fields.domain}`);
        const companyUsers = usersByCompany.get(c.id) ?? [];
        if (companyUsers.length > 0) {
          lines.push(`     Users (${companyUsers.length}):`);
          companyUsers.forEach((u: any) => {
            const name = u.fields?.name ?? '';
            const email = u.fields?.email ?? '';
            lines.push(`       - ${name}${email ? `  (${email})` : ''}`);
          });
        } else {
          lines.push(`     Users: none`);
        }
      });
      lines.push('');
    }

    if (users.length > 0) {
      lines.push(`Users matching "${params.query}" (${users.length}):`);
      users.forEach((u, i) => {
        const name = u.fields?.name ?? '';
        const email = u.fields?.email ?? '';
        const parentCompanyId = u.relationships?.parent?.id;
        const parentCompanyName = parentCompanyId ? companyById.get(parentCompanyId) : undefined;
        lines.push(`  ${i + 1}. ${name}`);
        lines.push(`     ID: ${u.id}`);
        if (email) lines.push(`     Email: ${email}`);
        if (parentCompanyName) lines.push(`     Company: ${parentCompanyName}`);
      });
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  }
}
