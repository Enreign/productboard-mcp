import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListFeaturesTool } from '@tools/features/list-features';
import { ProductboardAPIClient } from '@api/client';

describe('ListFeaturesTool', () => {
  let tool: ListFeaturesTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: any;

  // v2 API format: features are wrapped in fields
  const mockFeatureDataV2 = {
    data: [
      {
        id: 'feat_123456',
        fields: { name: 'User Authentication Feature', description: 'Implement OAuth2', status: { name: 'in_progress' }, owner: { email: 'john@example.com' } },
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
      },
      {
        id: 'feat_234567',
        fields: { name: 'Payment Integration', description: 'Integrate Stripe', status: { name: 'new' }, owner: { email: 'jane@example.com' } },
        createdAt: '2024-01-16T11:00:00Z',
        updatedAt: '2024-01-16T11:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<ProductboardAPIClient>;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new ListFeaturesTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_feature_list');
      expect(tool.description).toBe('List features with optional filtering and pagination');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
            default: 20,
          },
          offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
          },
          sort: {
            type: 'string',
            enum: ['created_at', 'updated_at', 'name', 'priority'],
            default: 'created_at',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should accept empty parameters', () => {
      const validation = tool.validateParams({});
      expect(validation.valid).toBe(true);
    });

    it('should validate status enum', async () => {
      await expect(tool.execute({ status: 'invalid' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate sort enum', async () => {
      await expect(tool.execute({ sort: 'invalid_field' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate order enum', async () => {
      await expect(tool.execute({ order: 'invalid_order' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate tags array', async () => {
      await expect(tool.execute({ tags: 'not-an-array' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid filter combinations', () => {
      const validation = tool.validateParams({
        status: 'in_progress',
        product_id: 'prod_123',
        tags: ['tag1', 'tag2'],
        limit: 50,
        offset: 20,
        sort: 'priority',
        order: 'asc',
      });
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should list features with default parameters', async () => {
      mockClient.get.mockResolvedValueOnce(mockFeatureDataV2);

      const result = await tool.execute({});

      // v2 API: uses /entities with type[]=feature
      expect(mockClient.get).toHaveBeenCalledWith('/entities', { 'type[]': 'feature' });
      // Result should be MCP content format
      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: 'in_progress' as const,
        product_id: 'prod_789',
        owner_email: 'john.doe@example.com',
        tags: ['mobile', 'security'],
        search: 'authentication',
      };

      mockClient.get.mockResolvedValueOnce(mockFeatureDataV2);

      await tool.execute(filters);

      expect(mockClient.get).toHaveBeenCalledWith('/entities', {
          'type[]': 'feature',
          status: 'in_progress',
          product_id: 'prod_789',
          owner_email: 'john.doe@example.com',
          tags: 'mobile,security',
          search: 'authentication',
      });
    });

    it('should handle empty results', async () => {
      const emptyResponse = { data: [] };

      mockClient.get.mockResolvedValueOnce(emptyResponse);

      const result = await tool.execute({});
      expect(result.content[0].text).toBe('No features found.');
    });

    it('should handle API errors gracefully', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await tool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });

    it('should handle rate limiting', async () => {
      const error = new Error('Rate limited');
      (error as any).response = { status: 429, data: {} };
      mockClient.get.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });

    it('should handle error if client not initialized', async () => {
      const uninitializedTool = new ListFeaturesTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });
  });

  describe('response transformation', () => {
    it('should return MCP content with feature names', async () => {
      mockClient.get.mockResolvedValueOnce(mockFeatureDataV2);

      const result = await tool.execute({});
      const text = result.content[0].text;

      expect(text).toContain('User Authentication Feature');
      expect(text).toContain('Payment Integration');
    });

    it('should handle raw array response', async () => {
      const arrayResponse = [
        { id: 'feat_1', fields: { name: 'Feature 1' } },
        { id: 'feat_2', fields: { name: 'Feature 2' } },
      ];

      mockClient.get.mockResolvedValueOnce(arrayResponse);

      const result = await tool.execute({});
      const text = result.content[0].text;

      expect(text).toContain('Feature 1');
      expect(text).toContain('Feature 2');
    });

    it('should apply client-side pagination', async () => {
      const manyFeatures = {
        data: Array.from({ length: 5 }, (_, i) => ({
          id: `feat_${i}`,
          fields: { name: `Feature ${i}` },
        })),
      };

      mockClient.get.mockResolvedValueOnce(manyFeatures);

      const result = await tool.execute({ limit: 2, offset: 1 });
      const text = result.content[0].text;

      // Should show features at index 1 and 2 (offset=1, limit=2)
      expect(text).toContain('Feature 1');
      expect(text).toContain('Feature 2');
      expect(text).not.toContain('Feature 0');
    });
  });
});
