import { CreateNoteTool } from '@tools/notes/create-note';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('CreateNoteTool', () => {
  let tool: CreateNoteTool;
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

    tool = new CreateNoteTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_note_create');
      expect(tool.description).toBe('Create a customer feedback note');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['content'],
        properties: {
          content: {
            type: 'string',
            description: 'Note content (customer feedback)',
          },
          title: {
            type: 'string',
            description: 'Note title/summary',
          },
          customer_email: {
            type: 'string',
            format: 'email',
            description: 'Customer email address',
          },
          company_name: {
            type: 'string',
            description: 'Customer company name',
          },
          source: {
            type: 'string',
            enum: ['email', 'call', 'meeting', 'survey', 'support', 'social'],
            description: 'Feedback source',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Feature IDs to link this note to',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const validParams = {
      content: 'Customer wants better search functionality',
    };

    const mockCreatedNote = {
      id: 'note-123',
      content: 'Customer wants better search functionality',
      title: null,
      customer_email: null,
      company_name: null,
      source: null,
      tags: [],
      created_at: '2025-01-15T00:00:00Z',
    };

    it('should create a note with minimal parameters', async () => {
      mockApiClient.post.mockResolvedValue(mockCreatedNote);

      const result = parseResult(await tool.execute(validParams));

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', {
        data: {
          type: 'simple',
          fields: {
            name: validParams.content.slice(0, 100),
            content: `<p>${validParams.content}</p>`,
          },
        },
      });

      expect(result).toEqual({
        success: true,
        data: mockCreatedNote,
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Creating note');
    });

    it('should create a note with all parameters', async () => {
      const fullParams = {
        content: 'Detailed customer feedback',
        title: 'Search Enhancement Request',
        customer_email: 'customer@example.com',
        company_name: 'Acme Corp',
        source: 'meeting' as const,
        tags: ['search', 'enhancement'],
        feature_ids: ['feat-1', 'feat-2'],
      };

      const mockFullNote = {
        ...mockCreatedNote,
        ...fullParams,
        id: 'note-456',
      };

      mockApiClient.post.mockResolvedValue(mockFullNote);

      const result = parseResult(await tool.execute(fullParams));

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', {
        data: {
          type: 'simple',
          fields: {
            name: fullParams.title,
            content: `<p>${fullParams.content}</p>`,
          },
        },
      });

      expect(result.data).toBeDefined();
    });

    it('should validate required content parameter', async () => {
      const invalidParams = {
        title: 'Title without content',
      };

      await expect(tool.execute(invalidParams as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate email format', async () => {
      const invalidParams = {
        content: 'Feedback',
        customer_email: 'invalid-email',
      };

      await expect(tool.execute(invalidParams as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate source enum values', async () => {
      const invalidParams = {
        content: 'Feedback',
        source: 'invalid-source',
      };

      await expect(tool.execute(invalidParams as any)).rejects.toThrow('Invalid parameters');
    });

    it('should handle feature linking errors', async () => {
      const paramsWithFeatures = {
        content: 'Feedback',
        feature_ids: ['non-existent-feature'],
      };

      mockApiClient.post.mockRejectedValue(
        new Error('One or more features not found')
      );

      await expect(tool.execute(paramsWithFeatures)).rejects.toThrow('One or more features not found');
    });

    it('should handle duplicate customer error gracefully', async () => {
      const paramsWithCustomer = {
        content: 'Feedback',
        customer_email: 'existing@example.com',
        company_name: 'Existing Corp',
      };

      mockApiClient.post.mockResolvedValue({
        ...mockCreatedNote,
        ...paramsWithCustomer,
      });

      const result = parseResult(await tool.execute(paramsWithCustomer));

      expect(result.success).toBe(true);
    });
  });
});