import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReleaseTimelineTool } from '@tools/releases/timeline';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ReleaseTimelineTool', () => {
  let tool: ReleaseTimelineTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      makeRequest: jest.fn(),
    } as unknown as jest.Mocked<ProductboardAPIClient>;
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
    
    tool = new ReleaseTimelineTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_release_timeline');
      expect(tool.description).toBe('Get release timeline with features and milestones');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          release_group_id: {
            type: 'string',
            description: 'Filter by release group',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Start date for timeline',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'End date for timeline',
          },
          include_features: {
            type: 'boolean',
            default: true,
            description: 'Include features in timeline',
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

    it('should validate date format', async () => {
      const invalidFromDate = {
        date_from: 'invalid-date',
      } as any;
      await expect(tool.execute(invalidFromDate)).rejects.toThrow('Invalid parameters');

      const invalidToDate = {
        date_to: 'invalid-date',
      } as any;
      await expect(tool.execute(invalidToDate)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid filters', () => {
      const validInput = {
        release_group_id: 'group_123',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        include_features: false,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should get timeline without filters', async () => {
      const expectedResponse = {
        timeline: [
          {
            id: 'rel_123',
            name: 'v1.0.0',
            date: '2024-01-15',
            status: 'planned',
            type: 'release',
            features: [
              {
                id: 'feat_123',
                name: 'User Authentication',
                status: 'in_progress',
              },
            ],
          },
          {
            id: 'rel_456',
            name: 'v2.0.0',
            date: '2024-06-15',
            status: 'planned',
            type: 'release',
            features: [
              {
                id: 'feat_456',
                name: 'Payment Integration',
                status: 'new',
              },
            ],
          },
        ],
        metadata: {
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          include_features: true,
        },
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/releases/timeline',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should get timeline with all filters', async () => {
      const input = {
        release_group_id: 'group_123',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        include_features: false,
      };
      const expectedResponse = {
        timeline: [
          {
            id: 'rel_789',
            name: 'v1.5.0',
            date: '2024-03-15',
            status: 'in_progress',
            type: 'release',
            release_group_id: 'group_123',
          },
        ],
        metadata: {
          release_group_id: 'group_123',
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          include_features: false,
        },
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/releases/timeline',
        params: {
          release_group_id: 'group_123',
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          include_features: false,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle partial filters', async () => {
      const input = {
        date_from: '2024-01-01',
        include_features: true,
      };
      const expectedResponse = {
        timeline: [
          {
            id: 'rel_123',
            name: 'v1.0.0',
            date: '2024-01-15',
            status: 'planned',
            type: 'release',
            features: [
              {
                id: 'feat_123',
                name: 'User Authentication',
                status: 'in_progress',
              },
            ],
          },
        ],
        metadata: {
          date_from: '2024-01-01',
          include_features: true,
        },
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/releases/timeline',
        params: {
          date_from: '2024-01-01',
          include_features: true,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle empty timeline', async () => {
      const input = {
        date_from: '2024-01-01',
        date_to: '2024-01-31',
      };
      const expectedResponse = {
        timeline: [],
        metadata: {
          date_from: '2024-01-01',
          date_to: '2024-01-31',
          include_features: true,
        },
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      mockClient.makeRequest.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get release timeline: API Error',
      });
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Authentication failed');
      (error as any).response = {
        status: 401,
        data: {
          error: true,
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
          details: {},
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get release timeline: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const input = {
        date_from: '2024-01-01',
        date_to: '2023-01-01', // Invalid date range
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid date range',
          details: {
            date_from: '2024-01-01',
            date_to: '2023-01-01',
            error: 'date_to must be after date_from',
          },
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute(input);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get release timeline: Validation error',
      });
    });

    it('should handle not found errors', async () => {
      const input = {
        release_group_id: 'group_nonexistent',
      };
      
      const error = new Error('Not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Release group not found',
          details: {},
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute(input);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get release timeline: Not found',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ReleaseTimelineTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to get release timeline:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        timeline: [
          {
            id: 'rel_123',
            name: 'v1.0.0',
            date: '2024-01-15',
            status: 'planned',
            type: 'release',
            features: [
              {
                id: 'feat_123',
                name: 'User Authentication',
                status: 'in_progress',
              },
            ],
          },
        ],
        metadata: {
          include_features: true,
        },
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('timeline');
      expect((result as any).data).toHaveProperty('metadata');
      expect((result as any).data.timeline[0]).toHaveProperty('id', 'rel_123');
      expect((result as any).data.timeline[0]).toHaveProperty('features');
      expect((result as any).data.timeline[0].features[0]).toHaveProperty('id', 'feat_123');
    });
  });
});