import { ProductHierarchyTool } from '@tools/products/product-hierarchy';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('ProductHierarchyTool', () => {
  let tool: ProductHierarchyTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  const product = (id: string, name: string, parentId?: string) => ({
    id,
    type: 'product',
    fields: { name },
    relationships: parentId
      ? { data: [{ type: 'parent', target: { id: parentId, type: 'product' } }] }
      : { data: [] },
  });

  const component = (id: string, name: string, parentId: string, description?: string) => ({
    id,
    type: 'component',
    fields: { name, description },
    relationships: { data: [{ type: 'parent', target: { id: parentId, type: 'product' } }] },
  });

  const feature = (id: string, name: string, parentId: string, status?: string) => ({
    id,
    type: 'feature',
    fields: {
      name,
      status: status ? { name: status } : undefined,
    },
    relationships: { data: [{ type: 'parent', target: { id: parentId } }] },
  });

  const subfeature = (id: string, name: string, parentId: string) => ({
    id,
    type: 'subfeature',
    fields: { name },
    relationships: { data: [{ type: 'parent', target: { id: parentId } }] },
  });

  beforeEach(() => {
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      makeRequest: jest.fn(),
      getAllPages: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new ProductHierarchyTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('has correct name', () => {
      expect(tool.name).toBe('pb_product_hierarchy');
    });

    it('description mentions all four levels', () => {
      const d = tool.description;
      expect(d).toContain('products');
      expect(d).toContain('components');
      expect(d).toContain('features');
      expect(d).toContain('subfeatures');
    });
  });

  describe('execute', () => {
    it('fetches all four entity types in parallel by default', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await tool.execute({});

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': 'product',
        archived: false,
      });
      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': 'component',
        archived: false,
      });
      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': 'feature',
        archived: false,
      });
      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': 'subfeature',
        archived: false,
      });
    });

    it('skips features and subfeatures when include_features=false', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([]);

      await tool.execute({ include_features: false });

      expect(mockApiClient.getAllPages).toHaveBeenCalledTimes(2);
    });

    it('passes archived=true when requested', async () => {
      mockApiClient.getAllPages.mockResolvedValue([]);

      await tool.execute({ archived: true });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': 'product',
        archived: true,
      });
    });

    it('builds nested tree from parent relationships', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([component('c1', 'Routing', 'p1')])
        .mockResolvedValueOnce([feature('f1', 'Pickup-delivery pairing', 'c1', 'in_progress')])
        .mockResolvedValueOnce([subfeature('sf1', 'Auto-assign drivers', 'f1')]);

      const result: any = await tool.execute({});
      const text = result.content[0].text;

      // Tree structure with indentation
      expect(text).toContain('Product: Routific');
      expect(text).toContain('  Component: Routing');
      expect(text).toContain('    Feature: Pickup-delivery pairing [in_progress]');
      expect(text).toContain('      Subfeature: Auto-assign drivers');
    });

    it('sorts children alphabetically', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([
          component('c1', 'Zebra', 'p1'),
          component('c2', 'Alpha', 'p1'),
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result: any = await tool.execute({});
      const text = result.content[0].text;
      const alphaIdx = text.indexOf('Alpha');
      const zebraIdx = text.indexOf('Zebra');

      expect(alphaIdx).toBeLessThan(zebraIdx);
    });

    it('reports counts in the header', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific'), product('p2', 'Other')])
        .mockResolvedValueOnce([component('c1', 'Routing', 'p1')])
        .mockResolvedValueOnce([feature('f1', 'X', 'c1')])
        .mockResolvedValueOnce([]);

      const result: any = await tool.execute({});
      expect(result.content[0].text).toContain(
        'products: 2, components: 1, features: 1, subfeatures: 0'
      );
    });

    it('lists orphans separately', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([feature('f-orphan', 'Lost feature', 'missing-parent-id')])
        .mockResolvedValueOnce([]);

      const result: any = await tool.execute({});
      const text = result.content[0].text;

      expect(text).toContain('Orphans');
      expect(text).toContain('Lost feature');
    });

    it('falls back to /entities/{id}/relationships?type=parent when the embedded relationships are missing the parent', async () => {
      // The PB API paginates relationships.data; an entity with many
      // children listed first may not include its parent on page 1.
      // Simulate that: this component has no parent in its embedded
      // relationships, but the relationships endpoint returns the parent.
      const orphanLooking = {
        id: 'c-no-parent-in-data',
        type: 'component',
        fields: { name: 'UX issues in scheduling' },
        relationships: { data: [] },
      };

      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Web App')])
        .mockResolvedValueOnce([
          component('c-parent', 'Scheduling orders to routes', 'p1'),
          orphanLooking,
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockApiClient.get = jest.fn().mockResolvedValue({
        data: [{ type: 'parent', target: { id: 'c-parent', type: 'component' } }],
      });

      const result: any = await tool.execute({});
      const text = result.content[0].text;

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/entities/c-no-parent-in-data/relationships',
        { type: 'parent' },
      );
      // Should be nested under Scheduling orders to routes, not in orphans
      expect(text).toContain('Component: UX issues in scheduling');
      expect(text).not.toContain('Orphans');
    });

    it('keeps an entity as orphan when both the embedded relationships and the fallback return no parent', async () => {
      const trulyOrphan = {
        id: 'really-orphan',
        type: 'feature',
        fields: { name: 'Genuinely lost' },
        relationships: { data: [] },
      };

      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([trulyOrphan])
        .mockResolvedValueOnce([]);

      mockApiClient.get = jest.fn().mockResolvedValue({ data: [] });

      const result: any = await tool.execute({});
      const text = result.content[0].text;

      expect(text).toContain('Orphans');
      expect(text).toContain('Genuinely lost');
    });

    it('does not call the parent fallback for products', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockApiClient.get = jest.fn();

      await tool.execute({});
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('starts from root_id when provided', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific'), product('p2', 'Other product')])
        .mockResolvedValueOnce([component('c1', 'Routing', 'p1')])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result: any = await tool.execute({ root_id: 'c1' });
      const text = result.content[0].text;

      expect(text).toContain('Component: Routing');
      // Should not start from products
      expect(text).not.toContain('Product: Routific');
      expect(text).not.toContain('Product: Other product');
    });

    it('returns error when root_id is not found', async () => {
      mockApiClient.getAllPages.mockResolvedValue([]);

      const result: any = await tool.execute({ root_id: 'unknown-id' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('unknown-id');
    });

    it('includes descriptions when include_descriptions=true', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([
          component('c1', 'Routing', 'p1', 'Handles automatic route optimization for fleets.'),
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result: any = await tool.execute({ include_descriptions: true });
      expect(result.content[0].text).toContain(
        'Handles automatic route optimization'
      );
    });

    it('omits descriptions when include_descriptions is not set', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([
          component('c1', 'Routing', 'p1', 'Handles automatic route optimization for fleets.'),
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result: any = await tool.execute({});
      expect(result.content[0].text).not.toContain('Handles automatic');
    });

    it('strips HTML from descriptions', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([product('p1', 'Routific')])
        .mockResolvedValueOnce([
          component('c1', 'Routing', 'p1', '<p>Handles <b>routing</b>.</p>'),
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result: any = await tool.execute({ include_descriptions: true });
      const text = result.content[0].text;

      expect(text).toMatch(/Handles routing\s?\./);
      expect(text).not.toContain('<p>');
      expect(text).not.toContain('<b>');
    });
  });
});
