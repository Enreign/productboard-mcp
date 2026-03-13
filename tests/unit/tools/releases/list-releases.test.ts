import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListReleasesTool } from '@tools/releases/list-releases';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ListReleasesTool', () => {
  let tool: ListReleasesTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  // v2 API format
  const mockReleases = [
    {
      id: 'rel_123',
      fields: { name: 'v1.0.0', status: { name: 'planned' }, release_date: '2024-01-15' },
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'rel_456',
      fields: { name: 'v2.0.0', status: { name: 'in_progress' }, release_date: '2024-06-15' },
      createdAt: '2024-03-01T00:00:00Z',
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

    tool = new ListReleasesTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_release_list');
      expect(tool.description).toContain('List releases with optional filtering');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
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
      const input = { status: 'invalid_status' } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate limit range', async () => {
      await expect(tool.execute({ limit: 0 } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ limit: 101 } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate offset minimum', async () => {
      await expect(tool.execute({ offset: -1 } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid filters', () => {
      const validInput = {
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
      mockClient.makeRequest.mockResolvedValueOnce({ data: mockReleases });

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: { 'type[]': 'release' },
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('v1.0.0');
      expect(result.content[0].text).toContain('v2.0.0');
      expect(result.content[0].text).toContain('Found 2 releases');
    });

    it('should list releases with all filters', async () => {
      const input = {
        status: 'in_progress' as const,
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        limit: 50,
        offset: 0,
      };

      mockClient.makeRequest.mockResolvedValueOnce({ data: [mockReleases[1]] });

      const result = await tool.execute(input);

      // limit and offset are NOT sent to the API (client-side only)
      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: {
          'type[]': 'release',
          status: 'in_progress',
          date_from: '2024-01-01',
          date_to: '2024-12-31',
        },
      });

      expect(result.content[0].text).toContain('v2.0.0');
    });

    it('should handle partial filters', async () => {
      const input = {
        status: 'released' as const,
        limit: 10,
      };

      mockClient.makeRequest.mockResolvedValueOnce({ data: [] });

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: { 'type[]': 'release', status: 'released' },
      });

      expect(result.content[0].text).toBe('No releases found.');
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

    it('should handle error if client not initialized', async () => {
      const uninitializedTool = new ListReleasesTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      mockClient.makeRequest.mockResolvedValueOnce({ data: mockReleases });

      const result = await tool.execute({});

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('v1.0.0');
      expect(result.content[0].text).toContain('Found 2 releases');
    });
  });
});
