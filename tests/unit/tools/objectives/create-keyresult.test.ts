import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CreateKeyResultTool } from '@tools/objectives/create-keyresult';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('CreateKeyResultTool', () => {
  let tool: CreateKeyResultTool;
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
    
    tool = new CreateKeyResultTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_keyresult_create');
      expect(tool.description).toBe('Create a key result for an objective');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['objective_id', 'name', 'target_value'],
        properties: {
          objective_id: {
            type: 'string',
            description: 'Parent objective ID',
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
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ objective_id: 'obj_123' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ objective_id: 'obj_123', name: 'Test KR' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Test KR', target_value: 100 } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate metric_type enum', async () => {
      const input = {
        objective_id: 'obj_123',
        name: 'Increase DAU',
        target_value: 10000,
        metric_type: 'invalid_type',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate numeric fields', async () => {
      const inputInvalidTarget = {
        objective_id: 'obj_123',
        name: 'Increase DAU',
        target_value: 'not-a-number',
      } as any;
      await expect(tool.execute(inputInvalidTarget)).rejects.toThrow('Invalid parameters');

      const inputInvalidCurrent = {
        objective_id: 'obj_123',
        name: 'Increase DAU',
        target_value: 10000,
        current_value: 'not-a-number',
      } as any;
      await expect(tool.execute(inputInvalidCurrent)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        metric_type: 'number' as const,
        current_value: 5000,
        target_value: 10000,
        unit: 'users',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept minimal valid input', () => {
      const validInput = {
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        target_value: 10000,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should create key result with full input', async () => {
      const validInput = {
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        metric_type: 'number' as const,
        current_value: 5000,
        target_value: 10000,
        unit: 'users',
      };
      const expectedResponse = {
        id: 'kr_456789',
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        metric_type: 'number',
        current_value: 5000,
        target_value: 10000,
        unit: 'users',
        progress: 0.5,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/keyresults', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create key result with minimal input', async () => {
      const minimalInput = {
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        target_value: 10000,
      };
      const expectedResponse = {
        id: 'kr_456789',
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        target_value: 10000,
        current_value: 0,
        progress: 0,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(minimalInput);

      expect(mockClient.post).toHaveBeenCalledWith('/keyresults', minimalInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create percentage-based key result', async () => {
      const validInput = {
        objective_id: 'obj_123',
        name: 'Improve User Satisfaction',
        metric_type: 'percentage' as const,
        current_value: 75,
        target_value: 90,
        unit: '%',
      };
      const expectedResponse = {
        id: 'kr_456789',
        objective_id: 'obj_123',
        name: 'Improve User Satisfaction',
        metric_type: 'percentage',
        current_value: 75,
        target_value: 90,
        unit: '%',
        progress: 0.83, // (75-0)/(90-0) 
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/keyresults', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create currency-based key result', async () => {
      const validInput = {
        objective_id: 'obj_123',
        name: 'Increase MRR',
        metric_type: 'currency' as const,
        current_value: 50000,
        target_value: 100000,
        unit: 'USD',
      };
      const expectedResponse = {
        id: 'kr_456789',
        objective_id: 'obj_123',
        name: 'Increase MRR',
        metric_type: 'currency',
        current_value: 50000,
        target_value: 100000,
        unit: 'USD',
        progress: 0.5,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/keyresults', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        target_value: 10000,
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create key result: API Error',
      });
    });

    it('should handle invalid objective_id errors', async () => {
      const validInput = {
        objective_id: 'obj_nonexistent',
        name: 'Increase Daily Active Users',
        target_value: 10000,
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
        error: 'Failed to create key result: Objective not found',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        target_value: 10000,
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
        error: 'Failed to create key result: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        target_value: 10000,
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
              target_value: 'Target value must be greater than current value',
            },
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create key result: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new CreateKeyResultTool(null as any, mockLogger);
      const validInput = {
        objective_id: 'obj_123',
        name: 'Increase Daily Active Users',
        target_value: 10000,
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to create key result:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'kr_123',
        objective_id: 'obj_456',
        name: 'Test Key Result',
        metric_type: 'number',
        current_value: 50,
        target_value: 100,
        progress: 0.5,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        objective_id: 'obj_456',
        name: 'Test Key Result',
        target_value: 100,
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'kr_123');
      expect((result as any).data).toHaveProperty('objective_id', 'obj_456');
      expect((result as any).data).toHaveProperty('progress', 0.5);
      expect((result as any).data).toHaveProperty('created_at');
    });
  });
});