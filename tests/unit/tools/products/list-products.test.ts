import { ListProductsTool } from '@tools/products/list-products';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

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
        name: 'Product A',
        description: 'Main product',
        parent_id: null,
        archived: false,
      },
      {
        id: 'prod-2',
        name: 'Product B',
        description: 'Another product',
        parent_id: null,
        archived: false,
      },
    ];

    it('should list all products successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockProducts,
        links: {},
      });

      const result = parseResult(await tool.execute({}));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/products',
        params: {},
      });

      expect(result).toEqual({
        success: true,
        data: {
          products: mockProducts,
          total: 2,
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Listing products');
    });

    it('should filter by parent_id', async () => {
      const subProducts = [
        {
          id: 'sub-1',
          name: 'Sub Product 1',
          parent_id: 'prod-1',
          archived: false,
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        data: subProducts,
        links: {},
      });

      const result = parseResult(await tool.execute({ parent_id: 'prod-1' }));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/products',
        params: { parent_id: 'prod-1' },
      });

      expect(result.data.products).toEqual(subProducts);
    });

    it('should include components when requested', async () => {
      const productsWithComponents = mockProducts.map(p => ({
        ...p,
        components: [
          { id: 'comp-1', name: 'Component 1' },
        ],
      }));

      mockApiClient.makeRequest.mockResolvedValue({
        data: productsWithComponents,
        links: {},
      });

      const result = parseResult(await tool.execute({ include_components: true }));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/products',
        params: { include_components: true },
      });

      expect(result.data.products[0]).toHaveProperty('components');
    });

    it('should include archived products when requested', async () => {
      const allProducts = [
        ...mockProducts,
        {
          id: 'prod-archived',
          name: 'Archived Product',
          archived: true,
        },
      ];

      mockApiClient.makeRequest.mockResolvedValue({
        data: allProducts,
        links: {},
      });

      const result = parseResult(await tool.execute({ include_archived: true }));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/products',
        params: { include_archived: true },
      });

      expect(result.data.products).toHaveLength(3);
      expect(result.data.products.some((p: any) => p.archived)).toBe(true);
    });

    it('should handle empty results', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: [],
        links: {},
      });

      const result = parseResult(await tool.execute({}));

      expect(result).toEqual({
        success: true,
        data: {
          products: [],
          total: 0,
        },
      });
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('API Error');
    });
  });
});