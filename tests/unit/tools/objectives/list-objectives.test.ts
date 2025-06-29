import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListObjectivesTool } from '@tools/objectives/list-objectives';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ListObjectivesTool', () => {
  let tool: ListObjectivesTool;
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
    
    tool = new ListObjectivesTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_objective_list');
      expect(tool.description).toBe('List objectives with optional filtering');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'completed', 'cancelled'],
            description: 'Filter by objective status',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Filter by owner email',
          },
          period: {
            type: 'string',
            enum: ['quarter', 'year'],
            description: 'Filter by objective period',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of objectives to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of objectives to skip',
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

    it('should validate status enum', async () => {
      const input = {
        status: 'invalid_status',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate period enum', async () => {
      const input = {
        period: 'invalid_period',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate email format', async () => {
      const input = {
        owner_email: 'invalid-email',
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
        status: 'active' as const,
        owner_email: 'jane.doe@example.com',
        period: 'quarter' as const,
        limit: 10,
        offset: 5,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should list objectives with no filters', async () => {
      const expectedResponse = {
        objectives: [
          {
            id: 'obj_123',
            name: 'Increase User Engagement',
            description: 'Improve user engagement metrics',
            status: 'active',
            period: 'quarter',
            created_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'obj_456',
            name: 'Reduce Churn Rate',
            description: 'Decrease monthly churn rate',
            status: 'active',
            period: 'quarter',
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
        endpoint: '/objectives',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list objectives with filters', async () => {
      const input = {
        status: 'active' as const,
        owner_email: 'jane.doe@example.com',
        period: 'quarter' as const,
        limit: 10,
        offset: 5,
      };
      const expectedResponse = {
        objectives: [
          {
            id: 'obj_123',
            name: 'Increase User Engagement',
            description: 'Improve user engagement metrics',
            status: 'active',
            period: 'quarter',
            owner_email: 'jane.doe@example.com',
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
        endpoint: '/objectives',
        params: {
          status: 'active',
          owner_email: 'jane.doe@example.com',
          period: 'quarter',
          limit: 10,
          offset: 5,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle partial filters', async () => {
      const input = {
        status: 'completed' as const,
        limit: 5,
      };
      const expectedResponse = {
        objectives: [],
        total: 0,
        limit: 5,
        offset: 0,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/objectives',
        params: {
          status: 'completed',
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
        error: 'Failed to list objectives: API Error',
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
        error: 'Failed to list objectives: Authentication failed',
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
        error: 'Failed to list objectives: Insufficient permissions',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ListObjectivesTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to list objectives:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        objectives: [
          {
            id: 'obj_123',
            name: 'Test Objective',
            description: 'Test Description',
            status: 'active',
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
      expect((result as any).data).toHaveProperty('objectives');
      expect((result as any).data).toHaveProperty('total', 1);
      expect((result as any).data.objectives[0]).toHaveProperty('id', 'obj_123');
    });

    it('should handle empty results', async () => {
      const apiResponse = {
        objectives: [],
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
      expect((result as any).data.objectives).toHaveLength(0);
    });
  });
});