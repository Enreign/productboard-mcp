import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TestWebhookTool } from '@tools/webhooks/test-webhook';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('TestWebhookTool', () => {
  let tool: TestWebhookTool;
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
    
    tool = new TestWebhookTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_webhook_test');
      expect(tool.description).toBe('Test webhook endpoint with sample payload');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Webhook ID to test',
          },
          test_event: {
            type: 'string',
            default: 'test',
            description: 'Type of test event to send',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required id field', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ test_event: 'ping' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate id is a string', async () => {
      const input = {
        id: 123,
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate test_event is a string', async () => {
      const input = {
        id: 'webhook_123',
        test_event: 123,
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input with id only', () => {
      const validInput = {
        id: 'webhook_123456',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept valid input with custom test event', () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'ping',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept different test event types', () => {
      const testEvents = [
        'test',
        'ping',
        'feature.created',
        'note.updated',
        'user.created',
        'custom_test_event',
      ];

      testEvents.forEach(test_event => {
        const validInput = {
          id: 'webhook_123',
          test_event,
        };
        const validation = tool.validateParams(validInput);
        expect(validation.valid).toBe(true);
      });
    });
  });

  describe('execute', () => {
    it('should test webhook with default test event', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      const expectedResponse = {
        webhook_id: 'webhook_123456',
        test_event: 'test',
        delivery_id: 'delivery_abc123',
        status: 'delivered',
        response_code: 200,
        response_time_ms: 145,
        response_body: 'OK',
        sent_at: '2024-01-20T14:30:00Z',
        delivered_at: '2024-01-20T14:30:00.145Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/webhooks/webhook_123456/test', {
        event_type: 'test',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should test webhook with custom test event', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'ping',
      };
      const expectedResponse = {
        webhook_id: 'webhook_123456',
        test_event: 'ping',
        delivery_id: 'delivery_def456',
        status: 'delivered',
        response_code: 200,
        response_time_ms: 89,
        response_body: 'pong',
        sent_at: '2024-01-20T14:30:00Z',
        delivered_at: '2024-01-20T14:30:00.089Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/webhooks/webhook_123456/test', {
        event_type: 'ping',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should test webhook with feature event', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'feature.created',
      };
      const expectedResponse = {
        webhook_id: 'webhook_123456',
        test_event: 'feature.created',
        delivery_id: 'delivery_ghi789',
        status: 'delivered',
        response_code: 201,
        response_time_ms: 234,
        response_body: '{"status": "received", "id": "test_feature_123"}',
        sent_at: '2024-01-20T14:30:00Z',
        delivered_at: '2024-01-20T14:30:00.234Z',
        payload: {
          event: 'feature.created',
          data: {
            id: 'test_feature_123',
            name: 'Test Feature',
            status: 'new',
          },
        },
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/webhooks/webhook_123456/test', {
        event_type: 'feature.created',
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle webhook test failure (endpoint unreachable)', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'ping',
      };
      const expectedResponse = {
        webhook_id: 'webhook_123456',
        test_event: 'ping',
        delivery_id: 'delivery_failed123',
        status: 'failed',
        error: 'Connection timeout',
        response_code: null,
        response_time_ms: 5000,
        sent_at: '2024-01-20T14:30:00Z',
        failed_at: '2024-01-20T14:30:05Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle webhook test with error response', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'test',
      };
      const expectedResponse = {
        webhook_id: 'webhook_123456',
        test_event: 'test',
        delivery_id: 'delivery_error456',
        status: 'failed',
        response_code: 500,
        response_time_ms: 1200,
        response_body: 'Internal Server Error',
        error: 'HTTP 500: Internal Server Error',
        sent_at: '2024-01-20T14:30:00Z',
        delivered_at: '2024-01-20T14:30:01.200Z',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'test',
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to test webhook: API Error',
      });
    });

    it('should handle webhook not found errors', async () => {
      const validInput = {
        id: 'webhook_nonexistent',
        test_event: 'test',
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
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to test webhook: Webhook not found',
      });
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'test',
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
        error: 'Failed to test webhook: Authentication failed',
      });
    });

    it('should handle forbidden errors (insufficient permissions)', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'test',
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
        error: 'Failed to test webhook: Admin access required',
      });
    });

    it('should handle inactive webhook errors', async () => {
      const validInput = {
        id: 'webhook_inactive',
        test_event: 'test',
      };
      
      const error = new Error('Webhook is inactive');
      (error as any).response = {
        status: 400,
        data: {
          error: true,
          code: 'WEBHOOK_INACTIVE',
          message: 'Webhook is inactive',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to test webhook: Webhook is inactive',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new TestWebhookTool(null as any, mockLogger);
      const validInput = {
        id: 'webhook_123456',
        test_event: 'test',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to test webhook:'),
      });
    });

    it('should use default test event when not specified', async () => {
      const validInput = {
        id: 'webhook_123456',
      };
      const expectedResponse = {
        webhook_id: 'webhook_123456',
        test_event: 'test',
        delivery_id: 'delivery_default123',
        status: 'delivered',
        response_code: 200,
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/webhooks/webhook_123456/test', {
        event_type: 'test',
      });
    });
  });

  describe('response transformation', () => {
    it('should transform successful test response correctly', async () => {
      const apiResponse = {
        webhook_id: 'webhook_123',
        test_event: 'test',
        delivery_id: 'delivery_abc123',
        status: 'delivered',
        response_code: 200,
        response_time_ms: 145,
        response_body: 'OK',
        sent_at: '2024-01-01T00:00:00Z',
        delivered_at: '2024-01-01T00:00:00.145Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'webhook_123',
        test_event: 'test',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('webhook_id', 'webhook_123');
      expect((result as any).data).toHaveProperty('delivery_id');
      expect((result as any).data).toHaveProperty('status', 'delivered');
      expect((result as any).data).toHaveProperty('response_code', 200);
      expect((result as any).data).toHaveProperty('response_time_ms');
    });

    it('should transform failed test response correctly', async () => {
      const apiResponse = {
        webhook_id: 'webhook_123',
        test_event: 'ping',
        delivery_id: 'delivery_failed123',
        status: 'failed',
        error: 'Connection timeout',
        response_code: null,
        response_time_ms: 5000,
        sent_at: '2024-01-01T00:00:00Z',
        failed_at: '2024-01-01T00:00:05Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'webhook_123',
        test_event: 'ping',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('status', 'failed');
      expect((result as any).data).toHaveProperty('error', 'Connection timeout');
      expect((result as any).data).toHaveProperty('failed_at');
    });

    it('should handle test response with payload', async () => {
      const apiResponse = {
        webhook_id: 'webhook_123',
        test_event: 'feature.created',
        delivery_id: 'delivery_payload123',
        status: 'delivered',
        response_code: 201,
        response_time_ms: 234,
        payload: {
          event: 'feature.created',
          data: {
            id: 'test_feature_123',
            name: 'Test Feature',
            status: 'new',
          },
          timestamp: '2024-01-01T00:00:00Z',
        },
        sent_at: '2024-01-01T00:00:00Z',
        delivered_at: '2024-01-01T00:00:00.234Z',
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        id: 'webhook_123',
        test_event: 'feature.created',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('payload');
      expect((result as any).data.payload).toHaveProperty('event', 'feature.created');
      expect((result as any).data.payload).toHaveProperty('data');
    });

    it('should handle different response codes correctly', async () => {
      const responseCodes = [200, 201, 202, 204, 400, 401, 403, 404, 500];

      for (const code of responseCodes) {
        const apiResponse = {
          webhook_id: 'webhook_123',
          test_event: 'test',
          delivery_id: `delivery_${code}`,
          status: code >= 200 && code < 300 ? 'delivered' : 'failed',
          response_code: code,
          response_time_ms: 100,
          sent_at: '2024-01-01T00:00:00Z',
          delivered_at: '2024-01-01T00:00:00.100Z',
        };

        mockClient.post.mockResolvedValueOnce(apiResponse);

        const result = await tool.execute({
          id: 'webhook_123',
          test_event: 'test',
        });

        expect(result).toEqual({
          success: true,
          data: apiResponse,
        });
        expect((result as any).data.response_code).toBe(code);
      }
    });
  });

  describe('logging', () => {
    it('should log webhook test action', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'ping',
      };
      
      const expectedResponse = {
        webhook_id: 'webhook_123456',
        status: 'delivered',
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      await tool.execute(validInput);

      expect(mockLogger.info).toHaveBeenCalledWith('Testing webhook', { id: 'webhook_123456' });
    });

    it('should log errors when test fails', async () => {
      const validInput = {
        id: 'webhook_123456',
        test_event: 'test',
      };
      
      const error = new Error('Test error');
      mockClient.post.mockRejectedValueOnce(error);

      await tool.execute(validInput);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to test webhook', error);
    });
  });
});