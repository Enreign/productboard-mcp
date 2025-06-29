import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SetCustomFieldValueTool } from '@tools/customfields/set-value';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('SetCustomFieldValueTool', () => {
  let tool: SetCustomFieldValueTool;
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
    
    tool = new SetCustomFieldValueTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_customfield_value_set');
      expect(tool.description).toBe('Set custom field value for an entity');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['entity_id', 'entity_type', 'field_id', 'value'],
        properties: {
          entity_id: {
            type: 'string',
            description: 'ID of the entity (feature, note, objective)',
          },
          entity_type: {
            type: 'string',
            enum: ['feature', 'note', 'objective'],
            description: 'Type of entity',
          },
          field_id: {
            type: 'string',
            description: 'Custom field ID',
          },
          value: {
            description: 'Value to set (type depends on field type)',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ entity_id: 'feat_123' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ entity_id: 'feat_123', entity_type: 'feature' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ entity_id: 'feat_123', entity_type: 'feature', field_id: 'cf_123' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate entity_type enum', async () => {
      const input = {
        entity_id: 'feat_123',
        entity_type: 'invalid_entity',
        field_id: 'cf_123',
        value: 'test',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        entity_id: 'feat_123',
        entity_type: 'feature' as const,
        field_id: 'cf_123',
        value: 'High Priority',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should set text field value', async () => {
      const validInput = {
        entity_id: 'feat_123',
        entity_type: 'feature' as const,
        field_id: 'cf_123',
        value: 'High Priority',
      };
      const expectedResponse = {
        entity_id: 'feat_123',
        entity_type: 'feature',
        field_id: 'cf_123',
        field_name: 'Priority Level',
        field_type: 'text',
        value: 'High Priority',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/customfields/cf_123/values', {
        entity_id: 'feat_123',
        entity_type: 'feature',
        value: 'High Priority',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should set number field value', async () => {
      const validInput = {
        entity_id: 'feat_456',
        entity_type: 'feature' as const,
        field_id: 'cf_456',
        value: 8,
      };
      const expectedResponse = {
        entity_id: 'feat_456',
        entity_type: 'feature',
        field_id: 'cf_456',
        field_name: 'Story Points',
        field_type: 'number',
        value: 8,
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/customfields/cf_456/values', {
        entity_id: 'feat_456',
        entity_type: 'feature',
        value: 8,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should set date field value', async () => {
      const validInput = {
        entity_id: 'feat_789',
        entity_type: 'feature' as const,
        field_id: 'cf_789',
        value: '2024-03-15',
      };
      const expectedResponse = {
        entity_id: 'feat_789',
        entity_type: 'feature',
        field_id: 'cf_789',
        field_name: 'Target Release Date',
        field_type: 'date',
        value: '2024-03-15',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/customfields/cf_789/values', {
        entity_id: 'feat_789',
        entity_type: 'feature',
        value: '2024-03-15',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should set boolean field value', async () => {
      const validInput = {
        entity_id: 'feat_890',
        entity_type: 'feature' as const,
        field_id: 'cf_890',
        value: true,
      };
      const expectedResponse = {
        entity_id: 'feat_890',
        entity_type: 'feature',
        field_id: 'cf_890',
        field_name: 'Is Breaking Change',
        field_type: 'boolean',
        value: true,
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/customfields/cf_890/values', {
        entity_id: 'feat_890',
        entity_type: 'feature',
        value: true,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should set select field value', async () => {
      const validInput = {
        entity_id: 'feat_234',
        entity_type: 'feature' as const,
        field_id: 'cf_234',
        value: 'approved',
      };
      const expectedResponse = {
        entity_id: 'feat_234',
        entity_type: 'feature',
        field_id: 'cf_234',
        field_name: 'Feature Status',
        field_type: 'select',
        value: 'approved',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/customfields/cf_234/values', {
        entity_id: 'feat_234',
        entity_type: 'feature',
        value: 'approved',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should set multiselect field value', async () => {
      const validInput = {
        entity_id: 'feat_567',
        entity_type: 'feature' as const,
        field_id: 'cf_567',
        value: ['ui', 'mobile', 'api'],
      };
      const expectedResponse = {
        entity_id: 'feat_567',
        entity_type: 'feature',
        field_id: 'cf_567',
        field_name: 'Tags',
        field_type: 'multiselect',
        value: ['ui', 'mobile', 'api'],
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/customfields/cf_567/values', {
        entity_id: 'feat_567',
        entity_type: 'feature',
        value: ['ui', 'mobile', 'api'],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should set value for note entity', async () => {
      const validInput = {
        entity_id: 'note_123',
        entity_type: 'note' as const,
        field_id: 'cf_345',
        value: 'standup',
      };
      const expectedResponse = {
        entity_id: 'note_123',
        entity_type: 'note',
        field_id: 'cf_345',
        field_name: 'Meeting Type',
        field_type: 'select',
        value: 'standup',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/customfields/cf_345/values', {
        entity_id: 'note_123',
        entity_type: 'note',
        value: 'standup',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should set value for objective entity', async () => {
      const validInput = {
        entity_id: 'obj_456',
        entity_type: 'objective' as const,
        field_id: 'cf_678',
        value: 'Q1 2024',
      };
      const expectedResponse = {
        entity_id: 'obj_456',
        entity_type: 'objective',
        field_id: 'cf_678',
        field_name: 'Quarter',
        field_type: 'text',
        value: 'Q1 2024',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle null value (clearing field)', async () => {
      const validInput = {
        entity_id: 'feat_123',
        entity_type: 'feature' as const,
        field_id: 'cf_123',
        value: null,
      };
      const expectedResponse = {
        entity_id: 'feat_123',
        entity_type: 'feature',
        field_id: 'cf_123',
        field_name: 'Priority Level',
        field_type: 'text',
        value: null,
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/customfields/cf_123/values', {
        entity_id: 'feat_123',
        entity_type: 'feature',
        value: null,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        entity_id: 'feat_123',
        entity_type: 'feature' as const,
        field_id: 'cf_123',
        value: 'High Priority',
      };
      
      mockClient.put.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to set custom field value: API Error',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        entity_id: 'feat_123',
        entity_type: 'feature' as const,
        field_id: 'cf_123',
        value: 'High Priority',
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
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to set custom field value: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        entity_id: 'feat_123',
        entity_type: 'feature' as const,
        field_id: 'cf_123',
        value: 'Invalid Option',
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid field value',
          details: {
            field_id: 'cf_123',
            value: 'Invalid Option',
            allowed_values: ['draft', 'review', 'approved', 'rejected'],
          },
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to set custom field value: Validation error',
      });
    });

    it('should handle not found errors', async () => {
      const validInput = {
        entity_id: 'feat_nonexistent',
        entity_type: 'feature' as const,
        field_id: 'cf_123',
        value: 'High Priority',
      };
      
      const error = new Error('Not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Entity or field not found',
          details: {
            entity_id: 'feat_nonexistent',
            field_id: 'cf_123',
          },
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to set custom field value: Not found',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new SetCustomFieldValueTool(null as any, mockLogger);
      const validInput = {
        entity_id: 'feat_123',
        entity_type: 'feature' as const,
        field_id: 'cf_123',
        value: 'High Priority',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to set custom field value:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        entity_id: 'feat_123',
        entity_type: 'feature',
        field_id: 'cf_123',
        field_name: 'Priority Level',
        field_type: 'text',
        value: 'High Priority',
        updated_at: '2024-01-15T10:00:00Z',
      };

      mockClient.put.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        entity_id: 'feat_123',
        entity_type: 'feature',
        field_id: 'cf_123',
        value: 'High Priority',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('entity_id', 'feat_123');
      expect((result as any).data).toHaveProperty('entity_type', 'feature');
      expect((result as any).data).toHaveProperty('field_id', 'cf_123');
      expect((result as any).data).toHaveProperty('field_name', 'Priority Level');
      expect((result as any).data).toHaveProperty('value', 'High Priority');
      expect((result as any).data).toHaveProperty('updated_at');
    });
  });
});