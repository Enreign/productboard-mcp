import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListReleasesTool } from '@tools/releases/list-releases';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ListReleasesTool', () => {
  let tool: ListReleasesTool;
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
    
    tool = new ListReleasesTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_release_list');
      expect(tool.description).toBe('List releases with optional filtering');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          release_group_id: {
            type: 'string',
            description: 'Filter by release group',
          },
          status: {
            type: 'string',
            enum: ['planned', 'in_progress', 'released'],
            description: 'Filter by release status',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Filter releases after this date',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'Filter releases before this date',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 20,
            description: 'Maximum number of releases to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of releases to skip',
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

    it('should validate limit range', async () => {
      const invalidMinLimit = { limit: 0 } as any;
      await expect(tool.execute(invalidMinLimit)).rejects.toThrow('Invalid parameters');

      const invalidMaxLimit = { limit: 101 } as any;
      await expect(tool.execute(invalidMaxLimit)).rejects.toThrow('Invalid parameters');
    });

    it('should validate offset minimum', async () => {
      const input = { offset: -1 } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid filters', () => {
      const validInput = {
        release_group_id: 'group_123',
        status: 'in_progress' as const,
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        limit: 50,
        offset: 10,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should list releases without filters', async () => {
      const expectedResponse = {
        releases: [
          {
            id: 'rel_123',
            name: 'v1.0.0',
            status: 'planned',
            date: '2024-01-15',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'rel_456',
            name: 'v2.0.0',
            status: 'in_progress',
            date: '2024-06-15',
            created_at: '2024-03-01T00:00:00Z',
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
        endpoint: '/releases',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list releases with all filters', async () => {
      const input = {
        release_group_id: 'group_123',
        status: 'in_progress' as const,
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        limit: 50,
        offset: 10,
      };
      const expectedResponse = {
        releases: [
          {
            id: 'rel_789',
            name: 'v1.5.0',
            status: 'in_progress',
            date: '2024-03-15',
            release_group_id: 'group_123',
            created_at: '2024-02-01T00:00:00Z',
          },
        ],
        total: 1,
        limit: 50,
        offset: 10,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/releases',
        params: {
          release_group_id: 'group_123',
          status: 'in_progress',
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          limit: 50,
          offset: 10,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle partial filters', async () => {
      const input = {
        status: 'released' as const,
        limit: 10,
      };
      const expectedResponse = {
        releases: [],
        total: 0,
        limit: 10,
        offset: 0,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/releases',
        params: {
          status: 'released',
          limit: 10,
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
        error: 'Failed to list releases: API Error',
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
        error: 'Failed to list releases: Authentication failed',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ListReleasesTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to list releases:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        releases: [
          {
            id: 'rel_123',
            name: 'v1.0.0',
            status: 'planned',
            date: '2024-01-15',
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
      expect((result as any).data).toHaveProperty('releases');
      expect((result as any).data).toHaveProperty('total', 1);
      expect((result as any).data.releases[0]).toHaveProperty('id', 'rel_123');
    });
  });
});