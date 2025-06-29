import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LinkFeaturesToObjectiveTool } from '@tools/objectives/link-features';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('LinkFeaturesToObjectiveTool', () => {
  let tool: LinkFeaturesToObjectiveTool;
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
    
    tool = new LinkFeaturesToObjectiveTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_objective_link_feature');
      expect(tool.description).toBe('Link features to an objective');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['objective_id', 'feature_ids'],
        properties: {
          objective_id: {
            type: 'string',
            description: 'Objective ID',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Feature IDs to link',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ objective_id: 'obj_123' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ feature_ids: ['feat_123'] } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate feature_ids array is not empty', async () => {
      const input = {
        objective_id: 'obj_123',
        feature_ids: [],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate feature_ids contains strings', async () => {
      const input = {
        objective_id: 'obj_123',
        feature_ids: [123, 'feat_456'],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456', 'feat_789', 'feat_012'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept single feature ID', () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should link features to objective with valid input', async () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456', 'feat_789', 'feat_012'],
      };
      const expectedResponse = {
        objective_id: 'obj_123',
        linked_features: [
          {
            id: 'feat_456',
            name: 'User Authentication',
            status: 'in_progress',
            linked_at: '2024-01-20T14:30:00Z',
          },
          {
            id: 'feat_789',
            name: 'Dashboard Analytics',
            status: 'new',
            linked_at: '2024-01-20T14:30:00Z',
          },
          {
            id: 'feat_012',
            name: 'Mobile App Integration',
            status: 'validation',
            linked_at: '2024-01-20T14:30:00Z',
          },
        ],
        total_linked: 3,
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/objectives/obj_123/features', {
        feature_ids: ['feat_456', 'feat_789', 'feat_012'],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should link single feature to objective', async () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456'],
      };
      const expectedResponse = {
        objective_id: 'obj_123',
        linked_features: [
          {
            id: 'feat_456',
            name: 'User Authentication',
            status: 'in_progress',
            linked_at: '2024-01-20T14:30:00Z',
          },
        ],
        total_linked: 1,
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/objectives/obj_123/features', {
        feature_ids: ['feat_456'],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle partial success (some features linked)', async () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456', 'feat_invalid', 'feat_789'],
      };
      const expectedResponse = {
        objective_id: 'obj_123',
        linked_features: [
          {
            id: 'feat_456',
            name: 'User Authentication',
            status: 'in_progress',
            linked_at: '2024-01-20T14:30:00Z',
          },
          {
            id: 'feat_789',
            name: 'Dashboard Analytics',
            status: 'new',
            linked_at: '2024-01-20T14:30:00Z',
          },
        ],
        total_linked: 2,
        failed_links: [
          {
            feature_id: 'feat_invalid',
            error: 'Feature not found',
          },
        ],
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/objectives/obj_123/features', {
        feature_ids: ['feat_456', 'feat_invalid', 'feat_789'],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456', 'feat_789'],
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to link features to objective: API Error',
      });
    });

    it('should handle objective not found errors', async () => {
      const validInput = {
        objective_id: 'obj_nonexistent',
        feature_ids: ['feat_456'],
      };
      
      const error = new Error('Objective not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'OBJECTIVE_NOT_FOUND',
          message: 'Objective not found',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to link features to objective: Objective not found',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456'],
      };
      
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
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to link features to objective: Authentication failed',
      });
    });

    it('should handle forbidden errors', async () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456'],
      };
      
      const error = new Error('Insufficient permissions');
      (error as any).response = {
        status: 403,
        data: {
          error: true,
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to link features to objective: Insufficient permissions',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456'],
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: {
            fields: {
              feature_ids: 'One or more feature IDs are invalid',
            },
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to link features to objective: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new LinkFeaturesToObjectiveTool(null as any, mockLogger);
      const validInput = {
        objective_id: 'obj_123',
        feature_ids: ['feat_456'],
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to link features to objective:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        objective_id: 'obj_123',
        linked_features: [
          {
            id: 'feat_456',
            name: 'Test Feature',
            status: 'new',
            linked_at: '2024-01-01T00:00:00Z',
          },
        ],
        total_linked: 1,
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        objective_id: 'obj_123',
        feature_ids: ['feat_456'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('objective_id', 'obj_123');
      expect((result as any).data).toHaveProperty('total_linked', 1);
      expect((result as any).data.linked_features[0]).toHaveProperty('id', 'feat_456');
      expect((result as any).data.linked_features[0]).toHaveProperty('linked_at');
    });

    it('should handle responses with failed links', async () => {
      const apiResponse = {
        objective_id: 'obj_123',
        linked_features: [
          {
            id: 'feat_456',
            name: 'Valid Feature',
            status: 'new',
            linked_at: '2024-01-01T00:00:00Z',
          },
        ],
        total_linked: 1,
        failed_links: [
          {
            feature_id: 'feat_invalid',
            error: 'Feature not found',
          },
          {
            feature_id: 'feat_archived',
            error: 'Cannot link archived feature',
          },
        ],
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        objective_id: 'obj_123',
        feature_ids: ['feat_456', 'feat_invalid', 'feat_archived'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('failed_links');
      expect((result as any).data.failed_links).toHaveLength(2);
      expect((result as any).data.failed_links[0]).toHaveProperty('feature_id', 'feat_invalid');
      expect((result as any).data.failed_links[1]).toHaveProperty('feature_id', 'feat_archived');
    });

    it('should handle empty linked features response', async () => {
      const apiResponse = {
        objective_id: 'obj_123',
        linked_features: [],
        total_linked: 0,
        failed_links: [
          {
            feature_id: 'feat_invalid',
            error: 'All provided features are invalid',
          },
        ],
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        objective_id: 'obj_123',
        feature_ids: ['feat_invalid'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.linked_features).toHaveLength(0);
      expect((result as any).data.total_linked).toBe(0);
    });
  });
});