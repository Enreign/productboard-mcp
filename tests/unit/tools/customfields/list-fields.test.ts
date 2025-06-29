import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListCustomFieldsTool } from '@tools/customfields/list-fields';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ListCustomFieldsTool', () => {
  let tool: ListCustomFieldsTool;
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
    
    tool = new ListCustomFieldsTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_customfield_list');
      expect(tool.description).toBe('List custom fields with optional filtering');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          entity_type: {
            type: 'string',
            enum: ['feature', 'note', 'objective'],
            description: 'Filter by entity type',
          },
          type: {
            type: 'string',
            enum: ['text', 'number', 'date', 'select', 'multiselect', 'boolean'],
            description: 'Filter by field type',
          },
          required: {
            type: 'boolean',
            description: 'Filter by required status',
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

    it('should validate entity_type enum', async () => {
      const input = {
        entity_type: 'invalid_entity',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate type enum', async () => {
      const input = {
        type: 'invalid_type',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid filters', () => {
      const validInput = {
        entity_type: 'feature' as const,
        type: 'text' as const,
        required: true,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should list all custom fields without filters', async () => {
      const expectedResponse = {
        fields: [
          {
            id: 'cf_123',
            name: 'Priority Level',
            type: 'text',
            description: 'Priority level for features',
            required: true,
            entity_type: 'feature',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'cf_456',
            name: 'Story Points',
            type: 'number',
            description: 'Estimated story points',
            required: false,
            entity_type: 'feature',
            created_at: '2024-01-02T00:00:00Z',
          },
          {
            id: 'cf_789',
            name: 'Meeting Type',
            type: 'select',
            description: 'Type of meeting',
            required: false,
            options: ['standup', 'review', 'planning'],
            entity_type: 'note',
            created_at: '2024-01-03T00:00:00Z',
          },
        ],
        total: 3,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/customfields',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list custom fields filtered by entity_type', async () => {
      const input = {
        entity_type: 'feature' as const,
      };
      const expectedResponse = {
        fields: [
          {
            id: 'cf_123',
            name: 'Priority Level',
            type: 'text',
            description: 'Priority level for features',
            required: true,
            entity_type: 'feature',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'cf_456',
            name: 'Story Points',
            type: 'number',
            description: 'Estimated story points',
            required: false,
            entity_type: 'feature',
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
        total: 2,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/customfields',
        params: {
          entity_type: 'feature',
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list custom fields filtered by type', async () => {
      const input = {
        type: 'select' as const,
      };
      const expectedResponse = {
        fields: [
          {
            id: 'cf_789',
            name: 'Meeting Type',
            type: 'select',
            description: 'Type of meeting',
            required: false,
            options: ['standup', 'review', 'planning'],
            entity_type: 'note',
            created_at: '2024-01-03T00:00:00Z',
          },
          {
            id: 'cf_890',
            name: 'Feature Status',
            type: 'select',
            description: 'Current status of the feature',
            required: true,
            options: ['draft', 'review', 'approved', 'rejected'],
            entity_type: 'feature',
            created_at: '2024-01-04T00:00:00Z',
          },
        ],
        total: 2,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/customfields',
        params: {
          type: 'select',
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list custom fields filtered by required status', async () => {
      const input = {
        required: true,
      };
      const expectedResponse = {
        fields: [
          {
            id: 'cf_123',
            name: 'Priority Level',
            type: 'text',
            description: 'Priority level for features',
            required: true,
            entity_type: 'feature',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'cf_890',
            name: 'Feature Status',
            type: 'select',
            description: 'Current status of the feature',
            required: true,
            options: ['draft', 'review', 'approved', 'rejected'],
            entity_type: 'feature',
            created_at: '2024-01-04T00:00:00Z',
          },
        ],
        total: 2,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/customfields',
        params: {
          required: true,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list custom fields with multiple filters', async () => {
      const input = {
        entity_type: 'feature' as const,
        type: 'text' as const,
        required: false,
      };
      const expectedResponse = {
        fields: [
          {
            id: 'cf_234',
            name: 'Description',
            type: 'text',
            description: 'Additional feature description',
            required: false,
            entity_type: 'feature',
            created_at: '2024-01-05T00:00:00Z',
          },
        ],
        total: 1,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/customfields',
        params: {
          entity_type: 'feature',
          type: 'text',
          required: false,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle empty results', async () => {
      const input = {
        entity_type: 'objective' as const,
        type: 'boolean' as const,
      };
      const expectedResponse = {
        fields: [],
        total: 0,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

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
        error: 'Failed to list custom fields: API Error',
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
        error: 'Failed to list custom fields: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const input = {
        entity_type: 'feature' as const,
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid filter parameters',
          details: {
            entity_type: 'Invalid entity type',
          },
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute(input);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to list custom fields: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ListCustomFieldsTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to list custom fields:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        fields: [
          {
            id: 'cf_123',
            name: 'Priority Level',
            type: 'text',
            description: 'Priority level for features',
            required: true,
            entity_type: 'feature',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('fields');
      expect((result as any).data).toHaveProperty('total', 1);
      expect((result as any).data.fields[0]).toHaveProperty('id', 'cf_123');
      expect((result as any).data.fields[0]).toHaveProperty('name', 'Priority Level');
      expect((result as any).data.fields[0]).toHaveProperty('type', 'text');
    });

    it('should transform API response with select field options', async () => {
      const apiResponse = {
        fields: [
          {
            id: 'cf_789',
            name: 'Feature Status',
            type: 'select',
            description: 'Current status of the feature',
            required: true,
            options: ['draft', 'review', 'approved', 'rejected'],
            entity_type: 'feature',
            created_at: '2024-01-04T00:00:00Z',
          },
        ],
        total: 1,
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({ type: 'select' });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.fields[0]).toHaveProperty('options');
      expect((result as any).data.fields[0].options).toEqual(['draft', 'review', 'approved', 'rejected']);
    });
  });
});