import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '../../api/client.js';
import { Logger } from '../../utils/logger.js';
import { ToolExecutionResult } from '../../core/types.js';
import { Permission, AccessLevel } from '../../auth/permissions.js';

interface JiraSyncParams {
  action: 'import' | 'export' | 'sync';
  jira_project_key?: string;
  feature_ids?: string[];
  sync_options?: {
    sync_status?: boolean;
    sync_priority?: boolean;
    sync_assignee?: boolean;
    sync_comments?: boolean;
    create_missing?: boolean;
  };
  mapping?: {
    status_map?: Record<string, string>;
    priority_map?: Record<string, string>;
    custom_field_map?: Record<string, string>;
  };
}

export class JiraSyncTool extends BaseTool<JiraSyncParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_jira_sync',
      'Synchronize features with JIRA issues',
      {
        type: 'object',
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: ['import', 'export', 'sync'],
            description: 'Sync action to perform',
          },
          jira_project_key: {
            type: 'string',
            description: 'JIRA project key',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific feature IDs to sync',
          },
          sync_options: {
            type: 'object',
            properties: {
              sync_status: {
                type: 'boolean',
                default: true,
                description: 'Sync status between systems',
              },
              sync_priority: {
                type: 'boolean',
                default: true,
                description: 'Sync priority between systems',
              },
              sync_assignee: {
                type: 'boolean',
                default: false,
                description: 'Sync assignee between systems',
              },
              sync_comments: {
                type: 'boolean',
                default: false,
                description: 'Sync comments between systems',
              },
              create_missing: {
                type: 'boolean',
                default: false,
                description: 'Create missing items in target system',
              },
            },
          },
          mapping: {
            type: 'object',
            properties: {
              status_map: {
                type: 'object',
                description: 'Status mapping between systems',
              },
              priority_map: {
                type: 'object',
                description: 'Priority mapping between systems',
              },
              custom_field_map: {
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

  protected async executeInternal(params: JiraSyncParams): Promise<ToolExecutionResult> {
    try {
      this.logger.info('Syncing with JIRA', { action: params.action });

      const requestData: any = {
        action: params.action,
        options: params.sync_options || {
          sync_status: true,
          sync_priority: true,
        },
      };

      if (params.jira_project_key) requestData.jira_project_key = params.jira_project_key;
      if (params.feature_ids?.length) requestData.feature_ids = params.feature_ids;
      if (params.mapping) requestData.mapping = params.mapping;

      const response = await this.apiClient.post('/integrations/jira/sync', requestData);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      this.logger.error('Failed to sync with JIRA', error);
      
      return {
        success: false,
        error: `Failed to sync with JIRA: ${(error as Error).message}`,
      };
    }
  }
}