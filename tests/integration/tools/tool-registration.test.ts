import { ToolRegistry } from '@core/registry.js';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';
import { GetFeatureTool } from '@tools/features/get-feature';
import { ListFeaturesTool } from '@tools/features/list-features';
import { ListProductsTool } from '@tools/products/list-products';
import { CreateProductTool } from '@tools/products/create-product';
import { ProductHierarchyTool } from '@tools/products/product-hierarchy';
import { CreateNoteTool } from '@tools/notes/create-note';
import { ListNotesTool } from '@tools/notes/list-notes';
import { ListObjectivesTool } from '@tools/objectives/list-objectives';
import { CreateObjectiveTool } from '@tools/objectives/create-objective';
import { ListReleasesTool } from '@tools/releases/list-releases';
import { CreateReleaseTool } from '@tools/releases/create-release';

describe('Tool Registration Integration', () => {
  let registry: ToolRegistry;
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
      getAllPages: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    registry = new ToolRegistry(mockLogger);
  });

  describe('registering all tools', () => {
    it('should register all feature tools', () => {
      const tools = [
        new GetFeatureTool(mockApiClient, mockLogger),
        new ListFeaturesTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_feature_get')).toBe(true);
      expect(registry.hasTool('pb_feature_list')).toBe(true);
      expect(registry.size()).toBe(2);
    });

    it('should register all product tools', () => {
      const tools = [
        new ListProductsTool(mockApiClient, mockLogger),
        new CreateProductTool(mockApiClient, mockLogger),
        new ProductHierarchyTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_product_list')).toBe(true);
      expect(registry.hasTool('pb_product_create')).toBe(true);
      expect(registry.hasTool('pb_product_hierarchy')).toBe(true);
      expect(registry.size()).toBe(3);
    });

    it('should register all note tools', () => {
      const tools = [
        new CreateNoteTool(mockApiClient, mockLogger),
        new ListNotesTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_note_create')).toBe(true);
      expect(registry.hasTool('pb_note_list')).toBe(true);
      expect(registry.size()).toBe(2);
    });

    it('should register all objective tools', () => {
      const tools = [
        new ListObjectivesTool(mockApiClient, mockLogger),
        new CreateObjectiveTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_objective_list')).toBe(true);
      expect(registry.hasTool('pb_objective_create')).toBe(true);
      expect(registry.size()).toBe(2);
    });

    it('should register all release tools', () => {
      const tools = [
        new ListReleasesTool(mockApiClient, mockLogger),
        new CreateReleaseTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      expect(registry.hasTool('pb_release_list')).toBe(true);
      expect(registry.hasTool('pb_release_create')).toBe(true);
      expect(registry.size()).toBe(2);
    });
  });

  describe('listing registered tools', () => {
    it('should list all tools with correct descriptors', () => {
      const tools = [
        new GetFeatureTool(mockApiClient, mockLogger),
        new ListProductsTool(mockApiClient, mockLogger),
        new CreateNoteTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        registry.registerTool(tool);
      });

      const descriptors = registry.listTools();

      expect(descriptors).toHaveLength(3);
      expect(descriptors).toContainEqual(
        expect.objectContaining({
          name: 'pb_feature_get',
          description: 'Get detailed information about a specific feature',
        })
      );
      expect(descriptors).toContainEqual(
        expect.objectContaining({
          name: 'pb_product_list',
          description: 'List all products in the workspace',
        })
      );
      expect(descriptors).toContainEqual(
        expect.objectContaining({
          name: 'pb_note_create',
          description: 'Create a customer feedback note with automatic customer/company lookup',
        })
      );
    });
  });

  describe('tool naming convention validation', () => {
    it('should follow pb_<resource>_<action> pattern', () => {
      const tools = [
        new GetFeatureTool(mockApiClient, mockLogger),
        new ListFeaturesTool(mockApiClient, mockLogger),
        new ListProductsTool(mockApiClient, mockLogger),
        new CreateProductTool(mockApiClient, mockLogger),
        new ProductHierarchyTool(mockApiClient, mockLogger),
        new CreateNoteTool(mockApiClient, mockLogger),
        new ListNotesTool(mockApiClient, mockLogger),
        new ListObjectivesTool(mockApiClient, mockLogger),
        new ListReleasesTool(mockApiClient, mockLogger),
      ];

      tools.forEach(tool => {
        expect(tool.name).toMatch(/^pb_[a-z]+(_[a-z]+)*$/);
      });
    });
  });
});
