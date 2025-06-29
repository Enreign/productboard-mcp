import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpdateReleaseTool } from '@tools/releases/update-release';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('UpdateReleaseTool', () => {
  let tool: UpdateReleaseTool;
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
    
    tool = new UpdateReleaseTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_release_update');
      expect(tool.description).toBe('Update an existing release');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Release ID to update',
          },
          name: {
            type: 'string',
            description: 'Release name/version',
          },
          date: {
            type: 'string',
            format: 'date',
            description: 'Release date',
          },
          description: {
            type: 'string',
            description: 'Release description',
          },
          status: {
            type: 'string',
            enum: ['planned', 'in_progress', 'released'],
            description: 'Release status',
          },
          release_group_id: {
            type: 'string',
            description: 'Parent release group ID',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate status enum', async () => {
      const input = {
        id: 'rel_123',
        status: 'invalid_status',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate date format', async () => {
      const input = {
        id: 'rel_123',
        date: 'invalid-date',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        id: 'rel_123',
        name: 'v1.0.1',
        date: '2024-01-20',
        description: 'Updated release with bug fixes',
        status: 'in_progress' as const,
        release_group_id: 'group_456',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept partial updates', () => {
      const validInput = {
        id: 'rel_123',
        name: 'v1.0.1',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should update release with valid input', async () => {
      const validInput = {
        id: 'rel_123',
        name: 'v1.0.1',
        date: '2024-01-20',
        description: 'Updated release with bug fixes',
        status: 'in_progress' as const,
        release_group_id: 'group_456',
      };
      const expectedResponse = {
        id: 'rel_123',
        name: 'v1.0.1',
        date: '2024-01-20',
        description: 'Updated release with bug fixes',
        status: 'in_progress',
        release_group_id: 'group_456',
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-15T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/releases/rel_123', {
        name: 'v1.0.1',
        date: '2024-01-20',
        description: 'Updated release with bug fixes',
        status: 'in_progress',
        release_group_id: 'group_456',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update release with partial fields', async () => {
      const partialInput = {
        id: 'rel_123',
        name: 'v1.0.1',
        status: 'released' as const,
      };
      const expectedResponse = {
        id: 'rel_123',
        name: 'v1.0.1',
        status: 'released',
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-15T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(partialInput);

      expect(mockClient.put).toHaveBeenCalledWith('/releases/rel_123', {
        name: 'v1.0.1',
        status: 'released',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should return error when no update fields provided', async () => {
      const input = {
        id: 'rel_123',
      };

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: false,
        error: 'No update fields provided',
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        id: 'rel_123',
        name: 'v1.0.1',
      };
      
      mockClient.put.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update release: API Error',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        id: 'rel_123',
        name: 'v1.0.1',
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
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update release: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        id: 'rel_123',
        name: 'v1.0.1',
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
              id: 'Release not found',
              name: 'Name already exists',
            },
          },
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update release: Validation error',
      });
    });

    it('should handle not found errors', async () => {
      const validInput = {
        id: 'rel_nonexistent',
        name: 'v1.0.1',
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
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update release: Not found',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new UpdateReleaseTool(null as any, mockLogger);
      const validInput = {
        id: 'rel_123',
        name: 'v1.0.1',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to update release:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'rel_123',
        name: 'v1.0.1',
        status: 'in_progress',
        date: '2024-01-20',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      mockClient.put.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'rel_123',
        name: 'v1.0.1',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'rel_123');
      expect((result as any).data).toHaveProperty('name', 'v1.0.1');
      expect((result as any).data).toHaveProperty('updated_at');
    });
  });
});