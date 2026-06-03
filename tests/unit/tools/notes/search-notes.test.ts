import { SearchNotesTool } from '@tools/notes/search-notes';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('SearchNotesTool', () => {
  let tool: SearchNotesTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  const FEATURE_ID = 'ea5e764a-bcf0-4ae2-abaa-baba0f5a3e8c';
  const CUSTOMER_ID = 'e40d7127-8315-4214-b750-300e93b1b2a2';

  beforeEach(() => {
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn().mockResolvedValue({ data: [] }),
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

    tool = new SearchNotesTool(mockApiClient, mockLogger);
  });

  const parse = (result: any) => {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      return null;
    }
  };

  describe('constructor', () => {
    it('has correct name', () => {
      expect(tool.name).toBe('pb_note_search');
    });

    it('description distinguishes from pb_note_list', () => {
      expect(tool.description).toContain('pb_note_list');
    });
  });

  describe('execute', () => {
    it('requires at least one filter', async () => {
      const result = await tool.execute({});
      const parsed = parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('At least one filter');
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('builds correct payload for feature_id', async () => {
      await tool.execute({ feature_id: FEATURE_ID });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes/search', {
        data: {
          filter: {
            relationships: { link: [{ id: FEATURE_ID }] },
          },
        },
      });
    });

    it('builds correct payload for customer_id', async () => {
      await tool.execute({ customer_id: CUSTOMER_ID });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes/search', {
        data: {
          filter: {
            relationships: { customer: [{ id: CUSTOMER_ID }] },
          },
        },
      });
    });

    it('combines feature_id and customer_id under relationships', async () => {
      await tool.execute({ feature_id: FEATURE_ID, customer_id: CUSTOMER_ID });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes/search', {
        data: {
          filter: {
            relationships: {
              link: [{ id: FEATURE_ID }],
              customer: [{ id: CUSTOMER_ID }],
            },
          },
        },
      });
    });

    it('puts tag, processed, archived under fields', async () => {
      await tool.execute({
        feature_id: FEATURE_ID,
        tag: 'beta',
        processed: false,
        archived: false,
      });

      const callBody = (mockApiClient.post as jest.Mock).mock.calls[0][1] as any;
      expect(callBody.data.filter.fields).toEqual({
        tag: 'beta',
        processed: false,
        archived: false,
      });
    });

    it('puts date range under createdAt', async () => {
      await tool.execute({
        feature_id: FEATURE_ID,
        created_from: '2026-01-01T00:00:00Z',
        created_to: '2026-12-31T23:59:59Z',
      });

      const callBody = (mockApiClient.post as jest.Mock).mock.calls[0][1] as any;
      expect(callBody.data.filter.createdAt).toEqual({
        from: '2026-01-01T00:00:00Z',
        to: '2026-12-31T23:59:59Z',
      });
    });

    it('returns "no notes matched" when API returns empty array', async () => {
      mockApiClient.post.mockResolvedValueOnce({ data: [] });

      const result: any = await tool.execute({ feature_id: FEATURE_ID });
      expect(result.content[0].text).toContain('No notes matched');
    });

    it('renders notes with id, content, customer and linked features', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: [
          {
            id: 'note-1',
            createdAt: '2026-04-01T00:00:00Z',
            fields: {
              content: '<p>Customer needs better reporting</p>',
              processed: false,
              owner: { email: 'sophie@routific.com' },
            },
            relationships: {
              data: [
                {
                  type: 'customer',
                  target: { id: CUSTOMER_ID, type: 'user' },
                },
                {
                  type: 'link',
                  target: { id: FEATURE_ID, type: 'feature' },
                },
              ],
            },
          },
        ],
      });

      const result: any = await tool.execute({ feature_id: FEATURE_ID });
      const text = result.content[0].text;

      expect(text).toContain('note-1');
      expect(text).toContain('Customer needs better reporting');
      expect(text).toContain(CUSTOMER_ID);
      expect(text).toContain(`feature:${FEATURE_ID}`);
      expect(text).toContain('sophie@routific.com');
      expect(text).toContain('Processed: false');
    });

    it('respects limit on results returned', async () => {
      const manyNotes = Array.from({ length: 5 }, (_, i) => ({
        id: `note-${i}`,
        createdAt: '2026-04-01T00:00:00Z',
        fields: { content: `note ${i}` },
        relationships: { data: [] },
      }));
      mockApiClient.post.mockResolvedValueOnce({ data: manyNotes });

      const result: any = await tool.execute({
        feature_id: FEATURE_ID,
        limit: 2,
      });
      const text = result.content[0].text;

      expect(text).toContain('Found 5 notes, showing 2');
      expect(text).toContain('note-0');
      expect(text).toContain('note-1');
      expect(text).not.toContain('note-2');
    });
  });
});
