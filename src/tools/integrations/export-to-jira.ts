import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface ExportToJiraParams {
  feature_ids: string[];
  jira_project_key: string;
  issue_type?: 'Story' | 'Task' | 'Bug' | 'Epic';
  create_options?: {
    include_description?: boolean;
    include_attachments?: boolean;
    include_notes_as_comments?: boolean;
    link_back_to_productboard?: boolean;
  };
  field_mapping?: {
    priority?: Record<string, string>;
    custom_fields?: Record<string, string>;
  };
}

export class ExportToJiraTool extends BaseTool<ExportToJiraParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_to_jira',
      'Export features to JIRA as issues',
      {
        type: 'object',
        required: ['feature_ids', 'jira_project_key'],
        properties: {
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Feature IDs to export',
          },
          jira_project_key: {
            type: 'string',
            description: 'Target JIRA project key',
          },
          issue_type: {
            type: 'string',
            enum: ['Story', 'Task', 'Bug', 'Epic'],
            default: 'Story',
            description: 'JIRA issue type',
          },
          create_options: {
            type: 'object',
            properties: {
              include_description: {
                type: 'boolean',
                default: true,
                description: 'Include feature description',
              },
              include_attachments: {
                type: 'boolean',
                default: false,
                description: 'Include attachments',
              },
              include_notes_as_comments: {
                type: 'boolean',
                default: true,
                description: 'Convert notes to JIRA comments',
              },
              link_back_to_productboard: {
                type: 'boolean',
                default: true,
                description: 'Add link back to Productboard',
              },
            },
          },
          field_mapping: {
            type: 'object',
            properties: {
              priority: {
                type: 'object',
                description: 'Priority mapping',
              },
              custom_fields: {
                type: 'object',
                description: 'Custom field mapping',
              },
            },
          },
        },
      },
      {
        requiredPermissions: [Permission.INTEGRATIONS_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to integrations',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ExportToJiraParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Exporting features to JIRA', { 
        count: params.feature_ids.length,
        project: params.jira_project_key 
      });

      const response = await this.apiClient.post('/integrations/jira/export', {
        feature_ids: params.feature_ids,
        jira_project_key: params.jira_project_key,
        issue_type: params.issue_type || 'Story',
        options: params.create_options || {
          include_description: true,
          include_notes_as_comments: true,
          link_back_to_productboard: true,
        },
        field_mapping: params.field_mapping,
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to export to JIRA', error);
      
      return {
        success: false,
        error: `Failed to export to JIRA: ${(error as Error).message}`,
      };
    }
  }
}