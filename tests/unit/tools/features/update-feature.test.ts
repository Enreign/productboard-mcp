import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpdateFeatureTool } from '@tools/features/update-feature';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';

function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try {
      return JSON.parse(result.content[0].text);
    } catch {
      return result.content[0].text;
    }
  }
  return result;
}

describe('UpdateFeatureTool', () => {
  let tool: UpdateFeatureTool;
  let mockClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockClient = {
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    } as unknown as jest.Mocked<ProductboardAPIClient>;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new UpdateFeatureTool(mockClient, mockLogger);
  });

  it('should have correct name and description', () => {
    expect(tool.name).toBe('pb_feature_update');
    expect(tool.description).toBe('Update an existing feature');
  });

  it('should require an id and at least one update field', async () => {
    await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
    await expect(tool.execute({ id: 'feat_123' } as any)).rejects.toThrow('Invalid parameters');
  });

  it('should PATCH description as Productboard rich text fields payload', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { id: 'feat_123' } });

    const result = parseResult(
      await tool.execute({
        id: 'feat_123',
        description: 'Full description with details',
      }),
    );

    expect(mockClient.patch).toHaveBeenCalledWith('/entities/feat_123', {
      data: {
        fields: {
          description: '<p>Full description with details</p>',
        },
      },
    });
    expect(result).toEqual({ success: true, data: { id: 'feat_123' } });
  });

  it('should preserve HTML descriptions instead of double-wrapping them', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { id: 'feat_123' } });

    await tool.execute({ id: 'feat_123', description: '<p>Already HTML</p>' });

    expect(mockClient.patch).toHaveBeenCalledWith('/entities/feat_123', {
      data: { fields: { description: '<p>Already HTML</p>' } },
    });
  });

  it('should map owner, status, and tags to Productboard update field formats', async () => {
    mockClient.patch.mockResolvedValueOnce({ data: { id: 'feat_123' } });

    await tool.execute({
      id: 'feat_123',
      owner_email: 'owner@example.com',
      status_id: 'status_123',
      tags: ['api', 'customer-feedback'],
    });

    expect(mockClient.patch).toHaveBeenCalledWith('/entities/feat_123', {
      data: {
        fields: {
          owner: { email: 'owner@example.com' },
          status: { id: 'status_123' },
          tags: [{ name: 'api' }, { name: 'customer-feedback' }],
        },
      },
    });
  });

  it('should surface API errors as failed tool results', async () => {
    mockClient.patch.mockRejectedValueOnce(new Error('API Error'));

    const result = parseResult(await tool.execute({ id: 'feat_123', description: 'Update' }));

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
