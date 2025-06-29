import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AddFeaturesToReleaseTool } from '@tools/releases/add-features';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('AddFeaturesToReleaseTool', () => {
  let tool: AddFeaturesToReleaseTool;
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
    
    tool = new AddFeaturesToReleaseTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_release_feature_add');
      expect(tool.description).toBe('Add features to a release');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['release_id', 'feature_ids'],
        properties: {
          release_id: {
            type: 'string',
            description: 'Release ID',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Feature IDs to add to the release',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ release_id: 'rel_123' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ feature_ids: ['feat_123'] } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate feature_ids array', async () => {
      const emptyArrayInput = {
        release_id: 'rel_123',
        feature_ids: [],
      } as any;
      await expect(tool.execute(emptyArrayInput)).rejects.toThrow('Invalid parameters');
    });

    it('should validate feature_ids contains strings', async () => {
      const invalidTypesInput = {
        release_id: 'rel_123',
        feature_ids: [123, null, undefined],
      } as any;
      await expect(tool.execute(invalidTypesInput)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123', 'feat_456', 'feat_789'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept single feature ID', () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should add multiple features to release', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123', 'feat_456', 'feat_789'],
      };
      const expectedResponse = {
        success: true,
        added_features: [
          {
            id: 'feat_123',
            name: 'User Authentication',
            added_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'feat_456',
            name: 'Payment Integration',
            added_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'feat_789',
            name: 'Mobile App',
            added_at: '2024-01-15T10:00:00Z',
          },
        ],
        release_id: 'rel_123',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/releases/rel_123/features', {
        feature_ids: ['feat_123', 'feat_456', 'feat_789'],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should add single feature to release', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
      };
      const expectedResponse = {
        success: true,
        added_features: [
          {
            id: 'feat_123',
            name: 'User Authentication',
            added_at: '2024-01-15T10:00:00Z',
          },
        ],
        release_id: 'rel_123',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/releases/rel_123/features', {
        feature_ids: ['feat_123'],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to add features to release: API Error',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
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
        error: 'Failed to add features to release: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123', 'feat_invalid'],
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Some features could not be added',
          details: {
            invalid_features: ['feat_invalid'],
            reason: 'Features not found',
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to add features to release: Validation error',
      });
    });

    it('should handle not found errors', async () => {
      const validInput = {
        release_id: 'rel_nonexistent',
        feature_ids: ['feat_123'],
      };
      
      const error = new Error('Not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Release not found',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to add features to release: Not found',
      });
    });

    it('should handle duplicate feature errors', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123', 'feat_456'],
      };
      
      const error = new Error('Conflict');
      (error as any).response = {
        status: 409,
        data: {
          error: true,
          code: 'CONFLICT',
          message: 'Some features are already in release',
          details: {
            existing_features: ['feat_123'],
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to add features to release: Conflict',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new AddFeaturesToReleaseTool(null as any, mockLogger);
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to add features to release:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        success: true,
        added_features: [
          {
            id: 'feat_123',
            name: 'User Authentication',
            added_at: '2024-01-15T10:00:00Z',
          },
        ],
        release_id: 'rel_123',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('added_features');
      expect((result as any).data).toHaveProperty('release_id', 'rel_123');
      expect((result as any).data.added_features[0]).toHaveProperty('id', 'feat_123');
    });
  });
});