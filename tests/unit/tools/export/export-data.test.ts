import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExportDataTool } from '@tools/export/export-data';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ExportDataTool', () => {
  let tool: ExportDataTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      makeRequest: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<ProductboardAPIClient>;
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;
    
    tool = new ExportDataTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_export');
      expect(tool.description).toBe('Export Productboard data');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['export_type', 'format'],
        properties: {
          export_type: {
            type: 'string',
            enum: ['features', 'notes', 'products', 'objectives', 'all'],
            description: 'Type of data to export',
          },
          format: {
            type: 'string',
            enum: ['json', 'csv', 'xlsx'],
            description: 'Export file format',
          },
          filters: {
            type: 'object',
            properties: {
              date_from: {
                type: 'string',
                format: 'date',
                description: 'Export data from this date',
              },
              date_to: {
                type: 'string',
                format: 'date',
                description: 'Export data until this date',
              },
              product_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by product IDs',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags',
              },
              status: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by status',
              },
            },
          },
          include_related: {
            type: 'boolean',
            default: true,
            description: 'Include related data (e.g., notes for features)',
          },
          email_to: {
            type: 'string',
            format: 'email',
            description: 'Email address to send the export to',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ export_type: 'features' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ format: 'json' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate export_type enum values', async () => {
      const input = {
        export_type: 'invalid_type',
        format: 'json',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid export_type enum values', () => {
      ['features', 'notes', 'products', 'objectives', 'all'].forEach(exportType => {
        const validInput = {
          export_type: exportType as any,
          format: 'json' as const,
        };
        const validation = tool.validateParams(validInput);
        expect(validation.valid).toBe(true);
      });
    });

    it('should validate format enum values', async () => {
      const input = {
        export_type: 'features',
        format: 'invalid_format',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid format enum values', () => {
      ['json', 'csv', 'xlsx'].forEach(format => {
        const validInput = {
          export_type: 'features' as const,
          format: format as any,
        };
        const validation = tool.validateParams(validInput);
        expect(validation.valid).toBe(true);
      });
    });

    it('should validate email format', async () => {
      const input = {
        export_type: 'features',
        format: 'json',
        email_to: 'invalid-email',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid email formats', () => {
      const validInput = {
        export_type: 'features' as const,
        format: 'json' as const,
        email_to: 'user@example.com',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate date formats in filters', async () => {
      const input = {
        export_type: 'features',
        format: 'json',
        filters: {
          date_from: 'invalid-date',
        },
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid filters', () => {
      const validInput = {
        export_type: 'features' as const,
        format: 'json' as const,
        filters: {
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          product_ids: ['prod_123', 'prod_456'],
          tags: ['important', 'bug'],
          status: ['new', 'in_progress'],
        },
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept comprehensive valid input', () => {
      const validInput = {
        export_type: 'all' as const,
        format: 'xlsx' as const,
        filters: {
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          product_ids: ['prod_123'],
          tags: ['critical'],
          status: ['done'],
        },
        include_related: true,
        email_to: 'admin@company.com',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should export data with required parameters only', async () => {
      const input = {
        export_type: 'features' as const,
        format: 'json' as const,
      };
      
      const expectedResponse = {
        export_id: 'exp_123456',
        status: 'processing',
        export_type: 'features',
        format: 'json',
        created_at: '2024-01-15T10:00:00Z',
        estimated_completion: '2024-01-15T10:05:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.post).toHaveBeenCalledWith('/export', {
        export_type: 'features',
        format: 'json',
        include_related: true,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should export data with all parameters', async () => {
      const input = {
        export_type: 'all' as const,
        format: 'xlsx' as const,
        filters: {
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          product_ids: ['prod_123', 'prod_456'],
          tags: ['critical', 'bug'],
          status: ['new', 'in_progress'],
        },
        include_related: false,
        email_to: 'user@example.com',
      };
      
      const expectedResponse = {
        export_id: 'exp_789012',
        status: 'processing',
        export_type: 'all',
        format: 'xlsx',
        email_to: 'user@example.com',
        filters: {
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          product_ids: ['prod_123', 'prod_456'],
          tags: ['critical', 'bug'],
          status: ['new', 'in_progress'],
        },
        include_related: false,
        created_at: '2024-01-15T10:00:00Z',
        estimated_completion: '2024-01-15T10:15:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.post).toHaveBeenCalledWith('/export', {
        export_type: 'all',
        format: 'xlsx',
        filters: {
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          product_ids: ['prod_123', 'prod_456'],
          tags: ['critical', 'bug'],
          status: ['new', 'in_progress'],
        },
        include_related: false,
        email_to: 'user@example.com',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        export_type: 'features' as const,
        format: 'json' as const,
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to export data: API Error',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to export data', expect.any(Error));
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        export_type: 'features' as const,
        format: 'json' as const,
      };
      
      const error = new Error('Authentication failed');
      (error as any).response = {
        status: 401,
        data: {
          error: true,
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to export data: Authentication failed',
      });
    });

    it('should handle insufficient permissions error', async () => {
      const validInput = {
        export_type: 'all' as const,
        format: 'xlsx' as const,
      };
      
      const error = new Error('Insufficient permissions');
      (error as any).response = {
        status: 403,
        data: {
          error: true,
          code: 'PERMISSION_DENIED',
          message: 'Data export requires admin permissions',
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to export data: Insufficient permissions',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        export_type: 'features' as const,
        format: 'json' as const,
        filters: {
          date_from: '2025-01-01', // Future date
        },
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid date range',
          details: {
            fields: {
              date_from: 'Date cannot be in the future',
            },
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to export data: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ExportDataTool(null as any, mockLogger);
      const validInput = {
        export_type: 'features' as const,
        format: 'json' as const,
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to export data:'),
      });
    });

    it('should set default include_related to true', async () => {
      const input = {
        export_type: 'features' as const,
        format: 'json' as const,
      };
      
      const expectedResponse = {
        export_id: 'exp_default',
        status: 'processing',
      };

      mockClient.post.mockResolvedValueOnce(expectedResponse);

      await tool.execute(input);

      expect(mockClient.post).toHaveBeenCalledWith('/export', {
        export_type: 'features',
        format: 'json',
        include_related: true,
      });
    });

    it('should handle large export requests', async () => {
      const input = {
        export_type: 'all' as const,
        format: 'xlsx' as const,
        filters: {
          product_ids: ['prod_1', 'prod_2', 'prod_3', 'prod_4', 'prod_5'],
          tags: ['tag_1', 'tag_2', 'tag_3'],
        },
      };
      
      const expectedResponse = {
        export_id: 'exp_large',
        status: 'queued',
        size_estimate: '500MB',
        estimated_completion: '2024-01-15T11:00:00Z',
        warning: 'Large export may take longer to process',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        export_id: 'exp_complete',
        status: 'completed',
        export_type: 'features',
        format: 'csv',
        file_url: 'https://exports.productboard.com/exp_complete.csv',
        file_size: '2.5MB',
        record_count: 1500,
        created_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:03:45Z',
        expires_at: '2024-01-22T10:03:45Z',
        include_related: true,
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        export_type: 'features',
        format: 'csv',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('export_id', 'exp_complete');
      expect((result as any).data).toHaveProperty('status', 'completed');
      expect((result as any).data).toHaveProperty('file_url');
      expect((result as any).data).toHaveProperty('record_count', 1500);
    });

    it('should handle minimal response structure', async () => {
      const apiResponse = {
        export_id: 'exp_minimal',
        status: 'processing',
        export_type: 'notes',
        format: 'json',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        export_type: 'notes',
        format: 'json',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
    });

    it('should handle email delivery response', async () => {
      const apiResponse = {
        export_id: 'exp_email',
        status: 'processing',
        export_type: 'objectives',
        format: 'xlsx',
        email_to: 'manager@company.com',
        delivery_method: 'email',
        notification_sent: true,
        message: 'Export will be emailed when ready',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        export_type: 'objectives',
        format: 'xlsx',
        email_to: 'manager@company.com',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('email_to', 'manager@company.com');
      expect((result as any).data).toHaveProperty('delivery_method', 'email');
    });
  });
});