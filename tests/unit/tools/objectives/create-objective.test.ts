import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CreateObjectiveTool } from '@tools/objectives/create-objective';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('CreateObjectiveTool', () => {
  let tool: CreateObjectiveTool;
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
    
    tool = new CreateObjectiveTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_objective_create');
      expect(tool.description).toBe('Create a new objective');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: {
            type: 'string',
            description: 'Objective name',
          },
          description: {
            type: 'string',
            description: 'Objective description',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Objective owner',
          },
          due_date: {
            type: 'string',
            format: 'date',
            description: 'Target completion date',
          },
          period: {
            type: 'string',
            enum: ['quarter', 'year'],
            description: 'Objective period',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Test Objective' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ description: 'Test description' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate email format', async () => {
      const input = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
        owner_email: 'invalid-email',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate period enum', async () => {
      const input = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
        period: 'invalid_period',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate due_date format', async () => {
      const input = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
        due_date: 'invalid-date',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
        owner_email: 'jane.doe@example.com',
        due_date: '2024-06-30',
        period: 'quarter' as const,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should create objective with valid input', async () => {
      const validInput = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
        owner_email: 'jane.doe@example.com',
        due_date: '2024-06-30',
        period: 'quarter' as const,
      };
      const expectedResponse = {
        id: 'obj_123456',
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
        owner_email: 'jane.doe@example.com',
        due_date: '2024-06-30',
        period: 'quarter',
        status: 'active',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/objectives', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create objective with minimal input', async () => {
      const minimalInput = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
      };
      const expectedResponse = {
        id: 'obj_123456',
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
        status: 'active',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(minimalInput);

      expect(mockClient.post).toHaveBeenCalledWith('/objectives', minimalInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create objective: API Error',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
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
        error: 'Failed to create objective: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
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
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create objective: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new CreateObjectiveTool(null as any, mockLogger);
      const validInput = {
        name: 'Increase User Engagement',
        description: 'Improve user engagement metrics for Q2',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to create objective:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'obj_123',
        name: 'Test Objective',
        description: 'Test Description',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        name: 'Test Objective',
        description: 'Test Description',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'obj_123');
      expect((result as any).data).toHaveProperty('name', 'Test Objective');
      expect((result as any).data).toHaveProperty('created_at');
    });
  });
});