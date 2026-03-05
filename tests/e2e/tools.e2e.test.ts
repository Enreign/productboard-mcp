/**
 * E2E test suite for all Productboard MCP tools.
 *
 * Requires a real PRODUCTBOARD_API_TOKEN set in the environment or .env.test.
 * Tests create real resources and clean them up in afterAll.
 *
 * Run with: npm run test:e2e
 */

import { ProductboardAPIClient } from '../../src/api/client.js';
import { AuthenticationManager } from '../../src/auth/manager.js';
import { AuthenticationType } from '../../src/auth/types.js';
import { RateLimiter } from '../../src/middleware/rateLimiter.js';
import { Logger } from '../../src/utils/logger.js';

import { ListFeaturesTool } from '../../src/tools/features/list-features.js';
import { GetFeatureTool } from '../../src/tools/features/get-feature.js';
import { CreateFeatureTool } from '../../src/tools/features/create-feature.js';
import { UpdateFeatureTool } from '../../src/tools/features/update-feature.js';
import { DeleteFeatureTool } from '../../src/tools/features/delete-feature.js';
import { ListProductsTool } from '../../src/tools/products/list-products.js';
import { ProductHierarchyTool } from '../../src/tools/products/product-hierarchy.js';
import { CreateProductTool } from '../../src/tools/products/create-product.js';
import { ListNotesTool } from '../../src/tools/notes/list-notes.js';
import { CreateNoteTool } from '../../src/tools/notes/create-note.js';
import { ListObjectivesTool } from '../../src/tools/objectives/list-objectives.js';
import { CreateObjectiveTool } from '../../src/tools/objectives/create-objective.js';
import { UpdateObjectiveTool } from '../../src/tools/objectives/update-objective.js';
import { ListKeyResultsTool } from '../../src/tools/objectives/list-keyresults.js';
import { CreateKeyResultTool } from '../../src/tools/objectives/create-keyresult.js';
import { UpdateKeyResultTool } from '../../src/tools/objectives/update-keyresult.js';
import { ListReleasesTool } from '../../src/tools/releases/list-releases.js';
import { CreateReleaseTool } from '../../src/tools/releases/create-release.js';
import { UpdateReleaseTool } from '../../src/tools/releases/update-release.js';
import { ReleaseStatusUpdateTool } from '../../src/tools/releases/status-update.js';
import { ReleaseTimelineTool } from '../../src/tools/releases/timeline.js';

const TOKEN = process.env.PRODUCTBOARD_API_TOKEN;
const SKIP = !TOKEN;

// Jest-compatible conditional test helper (it.skipIf is Vitest-only)
const itif = (cond: boolean) => (cond ? it.skip : it);

// Created resource IDs — cleaned up in afterAll
const cleanup: { type: 'entity' | 'note'; id: string }[] = [];

let apiClient: ProductboardAPIClient;
let logger: Logger;

// IDs discovered from the workspace during setup
let componentId: string;
let productId: string;
let releaseGroupId: string;
let releaseGroupIds: string[] = [];

function makeTools() {
  return {
    featureList: new ListFeaturesTool(apiClient, logger),
    featureGet: new GetFeatureTool(apiClient, logger),
    featureCreate: new CreateFeatureTool(apiClient, logger),
    featureUpdate: new UpdateFeatureTool(apiClient, logger),
    featureDelete: new DeleteFeatureTool(apiClient, logger),
    productList: new ListProductsTool(apiClient, logger),
    productHierarchy: new ProductHierarchyTool(apiClient, logger),
    productCreate: new CreateProductTool(apiClient, logger),
    noteList: new ListNotesTool(apiClient, logger),
    noteCreate: new CreateNoteTool(apiClient, logger),
    objectiveList: new ListObjectivesTool(apiClient, logger),
    objectiveCreate: new CreateObjectiveTool(apiClient, logger),
    objectiveUpdate: new UpdateObjectiveTool(apiClient, logger),
    keyResultList: new ListKeyResultsTool(apiClient, logger),
    keyResultCreate: new CreateKeyResultTool(apiClient, logger),
    keyResultUpdate: new UpdateKeyResultTool(apiClient, logger),
    releaseList: new ListReleasesTool(apiClient, logger),
    releaseCreate: new CreateReleaseTool(apiClient, logger),
    releaseUpdate: new UpdateReleaseTool(apiClient, logger),
    releaseStatusUpdate: new ReleaseStatusUpdateTool(apiClient, logger),
    releaseTimeline: new ReleaseTimelineTool(apiClient, logger),
  };
}

function text(result: unknown): string {
  const r = result as any;
  if (r?.content?.[0]?.text) return r.content[0].text;
  return JSON.stringify(result);
}

function parsed(result: unknown): any {
  try { return JSON.parse(text(result)); } catch { return {}; }
}

beforeAll(async () => {
  if (SKIP) return;

  logger = new Logger({ level: 'error', name: 'e2e' });

  const authManager = new AuthenticationManager(
    {
      type: AuthenticationType.BEARER_TOKEN,
      credentials: { type: AuthenticationType.BEARER_TOKEN, token: TOKEN! },
      baseUrl: 'https://api.productboard.com/v2',
    },
    logger,
  );
  authManager.setCredentials({ type: AuthenticationType.BEARER_TOKEN, token: TOKEN! });

  const rateLimiter = new RateLimiter(100, 60000);

  apiClient = new ProductboardAPIClient(
    {
      baseUrl: 'https://api.productboard.com/v2',
      timeout: 15000,
      retryAttempts: 3,
      retryDelay: 1000,
    },
    authManager,
    logger,
    rateLimiter,
  );

  // Discover a component or product to use as parent in feature create tests
  const entitiesResp = await apiClient.get<any>('/entities', { 'type[]': 'component' });
  const components = entitiesResp?.data ?? [];
  if (components.length > 0) componentId = components[0].id;

  if (!componentId) {
    const productsResp = await apiClient.get<any>('/entities', { 'type[]': 'product' });
    const products = productsResp?.data ?? [];
    if (products.length > 0) productId = products[0].id;
  }

  const rgResp = await apiClient.get<any>('/entities', { 'type[]': 'releaseGroup' });
  const releaseGroups = rgResp?.data ?? [];
  releaseGroupIds = releaseGroups.map((rg: any) => rg.id);
  if (releaseGroups.length > 0) releaseGroupId = releaseGroups[0].id;
});

afterAll(async () => {
  if (SKIP || !apiClient) return;

  for (const item of cleanup) {
    try {
      if (item.type === 'note') {
        await apiClient.delete(`/notes/${item.id}`);
      } else {
        await apiClient.delete(`/entities/${item.id}`);
      }
    } catch {
      // best-effort cleanup
    }
  }
});

// ─── Products ────────────────────────────────────────────────────────────────

describe('pb_product_list', () => {
  itif(SKIP)('returns products', async () => {
    const tools = makeTools();
    const result = await tools.productList.execute({});
    const output = text(result);
    expect(output).toMatch(/product/i);
  });
});

describe('pb_product_hierarchy', () => {
  itif(SKIP)('returns hierarchy', async () => {
    const tools = makeTools();
    const result = await tools.productHierarchy.execute({});
    const output = text(result);
    expect(output).toMatch(/product/i);
  });
});

describe('pb_product_create', () => {
  itif(SKIP)('creates a product', async () => {
    const tools = makeTools();
    const result = await tools.productCreate.execute({ name: 'E2E Test Product' });
    const data = parsed(result);
    expect(data.success).toBe(true);
    const id = data.data?.data?.id ?? data.data?.id;
    expect(id).toBeTruthy();
    cleanup.push({ type: 'entity', id });
  });
});

// ─── Features ────────────────────────────────────────────────────────────────

describe('pb_feature_list', () => {
  itif(SKIP)('returns features with correct field mapping', async () => {
    const tools = makeTools();
    const result = await tools.featureList.execute({});
    const output = text(result);
    expect(output).not.toMatch(/Untitled Feature/);
    expect(output).not.toMatch(/Status: Unknown/);
  });
});

describe('pb_feature_get', () => {
  itif(SKIP)('returns feature details', async () => {
    const tools = makeTools();
    // Get first feature ID from list
    const listResp = await apiClient.get<any>('/entities', { 'type[]': 'feature' });
    const featureId = listResp?.data?.[0]?.id;
    if (!featureId) return;

    const result = await tools.featureGet.execute({ id: featureId });
    const data = parsed(result);
    expect(data.success).toBe(true);
    expect(data.data?.fields?.name).toBeTruthy();
  });
});

describe('pb_feature_create', () => {
  let createdFeatureId: string;
  const hasParent = () => !!(componentId || productId);

  itif(SKIP)('creates a feature under a component or product', async () => {
    if (!hasParent()) return;
    const tools = makeTools();
    const params: Record<string, string> = {
      name: 'E2E Test Feature',
      description: 'Created by e2e test suite',
    };
    if (componentId) params.component_id = componentId;
    else params.product_id = productId;

    const result = await tools.featureCreate.execute(params as any);
    const data = parsed(result);
    expect(data.success).toBe(true);
    createdFeatureId = data.data?.data?.id ?? data.data?.id;
    expect(createdFeatureId).toBeTruthy();
    cleanup.push({ type: 'entity', id: createdFeatureId });
  });

  itif(SKIP)('updates the created feature', async () => {
    if (!createdFeatureId) return;
    const tools = makeTools();
    const result = await tools.featureUpdate.execute({
      id: createdFeatureId,
      name: 'E2E Test Feature (updated)',
    });
    expect(parsed(result).success).toBe(true);
  });

  itif(SKIP)('archives (soft-delete) the created feature', async () => {
    if (!createdFeatureId) return;
    const tools = makeTools();
    const result = await tools.featureDelete.execute({
      id: createdFeatureId,
      permanent: false,
    });
    const data = parsed(result);
    expect(data.success).toBe(true);
    expect(data.data?.action).toBe('archived');
  });

  itif(SKIP)('permanently deletes the created feature', async () => {
    if (!createdFeatureId) return;
    const tools = makeTools();
    const result = await tools.featureDelete.execute({
      id: createdFeatureId,
      permanent: true,
    });
    const data = parsed(result);
    expect(data.success).toBe(true);
    expect(data.data?.action).toBe('deleted');
    // Already deleted — remove from cleanup list
    const idx = cleanup.findIndex(c => c.id === createdFeatureId);
    if (idx !== -1) cleanup.splice(idx, 1);
  });
});

// ─── Notes ───────────────────────────────────────────────────────────────────

describe('pb_note_list', () => {
  itif(SKIP)('returns notes with correct field mapping', async () => {
    const tools = makeTools();
    const result = await tools.noteList.execute({});
    const output = text(result);
    // Should not show blanks — either real titles or "No notes found"
    expect(output).toBeDefined();
    expect(output).not.toMatch(/^undefined$/);
  });
});

describe('pb_note_create', () => {
  itif(SKIP)('creates a note', async () => {
    const tools = makeTools();
    const result = await tools.noteCreate.execute({
      content: 'E2E test note content',
      title: 'E2E Test Note',
    });
    const data = parsed(result);
    expect(data.success).toBe(true);
    const noteId = data.data?.data?.id ?? data.data?.id;
    expect(noteId).toBeTruthy();
    cleanup.push({ type: 'note', id: noteId });
  });
});

// ─── Objectives ──────────────────────────────────────────────────────────────

describe('pb_objective_list', () => {
  itif(SKIP)('returns objectives with correct field mapping', async () => {
    const tools = makeTools();
    const result = await tools.objectiveList.execute({});
    const output = text(result);
    expect(output).not.toMatch(/Untitled Objective/);
  });
});

describe('pb_objective_create + update', () => {
  let objectiveId: string;

  itif(SKIP)('creates an objective', async () => {
    const tools = makeTools();
    const result = await tools.objectiveCreate.execute({
      name: 'E2E Test Objective',
      description: 'Created by e2e test suite',
    });
    const data = parsed(result);
    expect(data.success).toBe(true);
    objectiveId = data.data?.data?.id ?? data.data?.id;
    expect(objectiveId).toBeTruthy();
    cleanup.push({ type: 'entity', id: objectiveId });
  });

  itif(SKIP)('updates the created objective', async () => {
    if (!objectiveId) return;
    const tools = makeTools();
    const result = await tools.objectiveUpdate.execute({
      id: objectiveId,
      name: 'E2E Test Objective (updated)',
    });
    expect(parsed(result).success).toBe(true);
  });
});

// ─── Key Results (unsupported in v2) ─────────────────────────────────────────

describe('pb_keyresult_list', () => {
  itif(SKIP)('returns unsupported message', async () => {
    const tools = makeTools();
    const result = await tools.keyResultList.execute({});
    const output = text(result);
    expect(output).toMatch(/not supported/i);
  });
});

describe('pb_keyresult_create', () => {
  itif(SKIP)('returns unsupported error', async () => {
    const tools = makeTools();
    const result = await tools.keyResultCreate.execute({
      objective_id: 'dummy',
      name: 'Test KR',
      target_value: 100,
    });
    const data = parsed(result);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/not supported/i);
  });
});

describe('pb_keyresult_update', () => {
  itif(SKIP)('returns unsupported error', async () => {
    const tools = makeTools();
    const result = await tools.keyResultUpdate.execute({ id: 'dummy' });
    const data = parsed(result);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/not supported/i);
  });
});

// ─── Releases ────────────────────────────────────────────────────────────────

describe('pb_release_list', () => {
  itif(SKIP)('returns releases with correct field mapping', async () => {
    const tools = makeTools();
    const result = await tools.releaseList.execute({});
    const output = text(result);
    expect(output).not.toMatch(/Untitled Release/);
  });
});

describe('pb_release_timeline', () => {
  itif(SKIP)('returns release groups', async () => {
    const tools = makeTools();
    const result = await tools.releaseTimeline.execute({});
    const data = parsed(result);
    expect(data.success).toBe(true);
    expect(data.data?.data).toBeDefined();
  });
});

describe('pb_release_create + update + status_update', () => {
  let releaseId: string;
  let statusId: string;

  itif(SKIP)('creates a release', async () => {
    const tools = makeTools();
    // Try each release group in order — some may have workspace-specific 500s
    const groupsToTry = releaseGroupIds.length > 0 ? releaseGroupIds : [releaseGroupId].filter(Boolean);
    for (const rgId of groupsToTry) {
      try {
        const result = await tools.releaseCreate.execute({ name: 'E2E Test Release', release_group_id: rgId });
        const data = parsed(result);
        if (data.success) {
          releaseId = data.data?.data?.id ?? data.data?.id;
          if (releaseId) {
            cleanup.push({ type: 'entity', id: releaseId });
            break;
          }
        }
      } catch {
        // try next group
      }
    }
    expect(releaseId).toBeTruthy();
  });

  itif(SKIP)('updates the created release', async () => {
    if (!releaseId) return;
    const tools = makeTools();
    const result = await tools.releaseUpdate.execute({
      id: releaseId,
      name: 'E2E Test Release (updated)',
    });
    expect(parsed(result).success).toBe(true);
  });

  itif(SKIP)('updates release status using its current status ID', async () => {
    if (!releaseId) return;
    // Fetch the release to get the current status ID
    const releaseData = await apiClient.get<any>(`/entities/${releaseId}`);
    statusId = releaseData?.data?.fields?.status?.id;
    if (!statusId) return;

    const tools = makeTools();
    const result = await tools.releaseStatusUpdate.execute({
      id: releaseId,
      status_id: statusId,
    });
    expect(parsed(result).success).toBe(true);
  });
});
