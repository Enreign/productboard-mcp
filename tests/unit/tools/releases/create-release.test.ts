import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CreateReleaseTool } from '@tools/releases/create-release';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('CreateReleaseTool', () => {
  let tool: CreateReleaseTool;
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
    
    tool = new CreateReleaseTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_release_create');
      expect(tool.description).toBe('Create a new release');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['name', 'date'],
        properties: {
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
      await expect(tool.execute({ name: 'v1.0' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ date: '2024-01-15' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate date format', async () => {
      const input = {
        name: 'v1.0',
        date: 'invalid-date',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        name: 'v1.0.0',
        date: '2024-01-15',
        description: 'Initial release with user authentication',
        release_group_id: 'group_123',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should create release with valid input', async () => {
      const validInput = {
        name: 'v1.0.0',
        date: '2024-01-15',
        description: 'Initial release with user authentication',
        release_group_id: 'group_123',
      };
      const expectedResponse = {
        id: 'rel_123456',
        name: 'v1.0.0',
        date: '2024-01-15',
        description: 'Initial release with user authentication',
        release_group_id: 'group_123',
        status: 'planned',
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-10T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/releases', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create release with minimal required input', async () => {
      const minimalInput = {
        name: 'v1.0.0',
        date: '2024-01-15',
      };
      const expectedResponse = {
        id: 'rel_123456',
        name: 'v1.0.0',
        date: '2024-01-15',
        status: 'planned',
        created_at: '2024-01-10T10:00:00Z',
        updated_at: '2024-01-10T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(minimalInput);

      expect(mockClient.post).toHaveBeenCalledWith('/releases', minimalInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        name: 'v1.0.0',
        date: '2024-01-15',
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create release: API Error',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        name: 'v1.0.0',
        date: '2024-01-15',
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
        error: 'Failed to create release: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        name: 'v1.0.0',
        date: '2024-01-15',
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
              date: 'Invalid date format',
            },
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create release: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new CreateReleaseTool(null as any, mockLogger);
      const validInput = {
        name: 'v1.0.0',
        date: '2024-01-15',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to create release:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'rel_123',
        name: 'v1.0.0',
        date: '2024-01-15',
        status: 'planned',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        name: 'v1.0.0',
        date: '2024-01-15',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'rel_123');
      expect((result as any).data).toHaveProperty('name', 'v1.0.0');
      expect((result as any).data).toHaveProperty('date', '2024-01-15');
    });
  });
});