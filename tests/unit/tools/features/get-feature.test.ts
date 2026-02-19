import { GetFeatureTool } from '@tools/features/get-feature';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('GetFeatureTool', () => {
  let tool: GetFeatureTool;
  let mockApiClient: ProductboardAPIClient;
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

    tool = new GetFeatureTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_feature_get');
      expect(tool.description).toBe('Get detailed information about a specific feature');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            description: 'Feature ID',
          },
          include: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['notes', 'objectives', 'releases', 'custom_fields'],
            },
            description: 'Additional data to include',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const validParams = {
      id: 'feature-123',
    };

    const mockFeature = {
      id: 'feature-123',
      name: 'Test Feature',
      description: 'Test description',
      status: 'new',
      created_at: '2025-01-15T00:00:00Z',
      updated_at: '2025-01-15T00:00:00Z',
    };

    it('should fetch feature details successfully', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue(mockFeature);

      const result = parseResult(await tool.execute(validParams));

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/features/feature-123',
        {}
      );

      expect(result).toEqual({
        success: true,
        data: mockFeature,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Getting feature details',
        { featureId: 'feature-123' }
      );
    });

    it('should include additional data when requested', async () => {
      const paramsWithInclude = {
        ...validParams,
        include: ['notes', 'objectives'] as Array<'notes' | 'objectives' | 'releases' | 'custom_fields'>,
      };

      const mockFeatureWithIncludes = {
        ...mockFeature,
        notes: [
          { id: 'note-1', content: 'Customer feedback' },
        ],
        objectives: [
          { id: 'obj-1', name: 'Q1 Goals' },
        ],
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue(mockFeatureWithIncludes);

      const result = parseResult(await tool.execute(paramsWithInclude));

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/features/feature-123',
        { include: 'notes,objectives' }
      );

      expect(result).toEqual({
        success: true,
        data: mockFeatureWithIncludes,
      });
    });

    it('should handle all include options', async () => {
      const paramsWithAllIncludes = {
        ...validParams,
        include: ['notes', 'objectives', 'releases', 'custom_fields'] as Array<'notes' | 'objectives' | 'releases' | 'custom_fields'>,
      };

      (mockApiClient.get as jest.Mock).mockResolvedValue(mockFeature);

      await tool.execute(paramsWithAllIncludes);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/features/feature-123',
        { include: 'notes,objectives,releases,custom_fields' }
      );
    });

    it('should handle feature not found error', async () => {
      (mockApiClient.get as jest.Mock).mockRejectedValue(new Error('Feature not found'));

      await expect(tool.execute(validParams)).rejects.toThrow('Tool pb_feature_get execution failed: Feature not found');
    });

    it('should validate required parameters', async () => {
      const invalidParams = {} as any;

      await expect(tool.execute(invalidParams)).rejects.toThrow('Invalid parameters for tool pb_feature_get');
    });

    it('should validate include parameter values', async () => {
      const invalidParams = {
        id: 'feature-123',
        include: ['invalid-option'],
      } as any;

      await expect(tool.execute(invalidParams)).rejects.toThrow('Invalid parameters for tool pb_feature_get');
    });
  });
});