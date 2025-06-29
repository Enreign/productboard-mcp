import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CreateCustomFieldTool } from '@tools/customfields/create-field';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('CreateCustomFieldTool', () => {
  let tool: CreateCustomFieldTool;
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
    
    tool = new CreateCustomFieldTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_customfield_create');
      expect(tool.description).toBe('Create a new custom field');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['name', 'type', 'entity_type'],
        properties: {
          name: {
            type: 'string',
            description: 'Custom field name',
          },
          type: {
            type: 'string',
            enum: ['text', 'number', 'date', 'select', 'multiselect', 'boolean'],
            description: 'Field data type',
          },
          description: {
            type: 'string',
            description: 'Field description',
          },
          required: {
            type: 'boolean',
            default: false,
            description: 'Whether the field is required',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Options for select/multiselect fields',
          },
          entity_type: {
            type: 'string',
            enum: ['feature', 'note', 'objective'],
            description: 'Entity type this field applies to',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Test Field' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Test Field', type: 'text' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate type enum', async () => {
      const input = {
        name: 'Test Field',
        type: 'invalid_type',
        entity_type: 'feature',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate entity_type enum', async () => {
      const input = {
        name: 'Test Field',
        type: 'text',
        entity_type: 'invalid_entity',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input for text field', () => {
      const validInput = {
        name: 'Priority Level',
        type: 'text' as const,
        description: 'Priority level for features',
        required: true,
        entity_type: 'feature' as const,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept valid input for select field', () => {
      const validInput = {
        name: 'Status',
        type: 'select' as const,
        description: 'Feature status',
        required: false,
        options: ['draft', 'review', 'approved'],
        entity_type: 'feature' as const,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should create text custom field', async () => {
      const validInput = {
        name: 'Priority Level',
        type: 'text' as const,
        description: 'Priority level for features',
        required: true,
        entity_type: 'feature' as const,
      };
      const expectedResponse = {
        id: 'cf_123456',
        name: 'Priority Level',
        type: 'text',
        description: 'Priority level for features',
        required: true,
        entity_type: 'feature',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/customfields', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create number custom field', async () => {
      const validInput = {
        name: 'Story Points',
        type: 'number' as const,
        description: 'Estimated story points',
        entity_type: 'feature' as const,
      };
      const expectedResponse = {
        id: 'cf_789012',
        name: 'Story Points',
        type: 'number',
        description: 'Estimated story points',
        required: false,
        entity_type: 'feature',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/customfields', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create select custom field with options', async () => {
      const validInput = {
        name: 'Feature Status',
        type: 'select' as const,
        description: 'Current status of the feature',
        required: true,
        options: ['draft', 'review', 'approved', 'rejected'],
        entity_type: 'feature' as const,
      };
      const expectedResponse = {
        id: 'cf_345678',
        name: 'Feature Status',
        type: 'select',
        description: 'Current status of the feature',
        required: true,
        options: ['draft', 'review', 'approved', 'rejected'],
        entity_type: 'feature',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/customfields', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create multiselect custom field with options', async () => {
      const validInput = {
        name: 'Tags',
        type: 'multiselect' as const,
        description: 'Feature tags',
        options: ['ui', 'backend', 'mobile', 'web', 'api'],
        entity_type: 'feature' as const,
      };
      const expectedResponse = {
        id: 'cf_567890',
        name: 'Tags',
        type: 'multiselect',
        description: 'Feature tags',
        required: false,
        options: ['ui', 'backend', 'mobile', 'web', 'api'],
        entity_type: 'feature',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/customfields', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create date custom field', async () => {
      const validInput = {
        name: 'Target Release Date',
        type: 'date' as const,
        description: 'Target date for feature release',
        entity_type: 'feature' as const,
      };
      const expectedResponse = {
        id: 'cf_234567',
        name: 'Target Release Date',
        type: 'date',
        description: 'Target date for feature release',
        required: false,
        entity_type: 'feature',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create boolean custom field', async () => {
      const validInput = {
        name: 'Is Breaking Change',
        type: 'boolean' as const,
        description: 'Whether this feature contains breaking changes',
        entity_type: 'feature' as const,
      };
      const expectedResponse = {
        id: 'cf_890123',
        name: 'Is Breaking Change',
        type: 'boolean',
        description: 'Whether this feature contains breaking changes',
        required: false,
        entity_type: 'feature',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should return error when options are missing for select field', async () => {
      const input = {
        name: 'Status',
        type: 'select' as const,
        entity_type: 'feature' as const,
      };

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: false,
        error: 'Options are required for select and multiselect field types',
      });
    });

    it('should return error when options are empty for multiselect field', async () => {
      const input = {
        name: 'Tags',
        type: 'multiselect' as const,
        options: [],
        entity_type: 'feature' as const,
      };

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: false,
        error: 'Options are required for select and multiselect field types',
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        name: 'Priority Level',
        type: 'text' as const,
        entity_type: 'feature' as const,
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create custom field: API Error',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        name: 'Priority Level',
        type: 'text' as const,
        entity_type: 'feature' as const,
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
        error: 'Failed to create custom field: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        name: 'Priority Level',
        type: 'text' as const,
        entity_type: 'feature' as const,
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid field configuration',
          details: {
            fields: {
              name: 'Field name already exists',
              type: 'Invalid field type',
            },
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create custom field: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new CreateCustomFieldTool(null as any, mockLogger);
      const validInput = {
        name: 'Priority Level',
        type: 'text' as const,
        entity_type: 'feature' as const,
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to create custom field:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'cf_123',
        name: 'Priority Level',
        type: 'text',
        description: 'Priority level for features',
        required: true,
        entity_type: 'feature',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        name: 'Priority Level',
        type: 'text',
        entity_type: 'feature',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'cf_123');
      expect((result as any).data).toHaveProperty('name', 'Priority Level');
      expect((result as any).data).toHaveProperty('type', 'text');
      expect((result as any).data).toHaveProperty('entity_type', 'feature');
    });
  });
});