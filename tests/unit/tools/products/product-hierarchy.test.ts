import { ProductHierarchyTool } from '@tools/products/product-hierarchy';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('ProductHierarchyTool', () => {
  let tool: ProductHierarchyTool;
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

    tool = new ProductHierarchyTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_product_hierarchy');
      expect(tool.description).toBe('Get the complete product hierarchy tree');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {
          product_id: {
            type: 'string',
            description: 'Root product ID (optional, defaults to all top-level products)',
          },
          depth: {
            type: 'integer',
            minimum: 1,
            maximum: 5,
            default: 3,
            description: 'Maximum depth of hierarchy to retrieve',
          },
          include_features: {
            type: 'boolean',
            default: false,
            description: 'Include features at each level',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const mockHierarchy = {
      products: [
        {
          id: 'prod-1',
          name: 'Product A',
          level: 0,
          children: [
            {
              id: 'sub-1',
              name: 'Sub Product 1',
              level: 1,
              parent_id: 'prod-1',
              children: [],
            },
          ],
        },
        {
          id: 'prod-2',
          name: 'Product B',
          level: 0,
          children: [],
        },
      ],
    };

    it('should retrieve full hierarchy with default parameters', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue(mockHierarchy);

      const result = parseResult(await tool.execute({}));

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/products/hierarchy',
        { depth: 3 }
      );

      expect(result).toEqual({
        success: true,
        data: mockHierarchy,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Getting product hierarchy');
    });

    it('should retrieve hierarchy for specific product', async () => {
      const singleProductHierarchy = {
        products: [mockHierarchy.products[0]],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue(singleProductHierarchy);

      const result = parseResult(await tool.execute({ product_id: 'prod-1' }));

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/products/hierarchy',
        { product_id: 'prod-1', depth: 3 }
      );

      expect(result.data.products).toHaveLength(1);
      expect(result.data.products[0].id).toBe('prod-1');
    });

    it('should respect custom depth parameter', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue(mockHierarchy);

      await tool.execute({ depth: 5 });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/products/hierarchy',
        { depth: 5 }
      );
    });

    it('should include features when requested', async () => {
      const hierarchyWithFeatures = {
        products: [
          {
            ...mockHierarchy.products[0],
            features: [
              { id: 'feat-1', name: 'Feature 1' },
              { id: 'feat-2', name: 'Feature 2' },
            ],
            children: [
              {
                ...mockHierarchy.products[0].children[0],
                features: [
                  { id: 'feat-3', name: 'Feature 3' },
                ],
              },
            ],
          },
        ],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue(hierarchyWithFeatures);

      const result = parseResult(await tool.execute({ include_features: true }));

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/products/hierarchy',
        { depth: 3, include_features: true }
      );

      expect(result.data.products[0]).toHaveProperty('features');
      expect(result.data.products[0].children[0]).toHaveProperty('features');
    });

    it('should validate depth parameter range', async () => {
      const invalidParams = { depth: 0 } as any;
      await expect(tool.execute(invalidParams)).rejects.toThrow('Invalid parameters for tool pb_product_hierarchy');

      const tooDeepParams = { depth: 6 } as any;
      await expect(tool.execute(tooDeepParams)).rejects.toThrow('Invalid parameters for tool pb_product_hierarchy');
    });

    it('should handle empty hierarchy', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue({ products: [] });

      const result = parseResult(await tool.execute({}));

      expect(result).toEqual({
        success: true,
        data: { products: [] },
      });
    });

    it('should handle API errors', async () => {
      (mockApiClient.get as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('Tool pb_product_hierarchy execution failed: API Error');
    });
  });
});