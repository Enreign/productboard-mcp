import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

type HealthStatus = 'onTrack' | 'atRisk' | 'offTrack';
type HealthMode = 'manual' | 'automatic';

interface UpdateFeatureHealthParams {
  id: string;
  status: HealthStatus;
  comment?: string;
  mode?: HealthMode;
}

export class UpdateFeatureHealthTool extends BaseTool<UpdateFeatureHealthParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_feature_health_update',
      'Update the health (status/comment/mode) of an existing feature. Writes the health.status (onTrack | atRisk | offTrack), optional comment (HTML; plain text is wrapped in <p>...</p>), and mode (manual | automatic; default manual). If the feature\'s existing health.mode is "automatic" and the caller does not explicitly pass mode, the update is skipped to avoid being overwritten by Productboard\'s health automation.',
      {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: {
            type: 'string',
            description: 'Feature ID to update',
          },
          status: {
            type: 'string',
            enum: ['onTrack', 'atRisk', 'offTrack'],
            description: 'New health status',
          },
          comment: {
            type: 'string',
            description: 'Optional health comment (HTML or plain text; plain text is auto-wrapped in <p>...</p>)',
          },
          mode: {
            type: 'string',
            enum: ['manual', 'automatic'],
            description: 'Health mode. Default is manual. Set to "automatic" to opt into Productboard\'s automated health calculation (which will overwrite the supplied status).',
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

  protected async executeInternal(params: UpdateFeatureHealthParams): Promise<unknown> {
    const { id, status, comment, mode } = params;

    // Guard: if existing health.mode is automatic and caller didn't explicitly
    // pass mode, refuse to write — Productboard's automation will overwrite us.
    if (mode === undefined) {
      const current = await this.apiClient.get<unknown>(`/entities/${id}`);
      const existingMode = (current as any)?.data?.fields?.health?.mode;
      if (existingMode === 'automatic') {
        this.logger.warn('Skipping pb_feature_health_update: existing health.mode is automatic', { featureId: id });
        return {
          success: false,
          skipped: true,
          reason: 'existing_mode_automatic',
          message: 'Feature health mode is currently "automatic" and would be overwritten by Productboard automation. Pass mode="manual" explicitly to override.',
        };
      }
    }

    const health: Record<string, unknown> = {
      status,
      mode: mode ?? 'manual',
    };
    if (comment !== undefined) {
      health.comment = comment.startsWith('<') ? comment : `<p>${comment}</p>`;
    }

    this.logger.info('Updating feature health', { featureId: id, status, mode: health.mode });

    const response = await this.apiClient.patch(`/entities/${id}`, { data: { fields: { health } } });

    return {
      success: true,
      data: (response as any).data || response,
    };
  }
}
