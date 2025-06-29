import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ReleaseStatusUpdateTool } from '@tools/releases/status-update';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ReleaseStatusUpdateTool', () => {
  let tool: ReleaseStatusUpdateTool;
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
    
    tool = new ReleaseStatusUpdateTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_release_status_update');
      expect(tool.description).toBe('Update release status and publish release notes');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: {
            type: 'string',
            description: 'Release ID',
          },
          status: {
            type: 'string',
            enum: ['planned', 'in_progress', 'released'],
            description: 'New release status',
          },
          release_notes: {
            type: 'string',
            description: 'Release notes (required when status is "released")',
          },
          actual_date: {
            type: 'string',
            format: 'date',
            description: 'Actual release date (for released status)',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ id: 'rel_123' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ status: 'released' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate status enum', async () => {
      const input = {
        id: 'rel_123',
        status: 'invalid_status',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate date format', async () => {
      const input = {
        id: 'rel_123',
        status: 'released',
        actual_date: 'invalid-date',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        id: 'rel_123',
        status: 'in_progress' as const,
        release_notes: 'Features are being tested',
        actual_date: '2024-01-20',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should update status to planned', async () => {
      const validInput = {
        id: 'rel_123',
        status: 'planned' as const,
      };
      const expectedResponse = {
        id: 'rel_123',
        status: 'planned',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.patch.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.patch).toHaveBeenCalledWith('/releases/rel_123/status', {
        status: 'planned',
        release_notes: undefined,
        actual_date: undefined,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update status to in_progress with notes', async () => {
      const validInput = {
        id: 'rel_123',
        status: 'in_progress' as const,
        release_notes: 'Development started, features being implemented',
      };
      const expectedResponse = {
        id: 'rel_123',
        status: 'in_progress',
        release_notes: 'Development started, features being implemented',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.patch.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.patch).toHaveBeenCalledWith('/releases/rel_123/status', {
        status: 'in_progress',
        release_notes: 'Development started, features being implemented',
        actual_date: undefined,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update status to released with notes and actual date', async () => {
      const validInput = {
        id: 'rel_123',
        status: 'released' as const,
        release_notes: 'Version 1.0.0 released with user authentication and payment integration',
        actual_date: '2024-01-20',
      };
      const expectedResponse = {
        id: 'rel_123',
        status: 'released',
        release_notes: 'Version 1.0.0 released with user authentication and payment integration',
        actual_date: '2024-01-20',
        updated_at: '2024-01-20T10:00:00Z',
      };
      
      mockClient.patch.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.patch).toHaveBeenCalledWith('/releases/rel_123/status', {
        status: 'released',
        release_notes: 'Version 1.0.0 released with user authentication and payment integration',
        actual_date: '2024-01-20',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should return error when release notes are missing for released status', async () => {
      const input = {
        id: 'rel_123',
        status: 'released' as const,
      };

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: false,
        error: 'Release notes are required when status is "released"',
      });
    });

    it('should return error when release notes are empty for released status', async () => {
      const input = {
        id: 'rel_123',
        status: 'released' as const,
        release_notes: '',
      };

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: false,
        error: 'Release notes are required when status is "released"',
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        id: 'rel_123',
        status: 'in_progress' as const,
      };
      
      mockClient.patch.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update release status: API Error',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        id: 'rel_123',
        status: 'in_progress' as const,
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
      mockClient.patch.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update release status: Authentication failed',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        id: 'rel_123',
        status: 'released' as const,
        release_notes: 'Short release',
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid status transition',
          details: {
            current_status: 'planned',
            requested_status: 'released',
            allowed_transitions: ['in_progress'],
          },
        },
      };
      mockClient.patch.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update release status: Validation error',
      });
    });

    it('should handle not found errors', async () => {
      const validInput = {
        id: 'rel_nonexistent',
        status: 'in_progress' as const,
      };
      
      const error = new Error('Not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Release not found',
          details: {},
        },
      };
      mockClient.patch.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update release status: Not found',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ReleaseStatusUpdateTool(null as any, mockLogger);
      const validInput = {
        id: 'rel_123',
        status: 'in_progress' as const,
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to update release status:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'rel_123',
        status: 'released',
        release_notes: 'Version 1.0.0 released',
        actual_date: '2024-01-20',
        updated_at: '2024-01-20T10:00:00Z',
      };

      mockClient.patch.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'rel_123',
        status: 'released',
        release_notes: 'Version 1.0.0 released',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'rel_123');
      expect((result as any).data).toHaveProperty('status', 'released');
      expect((result as any).data).toHaveProperty('release_notes');
      expect((result as any).data).toHaveProperty('updated_at');
    });
  });
});