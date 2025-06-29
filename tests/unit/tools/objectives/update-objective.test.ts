import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpdateObjectiveTool } from '@tools/objectives/update-objective';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('UpdateObjectiveTool', () => {
  let tool: UpdateObjectiveTool;
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
    
    tool = new UpdateObjectiveTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_objective_update');
      expect(tool.description).toBe('Update an existing objective');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Objective ID to update',
          },
          name: {
            type: 'string',
            description: 'Objective name',
          },
          description: {
            type: 'string',
            description: 'Objective description',
          },
          status: {
            type: 'string',
            enum: ['active', 'completed', 'cancelled'],
            description: 'Objective status',
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
    it('should validate required id field', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Test' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate email format', async () => {
      const input = {
        id: 'obj_123',
        owner_email: 'invalid-email',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate status enum', async () => {
      const input = {
        id: 'obj_123',
        status: 'invalid_status',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate period enum', async () => {
      const input = {
        id: 'obj_123',
        period: 'invalid_period',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate due_date format', async () => {
      const input = {
        id: 'obj_123',
        due_date: 'invalid-date',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        id: 'obj_123',
        name: 'Updated Objective',
        description: 'Updated description',
        status: 'active' as const,
        owner_email: 'jane.doe@example.com',
        due_date: '2024-06-30',
        period: 'quarter' as const,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept partial updates', () => {
      const validInput = {
        id: 'obj_123',
        name: 'Updated Objective',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should update objective with valid input', async () => {
      const validInput = {
        id: 'obj_123',
        name: 'Updated Objective',
        description: 'Updated description',
        status: 'active' as const,
      };
      const expectedResponse = {
        id: 'obj_123',
        name: 'Updated Objective',
        description: 'Updated description',
        status: 'active',
        owner_email: 'jane.doe@example.com',
        due_date: '2024-06-30',
        period: 'quarter',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/objectives/obj_123', {
        name: 'Updated Objective',
        description: 'Updated description',
        status: 'active',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update objective with partial data', async () => {
      const validInput = {
        id: 'obj_123',
        status: 'completed' as const,
      };
      const expectedResponse = {
        id: 'obj_123',
        name: 'Existing Objective',
        description: 'Existing description',
        status: 'completed',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/objectives/obj_123', {
        status: 'completed',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should fail if no update fields provided', async () => {
      const input = {
        id: 'obj_123',
      };

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: false,
        error: 'No update fields provided',
      });
      expect(mockClient.put).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        id: 'obj_123',
        name: 'Updated Objective',
      };
      
      mockClient.put.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update objective: API Error',
      });
    });

    it('should handle not found errors', async () => {
      const validInput = {
        id: 'obj_nonexistent',
        name: 'Updated Objective',
      };
      
      const error = new Error('Objective not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Objective not found',
          details: {},
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update objective: Objective not found',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        id: 'obj_123',
        name: 'Updated Objective',
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
        error: 'Failed to update objective: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        id: 'obj_123',
        name: 'Updated Objective',
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
              status: 'Invalid status value',
            },
          },
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update objective: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new UpdateObjectiveTool(null as any, mockLogger);
      const validInput = {
        id: 'obj_123',
        name: 'Updated Objective',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to update objective:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'obj_123',
        name: 'Updated Objective',
        description: 'Updated Description',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockClient.put.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'obj_123',
        name: 'Updated Objective',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'obj_123');
      expect((result as any).data).toHaveProperty('name', 'Updated Objective');
      expect((result as any).data).toHaveProperty('updated_at');
    });
  });
});