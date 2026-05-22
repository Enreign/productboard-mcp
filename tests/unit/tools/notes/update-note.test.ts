import { UpdateNoteTool } from '@tools/notes/update-note';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('UpdateNoteTool', () => {
  let tool: UpdateNoteTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  const NOTE_ID = 'd5cdda81-f0d6-44c9-8a4f-4924f22ec678';
  const FEATURE_ID = 'ea5e764a-bcf0-4ae2-abaa-baba0f5a3e8c';

  beforeEach(() => {
    mockApiClient = {
      get: jest.fn(),
      post: jest.fn().mockResolvedValue({ data: {} }),
      patch: jest.fn().mockResolvedValue({ data: {} }),
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

    tool = new UpdateNoteTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('has correct name and description', () => {
      expect(tool.name).toBe('pb_note_update');
      expect(tool.description).toContain('Update an existing note');
    });

    it('requires id', () => {
      expect(tool.parameters).toMatchObject({ required: ['id'] });
    });
  });

  const parse = (result: any) => JSON.parse(result.content[0].text);

  describe('execute', () => {
    it('rejects invalid note UUID', async () => {
      const result = await tool.execute({ id: 'not-a-uuid', processed: true });
      const parsed = parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('not a valid note UUID');
    });

    it('rejects when nothing to update', async () => {
      const result = await tool.execute({ id: NOTE_ID });
      const parsed = parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Nothing to update');
    });

    it('PATCHes fields when processed is provided', async () => {
      await tool.execute({ id: NOTE_ID, processed: true });

      expect(mockApiClient.patch).toHaveBeenCalledWith(`/notes/${NOTE_ID}`, {
        data: { type: 'textNote', fields: { processed: true } },
      });
    });

    it('PATCHes processed=false to mark a note unprocessed', async () => {
      await tool.execute({ id: NOTE_ID, processed: false });

      expect(mockApiClient.patch).toHaveBeenCalledWith(`/notes/${NOTE_ID}`, {
        data: { type: 'textNote', fields: { processed: false } },
      });
    });

    it('PATCHes archived and name together', async () => {
      await tool.execute({ id: NOTE_ID, archived: true, name: 'New title' });

      expect(mockApiClient.patch).toHaveBeenCalledWith(`/notes/${NOTE_ID}`, {
        data: { type: 'textNote', fields: { archived: true, name: 'New title' } },
      });
    });

    it('PATCHes owner by email', async () => {
      await tool.execute({ id: NOTE_ID, owner_email: 'sophie@routific.com' });

      expect(mockApiClient.patch).toHaveBeenCalledWith(`/notes/${NOTE_ID}`, {
        data: { type: 'textNote', fields: { owner: { email: 'sophie@routific.com' } } },
      });
    });

    it('PATCHes owner by id', async () => {
      await tool.execute({ id: NOTE_ID, owner_id: '4f19d484-13e7-4ffd-a0cb-b4e9505cba1f' });

      expect(mockApiClient.patch).toHaveBeenCalledWith(`/notes/${NOTE_ID}`, {
        data: { type: 'textNote', fields: { owner: { id: '4f19d484-13e7-4ffd-a0cb-b4e9505cba1f' } } },
      });
    });

    it('POSTs one relationship per feature link', async () => {
      const FID2 = 'd62512d0-450b-43b8-b647-4388002995ae';
      const result = await tool.execute({
        id: NOTE_ID,
        link_feature_ids: [FEATURE_ID, FID2],
      });
      const parsed = parse(result);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/notes/${NOTE_ID}/relationships`,
        { data: { type: 'link', target: { id: FEATURE_ID, type: 'link' } } }
      );
      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/notes/${NOTE_ID}/relationships`,
        { data: { type: 'link', target: { id: FID2, type: 'link' } } }
      );
      expect(parsed.success).toBe(true);
      expect(parsed.data.linkedFeatureIds).toEqual([FEATURE_ID, FID2]);
    });

    it('does both PATCH and POST in one call when both are requested, linking first', async () => {
      const callOrder: string[] = [];
      mockApiClient.post.mockImplementation(async () => {
        callOrder.push('post');
        return { data: {} } as any;
      });
      mockApiClient.patch.mockImplementation(async () => {
        callOrder.push('patch');
        return { data: {} } as any;
      });

      await tool.execute({
        id: NOTE_ID,
        processed: true,
        link_feature_ids: [FEATURE_ID],
      });

      expect(mockApiClient.patch).toHaveBeenCalledTimes(1);
      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual(['post', 'patch']);
    });

    it('skips PATCH when any feature link fails', async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error('boom'));

      const result = await tool.execute({
        id: NOTE_ID,
        processed: true,
        link_feature_ids: [FEATURE_ID],
      });
      const parsed = parse(result);

      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
      expect(mockApiClient.patch).not.toHaveBeenCalled();
      expect(parsed.success).toBe(false);
      expect(parsed.data.linkedFeatureIds).toEqual([]);
      expect(parsed.data.failedLinks).toEqual([{ id: FEATURE_ID, error: 'boom' }]);
      // processed should NOT be in updatedFields
      expect(parsed.data.updatedFields).toEqual({});
    });

    it('skips PATCH when an invalid feature UUID is rejected client-side', async () => {
      const result = await tool.execute({
        id: NOTE_ID,
        processed: true,
        link_feature_ids: ['not-a-uuid'],
      });
      const parsed = parse(result);

      expect(mockApiClient.post).not.toHaveBeenCalled();
      expect(mockApiClient.patch).not.toHaveBeenCalled();
      expect(parsed.success).toBe(false);
      expect(parsed.data.updatedFields).toEqual({});
    });

    it('reports invalid feature UUID without making the API call', async () => {
      const result = await tool.execute({
        id: NOTE_ID,
        link_feature_ids: ['nope', FEATURE_ID],
      });
      const parsed = parse(result);

      // Only the valid one should hit the API
      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
      expect(parsed.data.linkedFeatureIds).toEqual([FEATURE_ID]);
      expect(parsed.data.failedLinks).toEqual([{ id: 'nope', error: 'not a valid UUID' }]);
      expect(parsed.success).toBe(false);
    });

    it('continues linking remaining features when one fails', async () => {
      const FID2 = 'd62512d0-450b-43b8-b647-4388002995ae';
      mockApiClient.post
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ data: {} });

      const result = await tool.execute({
        id: NOTE_ID,
        link_feature_ids: [FEATURE_ID, FID2],
      });
      const parsed = parse(result);

      expect(mockApiClient.post).toHaveBeenCalledTimes(2);
      expect(parsed.data.linkedFeatureIds).toEqual([FID2]);
      expect(parsed.data.failedLinks).toEqual([{ id: FEATURE_ID, error: 'boom' }]);
      expect(parsed.success).toBe(false);
    });
  });
});
