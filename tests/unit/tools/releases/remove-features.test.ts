import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RemoveFeaturesFromReleaseTool } from '@tools/releases/remove-features';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('RemoveFeaturesFromReleaseTool', () => {
  let tool: RemoveFeaturesFromReleaseTool;
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
    
    tool = new RemoveFeaturesFromReleaseTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_release_feature_remove');
      expect(tool.description).toBe('Remove features from a release');
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
            description: 'Feature IDs to remove from the release',
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
    it('should remove multiple features from release', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123', 'feat_456', 'feat_789'],
      };
      const expectedResponse = {
        success: true,
        removed_features: [
          {
            id: 'feat_123',
            name: 'User Authentication',
            removed_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'feat_456',
            name: 'Payment Integration',
            removed_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'feat_789',
            name: 'Mobile App',
            removed_at: '2024-01-15T10:00:00Z',
          },
        ],
        release_id: 'rel_123',
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'DELETE',
        endpoint: '/releases/rel_123/features',
        data: {
          feature_ids: ['feat_123', 'feat_456', 'feat_789'],
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should remove single feature from release', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
      };
      const expectedResponse = {
        success: true,
        removed_features: [
          {
            id: 'feat_123',
            name: 'User Authentication',
            removed_at: '2024-01-15T10:00:00Z',
          },
        ],
        release_id: 'rel_123',
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'DELETE',
        endpoint: '/releases/rel_123/features',
        data: {
          feature_ids: ['feat_123'],
        },
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
      
      mockClient.makeRequest.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to remove features from release: API Error',
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
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to remove features from release: Authentication failed',
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
          message: 'Some features could not be removed',
          details: {
            invalid_features: ['feat_invalid'],
            reason: 'Features not found in release',
          },
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to remove features from release: Validation error',
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
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to remove features from release: Not found',
      });
    });

    it('should handle features not in release errors', async () => {
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123', 'feat_456'],
      };
      
      const error = new Error('Not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Some features are not in this release',
          details: {
            missing_features: ['feat_456'],
          },
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to remove features from release: Not found',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new RemoveFeaturesFromReleaseTool(null as any, mockLogger);
      const validInput = {
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to remove features from release:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        success: true,
        removed_features: [
          {
            id: 'feat_123',
            name: 'User Authentication',
            removed_at: '2024-01-15T10:00:00Z',
          },
        ],
        release_id: 'rel_123',
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        release_id: 'rel_123',
        feature_ids: ['feat_123'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('removed_features');
      expect((result as any).data).toHaveProperty('release_id', 'rel_123');
      expect((result as any).data.removed_features[0]).toHaveProperty('id', 'feat_123');
    });
  });
});