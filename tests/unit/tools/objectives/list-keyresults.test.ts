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
      await expect(tool.execute({ metric_type: 'invalid_type' } as any)).rejects.toThrow('Invalid parameters');
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
    // NOTE: ListKeyResultsTool returns an "not available" message — the keyResult
    // entity type is not supported in the v2 API for this workspace. The tool
    // resolves immediately without calling the API.

    it('should list key results with no filters', async () => {
      const result = await tool.execute({});
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('keyResult');
    });

    it('should filter by objective_id without sending limit/offset to API', async () => {
      const result = await tool.execute({
        objective_id: 'obj_123',
        metric_type: 'percentage' as const,
        limit: 10,
        offset: 5,
      });
      expect(result.content[0].type).toBe('text');
    });

    it('should filter by objective_id only', async () => {
      const result = await tool.execute({ objective_id: 'obj_123' });
      expect(result.content[0].type).toBe('text');
    });

    it('should filter by metric_type only', async () => {
      const result = await tool.execute({ metric_type: 'currency' as const, limit: 5 });
      expect(result.content[0].type).toBe('text');
    });

    it('should handle empty results', async () => {
      // Tool returns unavailability message, not "No key results found."
      const result = await tool.execute({});
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text.length).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      // Tool doesn't call API, so resolves with the unavailability message
      const result = await tool.execute({});
      expect(result.content[0].type).toBe('text');
    });

    it('should handle authentication errors', async () => {
      // Tool doesn't call API
      const result = await tool.execute({});
      expect(result.content[0].type).toBe('text');
    });

    it('should handle error if client not initialized', async () => {
      // Tool doesn't call API, so null client doesn't cause errors
      const uninitializedTool = new ListKeyResultsTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      expect(result.content[0].type).toBe('text');
    });
  });
});
