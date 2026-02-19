import { GlobalSearchTool } from '@tools/search/global-search';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';
import { ValidationError } from '@utils/errors';

describe('GlobalSearchTool', () => {
  let tool: GlobalSearchTool;
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

    tool = new GlobalSearchTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_search');
      expect(tool.description).toBe('Search across all Productboard entities');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          types: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['feature', 'note', 'product', 'objective', 'user'],
            },
            description: 'Entity types to search (defaults to all)',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 50,
            default: 10,
            description: 'Maximum results per type',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const validParams = {
      query: 'search term',
    };

    const mockSearchResults = {
      features: [
        {
          id: 'feat-1',
          name: 'Search Feature',
          score: 0.95,
          highlight: 'Enhanced <em>search</em> functionality',
        },
      ],
      notes: [
        {
          id: 'note-1',
          content: 'Customer wants better search',
          score: 0.89,
          highlight: 'Customer wants better <em>search</em>',
        },
      ],
      products: [
        {
          id: 'prod-1',
          name: 'Search Product',
          score: 0.75,
        },
      ],
      total_results: 3,
    };

    it('should perform global search successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockSearchResults,
        links: {},
      });

      const result = await tool.execute(validParams);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/search',
        params: { q: 'search term', limit: 10 },
      });

      const text = result.content[0].text;
      expect(text).toContain('Search results for "search term"');
      expect(text).toContain('FEATURES (1)');
      expect(text).toContain('Search Feature');
      expect(text).toContain('NOTES (1)');
      expect(text).toContain('Customer wants better search');
      expect(text).toContain('PRODUCTS (1)');
      expect(text).toContain('Search Product');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Performing global search',
        { query: 'search term' }
      );
    });

    it('should search specific entity types', async () => {
      const typedSearchParams = {
        query: 'feature request',
        types: ['feature', 'note'] as ('feature' | 'note' | 'product' | 'objective' | 'user')[],
      };

      const typedResults = {
        features: mockSearchResults.features,
        notes: mockSearchResults.notes,
        total_results: 2,
      };

      mockApiClient.makeRequest.mockResolvedValue({
        data: typedResults,
        links: {},
      });

      const result = await tool.execute(typedSearchParams);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/search',
        params: {
          q: 'feature request',
          types: 'feature,note',
          limit: 10,
        },
      });

      const text = result.content[0].text;
      expect(text).not.toContain('PRODUCTS');
    });

    it('should respect custom limit', async () => {
      const paramsWithLimit = {
        query: 'test',
        limit: 25,
      };

      mockApiClient.makeRequest.mockResolvedValue({
        data: mockSearchResults,
        links: {},
      });

      await tool.execute(paramsWithLimit);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/search',
        params: { q: 'test', limit: 25 },
      });
    });

    it('should validate required query parameter', async () => {
      const invalidParams = { types: ['feature'] };

      await expect(tool.execute(invalidParams as any)).rejects.toThrow(ValidationError);
    });

    it('should validate empty query', async () => {
      const emptyQuery = { query: '' };

      await expect(tool.execute(emptyQuery)).rejects.toThrow(ValidationError);
    });

    it('should validate entity types', async () => {
      const invalidTypes = {
        query: 'search',
        types: ['invalid-type'],
      };

      await expect(tool.execute(invalidTypes as any)).rejects.toThrow(ValidationError);
    });

    it('should validate limit range', async () => {
      const tooLowLimit = {
        query: 'search',
        limit: 0,
      };

      await expect(tool.execute(tooLowLimit)).rejects.toThrow(ValidationError);

      const tooHighLimit = {
        query: 'search',
        limit: 51,
      };

      await expect(tool.execute(tooHighLimit)).rejects.toThrow(ValidationError);
    });

    it('should handle no results found', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: {
          features: [],
          notes: [],
          products: [],
          objectives: [],
          users: [],
          total_results: 0,
        },
        links: {},
      });

      const result = await tool.execute({ query: 'nonexistent' });

      const text = result.content[0].text;
      expect(text).toContain('No results found for "nonexistent"');
    });

    it('should handle search with special characters', async () => {
      const specialCharsParams = {
        query: 'test+query "exact match" -exclude',
      };

      mockApiClient.makeRequest.mockResolvedValue({
        data: mockSearchResults,
        links: {},
      });

      await tool.execute(specialCharsParams);

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/search',
        params: {
          q: 'test+query "exact match" -exclude',
          limit: 10,
        },
      });
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Search service unavailable'));

      await expect(tool.execute(validParams)).rejects.toThrow('Search service unavailable');
    });
  });
});