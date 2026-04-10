import { ListNotesTool } from '@tools/notes/list-notes';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';



describe('ListNotesTool', () => {
  let tool: ListNotesTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
      getAllPages: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new ListNotesTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_note_list');
      expect(tool.description).toBe('List customer feedback notes');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Filter notes linked to a specific feature',
          },
          customer_email: {
            type: 'string',
            description: 'Filter by customer email',
          },
          company_name: {
            type: 'string',
            description: 'Filter by company',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags',
          },
          date_from: {
            type: 'string',
            format: 'date',
            description: 'Filter notes created after this date',
          },
          date_to: {
            type: 'string',
            format: 'date',
            description: 'Filter notes created before this date',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      });
    });
  });

  describe('execute', () => {
    const mockNotes = [
      {
        id: 'note-1',
        fields: { name: 'First feedback', content: '<p>First feedback</p>', owner: { email: 'customer1@example.com' }, tags: [] },
        createdAt: '2025-01-15T00:00:00Z',
      },
      {
        id: 'note-2',
        fields: { name: 'Second feedback', content: '<p>Second feedback</p>', owner: { email: 'customer2@example.com' }, tags: [] },
        createdAt: '2025-01-14T00:00:00Z',
      },
    ];

    it('should list notes with default parameters', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      const result = await tool.execute({});

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', {});

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Found 2 notes');
      expect(result.content[0].text).toContain('First feedback');
      expect(result.content[0].text).toContain('Second feedback');

      expect(mockLogger.info).toHaveBeenCalledWith('Listing notes');
    });

    it('should filter by feature_id', async () => {
      const featureNotes = [mockNotes[0]];

      mockApiClient.getAllPages.mockResolvedValue(featureNotes);

      const result = await tool.execute({ feature_id: 'feat-123' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { feature_id: 'feat-123' });

      expect(result.content[0].text).toContain('Found 1 notes');
    });

    it('should filter by customer_email', async () => {
      mockApiClient.getAllPages.mockResolvedValue([mockNotes[0]]);

      await tool.execute({ customer_email: 'customer1@example.com' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { customer_email: 'customer1@example.com' });
    });

    it('should filter by company_name', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({ company_name: 'Acme Corp' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { company_name: 'Acme Corp' });
    });

    it('should filter by tags', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({ tags: ['important', 'feature-request'] });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { tags: ['important', 'feature-request'] });
    });

    it('should filter by date range', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', {
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });
    });

    it('should respect custom limit', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      const result = await tool.execute({ limit: 1 });

      // limit is applied client-side, not sent to API
      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', {});

      // Only 1 note returned due to client-side limit
      expect(result.content[0].text).toContain('showing 1');
    });

    it('should handle pagination', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      const result = await tool.execute({});

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Found 2 notes');
    });

    it('should validate limit range', async () => {
      await expect(tool.execute({ limit: 0 })).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ limit: 101 })).rejects.toThrow('Invalid parameters');
    });

    it('should validate date format', async () => {
      await expect(
        tool.execute({ date_from: 'invalid-date' })
      ).rejects.toThrow('Invalid parameters');
    });

    it('should handle empty results', async () => {
      mockApiClient.getAllPages.mockResolvedValue([]);

      const result = await tool.execute({});

      expect(result.content[0].text).toBe('No notes found.');
    });

    it('should handle API errors', async () => {
      mockApiClient.getAllPages.mockRejectedValue(new Error('API Error'));

      const result = await tool.execute({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(false);
    });
  });
});