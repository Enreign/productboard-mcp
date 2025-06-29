import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ListWebhooksTool } from '@tools/webhooks/list-webhooks';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('ListWebhooksTool', () => {
  let tool: ListWebhooksTool;
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
    
    tool = new ListWebhooksTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_webhook_list');
      expect(tool.description).toBe('List webhook subscriptions');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          active: {
            type: 'boolean',
            description: 'Filter by active status',
          },
          event_type: {
            type: 'string',
            description: 'Filter by event type',
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

    it('should validate boolean active field', async () => {
      const input = {
        active: 'not-boolean',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate string event_type field', async () => {
      const input = {
        event_type: 123,
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input with active filter', () => {
      const validInput = {
        active: true,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept valid input with event_type filter', () => {
      const validInput = {
        event_type: 'feature.created',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept valid input with both filters', () => {
      const validInput = {
        active: true,
        event_type: 'feature.updated',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should list webhooks with no filters', async () => {
      const expectedResponse = {
        webhooks: [
          {
            id: 'webhook_123',
            name: 'Feature Updates Webhook',
            url: 'https://api.example.com/webhooks/features',
            events: ['feature.created', 'feature.updated'],
            active: true,
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'webhook_456',
            name: 'Note Updates Webhook',
            url: 'https://api.example.com/webhooks/notes',
            events: ['note.created', 'note.updated'],
            active: false,
            created_at: '2024-01-10T10:00:00Z',
            updated_at: '2024-01-12T14:30:00Z',
          },
        ],
        total: 2,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/webhooks',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list active webhooks only', async () => {
      const input = {
        active: true,
      };
      const expectedResponse = {
        webhooks: [
          {
            id: 'webhook_123',
            name: 'Feature Updates Webhook',
            url: 'https://api.example.com/webhooks/features',
            events: ['feature.created', 'feature.updated'],
            active: true,
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z',
          },
        ],
        total: 1,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/webhooks',
        params: {
          active: true,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list inactive webhooks only', async () => {
      const input = {
        active: false,
      };
      const expectedResponse = {
        webhooks: [
          {
            id: 'webhook_456',
            name: 'Disabled Webhook',
            url: 'https://api.example.com/webhooks/disabled',
            events: ['feature.deleted'],
            active: false,
            created_at: '2024-01-10T10:00:00Z',
            updated_at: '2024-01-12T14:30:00Z',
          },
        ],
        total: 1,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/webhooks',
        params: {
          active: false,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list webhooks by event type', async () => {
      const input = {
        event_type: 'feature.created',
      };
      const expectedResponse = {
        webhooks: [
          {
            id: 'webhook_123',
            name: 'Feature Creation Webhook',
            url: 'https://api.example.com/webhooks/feature-creation',
            events: ['feature.created'],
            active: true,
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z',
          },
          {
            id: 'webhook_789',
            name: 'All Feature Events Webhook',
            url: 'https://api.example.com/webhooks/all-features',
            events: ['feature.created', 'feature.updated', 'feature.deleted'],
            active: true,
            created_at: '2024-01-12T10:00:00Z',
            updated_at: '2024-01-12T10:00:00Z',
          },
        ],
        total: 2,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/webhooks',
        params: {
          event_type: 'feature.created',
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should list webhooks with both filters', async () => {
      const input = {
        active: true,
        event_type: 'note.updated',
      };
      const expectedResponse = {
        webhooks: [
          {
            id: 'webhook_456',
            name: 'Active Note Updates',
            url: 'https://api.example.com/webhooks/note-updates',
            events: ['note.created', 'note.updated'],
            active: true,
            created_at: '2024-01-10T10:00:00Z',
            updated_at: '2024-01-10T10:00:00Z',
          },
        ],
        total: 1,
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/webhooks',
        params: {
          active: true,
          event_type: 'note.updated',
        },
      });
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
        error: 'Failed to list webhooks: API Error',
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
        error: 'Failed to list webhooks: Authentication failed',
      });
    });

    it('should handle forbidden errors (insufficient permissions)', async () => {
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
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to list webhooks: Admin access required',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ListWebhooksTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to list webhooks:'),
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        webhooks: [
          {
            id: 'webhook_123',
            name: 'Test Webhook',
            url: 'https://example.com/webhook',
            events: ['feature.created'],
            active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
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
      expect((result as any).data).toHaveProperty('webhooks');
      expect((result as any).data).toHaveProperty('total', 1);
      expect((result as any).data.webhooks[0]).toHaveProperty('id', 'webhook_123');
      expect((result as any).data.webhooks[0]).toHaveProperty('name', 'Test Webhook');
      expect((result as any).data.webhooks[0]).toHaveProperty('url');
      expect((result as any).data.webhooks[0]).toHaveProperty('events');
      expect((result as any).data.webhooks[0]).toHaveProperty('active');
    });

    it('should handle empty results', async () => {
      const apiResponse = {
        webhooks: [],
        total: 0,
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.webhooks).toHaveLength(0);
      expect((result as any).data.total).toBe(0);
    });

    it('should handle webhooks with secrets masked', async () => {
      const apiResponse = {
        webhooks: [
          {
            id: 'webhook_123',
            name: 'Secure Webhook',
            url: 'https://example.com/webhook',
            events: ['feature.created'],
            secret: '***masked***',
            active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'webhook_456',
            name: 'No Secret Webhook',
            url: 'https://example.com/no-secret',
            events: ['note.created'],
            active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 2,
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.webhooks[0]).toHaveProperty('secret', '***masked***');
      expect((result as any).data.webhooks[1]).not.toHaveProperty('secret');
    });

    it('should handle multiple event types correctly', async () => {
      const apiResponse = {
        webhooks: [
          {
            id: 'webhook_123',
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
            active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
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
      expect((result as any).data.webhooks[0].events).toHaveLength(6);
      expect((result as any).data.webhooks[0].events).toContain('feature.created');
      expect((result as any).data.webhooks[0].events).toContain('user.created');
    });

    it('should handle different webhook statuses', async () => {
      const apiResponse = {
        webhooks: [
          {
            id: 'webhook_active',
            name: 'Active Webhook',
            url: 'https://example.com/active',
            events: ['feature.created'],
            active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'webhook_inactive',
            name: 'Inactive Webhook',
            url: 'https://example.com/inactive',
            events: ['feature.updated'],
            active: false,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
        ],
        total: 2,
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.webhooks[0].active).toBe(true);
      expect((result as any).data.webhooks[1].active).toBe(false);
    });
  });
});