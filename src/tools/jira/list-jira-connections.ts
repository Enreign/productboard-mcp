import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ListJiraConnectionsParams {
  integration_id: string;
  jira_issue_key?: string;
  jira_issue_id?: string;
}

export class ListJiraConnectionsTool extends BaseTool<ListJiraConnectionsParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_jira_connection_list',
      'List Productboard feature ↔ Jira issue connections for a given integration. Optionally filter by Jira issue key (e.g. INT-4290) or Jira issue ID. Use pb_jira_integration_list first to find the integration_id.',
      {
        type: 'object',
        required: ['integration_id'],
        properties: {
          integration_id: {
            type: 'string',
            description: 'Jira integration ID (from pb_jira_integration_list)',
          },
          jira_issue_key: {
            type: 'string',
            description: 'Optional: filter by Jira issue key (e.g. "INT-4290")',
          },
          jira_issue_id: {
            type: 'string',
            description: 'Optional: filter by Jira numeric issue ID',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to features',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ListJiraConnectionsParams): Promise<unknown> {
    this.logger.info('Listing Jira connections', { integrationId: params.integration_id });

    // Productboard v2 API: filter params are bare `issueKey` / `issueId`
    // (NOT prefixed with `connection.`). The endpoint does not accept
    // pageLimit/pageOffset query params; pagination is via response links.next.
    const queryParams: Record<string, any> = {};
    if (params.jira_issue_key) queryParams.issueKey = params.jira_issue_key;
    if (params.jira_issue_id) queryParams.issueId = params.jira_issue_id;

    const response = await this.apiClient.get(
      `/jira-integrations/${encodeURIComponent(params.integration_id)}/connections`,
      queryParams
    );

    return {
      success: true,
      data: (response as any).data || response,
      links: (response as any).links,
    };
  }
}
