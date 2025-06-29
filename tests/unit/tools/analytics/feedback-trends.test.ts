import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FeedbackTrendsTool } from '@tools/analytics/feedback-trends';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('FeedbackTrendsTool', () => {
  let tool: FeedbackTrendsTool;
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
    
    tool = new FeedbackTrendsTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_analytics_feedback_trends');
      expect(tool.description).toBe('Analyze feedback trends over time');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Start date for analysis',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'End date for analysis',
          },
          product_id: {
            type: 'string',
            description: 'Filter by product ID',
          },
          feature_id: {
            type: 'string',
            description: 'Filter by feature ID',
          },
          source: {
            type: 'string',
            description: 'Filter by feedback source',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags',
          },
          groupBy: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            default: 'week',
            description: 'Time period grouping',
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

    it('should validate groupBy enum values', async () => {
      const input = {
        groupBy: 'invalid_group' as any,
      };
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid groupBy enum values', () => {
      ['day', 'week', 'month'].forEach(groupBy => {
        const validInput = { groupBy: groupBy as any };
        const validation = tool.validateParams(validInput);
        expect(validation.valid).toBe(true);
      });
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

    it('should validate tags array', () => {
      const validInput = {
        tags: ['bug', 'enhancement', 'user-request'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate string fields', () => {
      const validInput = {
        product_id: 'prod_123',
        feature_id: 'feat_456',
        source: 'support-tickets',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept comprehensive valid input', () => {
      const validInput = {
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        product_id: 'prod_123',
        feature_id: 'feat_456',
        source: 'support-tickets',
        tags: ['bug', 'critical'],
        groupBy: 'week' as 'week',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should analyze feedback trends with empty parameters', async () => {
      const expectedResponse = {
        summary: {
          total_feedback: 150,
          trend: 'increasing',
          growth_rate: 12.5,
        },
        trends: [
          {
            period: '2024-W01',
            count: 25,
            sentiment_avg: 3.2,
          },
          {
            period: '2024-W02',
            count: 30,
            sentiment_avg: 3.5,
          },
        ],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/feedback-trends',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should analyze feedback trends with all parameters', async () => {
      const input = {
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        product_id: 'prod_123',
        feature_id: 'feat_456',
        source: 'support-tickets',
        tags: ['bug', 'critical'],
        groupBy: 'month' as 'month',
      };
      
      const expectedResponse = {
        summary: {
          total_feedback: 45,
          trend: 'decreasing',
          growth_rate: -5.2,
        },
        trends: [
          {
            period: '2024-01',
            count: 15,
            sentiment_avg: 2.8,
            sources: {
              'support-tickets': 15,
            },
            tags: {
              'bug': 12,
              'critical': 8,
            },
          },
          {
            period: '2024-02',
            count: 30,
            sentiment_avg: 3.1,
            sources: {
              'support-tickets': 30,
            },
            tags: {
              'bug': 20,
              'critical': 15,
            },
          },
        ],
        filters: {
          product_id: 'prod_123',
          feature_id: 'feat_456',
          source: 'support-tickets',
          tags: ['bug', 'critical'],
        },
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/feedback-trends',
        params: {
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          product_id: 'prod_123',
          feature_id: 'feat_456',
          source: 'support-tickets',
          tags: 'bug,critical',
          group_by: 'month',
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
        error: 'Failed to analyze feedback trends: API Error',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to analyze feedback trends', error);
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
        error: 'Failed to analyze feedback trends: Authentication failed',
      });
    });

    it('should handle insufficient permissions error', async () => {
      const error = new Error('Insufficient permissions');
      (error as any).response = {
        status: 403,
        data: {
          error: true,
          code: 'PERMISSION_DENIED',
          message: 'Analytics access requires admin privileges',
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to analyze feedback trends: Insufficient permissions',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new FeedbackTrendsTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to analyze feedback trends:'),
      });
    });

    it('should handle empty arrays gracefully', async () => {
      const input = {
        tags: [],
      };
      
      const expectedResponse = {
        summary: { total_feedback: 0 },
        trends: [],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/feedback-trends',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should use default groupBy parameter correctly', async () => {
      const input = {
        date_from: '2024-01-01',
      };
      
      const expectedResponse = {
        summary: { total_feedback: 50 },
        trends: [],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/feedback-trends',
        params: {
          date_from: '2024-01-01',
        },
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        summary: {
          total_feedback: 200,
          trend: 'stable',
          growth_rate: 2.1,
          avg_sentiment: 3.4,
        },
        trends: [
          {
            period: '2024-01',
            count: 50,
            sentiment_avg: 3.2,
            sentiment_distribution: {
              positive: 25,
              neutral: 15,
              negative: 10,
            },
            sources: {
              'support-tickets': 30,
              'user-interviews': 20,
            },
            tags: {
              'feature-request': 35,
              'bug': 15,
            },
          },
        ],
        period: {
          from: '2024-01-01',
          to: '2024-12-31',
          groupBy: 'month',
        },
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        groupBy: 'month',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('summary');
      expect((result as any).data).toHaveProperty('trends');
      expect((result as any).data.summary).toHaveProperty('total_feedback', 200);
      expect((result as any).data.trends[0]).toHaveProperty('period', '2024-01');
      expect((result as any).data.trends[0]).toHaveProperty('count', 50);
    });

    it('should handle minimal response structure', async () => {
      const apiResponse = {
        summary: {
          total_feedback: 0,
        },
        trends: [],
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
    });

    it('should handle complex trend data with multiple dimensions', async () => {
      const apiResponse = {
        summary: {
          total_feedback: 500,
          trend: 'increasing',
          growth_rate: 25.8,
        },
        trends: [
          {
            period: '2024-W10',
            count: 45,
            sentiment_avg: 3.8,
            top_keywords: ['performance', 'usability'],
            sentiment_distribution: {
              very_positive: 15,
              positive: 20,
              neutral: 8,
              negative: 2,
              very_negative: 0,
            },
          },
        ],
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        groupBy: 'week',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.trends[0]).toHaveProperty('top_keywords');
      expect((result as any).data.trends[0]).toHaveProperty('sentiment_distribution');
    });
  });
});