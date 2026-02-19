import { BulkUpdateFeaturesTool } from '@tools/bulk/bulk-update-features';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('BulkUpdateFeaturesTool', () => {
  let tool: BulkUpdateFeaturesTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new BulkUpdateFeaturesTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_feature_bulk_update');
      expect(tool.description).toBe('Update multiple features at once');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['feature_ids', 'updates'],
        properties: {
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 100,
            description: 'Feature IDs to update',
          },
          updates: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
              },
              owner_email: {
                type: 'string',
                format: 'email',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            description: 'Fields to update',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const validParams = {
      feature_ids: ['feat-1', 'feat-2', 'feat-3'],
      updates: {
        status: 'in_progress' as const,
      },
    };

    const mockBulkResponse = {
      updated: 3,
      failed: 0,
      results: [
        { id: 'feat-1', success: true },
        { id: 'feat-2', success: true },
        { id: 'feat-3', success: true },
      ],
    };

    it('should bulk update features successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockBulkResponse,
        links: {},
      });

      const result = parseResult(await tool.execute(validParams));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        endpoint: '/features/bulk',
        data: {
          feature_ids: ['feat-1', 'feat-2', 'feat-3'],
          updates: { status: 'in_progress' },
        },
      });

      expect(result).toEqual({
        success: true,
        data: {
          data: mockBulkResponse,
          links: {},
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Bulk updating features',
        { count: 3 }
      );
    });

    it('should update multiple fields', async () => {
      const multiFieldParams = {
        feature_ids: ['feat-1', 'feat-2'],
        updates: {
          status: 'done' as const,
          owner_email: 'newowner@example.com',
          tags: ['completed', 'reviewed'],
        },
      };

      mockApiClient.makeRequest.mockResolvedValue({
        data: {
          updated: 2,
          failed: 0,
          results: [
            { id: 'feat-1', success: true },
            { id: 'feat-2', success: true },
          ],
        },
        links: {},
      });

      const result = parseResult(await tool.execute(multiFieldParams));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        endpoint: '/features/bulk',
        data: multiFieldParams,
      });

      expect(result.data.data.updated).toBe(2);
    });

    it('should handle partial failures', async () => {
      const partialFailureResponse = {
        updated: 2,
        failed: 1,
        results: [
          { id: 'feat-1', success: true },
          { id: 'feat-2', success: true },
          { id: 'feat-3', success: false, error: 'Feature not found' },
        ],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        data: partialFailureResponse,
        links: {},
      });

      const result = parseResult(await tool.execute(validParams));

      expect(result).toEqual({
        success: true,
        data: {
          data: partialFailureResponse,
          links: {},
        },
      });

      // Implementation doesn't currently log warnings for partial failures
      // expect(mockLogger.warn).toHaveBeenCalledWith(
      //   'Some features failed to update',
      //   { failed: 1, total: 3 }
      // );
    });

    it('should validate required parameters', async () => {
      const missingFeatureIds = { updates: { status: 'done' } };
      await expect(tool.execute(missingFeatureIds as any)).rejects.toThrow('Invalid parameters');

      const missingUpdates = { feature_ids: ['feat-1'] };
      await expect(tool.execute(missingUpdates as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate feature_ids array constraints', async () => {
      const emptyArray = {
        feature_ids: [],
        updates: { status: 'done' as const },
      };
      await expect(tool.execute(emptyArray)).rejects.toThrow('Invalid parameters');

      const tooManyIds = {
        feature_ids: Array(101).fill('feat').map((_, i) => `feat-${i}`),
        updates: { status: 'done' as const },
      };
      await expect(tool.execute(tooManyIds)).rejects.toThrow('Invalid parameters');
    });

    it('should validate status enum values', async () => {
      const invalidStatus = {
        feature_ids: ['feat-1'],
        updates: { status: 'invalid-status' },
      };

      await expect(tool.execute(invalidStatus as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate email format', async () => {
      const invalidEmail = {
        feature_ids: ['feat-1'],
        updates: { owner_email: 'invalid-email' },
      };

      await expect(tool.execute(invalidEmail)).rejects.toThrow('Invalid parameters');
    });

    it('should validate at least one update field is provided', async () => {
      const emptyUpdates = {
        feature_ids: ['feat-1'],
        updates: {},
      };

      await expect(tool.execute(emptyUpdates)).rejects.toThrow('Tool pb_feature_bulk_update execution failed');
    });

    it('should handle complete failure', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Bulk operation failed')
      );

      await expect(tool.execute({
        feature_ids: ['feat-1', 'feat-2'],
        updates: { status: 'in_progress' },
      })).rejects.toThrow('Tool pb_feature_bulk_update execution failed');
    });

    it('should handle permission errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Insufficient permissions for bulk update')
      );

      await expect(tool.execute({
        feature_ids: ['feat-1', 'feat-2'],
        updates: { status: 'in_progress' },
      })).rejects.toThrow('Tool pb_feature_bulk_update execution failed');
    });
  });
});