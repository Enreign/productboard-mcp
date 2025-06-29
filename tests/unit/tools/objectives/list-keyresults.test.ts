import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListKeyResultsTool } from '@tools/objectives/list-keyresults';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ListKeyResultsTool', () => {
  let tool: ListKeyResultsTool;
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
    
    tool = new ListKeyResultsTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_keyresult_list');
      expect(tool.description).toBe('List key results with optional filtering');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          objective_id: {
            type: 'string',
            description: 'Filter by objective ID',
          },
          metric_type: {
            type: 'string',
            enum: ['number', 'percentage', 'currency'],
            description: 'Filter by metric type',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of key results to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of key results to skip',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should accept empty parameters', () => {
      const validation = tool.validateParams({});
      expect(validation.valid).toBe(true);
    });

    it('should validate metric_type enum', async () => {
      const input = {
        metric_type: 'invalid_type',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate limit range', async () => {
      const inputTooLow = { limit: 0 } as any;
      await expect(tool.execute(inputTooLow)).rejects.toThrow('Invalid parameters');
      
      const inputTooHigh = { limit: 101 } as any;
      await expect(tool.execute(inputTooHigh)).rejects.toThrow('Invalid parameters');
    });

    it('should validate offset minimum', async () => {
      const input = { offset: -1 } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        objective_id: 'obj_123',
        metric_type: 'number' as const,
        limit: 10,
        offset: 5,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should list key results with no filters', async () => {
      const expectedResponse = {
        keyResults: [
          {
            id: 'kr_123',
            objective_id: 'obj_456',
            name: 'Increase Daily Active Users',
            metric_type: 'number',
            current_value: 5000,
            target_value: 10000,
            unit: 'users',
            progress: 0.5,
            created_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'kr_789',
            objective_id: 'obj_456',
            name: 'Improve User Satisfaction',
            metric_type: 'percentage',
            current_value: 75,
            target_value: 90,
            unit: '%',
            progress: 0.83,
            created_at: '2024-01-10T10:00:00Z',
          },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/keyresults',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list key results with filters', async () => {
      const input = {
        objective_id: 'obj_123',
        metric_type: 'percentage' as const,
        limit: 10,
        offset: 5,
      };
      const expectedResponse = {
        keyResults: [
          {
            id: 'kr_789',
            objective_id: 'obj_123',
            name: 'Improve User Satisfaction',
            metric_type: 'percentage',
            current_value: 75,
            target_value: 90,
            unit: '%',
            progress: 0.83,
            created_at: '2024-01-15T10:00:00Z',
          },
        ],
        total: 1,
        limit: 10,
        offset: 5,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/keyresults',
        params: {
          objective_id: 'obj_123',
          metric_type: 'percentage',
          limit: 10,
          offset: 5,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list key results by objective only', async () => {
      const input = {
        objective_id: 'obj_123',
      };
      const expectedResponse = {
        keyResults: [
          {
            id: 'kr_123',
            objective_id: 'obj_123',
            name: 'Increase Daily Active Users',
            metric_type: 'number',
            current_value: 5000,
            target_value: 10000,
            unit: 'users',
            progress: 0.5,
            created_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'kr_456',
            objective_id: 'obj_123',
            name: 'Increase MRR',
            metric_type: 'currency',
            current_value: 50000,
            target_value: 100000,
            unit: 'USD',
            progress: 0.5,
            created_at: '2024-01-10T10:00:00Z',
          },
        ],
        total: 2,
        limit: 20,
        offset: 0,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/keyresults',
        params: {
          objective_id: 'obj_123',
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list key results by metric type only', async () => {
      const input = {
        metric_type: 'currency' as const,
        limit: 5,
      };
      const expectedResponse = {
        keyResults: [
          {
            id: 'kr_456',
            objective_id: 'obj_123',
            name: 'Increase MRR',
            metric_type: 'currency',
            current_value: 50000,
            target_value: 100000,
            unit: 'USD',
            progress: 0.5,
            created_at: '2024-01-10T10:00:00Z',
          },
        ],
        total: 1,
        limit: 5,
        offset: 0,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/keyresults',
        params: {
          metric_type: 'currency',
          limit: 5,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      mockClient.makeRequest.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to list key results: API Error',
      });
    });

    it('should handle authentication errors', async () => {
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

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to list key results: Authentication failed',
      });
    });

    it('should handle forbidden errors', async () => {
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
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to list key results: Insufficient permissions',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ListKeyResultsTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to list key results:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        keyResults: [
          {
            id: 'kr_123',
            objective_id: 'obj_456',
            name: 'Test Key Result',
            metric_type: 'number',
            current_value: 50,
            target_value: 100,
            progress: 0.5,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('keyResults');
      expect((result as any).data).toHaveProperty('total', 1);
      expect((result as any).data.keyResults[0]).toHaveProperty('id', 'kr_123');
      expect((result as any).data.keyResults[0]).toHaveProperty('progress', 0.5);
    });

    it('should handle empty results', async () => {
      const apiResponse = {
        keyResults: [],
        total: 0,
        limit: 20,
        offset: 0,
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.keyResults).toHaveLength(0);
    });

    it('should handle different metric types correctly', async () => {
      const apiResponse = {
        keyResults: [
          {
            id: 'kr_123',
            name: 'Number Metric',
            metric_type: 'number',
            current_value: 5000,
            target_value: 10000,
            unit: 'users',
            progress: 0.5,
          },
          {
            id: 'kr_456',
            name: 'Percentage Metric',
            metric_type: 'percentage',
            current_value: 75,
            target_value: 90,
            unit: '%',
            progress: 0.83,
          },
          {
            id: 'kr_789',
            name: 'Currency Metric',
            metric_type: 'currency',
            current_value: 50000,
            target_value: 100000,
            unit: 'USD',
            progress: 0.5,
          },
        ],
        total: 3,
        limit: 20,
        offset: 0,
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.keyResults).toHaveLength(3);
      expect((result as any).data.keyResults[0].metric_type).toBe('number');
      expect((result as any).data.keyResults[1].metric_type).toBe('percentage');
      expect((result as any).data.keyResults[2].metric_type).toBe('currency');
    });
  });
});