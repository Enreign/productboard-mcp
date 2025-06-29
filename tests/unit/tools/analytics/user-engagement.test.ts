import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserEngagementTool } from '@tools/analytics/user-engagement';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

describe('UserEngagementTool', () => {
  let tool: UserEngagementTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockClient = {
      makeRequest: jest.fn(),
      post: jest.fn(),
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
    
    tool = new UserEngagementTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_analytics_user_engagement');
      expect(tool.description).toBe('Get user engagement analytics');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: 'Specific user ID to analyze',
          },
          user_role: {
            type: 'string',
            description: 'Filter by user role',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Start date for metrics',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'End date for metrics',
          },
          engagement_types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['logins', 'features_created', 'votes', 'comments', 'notes_created'],
            },
            description: 'Types of engagement to track',
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should accept empty parameters', async () => {
      const validation = tool.validateParams({});
      expect(validation.valid).toBe(true);
    });

    it('should validate engagement_types enum values', async () => {
      const input = {
        engagement_types: ['invalid_type'],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid engagement_types enum values', () => {
      const validInput = {
        engagement_types: ['logins', 'features_created', 'votes', 'comments', 'notes_created'] as ('logins' | 'features_created' | 'votes' | 'comments' | 'notes_created')[],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate date format', async () => {
      const input = {
        date_from: 'invalid-date',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid date formats', () => {
      const validInput = {
        date_from: '2024-01-01',
        date_to: '2024-12-31',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate user_id string', () => {
      const validInput = {
        user_id: 'user_123',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate user_role string', () => {
      const validInput = {
        user_role: 'product_manager',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept comprehensive valid input', () => {
      const validInput = {
        user_id: 'user_123',
        user_role: 'admin',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        engagement_types: ['logins', 'features_created'] as ('logins' | 'features_created')[],
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('execute', () => {
    it('should get user engagement analytics with empty parameters', async () => {
      const expectedResponse = {
        summary: {
          total_users: 150,
          active_users: 120,
          engagement_score: 7.8,
        },
        users: [
          {
            user_id: 'user_123',
            name: 'John Doe',
            role: 'product_manager',
            last_active: '2024-01-15T10:30:00Z',
            engagement_metrics: {
              logins: 25,
              features_created: 5,
              votes: 45,
              comments: 12,
              notes_created: 8,
            },
          },
        ],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute({});

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/user-engagement',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should get user engagement analytics with all parameters', async () => {
      const input = {
        user_id: 'user_456',
        user_role: 'developer',
        date_from: '2024-01-01',
        date_to: '2024-12-31',
        engagement_types: ['logins', 'votes', 'comments'] as ('logins' | 'votes' | 'comments')[],
      };
      
      const expectedResponse = {
        summary: {
          total_users: 1,
          active_users: 1,
          engagement_score: 8.5,
        },
        users: [
          {
            user_id: 'user_456',
            name: 'Jane Smith',
            role: 'developer',
            last_active: '2024-01-20T14:45:00Z',
            engagement_metrics: {
              logins: 45,
              votes: 78,
              comments: 23,
            },
          },
        ],
        period: {
          from: '2024-01-01',
          to: '2024-12-31',
        },
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/user-engagement',
        params: {
          user_id: 'user_456',
          user_role: 'developer',
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          engagement_types: 'logins,votes,comments',
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get user engagement analytics: API Error',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get user engagement analytics', error);
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Authentication failed');
      (error as any).response = {
        status: 401,
        data: {
          error: true,
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get user engagement analytics: Authentication failed',
      });
    });

    it('should handle insufficient permissions error', async () => {
      const error = new Error('Insufficient permissions');
      (error as any).response = {
        status: 403,
        data: {
          error: true,
          code: 'PERMISSION_DENIED',
          message: 'User analytics requires admin access',
        },
      };
      mockClient.makeRequest.mockRejectedValueOnce(error);

      const result = await tool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to get user engagement analytics: Insufficient permissions',
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new UserEngagementTool(null as any, mockLogger);
      const result = await uninitializedTool.execute({});
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to get user engagement analytics:'),
      });
    });

    it('should handle empty arrays gracefully', async () => {
      const input = {
        engagement_types: [],
      };
      
      const expectedResponse = {
        summary: { total_users: 0 },
        users: [],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/user-engagement',
        params: {},
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle role-based analytics', async () => {
      const input = {
        user_role: 'product_manager',
      };
      
      const expectedResponse = {
        summary: {
          total_users: 25,
          active_users: 20,
          engagement_score: 8.2,
        },
        role_analysis: {
          role: 'product_manager',
          avg_engagement_score: 8.2,
          top_activities: ['features_created', 'votes'],
        },
        users: [],
      };
      
      mockClient.makeRequest.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(input);

      expect(mockClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/analytics/user-engagement',
        params: {
          user_role: 'product_manager',
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        summary: {
          total_users: 200,
          active_users: 150,
          engagement_score: 7.5,
          avg_sessions_per_user: 12.3,
        },
        users: [
          {
            user_id: 'user_789',
            name: 'Alice Johnson',
            email: 'alice@example.com',
            role: 'admin',
            department: 'Product',
            last_active: '2024-01-20T16:20:00Z',
            engagement_metrics: {
              logins: 35,
              features_created: 8,
              votes: 120,
              comments: 45,
              notes_created: 15,
            },
            engagement_score: 9.2,
          },
        ],
        trends: [
          {
            date: '2024-01-01',
            active_users: 45,
            new_users: 5,
          },
          {
            date: '2024-01-02',
            active_users: 50,
            new_users: 3,
          },
        ],
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        engagement_types: ['logins', 'features_created', 'votes'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('summary');
      expect((result as any).data).toHaveProperty('users');
      expect((result as any).data.summary).toHaveProperty('total_users', 200);
      expect((result as any).data.users[0]).toHaveProperty('user_id', 'user_789');
      expect((result as any).data.users[0]).toHaveProperty('engagement_metrics');
      expect((result as any).data.users[0].engagement_metrics).toHaveProperty('logins', 35);
    });

    it('should handle minimal response structure', async () => {
      const apiResponse = {
        summary: {
          total_users: 0,
          active_users: 0,
        },
        users: [],
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
    });

    it('should handle aggregated analytics without individual users', async () => {
      const apiResponse = {
        summary: {
          total_users: 500,
          active_users: 400,
          engagement_score: 8.1,
        },
        role_breakdown: {
          admin: { count: 10, avg_engagement: 9.5 },
          product_manager: { count: 50, avg_engagement: 8.8 },
          developer: { count: 200, avg_engagement: 7.2 },
          stakeholder: { count: 240, avg_engagement: 6.9 },
        },
        engagement_distribution: {
          high: 150,
          medium: 200,
          low: 150,
        },
      };

      mockClient.makeRequest.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('role_breakdown');
      expect((result as any).data).toHaveProperty('engagement_distribution');
    });
  });
});