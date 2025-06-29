import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CreateWebhookTool } from '@tools/webhooks/create-webhook';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('CreateWebhookTool', () => {
  let tool: CreateWebhookTool;
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
    
    tool = new CreateWebhookTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_webhook_create');
      expect(tool.description).toBe('Create a new webhook subscription');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['name', 'url', 'events'],
        properties: {
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
            minItems: 1,
            description: 'Event types to subscribe to',
          },
          secret: {
            type: 'string',
            description: 'Secret for webhook signature verification',
          },
          active: {
            type: 'boolean',
            default: true,
            description: 'Whether webhook is active',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Test Webhook' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ name: 'Test Webhook', url: 'https://example.com/webhook' } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ url: 'https://example.com/webhook', events: ['feature.created'] } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate URL format', async () => {
      const input = {
        name: 'Test Webhook',
        url: 'invalid-url',
        events: ['feature.created'],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate events array is not empty', async () => {
      const input = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: [],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate events contains strings', async () => {
      const input = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created', 123],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate boolean active field', async () => {
      const input = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
        active: 'not-boolean',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input', () => {
      const validInput = {
        name: 'Feature Updates Webhook',
        url: 'https://api.example.com/webhooks/productboard',
        events: ['feature.created', 'feature.updated', 'feature.deleted'],
        secret: 'secret_key_123',
        active: true,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept minimal valid input', () => {
      const validInput = {
        name: 'Basic Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept HTTPS URLs', () => {
      const validInput = {
        name: 'Secure Webhook',
        url: 'https://secure-api.example.com/webhook',
        events: ['feature.created'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept HTTP URLs', () => {
      const validInput = {
        name: 'Local Webhook',
        url: 'http://localhost:3000/webhook',
        events: ['feature.created'],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should create webhook with full input', async () => {
      const validInput = {
        name: 'Feature Updates Webhook',
        url: 'https://api.example.com/webhooks/productboard',
        events: ['feature.created', 'feature.updated', 'feature.deleted'],
        secret: 'secret_key_123',
        active: true,
      };
      const expectedResponse = {
        id: 'webhook_123456',
        name: 'Feature Updates Webhook',
        url: 'https://api.example.com/webhooks/productboard',
        events: ['feature.created', 'feature.updated', 'feature.deleted'],
        secret: 'secret_key_123',
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/webhooks', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create webhook with minimal input', async () => {
      const minimalInput = {
        name: 'Basic Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
      };
      const expectedResponse = {
        id: 'webhook_123456',
        name: 'Basic Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(minimalInput);

      expect(mockClient.post).toHaveBeenCalledWith('/webhooks', minimalInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create webhook with multiple event types', async () => {
      const validInput = {
        name: 'Multi-Event Webhook',
        url: 'https://example.com/webhook',
        events: [
          'feature.created',
          'feature.updated', 
          'feature.deleted',
          'note.created',
          'note.updated',
          'user.created'
        ],
        secret: 'multi_event_secret',
      };
      const expectedResponse = {
        id: 'webhook_123456',
        name: 'Multi-Event Webhook',
        url: 'https://example.com/webhook',
        events: [
          'feature.created',
          'feature.updated', 
          'feature.deleted',
          'note.created',
          'note.updated',
          'user.created'
        ],
        secret: 'multi_event_secret',
        active: true,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/webhooks', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should create inactive webhook', async () => {
      const validInput = {
        name: 'Inactive Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
        active: false,
      };
      const expectedResponse = {
        id: 'webhook_123456',
        name: 'Inactive Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
        active: false,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/webhooks', validInput);
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create webhook: API Error',
      });
    });

    it('should handle invalid URL errors', async () => {
      const validInput = {
        name: 'Test Webhook',
        url: 'https://unreachable-domain.invalid/webhook',
        events: ['feature.created'],
      };
      
      const error = new Error('Webhook URL is not reachable');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'INVALID_WEBHOOK_URL',
          message: 'Webhook URL is not reachable',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create webhook: Webhook URL is not reachable',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
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
        error: 'Failed to create webhook: Authentication failed',
      });
    });

    it('should handle forbidden errors (insufficient permissions)', async () => {
      const validInput = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
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
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create webhook: Admin access required',
      });
    });

    it('should handle validation errors from API', async () => {
      const validInput = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
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
              events: 'Invalid event type specified',
              url: 'URL must be accessible',
            },
          },
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to create webhook: Validation error',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new CreateWebhookTool(null as any, mockLogger);
      const validInput = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to create webhook:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        id: 'webhook_123',
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
        active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('id', 'webhook_123');
      expect((result as any).data).toHaveProperty('name', 'Test Webhook');
      expect((result as any).data).toHaveProperty('url', 'https://example.com/webhook');
      expect((result as any).data).toHaveProperty('events');
      expect((result as any).data).toHaveProperty('created_at');
    });

    it('should handle webhook with secret in response', async () => {
      const apiResponse = {
        id: 'webhook_123',
        name: 'Secure Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
        secret: '***masked***',
        active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        name: 'Secure Webhook',
        url: 'https://example.com/webhook',
        events: ['feature.created'],
        secret: 'actual_secret_123',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('secret', '***masked***');
    });
  });
});