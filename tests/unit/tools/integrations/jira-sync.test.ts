import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JiraSyncTool } from '@tools/integrations/jira-sync';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';
// Error types are checked by message rather than type

describe('JiraSyncTool', () => {
  let tool: JiraSyncTool;
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
    
    tool = new JiraSyncTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_jira_sync');
      expect(tool.description).toBe('Synchronize features with JIRA issues');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: ['import', 'export', 'sync'],
            description: 'Sync action to perform',
          },
          jira_project_key: {
            type: 'string',
            description: 'JIRA project key',
          },
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific feature IDs to sync',
          },
          sync_options: {
            type: 'object',
            properties: {
              sync_status: {
                type: 'boolean',
                default: true,
                description: 'Sync status between systems',
              },
              sync_priority: {
                type: 'boolean',
                default: true,
                description: 'Sync priority between systems',
              },
              sync_assignee: {
                type: 'boolean',
                default: false,
                description: 'Sync assignee between systems',
              },
              sync_comments: {
                type: 'boolean',
                default: false,
                description: 'Sync comments between systems',
              },
              create_missing: {
                type: 'boolean',
                default: false,
                description: 'Create missing items in target system',
              },
            },
          },
          mapping: {
            type: 'object',
            properties: {
              status_map: {
                type: 'object',
                description: 'Status mapping between systems',
              },
              priority_map: {
                type: 'object',
                description: 'Priority mapping between systems',
              },
              custom_field_map: {
                type: 'object',
                description: 'Custom field mapping',
              },
            },
          },
        },
      });
    });
  });

  describe('parameter validation', () => {
    it('should validate required action field', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate action enum values', async () => {
      const input = {
        action: 'invalid_action',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input with minimal parameters', () => {
      const validInput = {
        action: 'sync' as const,
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept valid input with all parameters', () => {
      const validInput = {
        action: 'sync' as const,
        jira_project_key: 'MYPROJECT',
        feature_ids: ['feat_123', 'feat_456'],
        sync_options: {
          sync_status: true,
          sync_priority: false,
          sync_assignee: true,
          sync_comments: true,
          create_missing: true,
        },
        mapping: {
          status_map: { 'new': 'To Do', 'in_progress': 'In Progress', 'done': 'Done' },
          priority_map: { 'high': 'High', 'medium': 'Medium', 'low': 'Low' },
          custom_field_map: { 'story_points': 'customfield_10001' },
        },
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate feature_ids array contains strings', async () => {
      const input = {
        action: 'sync',
        feature_ids: [123, 456],
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept each valid action type', () => {
      const actions = ['import', 'export', 'sync'] as const;
      actions.forEach(action => {
        const validInput = { action };
        const validation = tool.validateParams(validInput);
        expect(validation.valid).toBe(true);
      });
    });
  });

  describe('execute', () => {
    it('should sync with JIRA with minimal parameters', async () => {
      const validInput = {
        action: 'sync' as const,
      };
      const expectedResponse = {
        action: 'sync',
        synced_items: 15,
        created_items: 0,
        updated_items: 15,
        errors: [],
        sync_summary: {
          features_synced: 10,
          issues_synced: 5,
          conflicts_resolved: 2,
        },
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/sync', {
        action: 'sync',
        options: {
          sync_status: true,
          sync_priority: true,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Syncing with JIRA',
        { action: 'sync' }
      );
    });

    it('should import from JIRA with all parameters', async () => {
      const validInput = {
        action: 'import' as const,
        jira_project_key: 'MYPROJECT',
        feature_ids: ['feat_123', 'feat_456'],
        sync_options: {
          sync_status: true,
          sync_priority: true,
          sync_assignee: true,
          sync_comments: false,
          create_missing: true,
        },
        mapping: {
          status_map: { 'To Do': 'new', 'In Progress': 'in_progress', 'Done': 'done' },
          priority_map: { 'High': 'high', 'Medium': 'medium', 'Low': 'low' },
          custom_field_map: { 'customfield_10001': 'story_points' },
        },
      };
      const expectedResponse = {
        action: 'import',
        synced_items: 5,
        created_items: 2,
        updated_items: 3,
        errors: [],
        sync_summary: {
          features_created: 2,
          features_updated: 3,
          issues_processed: 5,
        },
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/sync', {
        action: 'import',
        jira_project_key: 'MYPROJECT',
        feature_ids: ['feat_123', 'feat_456'],
        options: {
          sync_status: true,
          sync_priority: true,
          sync_assignee: true,
          sync_comments: false,
          create_missing: true,
        },
        mapping: {
          status_map: { 'To Do': 'new', 'In Progress': 'in_progress', 'Done': 'done' },
          priority_map: { 'High': 'high', 'Medium': 'medium', 'Low': 'low' },
          custom_field_map: { 'customfield_10001': 'story_points' },
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should export to JIRA with specific options', async () => {
      const validInput = {
        action: 'export' as const,
        jira_project_key: 'EXPORT_PROJ',
        sync_options: {
          sync_status: false,
          sync_priority: true,
          sync_assignee: false,
          sync_comments: true,
          create_missing: false,
        },
      };
      const expectedResponse = {
        action: 'export',
        synced_items: 8,
        created_items: 0,
        updated_items: 8,
        errors: [],
        sync_summary: {
          features_exported: 8,
          issues_updated: 8,
        },
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/sync', {
        action: 'export',
        jira_project_key: 'EXPORT_PROJ',
        options: {
          sync_status: false,
          sync_priority: true,
          sync_assignee: false,
          sync_comments: true,
          create_missing: false,
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        action: 'sync' as const,
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('JIRA API connection failed'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to sync with JIRA: JIRA API connection failed',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to sync with JIRA',
        expect.any(Error)
      );
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        action: 'import' as const,
        jira_project_key: 'MYPROJECT',
      };
      
      const error = new Error('JIRA authentication failed');
      (error as any).response = {
        status: 401,
        data: {
          error: true,
          code: 'JIRA_AUTH_FAILED',
          message: 'JIRA authentication failed',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to sync with JIRA: JIRA authentication failed',
      });
    });

    it('should handle JIRA project not found errors', async () => {
      const validInput = {
        action: 'export' as const,
        jira_project_key: 'NONEXISTENT',
      };
      
      const error = new Error('JIRA project not found');
      (error as any).response = {
        status: 404,
        data: {
          error: true,
          code: 'JIRA_PROJECT_NOT_FOUND',
          message: 'JIRA project NONEXISTENT not found',
          details: {},
        },
      };
      mockClient.post.mockRejectedValueOnce(error);

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to sync with JIRA: JIRA project not found',
      });
    });

    it('should handle sync conflicts and errors', async () => {
      const validInput = {
        action: 'sync' as const,
        jira_project_key: 'CONFLICTS',
        feature_ids: ['feat_123', 'feat_456', 'feat_789'],
      };
      
      const expectedResponse = {
        action: 'sync',
        synced_items: 2,
        created_items: 0,
        updated_items: 2,
        errors: [
          {
            feature_id: 'feat_789',
            jira_issue_key: 'CONFLICTS-123',
            error: 'Sync conflict: Feature updated in both systems',
          },
        ],
        sync_summary: {
          features_synced: 2,
          issues_synced: 2,
          conflicts_encountered: 1,
        },
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
      expect((result as any).data.errors).toHaveLength(1);
      expect((result as any).data.sync_summary.conflicts_encountered).toBe(1);
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new JiraSyncTool(null as any, mockLogger);
      const validInput = {
        action: 'sync' as const,
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to sync with JIRA:'),
      });
    });

    it('should set default sync_options if not provided', async () => {
      const inputWithoutOptions = {
        action: 'sync' as const,
        jira_project_key: 'MYPROJECT',
      };
      
      const expectedResponse = {
        action: 'sync',
        synced_items: 5,
        created_items: 0,
        updated_items: 5,
        errors: [],
        sync_summary: {
          features_synced: 5,
          issues_synced: 5,
        },
      };

      mockClient.post.mockResolvedValueOnce(expectedResponse);

      await tool.execute(inputWithoutOptions);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/sync', expect.objectContaining({
        options: {
          sync_status: true,
          sync_priority: true,
        },
      }));
    });

    it('should include optional parameters when provided', async () => {
      const inputWithOptionalParams = {
        action: 'import' as const,
        jira_project_key: 'OPTIONAL',
        feature_ids: ['feat_123'],
        mapping: {
          status_map: { 'Done': 'completed' },
        },
      };
      
      const expectedResponse = {
        action: 'import',
        synced_items: 1,
        created_items: 0,
        updated_items: 1,
        errors: [],
        sync_summary: {
          features_updated: 1,
        },
      };

      mockClient.post.mockResolvedValueOnce(expectedResponse);

      await tool.execute(inputWithOptionalParams);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/sync', {
        action: 'import',
        jira_project_key: 'OPTIONAL',
        feature_ids: ['feat_123'],
        options: {
          sync_status: true,
          sync_priority: true,
        },
        mapping: {
          status_map: { 'Done': 'completed' },
        },
      });
    });

    it('should not include optional parameters when not provided', async () => {
      const minimalInput = {
        action: 'sync' as const,
      };
      
      const expectedResponse = {
        action: 'sync',
        synced_items: 10,
        created_items: 0,
        updated_items: 10,
        errors: [],
        sync_summary: {
          features_synced: 10,
          issues_synced: 10,
        },
      };

      mockClient.post.mockResolvedValueOnce(expectedResponse);

      await tool.execute(minimalInput);

      const callArgs = mockClient.post.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('jira_project_key');
      expect(callArgs).not.toHaveProperty('feature_ids');
      expect(callArgs).not.toHaveProperty('mapping');
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly for sync action', async () => {
      const apiResponse = {
        action: 'sync',
        synced_items: 25,
        created_items: 5,
        updated_items: 20,
        errors: [],
        sync_summary: {
          features_synced: 15,
          issues_synced: 10,
          conflicts_resolved: 3,
        },
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        action: 'sync',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('action', 'sync');
      expect((result as any).data).toHaveProperty('synced_items', 25);
      expect((result as any).data).toHaveProperty('sync_summary');
      expect((result as any).data.sync_summary).toHaveProperty('features_synced', 15);
    });

    it('should transform API response correctly for import action', async () => {
      const apiResponse = {
        action: 'import',
        synced_items: 12,
        created_items: 8,
        updated_items: 4,
        errors: [
          {
            jira_issue_key: 'PROJ-123',
            error: 'Invalid status mapping',
          },
        ],
        sync_summary: {
          features_created: 8,
          features_updated: 4,
          issues_processed: 13,
        },
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        action: 'import',
        jira_project_key: 'PROJ',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.action).toBe('import');
      expect((result as any).data.errors).toHaveLength(1);
      expect((result as any).data.sync_summary.features_created).toBe(8);
    });

    it('should transform API response correctly for export action', async () => {
      const apiResponse = {
        action: 'export',
        synced_items: 7,
        created_items: 3,
        updated_items: 4,
        errors: [],
        sync_summary: {
          features_exported: 7,
          issues_created: 3,
          issues_updated: 4,
        },
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        action: 'export',
        jira_project_key: 'EXPORT',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.action).toBe('export');
      expect((result as any).data.sync_summary.issues_created).toBe(3);
    });

    it('should handle empty sync results', async () => {
      const apiResponse = {
        action: 'sync',
        synced_items: 0,
        created_items: 0,
        updated_items: 0,
        errors: [
          {
            error: 'No matching features found',
          },
        ],
        sync_summary: {
          features_synced: 0,
          issues_synced: 0,
        },
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        action: 'sync',
        feature_ids: ['nonexistent_feature'],
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.synced_items).toBe(0);
      expect((result as any).data.errors).toHaveLength(1);
    });
  });
});