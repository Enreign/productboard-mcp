import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpdateWebhookTool } from '@tools/webhooks/update-webhook';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('UpdateWebhookTool', () => {
  let tool: UpdateWebhookTool;
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
    
    tool = new UpdateWebhookTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_webhook_update');
      expect(tool.description).toBe('Update webhook subscription settings');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook ID to update',
          },
          name: {
            type: 'string',
            description: 'Webhook name',
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Webhook endpoint URL',
          },
          events: {
            type: 'array',
            items: { type: 'string' },
            description: 'Event types to subscribe to',
          },
          secret: {
            type: 'string',
            description: 'Secret for webhook signature verification',
          },
          active: {
            type: 'boolean',
            description: 'Whether webhook is active',
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

    it('should validate URL format', async () => {
      const input = {
        id: 'webhook_123',
        url: 'invalid-url',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate events array contains strings', async () => {
      const input = {
        id: 'webhook_123',
        events: ['feature.created', 123],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate boolean active field', async () => {
      const input = {
        id: 'webhook_123',
        active: 'not-boolean',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        id: 'webhook_123',
        name: 'Updated Webhook',
        url: 'https://api.example.com/webhooks/updated',
        events: ['feature.created', 'feature.updated'],
        secret: 'new_secret_key',
        active: true,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept partial updates', () => {
      const validInput = {
        id: 'webhook_123',
        name: 'Updated Name Only',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept URL update only', () => {
      const validInput = {
        id: 'webhook_123',
        url: 'https://new-endpoint.example.com/webhook',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept events update only', () => {
      const validInput = {
        id: 'webhook_123',
        events: ['note.created', 'note.updated', 'note.deleted'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept empty events array', () => {
      const validInput = {
        id: 'webhook_123',
        events: [],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should update webhook with valid input', async () => {
      const validInput = {
        id: 'webhook_123',
        name: 'Updated Webhook',
        url: 'https://api.example.com/webhooks/updated',
        events: ['feature.created', 'feature.updated'],
        active: true,
      };
      const expectedResponse = {
        id: 'webhook_123',
        name: 'Updated Webhook',
        url: 'https://api.example.com/webhooks/updated',
        events: ['feature.created', 'feature.updated'],
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/webhooks/webhook_123', {
        name: 'Updated Webhook',
        url: 'https://api.example.com/webhooks/updated',
        events: ['feature.created', 'feature.updated'],
        active: true,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update webhook with partial data', async () => {
      const validInput = {
        id: 'webhook_123',
        name: 'New Name',
      };
      const expectedResponse = {
        id: 'webhook_123',
        name: 'New Name',
        url: 'https://api.example.com/webhooks/existing',
        events: ['feature.created'],
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/webhooks/webhook_123', {
        name: 'New Name',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update webhook URL only', async () => {
      const validInput = {
        id: 'webhook_123',
        url: 'https://new-endpoint.example.com/webhook',
      };
      const expectedResponse = {
        id: 'webhook_123',
        name: 'Existing Webhook',
        url: 'https://new-endpoint.example.com/webhook',
        events: ['feature.created'],
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/webhooks/webhook_123', {
        url: 'https://new-endpoint.example.com/webhook',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update webhook events only', async () => {
      const validInput = {
        id: 'webhook_123',
        events: ['note.created', 'note.updated', 'user.created'],
      };
      const expectedResponse = {
        id: 'webhook_123',
        name: 'Existing Webhook',
        url: 'https://api.example.com/webhooks/existing',
        events: ['note.created', 'note.updated', 'user.created'],
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/webhooks/webhook_123', {
        events: ['note.created', 'note.updated', 'user.created'],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should update webhook secret', async () => {
      const validInput = {
        id: 'webhook_123',
        secret: 'new_secret_key_456',
      };
      const expectedResponse = {
        id: 'webhook_123',
        name: 'Existing Webhook',
        url: 'https://api.example.com/webhooks/existing',
        events: ['feature.created'],
        secret: '***masked***',
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/webhooks/webhook_123', {
        secret: 'new_secret_key_456',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should deactivate webhook', async () => {
      const validInput = {
        id: 'webhook_123',
        active: false,
      };
      const expectedResponse = {
        id: 'webhook_123',
        name: 'Existing Webhook',
        url: 'https://api.example.com/webhooks/existing',
        events: ['feature.created'],
        active: false,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/webhooks/webhook_123', {
        active: false,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should activate webhook', async () => {
      const validInput = {
        id: 'webhook_123',
        active: true,
      };
      const expectedResponse = {
        id: 'webhook_123',
        name: 'Existing Webhook',
        url: 'https://api.example.com/webhooks/existing',
        events: ['feature.created'],
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/webhooks/webhook_123', {
        active: true,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should clear webhook events', async () => {
      const validInput = {
        id: 'webhook_123',
        events: [],
      };
      const expectedResponse = {
        id: 'webhook_123',
        name: 'Existing Webhook',
        url: 'https://api.example.com/webhooks/existing',
        events: [],
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T14:30:00Z',
      };
      
      mockClient.put.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.put).toHaveBeenCalledWith('/webhooks/webhook_123', {
        events: [],
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should fail if no update fields provided', async () => {
      const input = {
        id: 'webhook_123',
      };

      const result = await tool.execute(input);

      expect(result).toEqual({
        success: false,
        error: 'No update fields provided',
      });
      expect(mockClient.put).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        id: 'webhook_123',
        name: 'Updated Webhook',
      };
      
      mockClient.put.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update webhook: API Error',
      });
    });

    it('should handle not found errors', async () => {
      const validInput = {
        id: 'webhook_nonexistent',
        name: 'Updated Webhook',
      };
      
      const error = new Error('Webhook not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'NOT_FOUND',
          message: 'Webhook not found',
          details: {},
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update webhook: Webhook not found',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        id: 'webhook_123',
        name: 'Updated Webhook',
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
        error: 'Failed to update webhook: Authentication failed',
      });
    });

    it('should handle forbidden errors (insufficient permissions)', async () => {
      const validInput = {
        id: 'webhook_123',
        name: 'Updated Webhook',
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
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update webhook: Admin access required',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        id: 'webhook_123',
        url: 'https://unreachable-domain.invalid/webhook',
      };
      
      const error = new Error('Validation error');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: {
            fields: {
              url: 'Webhook URL is not reachable',
            },
          },
        },
      };
      mockClient.put.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to update webhook: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new UpdateWebhookTool(null as any, mockLogger);
      const validInput = {
        id: 'webhook_123',
        name: 'Updated Webhook',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to update webhook:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'webhook_123',
        name: 'Updated Webhook',
        url: 'https://api.example.com/webhooks/updated',
        events: ['feature.created', 'feature.updated'],
        active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockClient.put.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'webhook_123',
        name: 'Updated Webhook',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'webhook_123');
      expect((result as any).data).toHaveProperty('name', 'Updated Webhook');
      expect((result as any).data).toHaveProperty('updated_at');
    });

    it('should handle response with masked secret', async () => {
      const apiResponse = {
        id: 'webhook_123',
        name: 'Secure Webhook',
        url: 'https://api.example.com/webhooks/secure',
        events: ['feature.created'],
        secret: '***masked***',
        active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockClient.put.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'webhook_123',
        secret: 'new_secret_key',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('secret', '***masked***');
    });

    it('should handle response with empty events array', async () => {
      const apiResponse = {
        id: 'webhook_123',
        name: 'No Events Webhook',
        url: 'https://api.example.com/webhooks/no-events',
        events: [],
        active: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockClient.put.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'webhook_123',
        events: [],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.events).toHaveLength(0);
    });
  });
});