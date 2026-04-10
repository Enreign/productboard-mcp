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
      getAllPages: jest.fn(),
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
      expect(tool.description).toBe('Create a customer feedback note with automatic customer/company lookup');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
          title: { type: 'string' },
          customer_email: { type: 'string', format: 'email' },
          customer_name: { type: 'string' },
          company_name: { type: 'string' },
          feature_ids: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          source: {
            type: 'object',
            properties: {
              origin: { type: 'string' },
              record_id: { type: 'string' },
              url: { type: 'string' },
            },
          },
          create_if_missing: { type: 'boolean' },
        },
      });
    });
  });

  describe('execute', () => {
    it('should create a note with minimal parameters', async () => {
      const mockResponse = { data: { id: 'note-1' } };
      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await tool.execute({ content: 'Some feedback' });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', {
        data: {
          type: 'textNote',
          fields: {
            name: 'Some feedback',
            content: '<p>Some feedback</p>',
          },
        },
      });

      const text = result.content[0].text;
      expect(text).toContain('Note created successfully');
    });

    it('should use title as name when provided', async () => {
      mockApiClient.post.mockResolvedValue({ data: { id: 'note-2' } });

      await tool.execute({ content: 'Feedback body', title: 'My Title' });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', expect.objectContaining({
        data: expect.objectContaining({
          fields: expect.objectContaining({ name: 'My Title' }),
        }),
      }));
    });

    it('should preserve HTML content as-is', async () => {
      mockApiClient.post.mockResolvedValue({ data: { id: 'note-3' } });

      await tool.execute({ content: '<div>Already HTML</div>' });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', expect.objectContaining({
        data: expect.objectContaining({
          fields: expect.objectContaining({ content: '<div>Already HTML</div>' }),
        }),
      }));
    });

    it('should include tags as array of {name} objects', async () => {
      mockApiClient.post.mockResolvedValue({ data: { id: 'note-4' } });

      await tool.execute({ content: 'Feedback', tags: ['bug', 'ux'] });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', expect.objectContaining({
        data: expect.objectContaining({
          fields: expect.objectContaining({
            tags: [{ name: 'bug' }, { name: 'ux' }],
          }),
        }),
      }));
    });

    it('should include source metadata', async () => {
      mockApiClient.post.mockResolvedValue({ data: { id: 'note-5' } });

      await tool.execute({
        content: 'Feedback',
        source: { origin: 'zendesk', record_id: 'ZD-123', url: 'https://zendesk.com/t/123' },
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', expect.objectContaining({
        data: expect.objectContaining({
          fields: expect.objectContaining({
            source: { origin: 'zendesk', recordId: 'ZD-123', url: 'https://zendesk.com/t/123' },
          }),
        }),
      }));
    });

    it('should include feature_ids as link relationships', async () => {
      mockApiClient.post.mockResolvedValue({ data: { id: 'note-6' } });

      await tool.execute({ content: 'Feedback', feature_ids: ['feat-1', 'feat-2'] });

      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', expect.objectContaining({
        data: expect.objectContaining({
          relationships: [
            { type: 'link', target: { id: 'feat-1', type: 'link' } },
            { type: 'link', target: { id: 'feat-2', type: 'link' } },
          ],
        }),
      }));
    });

    it('should validate required content parameter', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate email format', async () => {
      await expect(
        tool.execute({ content: 'Feedback', customer_email: 'not-an-email' } as any)
      ).rejects.toThrow('Invalid parameters');
    });

    it('should handle API errors', async () => {
      mockApiClient.post.mockRejectedValue(new Error('API failure'));

      const result = parseResult(await tool.execute({ content: 'Feedback' }));
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('customer lookup', () => {
    it('should auto-link when email matches', async () => {
      const mockUser = {
        id: 'user-1',
        fields: { email: 'wgao@acme.com', name: 'Wei Gao' },
        relationships: {
          data: [{ type: 'parent', target: { id: 'company-1', type: 'company' } }],
        },
      };

      mockApiClient.getAllPages.mockResolvedValueOnce([mockUser]); // email search
      mockApiClient.post.mockResolvedValue({ data: { id: 'note-7' } });

      const result = await tool.execute({
        content: 'Feedback from Wei',
        customer_email: 'wgao@acme.com',
      });

      // Should search by email local part
      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': 'user',
        'name': 'wgao',
      });

      // Should include customer relationship
      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', expect.objectContaining({
        data: expect.objectContaining({
          relationships: expect.arrayContaining([
            { type: 'customer', target: { id: 'user-1', type: 'user' } },
          ]),
        }),
      }));

      const text = result.content[0].text;
      expect(text).toContain('Linked to customer');
    });

    it('should return prompt when not found and create_if_missing is false', async () => {
      mockApiClient.getAllPages.mockResolvedValue([]); // no results

      const result = await tool.execute({
        content: 'Feedback',
        customer_email: 'nobody@acme.com',
      });

      const text = result.content[0].text;
      expect(text).toContain('No user found');
      expect(text).toContain('create_if_missing');
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('should create user and company when create_if_missing is true', async () => {
      // 1. Email search -> empty
      mockApiClient.getAllPages.mockResolvedValueOnce([]);
      // 2. Name search -> empty
      mockApiClient.getAllPages.mockResolvedValueOnce([]);
      // 3. Company search -> empty
      mockApiClient.getAllPages.mockResolvedValueOnce([]);

      // Create company
      mockApiClient.post.mockResolvedValueOnce({ data: { id: 'company-new' } });
      // Create user
      mockApiClient.post.mockResolvedValueOnce({ data: { id: 'user-new' } });
      // Create note
      mockApiClient.post.mockResolvedValueOnce({ data: { id: 'note-8' } });

      const result = await tool.execute({
        content: 'First feedback',
        customer_email: 'new@newcorp.com',
        customer_name: 'New Person',
        company_name: 'NewCorp',
        create_if_missing: true,
      });

      // Should have created the company
      expect(mockApiClient.post).toHaveBeenCalledWith('/entities', {
        data: { type: 'company', fields: { name: 'NewCorp' } },
      });

      // Should have created the user linked to company
      expect(mockApiClient.post).toHaveBeenCalledWith('/entities', {
        data: {
          type: 'user',
          fields: { name: 'New Person', email: 'new@newcorp.com' },
          relationships: [{ type: 'parent', target: { id: 'company-new', type: 'company' } }],
        },
      });

      // Should have created the note linked to the user
      expect(mockApiClient.post).toHaveBeenCalledWith('/notes', expect.objectContaining({
        data: expect.objectContaining({
          relationships: expect.arrayContaining([
            { type: 'customer', target: { id: 'user-new', type: 'user' } },
          ]),
        }),
      }));

      const text = result.content[0].text;
      expect(text).toContain('Note created successfully');
    });

    it('should reuse existing company when create_if_missing is true', async () => {
      // 1. Email search -> empty
      mockApiClient.getAllPages.mockResolvedValueOnce([]);
      // 2. Name search -> empty
      mockApiClient.getAllPages.mockResolvedValueOnce([]);
      // 3. Company search -> found existing
      mockApiClient.getAllPages.mockResolvedValueOnce([
        { id: 'company-existing', fields: { name: 'ExistingCorp' } },
      ]);

      // Create user (no company creation needed)
      mockApiClient.post.mockResolvedValueOnce({ data: { id: 'user-new2' } });
      // Create note
      mockApiClient.post.mockResolvedValueOnce({ data: { id: 'note-9' } });

      await tool.execute({
        content: 'Feedback',
        customer_email: 'someone@existingcorp.com',
        customer_name: 'Someone',
        company_name: 'ExistingCorp',
        create_if_missing: true,
      });

      // Should NOT have created a company
      expect(mockApiClient.post).not.toHaveBeenCalledWith('/entities', expect.objectContaining({
        data: expect.objectContaining({ type: 'company' }),
      }));

      // Should have created user linked to existing company
      expect(mockApiClient.post).toHaveBeenCalledWith('/entities', {
        data: {
          type: 'user',
          fields: { name: 'Someone', email: 'someone@existingcorp.com' },
          relationships: [{ type: 'parent', target: { id: 'company-existing', type: 'company' } }],
        },
      });
    });
  });
});
