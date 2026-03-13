import { ListProductsTool } from '@tools/products/list-products';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('ListProductsTool', () => {
  let tool: ListProductsTool;
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

    tool = new ListProductsTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_product_list');
      expect(tool.description).toBe('List all products in the workspace');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {
          parent_id: {
            type: 'string',
            description: 'Filter by parent product ID (for sub-products)',
          },
          include_components: {
            type: 'boolean',
            default: false,
            description: 'Include component information',
          },
          include_archived: {
            type: 'boolean',
            default: false,
            description: 'Include archived products',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const mockProducts = [
      {
        id: 'prod-1',
        fields: { name: 'Product A', description: 'Main product' },
      },
      {
        id: 'prod-2',
        fields: { name: 'Product B', description: 'Another product' },
      },
    ];

    it('should list all products successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockProducts,
        links: {},
      });

      const result = await tool.execute({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: { 'type[]': 'product' },
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Found 2 products');
      expect(result.content[0].text).toContain('Product A');
      expect(result.content[0].text).toContain('Product B');

      expect(mockLogger.info).toHaveBeenCalledWith('Listing products');
    });

    it('should filter by parent_id', async () => {
      const subProducts = [
        {
          id: 'sub-1',
          fields: { name: 'Sub Product 1' },
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        data: subProducts,
        links: {},
      });

      const result = await tool.execute({ parent_id: 'prod-1' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: { 'type[]': 'product', parent_id: 'prod-1' },
      });

      expect(result.content[0].text).toContain('Sub Product 1');
    });

    it('should include components when requested', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockProducts,
        links: {},
      });

      const result = await tool.execute({ include_components: true });

      // include_components is not forwarded to API (not a supported param)
      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/entities',
        params: { 'type[]': 'product' },
      });

      expect(result.content[0].text).toContain('Product A');
    });

    it('should include archived products when requested', async () => {
      const allProducts = [
        ...mockProducts,
        {
          id: 'prod-archived',
          fields: { name: 'Archived Product' },
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        data: allProducts,
        links: {},
      });

      const result = await tool.execute({ include_archived: true });

      expect(result.content[0].text).toContain('Found 3 products');
      expect(result.content[0].text).toContain('Archived Product');
    });

    it('should handle empty results', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: [],
        links: {},
      });

      const result = await tool.execute({});

      expect(result.content[0].text).toBe('No products found.');
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('API Error'));

      const result = await tool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });
  });
});
