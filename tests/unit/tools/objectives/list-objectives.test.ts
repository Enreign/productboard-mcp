import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListObjectivesTool } from '@tools/objectives/list-objectives';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ListObjectivesTool', () => {
  let tool: ListObjectivesTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  // v2 API format with fields wrapper
  const mockObjectives = [
    {
      id: 'obj_123',
      fields: { name: 'Increase User Engagement', description: 'Improve engagement', status: { name: 'active' }, owner: { email: 'jane@example.com' } },
      createdAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'obj_456',
      fields: { name: 'Reduce Churn Rate', description: 'Decrease churn', status: { name: 'active' }, owner: { email: 'john@example.com' } },
      createdAt: '2024-01-10T10:00:00Z',
    },
  ];

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
      await expect(tool.execute({ status: 'invalid_status' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate period enum', async () => {
      await expect(tool.execute({ period: 'invalid_period' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate email format', async () => {
      await expect(tool.execute({ owner_email: 'invalid-email' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate limit range', async () => {
      await expect(tool.execute({ limit: 0 } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ limit: 101 } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate offset minimum', async () => {
      await expect(tool.execute({ offset: -1 } as any)).rejects.toThrow('Invalid parameters');
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
      mockClient.makeRequest.mockResolvedValueOnce({ data: mockObjectives });

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: { 'type[]': 'objective' },
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Increase User Engagement');
      expect(result.content[0].text).toContain('Reduce Churn Rate');
    });

    it('should list objectives with filters', async () => {
      const input = {
        status: 'active' as const,
        owner_email: 'jane.doe@example.com',
        period: 'quarter' as const,
        limit: 10,
        offset: 0,
      };

      mockClient.makeRequest.mockResolvedValueOnce({ data: [mockObjectives[0]] });

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: {
          'type[]': 'objective',
          status: 'active',
          owner_email: 'jane.doe@example.com',
          period: 'quarter',
        },
      });

      expect(result.content[0].text).toContain('Increase User Engagement');
    });

    it('should handle partial filters', async () => {
      const input = { status: 'completed' as const, limit: 5 };

      mockClient.makeRequest.mockResolvedValueOnce({ data: [] });

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: { 'type[]': 'objective', status: 'completed' },
      });

      expect(result.content[0].text).toBe('No objectives found.');
    });

    it('should handle API errors gracefully', async () => {
      mockClient.makeRequest.mockRejectedValueOnce(new Error('API Error'));
      const result = await tool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Authentication failed');
      (error as any).response = { status: 401, data: {} };
      mockClient.makeRequest.mockRejectedValueOnce(error);
      const result = await tool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });

    it('should handle forbidden errors', async () => {
      const error = new Error('Insufficient permissions');
      (error as any).response = { status: 403, data: {} };
      mockClient.makeRequest.mockRejectedValueOnce(error);
      const result = await tool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });

    it('should handle error if client not initialized', async () => {
      const uninitializedTool = new ListObjectivesTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        data: [
          {
            id: 'obj_123',
            fields: { name: 'Test Objective', description: 'Test Description', status: { name: 'active' } },
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Test Objective');
      expect(result.content[0].text).toContain('Found 1 objectives');
    });

    it('should handle empty results', async () => {
      mockClient.makeRequest.mockResolvedValueOnce({ data: [] });
      const result = await tool.execute({});
      expect(result.content[0].text).toBe('No objectives found.');
    });
  });
});
