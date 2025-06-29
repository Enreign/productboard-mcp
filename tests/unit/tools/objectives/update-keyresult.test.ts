import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpdateKeyResultTool } from '@tools/objectives/update-keyresult';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('UpdateKeyResultTool', () => {
  let tool: UpdateKeyResultTool;
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
    
    tool = new UpdateKeyResultTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_keyresult_update');
      expect(tool.description).toBe('Update an existing key result');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Key result ID to update',
          },
          name: {
            type: 'string',
            description: 'Key result name',
          },
          metric_type: {
            type: 'string',
            enum: ['number', 'percentage', 'currency'],
            description: 'Type of metric',
          },
          current_value: {
            type: 'number',
            description: 'Current metric value',
          },
          target_value: {
            type: 'number',
            description: 'Target metric value',
          },
          unit: {
            type: 'string',
            description: 'Measurement unit (e.g., "users", "dollars")',
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

    it('should validate metric_type enum', async () => {
      const input = {
        id: 'kr_123',
        metric_type: 'invalid_type',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate numeric fields', async () => {
      const inputInvalidTarget = {
        id: 'kr_123',
        target_value: 'not-a-number',
      } as any;
      await expect(tool.execute(inputInvalidTarget)).rejects.toThrow('Invalid parameters');

      const inputInvalidCurrent = {
        id: 'kr_123',
        current_value: 'not-a-number',
      } as any;
      await expect(tool.execute(inputInvalidCurrent)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        id: 'kr_123',
        name: 'Updated Key Result',
        metric_type: 'number' as const,
        current_value: 7500,
        target_value: 15000,
        unit: 'users',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept partial updates', () => {
      const validInput = {
        id: 'kr_123',
        current_value: 7500,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should update key result with valid input', async () => {
      const validInput = {
        id: 'kr_123',
        name: 'Updated Key Result',
        current_value: 7500,
        target_value: 15000,
      };
      const expectedResponse = {
        id: 'kr_123',
        objective_id: 'obj_456',
        name: 'Updated Key Result',
        metric_type: 'number',
        current_value: 7500,
        target_value: 15000,
        unit: 'users',
        progress: 0.5,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/keyresults/kr_123', {
        name: 'Updated Key Result',
        current_value: 7500,
        target_value: 15000,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update key result with partial data', async () => {
      const validInput = {
        id: 'kr_123',
        current_value: 8000,
      };
      const expectedResponse = {
        id: 'kr_123',
        objective_id: 'obj_456',
        name: 'Existing Key Result',
        metric_type: 'number',
        current_value: 8000,
        target_value: 10000,
        unit: 'users',
        progress: 0.8,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/keyresults/kr_123', {
        current_value: 8000,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update metric type and values', async () => {
      const validInput = {
        id: 'kr_123',
        metric_type: 'percentage' as const,
        current_value: 85,
        target_value: 95,
        unit: '%',
      };
      const expectedResponse = {
        id: 'kr_123',
        objective_id: 'obj_456',
        name: 'User Satisfaction',
        metric_type: 'percentage',
        current_value: 85,
        target_value: 95,
        unit: '%',
        progress: 0.89,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/keyresults/kr_123', {
        metric_type: 'percentage',
        current_value: 85,
        target_value: 95,
        unit: '%',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update currency-based key result', async () => {
      const validInput = {
        id: 'kr_123',
        metric_type: 'currency' as const,
        current_value: 75000,
        target_value: 120000,
        unit: 'USD',
      };
      const expectedResponse = {
        id: 'kr_123',
        objective_id: 'obj_456',
        name: 'Monthly Recurring Revenue',
        metric_type: 'currency',
        current_value: 75000,
        target_value: 120000,
        unit: 'USD',
        progress: 0.625,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/keyresults/kr_123', {
        metric_type: 'currency',
        current_value: 75000,
        target_value: 120000,
        unit: 'USD',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should fail if no update fields provided', async () => {
      const input = {
        id: 'kr_123',
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
        id: 'kr_123',
        current_value: 7500,
      };
      
      mockClient.put.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update key result: API Error',
      });
    });

    it('should handle not found errors', async () => {
      const validInput = {
        id: 'kr_nonexistent',
        current_value: 7500,
      };
      
      const error = new Error('Key result not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Key result not found',
          details: {},
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update key result: Key result not found',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        id: 'kr_123',
        current_value: 7500,
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
        error: 'Failed to update key result: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        id: 'kr_123',
        current_value: 7500,
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
              current_value: 'Current value cannot be greater than target value',
            },
          },
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update key result: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new UpdateKeyResultTool(null as any, mockLogger);
      const validInput = {
        id: 'kr_123',
        current_value: 7500,
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to update key result:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'kr_123',
        objective_id: 'obj_456',
        name: 'Updated Key Result',
        metric_type: 'number',
        current_value: 7500,
        target_value: 15000,
        progress: 0.5,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockClient.put.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'kr_123',
        current_value: 7500,
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'kr_123');
      expect((result as any).data).toHaveProperty('current_value', 7500);
      expect((result as any).data).toHaveProperty('progress', 0.5);
      expect((result as any).data).toHaveProperty('updated_at');
    });

    it('should handle progress calculation correctly', async () => {
      const apiResponse = {
        id: 'kr_123',
        name: 'Test Key Result',
        metric_type: 'percentage',
        current_value: 80,
        target_value: 90,
        progress: 0.89,
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockClient.put.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'kr_123',
        current_value: 80,
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.progress).toBe(0.89);
    });
  });
});