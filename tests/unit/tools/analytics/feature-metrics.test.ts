import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeatureMetricsTool } from '@tools/analytics/feature-metrics';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('FeatureMetricsTool', () => {
  let tool: FeatureMetricsTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockClient = {
      makeRequest: jest.fn(),
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
    
    tool = new FeatureMetricsTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_analytics_feature_metrics');
      expect(tool.description).toBe('Get analytics metrics for features');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific feature IDs to analyze',
          },
          product_id: {
            type: 'string',
            description: 'Filter by product ID',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Start date for metrics',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'End date for metrics',
          },
          metrics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['views', 'votes', 'comments', 'status_changes'],
            },
            description: 'Types of metrics to retrieve',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should accept empty parameters', async () => {
      const validation = tool.validateParams({});
      expect(validation.valid).toBe(true);
    });

    it('should validate metrics enum values', async () => {
      const input = {
        metrics: ['invalid_metric'],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid metrics enum values', () => {
      const validInput = {
        metrics: ['views', 'votes', 'comments', 'status_changes'] as ('views' | 'votes' | 'comments' | 'status_changes')[],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate date format', async () => {
      const input = {
        date_from: 'invalid-date',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid date formats', () => {
      const validInput = {
        date_from: '2024-01-01',
        date_to: '2024-12-31',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate feature_ids array', () => {
      const validInput = {
        feature_ids: ['feat_123', 'feat_456'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate product_id string', () => {
      const validInput = {
        product_id: 'prod_123',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept comprehensive valid input', () => {
      const validInput = {
        feature_ids: ['feat_123', 'feat_456'],
        product_id: 'prod_789',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        metrics: ['views', 'votes'] as ('views' | 'votes')[],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should get feature metrics with empty parameters', async () => {
      const expectedResponse = {
        summary: {
          total_features: 25,
          total_views: 1250,
          total_votes: 320,
          total_comments: 89,
        },
        metrics: [],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/features',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should get feature metrics with all parameters', async () => {
      const input = {
        feature_ids: ['feat_123', 'feat_456'],
        product_id: 'prod_789',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        metrics: ['views', 'votes'] as ('views' | 'votes')[],
      };
      
      const expectedResponse = {
        summary: {
          total_features: 2,
          total_views: 145,
          total_votes: 23,
        },
        metrics: [
          {
            feature_id: 'feat_123',
            views: 89,
            votes: 15,
          },
          {
            feature_id: 'feat_456',
            views: 56,
            votes: 8,
          },
        ],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/features',
        params: {
          feature_ids: 'feat_123,feat_456',
          product_id: 'prod_789',
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          metrics: 'views,votes',
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get feature metrics: API Error',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get feature metrics', error);
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Authentication failed');
      (error as any).response = {
        status: 401,
        data: {
          error: true,
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get feature metrics: Authentication failed',
      });
    });

    it('should handle insufficient permissions error', async () => {
      const error = new Error('Insufficient permissions');
      (error as any).response = {
        status: 403,
        data: {
          error: true,
          code: 'PERMISSION_DENIED',
          message: 'Insufficient permissions for analytics',
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get feature metrics: Insufficient permissions',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new FeatureMetricsTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to get feature metrics:'),
      });
    });

    it('should handle empty arrays gracefully', async () => {
      const input = {
        feature_ids: [],
        metrics: [],
      };
      
      const expectedResponse = {
        summary: { total_features: 0 },
        metrics: [],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/features',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        summary: {
          total_features: 10,
          total_views: 500,
          total_votes: 120,
          total_comments: 45,
          total_status_changes: 15,
        },
        metrics: [
          {
            feature_id: 'feat_123',
            name: 'Authentication Feature',
            views: 89,
            votes: 23,
            comments: 12,
            status_changes: 3,
          },
        ],
        period: {
          from: '2024-01-01',
          to: '2024-12-31',
        },
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        metrics: ['views', 'votes', 'comments', 'status_changes'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('summary');
      expect((result as any).data).toHaveProperty('metrics');
      expect((result as any).data.summary).toHaveProperty('total_features', 10);
      expect((result as any).data.metrics[0]).toHaveProperty('feature_id', 'feat_123');
    });

    it('should handle minimal response structure', async () => {
      const apiResponse = {
        summary: {
          total_features: 0,
        },
        metrics: [],
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
    });
  });
});