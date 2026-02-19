import { CurrentUserTool } from '@tools/users/current-user';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('CurrentUserTool', () => {
  let tool: CurrentUserTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new CurrentUserTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_user_current');
      expect(tool.description).toBe('Verify API access by testing a minimal API call');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {},
      });
    });
  });

  describe('execute', () => {
    it('should verify API authentication successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ data: [] });

      const result = await tool.execute({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/features',
        params: { limit: 1 },
      });

      expect(result.content[0].text).toBe('Authentication verified. API access confirmed.');
      expect(mockLogger.info).toHaveBeenCalledWith('Verifying API authentication status');
    });

    it('should handle authentication errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Authentication token invalid')
      );

      await expect(tool.execute({})).rejects.toThrow('Authentication token invalid');
    });

    it('should handle expired token errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Token expired')
      );

      await expect(tool.execute({})).rejects.toThrow('Token expired');
    });

    it('should handle network errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Network error')
      );

      await expect(tool.execute({})).rejects.toThrow('Network error');
    });

    it('should accept empty parameters object', async () => {
      mockApiClient.makeRequest.mockResolvedValue({ data: [] });

      const result = await tool.execute({});
      expect(result.content[0].text).toContain('Authentication verified');
    });
  });
});
