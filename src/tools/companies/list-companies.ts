import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ListCompaniesParams {
  search?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  industry?: string;
}

export class ListCompaniesTool extends BaseTool<ListCompaniesParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_company_list',
      'List customer companies',
      {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search in company names',
          },
          size: {
            type: 'string',
            enum: ['small', 'medium', 'large', 'enterprise'],
            description: 'Filter by company size',
          },
          industry: {
            type: 'string',
            description: 'Filter by industry',
          },
        },
      },
      {
        requiredPermissions: [Permission.COMPANIES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to companies',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListCompaniesParams): Promise<unknown> {
    this.logger.info('Listing companies');

    const queryParams: Record<string, any> = {};
    if (params.search) queryParams.search = params.search;
    if (params.size) queryParams.size = params.size;
    if (params.industry) queryParams.industry = params.industry;

    const response = await this.apiClient.makeRequest({
      method: 'GET',
      endpoint: '/companies',
      params: queryParams,
    });

    return {
      success: true,
      data: {
        companies: (response as any)?.data || response,
        total: (response as any)?.data?.length || 0,
      },
    };
  }
}