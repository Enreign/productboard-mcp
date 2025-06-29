import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ExportDataParams {
  export_type: 'features' | 'notes' | 'products' | 'objectives' | 'all';
  format: 'json' | 'csv' | 'xlsx';
  filters?: {
    date_from?: string;
    date_to?: string;
    product_ids?: string[];
    tags?: string[];
    status?: string[];
  };
  include_related?: boolean;
  email_to?: string;
}

export class ExportDataTool extends BaseTool<ExportDataParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_export',
      'Export Productboard data',
      {
        type: 'object',
        required: ['export_type', 'format'],
        properties: {
          export_type: {
            type: 'string',
            enum: ['features', 'notes', 'products', 'objectives', 'all'],
            description: 'Type of data to export',
          },
          format: {
            type: 'string',
            enum: ['json', 'csv', 'xlsx'],
            description: 'Export file format',
          },
          filters: {
            type: 'object',
            properties: {
              date_from: {
                type: 'string',
                format: 'date',
                description: 'Export data from this date',
              },
              date_to: {
                type: 'string',
                format: 'date',
                description: 'Export data until this date',
              },
              product_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by product IDs',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              status: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by status',
              },
            },
          },
          include_related: {
            type: 'boolean',
            default: true,
            description: 'Include related data (e.g., notes for features)',
          },
          email_to: {
            type: 'string',
            format: 'email',
            description: 'Email address to send the export to',
          },
        },
      },
      {
        requiredPermissions: [Permission.EXPORT_DATA],
        minimumAccessLevel: AccessLevel.ADMIN,
        description: 'Requires admin access for data export',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ExportDataParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Exporting data', { 
        type: params.export_type,
        format: params.format 
      });

      const requestData: any = {
        export_type: params.export_type,
        format: params.format,
        include_related: params.include_related !== false,
      };

      if (params.filters) {
        requestData.filters = params.filters;
      }

      if (params.email_to) {
        requestData.email_to = params.email_to;
      }

      const response = await this.apiClient.post('/export', requestData);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to export data', error);
      
      return {
        success: false,
        error: `Failed to export data: ${(error as Error).message}`,
      };
    }
  }
}