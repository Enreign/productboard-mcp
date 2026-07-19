import { BaseTool } from '../base.js';
import { ProductboardAPIClient } from '@api/client.js';
import { Logger } from '@utils/logger.js';
import { Permission, AccessLevel } from '@auth/permissions.js';

interface ProductHierarchyParams {
  archived?: boolean;
  include_features?: boolean;
  include_descriptions?: boolean;
  root_id?: string;
  /** Backwards-compatible alias for root_id used by the previous tool shape. */
  product_id?: string;
  /** Maximum child depth to render from the selected root(s). 0 renders only roots. */
  depth?: number;
}

type EntityKind = 'product' | 'component' | 'feature' | 'subfeature';

interface Node {
  id: string;
  type: EntityKind;
  name: string;
  description?: string;
  status?: string;
  parentId?: string;
  children: Node[];
}

const TYPE_LABEL: Record<EntityKind, string> = {
  product: 'Product',
  component: 'Component',
  feature: 'Feature',
  subfeature: 'Subfeature',
};

const stripHtml = (s: string): string =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (s: string, max: number): string =>
  s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;

export class ProductHierarchyTool extends BaseTool<ProductHierarchyParams> {
  constructor(apiClient: ProductboardAPIClient, logger: Logger) {
    super(
      'pb_product_hierarchy',
      'Get the full Productboard hierarchy (products → components → features → subfeatures) in a single call. Use this to discover where a feature lives in the tree, find candidate features for tagging a note, or understand how the product is organized. The PB API returns only one parent per entity, so this tool fetches every node and builds the tree client-side.',
      {
        type: 'object',
        properties: {
          archived: {
            type: 'boolean',
            default: false,
            description: 'Include archived entities (default false). Archived features/components are usually not relevant for tagging new feedback.',
          },
          include_features: {
            type: 'boolean',
            default: true,
            description: 'Include features and subfeatures in the tree (default true). Set to false to get just the products/components skeleton, which is much smaller.',
          },
          include_descriptions: {
            type: 'boolean',
            default: false,
            description: 'Include each entity\'s description text (default false). Useful for semantic matching but increases response size significantly.',
          },
          root_id: {
            type: 'string',
            description: 'Optional UUID of a node to use as the tree root. If omitted, the tree starts from all top-level products.',
          },
          product_id: {
            type: 'string',
            description: 'Deprecated alias for root_id. Preserved for existing callers that pass product_id.',
          },
          depth: {
            type: 'integer',
            minimum: 0,
            description: 'Maximum child depth to render from the selected root(s). 0 renders only roots. If omitted, renders the full subtree.',
          },
        },
      },
      {
        requiredPermissions: [Permission.PRODUCTS_READ],
        minimumAccessLevel: AccessLevel.READ,
        description: 'Requires read access to products',
      },
      apiClient,
      logger
    );
  }

  protected async executeInternal(params: ProductHierarchyParams = {}): Promise<unknown> {
    const archived = params.archived ?? false;
    const includeFeatures = params.include_features ?? true;
    const includeDescriptions = params.include_descriptions ?? false;
    const rootId = params.root_id ?? params.product_id;
    const maxDepth = params.depth ?? Number.POSITIVE_INFINITY;

    const types: EntityKind[] = includeFeatures
      ? ['product', 'component', 'feature', 'subfeature']
      : ['product', 'component'];

    // Fetch all entity types in parallel.
    const fetched = await Promise.all(
      types.map((t) =>
        this.apiClient.getAllPages<any>('/entities', {
          'type[]': t,
          archived,
        })
      )
    );

    const entities: any[] = fetched.flat();

    // Build a node map. The parent of any entity is the relationship with
    // type="parent" inside the embedded relationships.data, but that array
    // is paginated. When an entity has many children listed first, its
    // parent can fall onto a later page and won't appear here. We collect
    // those entities and fall back to a targeted relationships fetch below.
    const nodeById = new Map<string, Node>();
    const needsParentLookup: Node[] = [];
    for (const e of entities) {
      const parentRel = (e.relationships?.data ?? []).find(
        (r: any) => r.type === 'parent'
      );
      const node: Node = {
        id: e.id,
        type: e.type as EntityKind,
        name: e.fields?.name ?? '(unnamed)',
        parentId: parentRel?.target?.id,
        children: [],
      };
      if (includeDescriptions && e.fields?.description) {
        node.description = truncate(stripHtml(e.fields.description), 300);
      }
      if (e.fields?.status?.name) {
        node.status = e.fields.status.name;
      }
      nodeById.set(node.id, node);
      // Products genuinely have no parent; everything else should.
      if (!node.parentId && node.type !== 'product') {
        needsParentLookup.push(node);
      }
    }

    // Fallback: for every non-product node whose parent wasn't found in
    // the first page of relationships, hit /entities/{id}/relationships?type=parent
    // to confirm. This is targeted (only the suspected orphans) and
    // parallel, so it stays fast even for hundreds of entities.
    if (needsParentLookup.length > 0) {
      const lookups = await Promise.all(
        needsParentLookup.map(async (node) => {
          try {
            const res = await this.apiClient.get<any>(
              `/entities/${node.id}/relationships`,
              { type: 'parent' }
            );
            const items: any[] = (res as any)?.data ?? [];
            const parentRel = items.find((r: any) => r.type === 'parent');
            return { node, parentId: parentRel?.target?.id };
          } catch {
            return { node, parentId: undefined };
          }
        })
      );
      for (const { node, parentId } of lookups) {
        if (parentId) node.parentId = parentId;
      }
    }

    // Wire children to parents. Entities whose parent really isn't in the
    // map after the fallback (deleted parents, parents of a different type
    // not in our query) end up in the orphans list.
    const orphans: Node[] = [];
    for (const node of nodeById.values()) {
      if (node.parentId && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node);
      } else if (node.type !== 'product') {
        orphans.push(node);
      }
    }

    // Sort children by name within each parent for stable output.
    for (const node of nodeById.values()) {
      node.children.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Determine roots.
    let roots: Node[];
    if (rootId) {
      const root = nodeById.get(rootId);
      if (!root) {
        return {
          success: false,
          error: `No entity with id "${rootId}" found in the hierarchy.`,
        };
      }
      roots = [root];
    } else {
      roots = [...nodeById.values()]
        .filter((n) => n.type === 'product')
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Build text output. Compact lines, indentation = depth.
    const lines: string[] = [];
    const counts: Record<EntityKind, number> = {
      product: 0,
      component: 0,
      feature: 0,
      subfeature: 0,
    };

    const render = (node: Node, depth: number): void => {
      counts[node.type]++;
      const indent = '  '.repeat(depth);
      const status = node.status ? ` [${node.status}]` : '';
      const desc = node.description ? `\n${indent}    ${node.description}` : '';
      lines.push(
        `${indent}${TYPE_LABEL[node.type]}: ${node.name}${status} (id: ${node.id})${desc}`
      );
      if (depth < maxDepth) {
        for (const child of node.children) render(child, depth + 1);
      }
    };

    for (const root of roots) render(root, 0);

    if (orphans.length > 0) {
      lines.push('');
      lines.push(
        `Orphans (parent missing from result set, ${orphans.length}):`
      );
      orphans.sort((a, b) => a.name.localeCompare(b.name));
      for (const o of orphans) {
        render(o, 1);
      }
    }

    const header = [
      `Productboard hierarchy${archived ? ' (including archived)' : ''}:`,
      `Totals — products: ${counts.product}, components: ${counts.component}, features: ${counts.feature}, subfeatures: ${counts.subfeature}`,
      '',
    ];

    return {
      content: [
        {
          type: 'text',
          text: header.concat(lines).join('\n'),
        },
      ],
    };
  }
}
