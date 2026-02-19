import { AttachNoteTool } from '@tools/notes/attach-note';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('AttachNoteTool', () => {
  let tool: AttachNoteTool;
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

    tool = new AttachNoteTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_note_attach');
      expect(tool.description).toBe('Link a note to one or more features');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['note_id', 'feature_ids'],
        properties: {
          note_id: {
            type: 'string',
            description: 'Note ID',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Feature IDs to link the note to',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const validParams = {
      note_id: 'note-123',
      feature_ids: ['feat-1', 'feat-2'],
    };

    const mockResponse = {
      note_id: 'note-123',
      attached_features: ['feat-1', 'feat-2'],
      total_attachments: 2,
    };

    it('should attach note to features successfully', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockResponse,
        links: {},
      });

      const result = parseResult(await tool.execute(validParams));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/notes/note-123/attach',
        data: { feature_ids: ['feat-1', 'feat-2'] },
      });

      expect(result).toEqual({
        success: true,
        data: {
          data: mockResponse,
          links: {},
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attaching note to features',
        { noteId: 'note-123', featureCount: 2 }
      );
    });

    it('should attach note to single feature', async () => {
      const singleFeatureParams = {
        note_id: 'note-456',
        feature_ids: ['feat-single'],
      };

      mockApiClient.makeRequest.mockResolvedValue({
        data: {
          note_id: 'note-456',
          attached_features: ['feat-single'],
          total_attachments: 1,
        },
        links: {},
      });

      const result = parseResult(await tool.execute(singleFeatureParams));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'POST',
        endpoint: '/notes/note-456/attach',
        data: { feature_ids: ['feat-single'] },
      });

      expect(result.data.data.total_attachments).toBe(1);
    });

    it('should validate required parameters', async () => {
      const missingNoteId = { feature_ids: ['feat-1'] };
      await expect(tool.execute(missingNoteId as any)).rejects.toThrow('Invalid parameters');

      const missingFeatureIds = { note_id: 'note-123' };
      await expect(tool.execute(missingFeatureIds as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate feature_ids is not empty', async () => {
      const emptyFeatures = {
        note_id: 'note-123',
        feature_ids: [],
      };

      await expect(tool.execute(emptyFeatures)).rejects.toThrow('Invalid parameters');
    });

    it('should handle note not found error', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('Note not found'));

      await expect(tool.execute({
        note_id: 'non-existent-note',
        feature_ids: ['feat-1'],
      })).rejects.toThrow('Tool pb_note_attach execution failed');
    });

    it('should handle feature not found error', async () => {
      mockApiClient.makeRequest.mockRejectedValue(
        new Error('One or more features not found')
      );

      await expect(tool.execute({
        note_id: 'note-123',
        feature_ids: ['non-existent-feature'],
      })).rejects.toThrow('Tool pb_note_attach execution failed');
    });

    it('should handle already attached features', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: {
          note_id: 'note-123',
          attached_features: ['feat-1', 'feat-2'],
          already_attached: ['feat-1'],
          newly_attached: ['feat-2'],
          total_attachments: 2,
        },
        links: {},
      });

      const result = parseResult(await tool.execute(validParams));

      expect(result.success).toBe(true);
      expect(result.data.data).toHaveProperty('already_attached');
      expect(result.data.data).toHaveProperty('newly_attached');
    });

    it('should handle attachment limit error', async () => {
      const manyFeatures = {
        note_id: 'note-123',
        feature_ids: Array(101).fill('feat').map((_, i) => `feat-${i}`),
      };

      mockApiClient.makeRequest.mockRejectedValue(
        new Error('Cannot attach note to more than 100 features')
      );

      await expect(tool.execute(manyFeatures)).rejects.toThrow('Tool pb_note_attach execution failed');
    });
  });
});