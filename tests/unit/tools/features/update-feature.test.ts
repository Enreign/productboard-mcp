import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpdateFeatureTool } from '@tools/features/update-feature';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';
// Error types are checked by message rather than type

describe('UpdateFeatureTool', () => {
  let tool: UpdateFeatureTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

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
    
    tool = new UpdateFeatureTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_feature_update');
      expect(tool.description).toBe('Update an existing feature');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: expect.stringContaining('Feature ID'),
          },
          name: {
            type: 'string',
          },
          status: {
            type: 'string',
            enum: ['new', 'in_progress', 'validation', 'done', 'archived'],
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low'],
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should require feature ID', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Updated' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should require at least one field to update', async () => {
      await expect(tool.execute({ id: 'feat_123' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate email format when updating owner', async () => {
      const input = {
        id: 'feat_123',
        owner_email: 'invalid-email',
      };
      await expect(tool.execute(input as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate status enum', async () => {
      const input = {
        id: 'feat_123',
        status: 'invalid_status',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate priority enum', async () => {
      const input = {
        id: 'feat_123',
        priority: 'invalid_priority',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate name length', async () => {
      const input = {
        id: 'feat_123',
        name: 'A'.repeat(256),
      };
      await expect(tool.execute(input as any)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid update input', () => {
      const validInput = {
        id: 'feat_123456',
        name: 'Updated Authentication Feature',
        status: 'validation' as const,
        priority: 'critical' as const,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should update feature with valid input', async () => {
      const validInput = {
        id: 'feat_123456',
        name: 'Updated Authentication Feature',
        status: 'validation' as const,
        priority: 'critical' as const,
      };
      
      const expectedResponse = {
        id: 'feat_123456',
        name: 'Updated Authentication Feature',
        description: 'Implement OAuth2 authentication for mobile app',
        status: 'validation',
        product_id: 'prod_789',
        component_id: 'comp_456',
        owner_email: 'john.doe@example.com',
        tags: ['authentication', 'mobile', 'security'],
        priority: 'critical',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.patch.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.patch).toHaveBeenCalledWith(
        '/features/feat_123456',
        {
          name: 'Updated Authentication Feature',
          status: 'validation',
          priority: 'critical',
        }
      );
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle partial updates', async () => {
      const partialUpdate = {
        id: 'feat_123',
        status: 'done' as const,
      };
      
      const expectedResponse = {
        id: 'feat_123',
        name: 'User Authentication Feature',
        description: 'Implement OAuth2 authentication for mobile app',
        status: 'done',
        product_id: 'prod_789',
        component_id: 'comp_456',
        owner_email: 'john.doe@example.com',
        tags: ['authentication', 'mobile', 'security'],
        priority: 'high',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };

      mockClient.patch.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(partialUpdate);

      expect(mockClient.patch).toHaveBeenCalledWith('/features/feat_123', {
        status: 'done',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle tag updates', async () => {
      const tagUpdate = {
        id: 'feat_123',
        tags: ['updated', 'tags'],
      };
      
      const expectedResponse = {
        id: 'feat_123',
        name: 'User Authentication Feature',
        description: 'Implement OAuth2 authentication for mobile app',
        status: 'in_progress',
        product_id: 'prod_789',
        component_id: 'comp_456',
        owner_email: 'john.doe@example.com',
        tags: ['updated', 'tags'],
        priority: 'high',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };

      mockClient.patch.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(tagUpdate);

      expect(mockClient.patch).toHaveBeenCalledWith('/features/feat_123', {
        tags: ['updated', 'tags'],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle feature not found error', async () => {
      const error = new Error('Not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Feature not found',
          details: { feature_id: 'feat_nonexistent' },
        },
      };
      mockClient.patch.mockRejectedValueOnce(error);

      const result = await tool.execute({ id: 'feat_nonexistent', name: 'Test' });
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update feature: Not found',
      });
    });

    it('should handle API validation errors', async () => {
      const validInput = {
        id: 'feat_123456',
        name: 'Updated Authentication Feature',
        status: 'validation' as const,
        priority: 'critical' as const,
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
              name: 'Name is required',
              owner_email: 'Invalid email format',
            },
          },
        },
      };
      mockClient.patch.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update feature: Validation error',
      });
    });

    it('should handle concurrent update conflicts', async () => {
      const validInput = {
        id: 'feat_123456',
        name: 'Updated Authentication Feature',
        status: 'validation' as const,
        priority: 'critical' as const,
      };
      
      const error = new Error('Conflict');
      (error as any).response = {
        status: 409,
        data: {
          error: true,
          code: 'CONFLICT',
          message: 'Feature was modified by another user',
        },
      };
      mockClient.patch.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update feature: Conflict',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new UpdateFeatureTool(null as any, mockLogger);
      const validInput = {
        id: 'feat_123456',
        name: 'Updated Authentication Feature',
        status: 'validation' as const,
        priority: 'critical' as const,
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to update feature:'),
      });
    });

    it('should exclude ID from update payload', async () => {
      const input = {
        id: 'feat_123',
        name: 'Updated Name',
        description: 'Updated Description',
      };
      
      const expectedResponse = {
        id: 'feat_123',
        name: 'Updated Name',
        description: 'Updated Description',
        status: 'in_progress',
        product_id: 'prod_789',
        component_id: 'comp_456',
        owner_email: 'john.doe@example.com',
        tags: ['authentication', 'mobile', 'security'],
        priority: 'high',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };

      mockClient.patch.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.patch).toHaveBeenCalledWith('/features/feat_123', {
        name: 'Updated Name',
        description: 'Updated Description',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });
  });

  describe('response transformation', () => {
    it('should return the updated feature data', async () => {
      const updatedFeature = {
        id: 'feat_123456',
        name: 'Completely Updated Feature',
        description: 'Implement OAuth2 authentication for mobile app',
        status: 'in_progress',
        product_id: 'prod_789',
        component_id: 'comp_456',
        owner_email: 'john.doe@example.com',
        tags: ['authentication', 'mobile', 'security'],
        priority: 'high',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: new Date().toISOString(),
      };

      mockClient.patch.mockResolvedValueOnce(updatedFeature);

      const result = await tool.execute({
        id: 'feat_123456',
        name: 'Completely Updated Feature',
      });

      expect(result).toEqual({
        success: true,
        data: updatedFeature,
      });
      
      const responseData = (result as any).data;
      expect(responseData.name).toBe('Completely Updated Feature');
      expect(responseData.updated_at).not.toBe('2024-01-20T14:30:00Z');
    });

    it('should preserve unchanged fields', async () => {
      const partialUpdate = {
        id: 'feat_123456',
        priority: 'low' as const,
      };

      const expectedResponse = {
        id: 'feat_123456',
        name: 'User Authentication Feature',
        description: 'Implement OAuth2 authentication for mobile app',
        status: 'in_progress',
        product_id: 'prod_789',
        component_id: 'comp_456',
        owner_email: 'john.doe@example.com',
        tags: ['authentication', 'mobile', 'security'],
        priority: 'low',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: new Date().toISOString(),
      };

      mockClient.patch.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(partialUpdate);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
      
      const responseData = (result as any).data;
      expect(responseData.name).toBe('User Authentication Feature');
      expect(responseData.description).toBe('Implement OAuth2 authentication for mobile app');
      expect(responseData.status).toBe('in_progress');
      expect(responseData.priority).toBe('low');
    });
  });
});