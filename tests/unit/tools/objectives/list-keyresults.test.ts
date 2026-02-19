import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListKeyResultsTool } from '@tools/objectives/list-keyresults';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ListKeyResultsTool', () => {
  let tool: ListKeyResultsTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  const mockKeyResults = [
    {
      id: 'kr_123',
      objective_id: 'obj_456',
      name: 'Increase Daily Active Users',
      metric_type: 'number',
      current_value: 5000,
      target_value: 10000,
    },
    {
      id: 'kr_789',
      objective_id: 'obj_456',
      name: 'Improve User Satisfaction',
      metric_type: 'percentage',
      current_value: 75,
      target_value: 90,
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
      mockClient.makeRequest.mockResolvedValueOnce({ data: mockKeyResults });

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/key-results',
        params: {},
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Increase Daily Active Users');
      expect(result.content[0].text).toContain('Improve User Satisfaction');
      expect(result.content[0].text).toContain('Found 2 key results');
    });

    it('should filter by objective_id without sending limit/offset to API', async () => {
      mockClient.makeRequest.mockResolvedValueOnce({ data: [mockKeyResults[0]] });

      await tool.execute({
        objective_id: 'obj_123',
        metric_type: 'percentage' as const,
        limit: 10,
        offset: 5,
      });

      // limit and offset are NOT sent to the API (client-side only)
      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/key-results',
        params: {
          objective_id: 'obj_123',
          metric_type: 'percentage',
        },
      });
    });

    it('should filter by objective_id only', async () => {
      mockClient.makeRequest.mockResolvedValueOnce({ data: mockKeyResults });

      const result = await tool.execute({ objective_id: 'obj_123' });

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/key-results',
        params: { objective_id: 'obj_123' },
      });

      expect(result.content[0].text).toContain('Increase Daily Active Users');
    });

    it('should filter by metric_type only', async () => {
      mockClient.makeRequest.mockResolvedValueOnce({ data: [mockKeyResults[1]] });

      const result = await tool.execute({ metric_type: 'currency' as const, limit: 5 });

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/key-results',
        params: { metric_type: 'currency' },
      });

      expect(result.content[0].text).toContain('Improve User Satisfaction');
    });

    it('should handle empty results', async () => {
      mockClient.makeRequest.mockResolvedValueOnce({ data: [] });

      const result = await tool.execute({});

      expect(result.content[0].text).toBe('No key results found.');
    });

    it('should handle API errors gracefully', async () => {
      mockClient.makeRequest.mockRejectedValueOnce(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('API Error');
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Authentication failed');
      (error as any).response = {
        status: 401,
        data: { error: true, code: 'AUTH_FAILED', message: 'Authentication failed', details: {} },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      await expect(tool.execute({})).rejects.toThrow('Authentication failed');
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ListKeyResultsTool(null as any, mockLogger);
      await expect(uninitializedTool.execute({})).rejects.toThrow();
    });
  });
});
