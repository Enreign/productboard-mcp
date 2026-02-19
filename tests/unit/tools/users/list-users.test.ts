import { ListUsersTool } from '@tools/users/list-users';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('ListUsersTool', () => {
  let tool: ListUsersTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn(),
    } as any;

    tool = new ListUsersTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_user_list');
      expect(tool.description).toBe('List users in the workspace');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['admin', 'contributor', 'viewer'],
            description: 'Filter by user role',
          },
          active: {
            type: 'boolean',
            description: 'Filter by active status',
          },
          search: {
            type: 'string',
            description: 'Search in user names and emails',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const mockUsers = [
      {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        active: true,
      },
      {
        id: 'user-2',
        email: 'contributor@example.com',
        name: 'Contributor User',
        role: 'contributor',
        active: true,
      },
    ];

    it('should list all users with default parameters', async () => {
      mockApiClient.makeRequest.mockResolvedValue(mockUsers);

      const result = parseResult(await tool.execute({}));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: {},
      });

      expect(result).toEqual({
        success: true,
        data: {
          users: mockUsers,
          total: 2,
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Listing users');
    });

    it('should filter by role', async () => {
      const adminUsers = [mockUsers[0]];

      mockApiClient.makeRequest.mockResolvedValue(adminUsers);

      const result = parseResult(await tool.execute({ role: 'admin' }));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: { role: 'admin' },
      });

      expect(result.data.users).toHaveLength(1);
      expect(result.data.users[0].role).toBe('admin');
    });

    it('should filter by active status', async () => {
      const activeUsers = mockUsers;

      mockApiClient.makeRequest.mockResolvedValue(activeUsers);

      await tool.execute({ active: true });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: { active: true },
      });
    });

    it('should search users by name or email', async () => {
      const searchResults = [mockUsers[0]];

      mockApiClient.makeRequest.mockResolvedValue(searchResults);

      const result = parseResult(await tool.execute({ search: 'admin' }));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: { search: 'admin' },
      });

      expect(result.data.users).toHaveLength(1);
    });

    it('should combine multiple filters', async () => {
      mockApiClient.makeRequest.mockResolvedValue([mockUsers[1]]);

      await tool.execute({
        role: 'contributor',
        active: true,
        search: 'contributor',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: {
          role: 'contributor',
          active: true,
          search: 'contributor',
        },
      });
    });

    it('should validate role enum values', async () => {
      const invalidParams = { role: 'invalid-role' } as any;

      await expect(tool.execute(invalidParams)).rejects.toThrow('Invalid parameters for tool pb_user_list');
    });

    it('should handle empty results', async () => {
      mockApiClient.makeRequest.mockResolvedValue([]);

      const result = parseResult(await tool.execute({ role: 'viewer' }));

      expect(result).toEqual({
        success: true,
        data: {
          users: [],
          total: 0,
        },
      });
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('Tool pb_user_list execution failed: API Error');
    });

    it('should handle permission errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Insufficient permissions to list users')
      );

      await expect(tool.execute({})).rejects.toThrow('Tool pb_user_list execution failed: Insufficient permissions to list users');
    });
  });
});