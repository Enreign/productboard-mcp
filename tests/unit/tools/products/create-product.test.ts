import { CreateProductTool } from '@tools/products/create-product';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('CreateProductTool', () => {
  let tool: CreateProductTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new CreateProductTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_product_create');
      expect(tool.description).toBe('Create a new product or sub-product');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Product name',
          },
          description: {
            type: 'string',
            description: 'Product description',
          },
          parent_id: {
            type: 'string',
            description: 'Parent product ID (for creating sub-products)',
          },
          owner_email: {
            type: 'string',
            format: 'email',
            description: 'Product owner email',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const validParams = {
      name: 'New Product',
      description: 'Product description',
    };

    const mockCreatedProduct = {
      id: 'prod-new',
      name: 'New Product',
      description: 'Product description',
      parent_id: null,
      owner_email: null,
      created_at: '2025-01-15T00:00:00Z',
    };

    it('should create a product successfully', async () => {
      mockApiClient.post.mockResolvedValue(mockCreatedProduct);

      const result = parseResult(await tool.execute(validParams));

      expect(mockApiClient.post).toHaveBeenCalledWith('/products', validParams);

      expect(result).toEqual({
        success: true,
        data: mockCreatedProduct,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating product',
        { name: 'New Product' }
      );
    });

    it('should create a sub-product with parent_id', async () => {
      const subProductParams = {
        ...validParams,
        parent_id: 'prod-parent',
      };

      const mockSubProduct = {
        ...mockCreatedProduct,
        parent_id: 'prod-parent',
      };

      mockApiClient.post.mockResolvedValue(mockSubProduct);

      const result = parseResult(await tool.execute(subProductParams));

      expect(mockApiClient.post).toHaveBeenCalledWith('/products', subProductParams);

      expect(result.data.parent_id).toBe('prod-parent');
    });

    it('should create a product with owner email', async () => {
      const paramsWithOwner = {
        ...validParams,
        owner_email: 'owner@example.com',
      };

      const mockProductWithOwner = {
        ...mockCreatedProduct,
        owner_email: 'owner@example.com',
      };

      mockApiClient.post.mockResolvedValue(mockProductWithOwner);

      const result = parseResult(await tool.execute(paramsWithOwner));

      expect(mockApiClient.post).toHaveBeenCalledWith('/products', paramsWithOwner);

      expect(result.data.owner_email).toBe('owner@example.com');
    });

    it('should validate required name parameter', async () => {
      const invalidParams = {
        description: 'Description without name',
      };

      await expect(tool.execute(invalidParams as any)).rejects.toThrow('Invalid parameters for tool pb_product_create');
    });

    it('should validate email format', async () => {
      const invalidParams = {
        name: 'Product',
        owner_email: 'invalid-email',
      };

      await expect(tool.execute(invalidParams)).rejects.toThrow('Invalid parameters for tool pb_product_create');
    });

    it('should handle duplicate product name error', async () => {
      mockApiClient.post.mockRejectedValue(
        new Error('Product with this name already exists')
      );

      await expect(tool.execute(validParams)).rejects.toThrow('Product with this name already exists');
    });

    it('should handle parent product not found error', async () => {
      const paramsWithInvalidParent = {
        ...validParams,
        parent_id: 'non-existent',
      };

      mockApiClient.post.mockRejectedValue(
        new Error('Parent product not found')
      );

      await expect(tool.execute(paramsWithInvalidParent)).rejects.toThrow('Parent product not found');
    });
  });
});