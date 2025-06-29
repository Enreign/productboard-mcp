import { describe, it, expect, beforeEach } from '@jest/globals';
import nock from 'nock';
import { CreateFeatureTool } from '../../../../src/tools/features/create-feature.js';
import { ListFeaturesTool } from '../../../../src/tools/features/list-features.js';
import { UpdateFeatureTool } from '../../../../src/tools/features/update-feature.js';
import { DeleteFeatureTool } from '../../../../src/tools/features/delete-feature.js';
import { ProductboardAPIClient } from '../../../../src/api/client.js';
import { AuthenticationManager } from '../../../../src/auth/manager.js';
import { Logger } from '../../../../src/utils/logger.js';
import { RateLimiter } from '../../../../src/middleware/rateLimiter.js';

describe('Feature Tools Integration Tests', () => {
  const API_BASE_URL = 'https://api.productboard.com';
  let authManager: AuthenticationManager;
  let apiClient: ProductboardAPIClient;
  let logger: Logger;
  let rateLimiter: RateLimiter;
  let createTool: CreateFeatureTool;
  let listTool: ListFeaturesTool;
  let updateTool: UpdateFeatureTool;
  let deleteTool: DeleteFeatureTool;

  // Test data
  const validFeature = {
    id: 'feature-123',
    name: 'Test Feature',
    description: 'A test feature for integration testing',
    status: 'new' as const,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  };

  const createFeatureInput = {
    name: 'Test Feature',
    description: 'A test feature for integration testing',
    status: 'new' as const,
  };

  const listFeaturesResponse = {
    data: [validFeature],
    pagination: {
      total: 1,
      hasMore: false,
    },
  };

  beforeEach(() => {
    nock.cleanAll();
    
    // Setup logger
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    } as any;

    // Setup auth manager
    authManager = {
      validateCredentials: jest.fn().mockResolvedValue(true),
      getAuthHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer test-token' }),
      isTokenExpired: jest.fn().mockReturnValue(false),
    } as any;

    // Setup rate limiter
    rateLimiter = {
      waitForSlot: jest.fn().mockResolvedValue(undefined),
      isLimited: jest.fn().mockReturnValue(false),
      getRemainingRequests: jest.fn().mockReturnValue({ minute: 60, hour: 3600, day: 86400 }),
    } as any;
    
    apiClient = new ProductboardAPIClient(
      {
        baseUrl: API_BASE_URL,
        timeout: 5000,
        retryAttempts: 2,
        retryDelay: 100,
      },
      authManager,
      logger,
      rateLimiter
    );

    createTool = new CreateFeatureTool(apiClient, logger);
    listTool = new ListFeaturesTool(apiClient, logger);
    updateTool = new UpdateFeatureTool(apiClient, logger);
    deleteTool = new DeleteFeatureTool(apiClient, logger);
  });

  describe('Create Feature Integration', () => {
    it('should create a feature successfully', async () => {
      const scope = nock(API_BASE_URL)
        .post('/features', createFeatureInput)
        .matchHeader('authorization', 'Bearer test-token')
        .reply(201, { success: true, data: validFeature });

      const result = await createTool.execute(createFeatureInput);

      expect(result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'feature-123',
          name: 'Test Feature',
        }),
      });
      expect(scope.isDone()).toBe(true);
    });

    it('should handle API validation errors', async () => {
      const scope = nock(API_BASE_URL)
        .post('/features')
        .reply(400, {
          message: 'Validation failed',
          errors: [{ field: 'name', message: 'Name is required' }],
        });

      const result = await createTool.execute({
        name: '',
        description: 'Test',
      });

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Validation failed'),
      });
      expect(scope.isDone()).toBe(true);
    });

    it('should retry on temporary failures', async () => {
      const scope = nock(API_BASE_URL)
        .post('/features', createFeatureInput)
        .reply(503, 'Service Unavailable')
        .post('/features', createFeatureInput)
        .reply(201, { success: true, data: validFeature });

      const result = await createTool.execute(createFeatureInput);

      expect(result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'feature-123',
        }),
      });
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('List Features Integration', () => {
    it('should list features with pagination', async () => {
      const scope = nock(API_BASE_URL)
        .get('/features')
        .query(true)
        .reply(200, listFeaturesResponse);

      const result = await listTool.execute({});

      expect(result).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'feature-123',
            name: 'Test Feature',
          }),
        ]),
      });
      expect(scope.isDone()).toBe(true);
    });

    it('should filter features by product', async () => {
      const scope = nock(API_BASE_URL)
        .get('/features')
        .query({
          product_id: 'product-1',
          limit: 20,
          offset: 0,
          sort: 'created_at',
          order: 'desc'
        })
        .reply(200, listFeaturesResponse);

      const result = await listTool.execute({ product_id: 'product-1' });

      expect(result).toMatchObject({
        data: expect.any(Array),
      });
      expect(scope.isDone()).toBe(true);
    });

    it('should handle empty results', async () => {
      const scope = nock(API_BASE_URL)
        .get('/features')
        .query(true)
        .reply(200, { data: [], pagination: { total: 0, hasMore: false } });

      const result = await listTool.execute({});

      expect(result).toMatchObject({
        data: [],
        pagination: {
          total: 0,
          hasMore: false,
        },
      });
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('Update Feature Integration', () => {
    it('should update a feature successfully', async () => {
      const updateData = {
        id: 'feature-123',
        name: 'Updated Feature Name',
        status: 'in_progress' as const,
      };

      const updatedFeature = {
        ...validFeature,
        name: 'Updated Feature Name',
        status: 'in_progress' as const,
        updatedAt: '2023-01-02T00:00:00Z',
      };

      const scope = nock(API_BASE_URL)
        .patch('/features/feature-123', {
          name: 'Updated Feature Name',
          status: 'in_progress' as const,
        })
        .matchHeader('authorization', 'Bearer test-token')
        .reply(200, { success: true, data: updatedFeature });

      const result = await updateTool.execute(updateData);

      expect(result).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: 'feature-123',
          name: 'Updated Feature Name',
          status: 'in_progress' as const,
        }),
      });
      expect(scope.isDone()).toBe(true);
    });

    it('should handle feature not found', async () => {
      const scope = nock(API_BASE_URL)
        .patch('/features/nonexistent-feature')
        .reply(404, { message: 'Feature not found' });

      const result = await updateTool.execute({
        id: 'nonexistent-feature',
        name: 'Updated Name',
      });

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Feature not found'),
      });
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('Delete Feature Integration', () => {
    it('should delete a feature successfully', async () => {
      const scope = nock(API_BASE_URL)
        .patch('/features/feature-123', { status: 'archived' })
        .matchHeader('authorization', 'Bearer test-token')
        .reply(200, { success: true, data: { ...validFeature, status: 'archived' } });

      const result = await deleteTool.execute({ id: 'feature-123' });

      expect(result).toMatchObject({
        success: true,
      });
      expect(scope.isDone()).toBe(true);
    });

    it('should handle feature not found during deletion', async () => {
      const scope = nock(API_BASE_URL)
        .patch('/features/nonexistent-feature', { status: 'archived' })
        .reply(404, { message: 'Feature not found' });

      const result = await deleteTool.execute({
        id: 'nonexistent-feature',
      });

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Feature not found'),
      });
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('Tool Chain Integration', () => {
    it('should complete full CRUD workflow', async () => {
      // 1. Create feature
      const createScope = nock(API_BASE_URL)
        .post('/features', createFeatureInput)
        .reply(201, { success: true, data: validFeature });

      const createResult = await createTool.execute(createFeatureInput);
      expect(createResult).toMatchObject({ success: true });
      expect(createScope.isDone()).toBe(true);

      // 2. List features (should include the created one)
      const listScope = nock(API_BASE_URL)
        .get('/features')
        .query(true)
        .reply(200, listFeaturesResponse);

      const listResult = await listTool.execute({});
      expect(listResult).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'feature-123' }),
        ]),
      });
      expect(listScope.isDone()).toBe(true);

      // 3. Update feature
      const updateScope = nock(API_BASE_URL)
        .patch('/features/feature-123')
        .reply(200, {
          success: true,
          data: { ...validFeature, status: 'in_progress' },
        });

      const updateResult = await updateTool.execute({
        id: 'feature-123',
        status: 'in_progress' as const,
      });
      expect(updateResult).toMatchObject({ success: true });
      expect(updateScope.isDone()).toBe(true);

      // 4. Delete feature
      const deleteScope = nock(API_BASE_URL)
        .patch('/features/feature-123', { status: 'archived' })
        .reply(200, { success: true, data: { ...validFeature, status: 'archived' } });

      const deleteResult = await deleteTool.execute({ id: 'feature-123' });
      expect(deleteResult).toMatchObject({ success: true });
      expect(deleteScope.isDone()).toBe(true);
    });
  });

});