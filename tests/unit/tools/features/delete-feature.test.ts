import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DeleteFeatureTool } from '@tools/features/delete-feature';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';
// Error types are checked by message rather than type
import { mockFeatureData, mockApiResponses } from '../../../fixtures/features';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('DeleteFeatureTool', () => {
  let tool: DeleteFeatureTool;
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
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
    
    tool = new DeleteFeatureTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_feature_delete');
      expect(tool.description).toBe('Delete a feature (or archive it)');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: expect.stringContaining('Feature ID'),
          },
          permanent: {
            type: 'boolean',
            default: false,
            description: expect.stringContaining('permanently delete'),
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should require feature ID', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ permanent: true } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate ID as string', async () => {
      await expect(tool.execute({ id: 123 } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ id: null } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate permanent as boolean', async () => {
      await expect(tool.execute({ id: 'feat_123', permanent: 'true' } as any))
        .rejects.toThrow('Invalid parameters');
    });

    it('should accept valid delete input', () => {
      const validation = tool.validateParams({ id: 'feat_123456' });
      expect(validation.valid).toBe(true);
    });

    it('should accept valid permanent delete input', () => {
      const validation = tool.validateParams({ id: 'feat_123456', permanent: true });
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should archive feature by default', async () => {
      mockClient.patch.mockResolvedValueOnce(mockApiResponses.archiveSuccess.data);

      const result = parseResult(await tool.execute({ id: 'feat_123456' }));

      expect(mockClient.patch).toHaveBeenCalledWith(
        '/features/feat_123456',
        { status: 'archived' }
      );
      expect(mockClient.delete).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: {
          feature: mockApiResponses.archiveSuccess.data,
          action: 'archived',
        },
      });
    });

    it('should archive when permanent is false', async () => {
      mockClient.patch.mockResolvedValueOnce(mockApiResponses.archiveSuccess.data);

      const result = parseResult(await tool.execute({ id: 'feat_123456', permanent: false }));

      expect(mockClient.patch).toHaveBeenCalledWith(
        '/features/feat_123456',
        { status: 'archived' }
      );
      expect(mockClient.delete).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.action).toBe('archived');
    });

    it('should permanently delete when permanent is true', async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = parseResult(await tool.execute({ id: 'feat_123456', permanent: true }));

      expect(mockClient.delete).toHaveBeenCalledWith('/features/feat_123456');
      expect(mockClient.patch).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: {
          action: 'deleted',
          feature_id: 'feat_123456',
        },
      });
    });

    it('should handle feature not found error', async () => {
      const error = new Error('Not found');
      (error as any).response = {
        status: 404,
        data: mockFeatureData.apiErrors.notFound,
      };
      mockClient.patch.mockRejectedValueOnce(error);

      await expect(tool.execute({ id: 'feat_nonexistent' })).rejects.toThrow('Not found');
    });

    it('should handle already archived feature', async () => {
      const error = new Error('Already archived');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Feature is already archived',
        },
      };
      mockClient.patch.mockRejectedValueOnce(error);

      await expect(tool.execute({ id: 'feat_123456' })).rejects.toThrow('Already archived');
    });

    it('should handle permission denied error', async () => {
      const error = new Error('Permission denied');
      (error as any).response = {
        status: 403,
        data: {
          error: true,
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to delete this feature',
        },
      };
      mockClient.delete.mockRejectedValueOnce(error);

      await expect(tool.execute({ id: 'feat_123456', permanent: true })).rejects.toThrow('Permission denied');
    });

    it('should handle features with dependencies', async () => {
      const error = new Error('Conflict');
      (error as any).response = {
        status: 409,
        data: {
          error: true,
          code: 'CONFLICT',
          message: 'Cannot delete feature with active dependencies',
          details: {
            dependencies: ['release_123', 'objective_456'],
          },
        },
      };
      mockClient.delete.mockRejectedValueOnce(error);

      await expect(tool.execute({ id: 'feat_123456', permanent: true })).rejects.toThrow('Conflict');
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new DeleteFeatureTool(null as any, mockLogger);
      await expect(uninitializedTool.execute({ id: 'feat_123456' })).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      mockClient.patch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(tool.execute({ id: 'feat_123456' })).rejects.toThrow('Network timeout');
    });
  });

  describe('response transformation', () => {
    it('should return success response for archive operation', async () => {
      const archivedFeature = {
        ...mockFeatureData.validFeature,
        status: 'archived',
        archived_at: '2024-01-25T10:00:00Z',
      };

      mockClient.patch.mockResolvedValueOnce(archivedFeature);

      const result = parseResult(await tool.execute({ id: 'feat_123456' }));

      expect(result).toEqual({
        success: true,
        data: {
          feature: archivedFeature,
          action: 'archived',
        },
      });
      expect(result.data.feature.status).toBe('archived');
      expect(result.data.feature.archived_at).toBeDefined();
    });

    it('should return minimal response for permanent deletion', async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = parseResult(await tool.execute({ id: 'feat_123456', permanent: true }));

      expect(result).toEqual({
        success: true,
        data: {
          action: 'deleted',
          feature_id: 'feat_123456',
        },
      });
    });

    it('should handle delete with response body', async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = parseResult(await tool.execute({ id: 'feat_123456', permanent: true }));

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('deleted');
      expect(result.data.feature_id).toBe('feat_123456');
    });
  });
});