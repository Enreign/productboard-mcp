import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DeleteWebhookTool } from '@tools/webhooks/delete-webhook';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('DeleteWebhookTool', () => {
  let tool: DeleteWebhookTool;
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
    
    tool = new DeleteWebhookTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_webhook_delete');
      expect(tool.description).toBe('Delete a webhook subscription');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook ID to delete',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required id field', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Test' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate id is a string', async () => {
      const input = {
        id: 123,
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        id: 'webhook_123456',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept webhook ID with different formats', () => {
      const formats = [
        'webhook_123',
        'wh_abc123',
        'hook-456-def',
        'webhook_abcdef123456',
      ];

      formats.forEach(id => {
        const validInput = { id };
        const validation = tool.validateParams(validInput);
        expect(validation.valid).toBe(true);
      });
    });
  });

  describe('execute', () => {
    it('should delete webhook with valid ID', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      
      // Delete endpoint typically returns void, but our tool returns a success message
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await tool.execute(validInput);

      expect(mockClient.delete).toHaveBeenCalledWith('/webhooks/webhook_123456');
      expect(result).toEqual({
        success: true,
        data: {
          message: 'Webhook deleted successfully',
          id: 'webhook_123456',
        },
      });
    });

    it('should delete webhook and log the action', async () => {
      const validInput = {
        id: 'webhook_abc789',
      };
      
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await tool.execute(validInput);

      expect(mockLogger.info).toHaveBeenCalledWith('Deleting webhook', { id: 'webhook_abc789' });
      expect(mockClient.delete).toHaveBeenCalledWith('/webhooks/webhook_abc789');
      expect(result).toEqual({
        success: true,
        data: {
          message: 'Webhook deleted successfully',
          id: 'webhook_abc789',
        },
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      
      mockClient.delete.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to delete webhook: API Error',
      });
    });

    it('should handle webhook not found errors', async () => {
      const validInput = {
        id: 'webhook_nonexistent',
      };
      
      const error = new Error('Webhook not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
          details: {},
        },
      };
      mockClient.delete.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to delete webhook: Webhook not found',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        id: 'webhook_123456',
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
      mockClient.delete.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to delete webhook: Authentication failed',
      });
    });

    it('should handle forbidden errors (insufficient permissions)', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      
      const error = new Error('Admin access required');
      (error as any).response = {
        status: 403,
        data: {
          error: true,
          code: 'ADMIN_REQUIRED',
          message: 'Admin access required',
          details: {},
        },
      };
      mockClient.delete.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to delete webhook: Admin access required',
      });
    });

    it('should handle conflict errors (webhook in use)', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      
      const error = new Error('Webhook is currently in use');
      (error as any).response = {
        status: 409,
        data: {
          error: true,
          code: 'WEBHOOK_IN_USE',
          message: 'Webhook is currently in use',
          details: {
            active_deliveries: 5,
          },
        },
      };
      mockClient.delete.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to delete webhook: Webhook is currently in use',
      });
    });

    it('should handle server errors', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      
      const error = new Error('Internal server error');
      (error as any).response = {
        status: 500,
        data: {
          error: true,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: {},
        },
      };
      mockClient.delete.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to delete webhook: Internal server error',
      });
    });

    it('should handle network errors', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      
      const networkError = new Error('Network timeout');
      mockClient.delete.mockRejectedValueOnce(networkError);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to delete webhook: Network timeout',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new DeleteWebhookTool(null as any, mockLogger);
      const validInput = {
        id: 'webhook_123456',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to delete webhook:'),
      });
    });

    it('should handle deletion of different webhook types', async () => {
      const webhookIds = [
        'webhook_feature_updates',
        'webhook_note_changes',
        'webhook_user_events',
        'webhook_product_changes',
      ];

      for (const id of webhookIds) {
        mockClient.delete.mockResolvedValueOnce(undefined);

        const result = await tool.execute({ id });

        expect(mockClient.delete).toHaveBeenCalledWith(`/webhooks/${id}`);
        expect(result).toEqual({
          success: true,
          data: {
            message: 'Webhook deleted successfully',
            id: id,
          },
        });
      }

      expect(mockClient.delete).toHaveBeenCalledTimes(webhookIds.length);
    });
  });

  describe('response transformation', () => {
    it('should transform deletion response correctly', async () => {
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await tool.execute({
        id: 'webhook_123',
      });

      expect(result).toEqual({
        success: true,
        data: {
          message: 'Webhook deleted successfully',
          id: 'webhook_123',
        },
      });
      expect((result as any).data).toHaveProperty('message');
      expect((result as any).data).toHaveProperty('id', 'webhook_123');
    });

    it('should handle successful deletion without response data', async () => {
      // Some APIs return null or undefined on successful deletion
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await tool.execute({
        id: 'webhook_456',
      });

      expect(result).toEqual({
        success: true,
        data: {
          message: 'Webhook deleted successfully',
          id: 'webhook_456',
        },
      });
    });

    it('should handle successful deletion with void response', async () => {
      // Most delete APIs return void
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await tool.execute({
        id: 'webhook_789',
      });

      expect(result).toEqual({
        success: true,
        data: {
          message: 'Webhook deleted successfully',
          id: 'webhook_789',
        },
      });
    });

    it('should handle successful deletion consistently', async () => {
      // Delete operations should consistently return void
      mockClient.delete.mockResolvedValueOnce(undefined);

      const result = await tool.execute({
        id: 'webhook_abc',
      });

      expect(result).toEqual({
        success: true,
        data: {
          message: 'Webhook deleted successfully',
          id: 'webhook_abc',
        },
      });
    });
  });

  describe('error logging', () => {
    it('should log errors when deletion fails', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      
      const error = new Error('Test error');
      mockClient.delete.mockRejectedValueOnce(error);

      await tool.execute(validInput);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete webhook', error);
    });

    it('should log info when starting deletion', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      
      mockClient.delete.mockResolvedValueOnce(undefined);

      await tool.execute(validInput);

      expect(mockLogger.info).toHaveBeenCalledWith('Deleting webhook', { id: 'webhook_123456' });
    });
  });
});