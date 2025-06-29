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
        content: 'First feedback',
        customer_email: 'customer1@example.com',
        created_at: '2025-01-15T00:00:00Z',
      },
      {
        id: 'note-2',
        content: 'Second feedback',
        customer_email: 'customer2@example.com',
        created_at: '2025-01-14T00:00:00Z',
      },
    ];

    it('should list notes with default parameters', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: { next: null },
      });

      const result = await tool.execute({});

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { limit: 20 },
      });

      expect(result).toEqual({
        success: true,
        data: {
          data: mockNotes,
          links: { next: null },
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Listing notes');
    });

    it('should filter by feature_id', async () => {
      const featureNotes = [mockNotes[0]];
      
      mockApiClient.makeRequest.mockResolvedValue({
        data: featureNotes,
        links: {},
      });

      const result = await tool.execute({ feature_id: 'feat-123' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { feature_id: 'feat-123', limit: 20 },
      });

      expect((result as any).data.data).toHaveLength(1);
    });

    it('should filter by customer_email', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: [mockNotes[0]],
        links: {},
      });

      await tool.execute({ customer_email: 'customer1@example.com' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { customer_email: 'customer1@example.com', limit: 20 },
      });
    });

    it('should filter by company_name', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: {},
      });

      await tool.execute({ company_name: 'Acme Corp' });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { company_name: 'Acme Corp', limit: 20 },
      });
    });

    it('should filter by tags', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: {},
      });

      await tool.execute({ tags: ['important', 'feature-request'] });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { tags: ['important', 'feature-request'], limit: 20 },
      });
    });

    it('should filter by date range', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: {},
      });

      await tool.execute({
        date_from: '2025-01-01',
        date_to: '2025-01-31',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: {
          date_from: '2025-01-01',
          date_to: '2025-01-31',
          limit: 20,
        },
      });
    });

    it('should respect custom limit', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: {},
      });

      await tool.execute({ limit: 50 });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/notes',
        params: { limit: 50 },
      });
    });

    it('should handle pagination', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockNotes,
        links: { next: '/notes?offset=20' },
      });

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: {
          data: mockNotes,
          links: { next: '/notes?offset=20' },
        },
      });
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
      mockApiClient.makeRequest.mockResolvedValue({
        data: [],
        links: {},
      });

      const result = await tool.execute({});

      expect(result).toEqual({
        success: true,
        data: {
          data: [],
          links: {},
        },
      });
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('Tool pb_note_list execution failed');
    });
  });
});