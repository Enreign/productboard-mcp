import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface SetFeatureSourceParams {
  id: string;
  system?: string;
  record_id?: string;
  url?: string;
}

/**
 * Sets feature.metadata.source.{system, recordId, url} via PATCH /entities/{id}.
 *
 * This is provenance metadata — it stores a cross-reference to a record in an
 * external system (Jira, Salesforce, Intercom, etc.) on the feature. It does
 * NOT create a functional integration connection: there is no status sync,
 * the link does not appear in the Productboard Jira sidebar UI, and the entry
 * is not returned by pb_jira_connection_list. For a real Jira connection,
 * create it through the Productboard UI or via the Jira-side integration.
 *
 * Partial updates are supported: only the fields you pass are changed; the
 * others are preserved (read-modify-write).
 */
export class SetFeatureSourceTool extends BaseTool<SetFeatureSourceParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_source_set',
      'Set the external-source provenance metadata (metadata.source) on a feature: which external system it relates to, the record ID in that system, and a URL. Generic — works for Jira, Salesforce, Intercom, etc. NOTE: this is metadata only; it does NOT create a functional Jira integration connection (no status sync, no Productboard Jira sidebar link). Pass empty string "" to clear an individual field; omit a field to leave it unchanged.',
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Feature UUID',
          },
          system: {
            type: 'string',
            description: 'External system name (e.g. "Jira", "Salesforce", "Intercom"). Pass empty string "" to clear.',
          },
          record_id: {
            type: 'string',
            description: 'Record identifier in that system (e.g. "INT-3775" for a Jira issue). Pass empty string "" to clear.',
          },
          url: {
            type: 'string',
            description: 'URL to the record (e.g. "https://your-org.atlassian.net/browse/INT-3775"). Pass empty string "" to clear.',
          },
        },
      },
      {
        requiredPermissions: [Permission.FEATURES_WRITE],
        minimumAccessLevel: AccessLevel.WRITE,
        description: 'Requires write access to features',
      },
      apiClient,
      logger
    );
  }

  validateParams(params: unknown) {
    const baseValidation = super.validateParams(params);
    if (!baseValidation.valid) return baseValidation;

    const p = params as unknown as Record<string, unknown>;
    const provided = ['system', 'record_id', 'url'].filter((k) => k in p);
    if (provided.length === 0) {
      return {
        valid: false,
        errors: [{
          path: '',
          message: 'At least one of system, record_id, or url must be provided',
          value: undefined,
        }],
      };
    }
    return { valid: true, errors: [] };
  }

  protected async executeInternal(params: SetFeatureSourceParams): Promise<unknown> {
    const { id } = params;

    // Read-modify-write so partial updates don't clobber unspecified fields.
    const current = await this.apiClient.get<unknown>(`/entities/${id}`);
    const existingSource = ((current as any)?.data?.fields?.metadata?.source
      ?? (current as any)?.data?.metadata?.source
      ?? {}) as Record<string, unknown>;

    const source: Record<string, unknown> = {
      system: existingSource.system ?? null,
      recordId: existingSource.recordId ?? null,
      url: existingSource.url ?? null,
    };
    // Empty string "" → null (explicit clear). Undefined → keep existing value.
    const raw = params as unknown as Record<string, unknown>;
    const norm = (v: string | undefined) => (v === '' ? null : v);
    if ('system' in raw) source.system = norm(params.system);
    if ('record_id' in raw) source.recordId = norm(params.record_id);
    if ('url' in raw) source.url = norm(params.url);

    this.logger.info('Setting feature source metadata', {
      featureId: id,
      system: source.system,
      recordId: source.recordId,
    });

    const response = await this.apiClient.patch(`/entities/${id}`, {
      data: { metadata: { source } },
    });

    return {
      success: true,
      data: (response as any).data || response,
      source,
    };
  }
}
