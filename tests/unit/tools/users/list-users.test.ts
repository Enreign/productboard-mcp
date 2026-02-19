import { ListUsersTool } from '@tools/users/list-users';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('ListUsersTool', () => {
  let tool: ListUsersTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

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
    it('should list all users with default parameters', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ data: mockUsers });

      const result = await tool.execute({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: {},
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Admin User');
      expect(result.content[0].text).toContain('Contributor User');
      expect(result.content[0].text).toContain('Found 2 users');

      expect(mockLogger.info).toHaveBeenCalledWith('Listing users');
    });

    it('should filter by role', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ data: [mockUsers[0]] });

      const result = await tool.execute({ role: 'admin' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: { role: 'admin' },
      });

      expect(result.content[0].text).toContain('admin@example.com');
    });

    it('should filter by active status', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ data: mockUsers });

      await tool.execute({ active: true });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: { active: true },
      });
    });

    it('should search users by name or email', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ data: [mockUsers[0]] });

      const result = await tool.execute({ search: 'admin' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/users',
        params: { search: 'admin' },
      });

      expect(result.content[0].text).toContain('admin@example.com');
    });

    it('should combine multiple filters', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ data: [mockUsers[1]] });

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
      mockApiClient.makeRequest.mockResolvedValue({ data: [] });

      const result = await tool.execute({ role: 'viewer' });

      expect(result.content[0].text).toBe('No users found.');
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('Tool pb_user_list execution failed: API Error');
    });

    it('should handle permission errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Insufficient permissions to list users')
      );

      await expect(tool.execute({})).rejects.toThrow('Insufficient permissions to list users');
    });
  });
});
