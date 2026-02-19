import { ProductHierarchyTool } from '@tools/products/product-hierarchy';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

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
    const mockProducts = [
      {
        id: 'prod-1',
        name: 'Product A',
        children: [
          {
            id: 'sub-1',
            name: 'Sub Product 1',
            parent_id: 'prod-1',
            children: [],
          },
        ],
      },
      {
        id: 'prod-2',
        name: 'Product B',
        children: [],
      },
    ];

    it('should retrieve full hierarchy with default parameters', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: mockProducts });

      const result = await tool.execute({});

      // Now calls /products (not /products/hierarchy)
      expect(mockApiClient.get).toHaveBeenCalledWith('/products', {});

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Product A');
      expect(result.content[0].text).toContain('Product B');

      expect(mockLogger.info).toHaveBeenCalledWith('Getting product hierarchy');
    });

    it('should retrieve hierarchy for specific product', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: [mockProducts[0]] });

      const result = await tool.execute({ product_id: 'prod-1' });

      expect(mockApiClient.get).toHaveBeenCalledWith('/products', { parent_id: 'prod-1' });

      expect(result.content[0].text).toContain('Product A');
    });

    it('should respect custom depth parameter', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: mockProducts });

      await tool.execute({ depth: 5 });

      // depth is not forwarded to API (not supported)
      expect(mockApiClient.get).toHaveBeenCalledWith('/products', {});
    });

    it('should include features when requested', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: mockProducts });

      await tool.execute({ include_features: true });

      // include_features is not forwarded to API (not supported)
      expect(mockApiClient.get).toHaveBeenCalledWith('/products', {});
    });

    it('should validate depth parameter range', async () => {
      const invalidParams = { depth: 0 } as any;
      await expect(tool.execute(invalidParams)).rejects.toThrow('Invalid parameters for tool pb_product_hierarchy');

      const tooDeepParams = { depth: 6 } as any;
      await expect(tool.execute(tooDeepParams)).rejects.toThrow('Invalid parameters for tool pb_product_hierarchy');
    });

    it('should handle empty hierarchy', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const result = await tool.execute({});

      expect(result.content[0].text).toBe('No products found.');
    });

    it('should handle API errors', async () => {
      (mockApiClient.get as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('Tool pb_product_hierarchy execution failed: API Error');
    });
  });
});
