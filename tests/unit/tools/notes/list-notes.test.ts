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
          processed: {
            type: 'boolean',
            description: 'Filter by processed state',
          },
          archived: {
            type: 'boolean',
            description: expect.stringContaining('archived'),
          },
          owner_email: {
            type: 'string',
            description: 'Filter by owner email address',
          },
          owner_id: {
            type: 'string',
            description: 'Filter by owner ID',
          },
          creator_email: {
            type: 'string',
            description: 'Filter by creator email address',
          },
          creator_id: {
            type: 'string',
            description: 'Filter by creator ID',
          },
          source_record_id: {
            type: 'string',
            description: 'Filter by source record ID',
          },
          metadata_source_system: {
            type: 'string',
            description: 'Filter by metadata source system',
          },
          metadata_source_record_id: {
            type: 'string',
            description: 'Filter by metadata source record ID',
          },
          created_from: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes created from this date-time',
          },
          created_to: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes created up to this date-time',
          },
          updated_from: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes updated from this date-time',
          },
          updated_to: {
            type: 'string',
            format: 'date-time',
            description: 'Filter notes updated up to this date-time',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 5000,
            default: 100,
          },
        },
      });
    });
  });

  describe('execute', () => {
    const mockNotes = [
      {
        id: 'note-1',
        fields: { name: 'First feedback', content: '<p>First feedback</p>', owner: { email: 'owner1@example.com' }, tags: [] },
        createdAt: '2025-01-15T00:00:00Z',
      },
      {
        id: 'note-2',
        fields: { name: 'Second feedback', content: '<p>Second feedback</p>', owner: { email: 'owner2@example.com' }, tags: [] },
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

    it('should filter by processed', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({ processed: true });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { processed: true });
    });

    it('should filter by archived', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({ archived: false });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { archived: false });
    });

    it('should filter by owner_email', async () => {
      mockApiClient.getAllPages.mockResolvedValue([mockNotes[0]]);

      await tool.execute({ owner_email: 'owner1@example.com' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { 'owner[email]': 'owner1@example.com' });
    });

    it('should filter by owner_id', async () => {
      mockApiClient.getAllPages.mockResolvedValue([mockNotes[0]]);

      await tool.execute({ owner_id: 'user-123' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { 'owner[id]': 'user-123' });
    });

    it('should filter by creator_email', async () => {
      mockApiClient.getAllPages.mockResolvedValue([mockNotes[0]]);

      await tool.execute({ creator_email: 'creator@example.com' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { 'creator[email]': 'creator@example.com' });
    });

    it('should filter by creator_id', async () => {
      mockApiClient.getAllPages.mockResolvedValue([mockNotes[0]]);

      await tool.execute({ creator_id: 'creator-456' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { 'creator[id]': 'creator-456' });
    });

    it('should filter by source_record_id', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({ source_record_id: 'src-789' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', { 'source[recordId]': 'src-789' });
    });

    it('should filter by metadata source fields', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({ metadata_source_system: 'zendesk', metadata_source_record_id: 'zd-100' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', {
        'metadata[source][system]': 'zendesk',
        'metadata[source][recordId]': 'zd-100',
      });
    });

    it('should filter by created date range', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({
        created_from: '2025-01-01T00:00:00Z',
        created_to: '2025-01-31T23:59:59Z',
      });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', {
        createdFrom: '2025-01-01T00:00:00Z',
        createdTo: '2025-01-31T23:59:59Z',
      });
    });

    it('should filter by updated date range', async () => {
      mockApiClient.getAllPages.mockResolvedValue(mockNotes);

      await tool.execute({
        updated_from: '2025-02-01T00:00:00Z',
        updated_to: '2025-02-28T23:59:59Z',
      });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/notes', {
        updatedFrom: '2025-02-01T00:00:00Z',
        updatedTo: '2025-02-28T23:59:59Z',
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
      await expect(tool.execute({ limit: 5001 })).rejects.toThrow('Invalid parameters');
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
