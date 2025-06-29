import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExportToJiraTool } from '@tools/integrations/export-to-jira';
import { ProductboardAPIClient } from '@api/client';
import { Logger } from '@utils/logger';
// Error types are checked by message rather than type

describe('ExportToJiraTool', () => {
  let tool: ExportToJiraTool;
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
    
    tool = new ExportToJiraTool(mockClient, mockLogger);
  });

  describe('metadata', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('pb_to_jira');
      expect(tool.description).toBe('Export features to JIRA as issues');
    });

    it('should have correct parameter schema', () => {
      const metadata = tool.getMetadata();
      expect(metadata.inputSchema).toMatchObject({
        type: 'object',
        required: ['feature_ids', 'jira_project_key'],
        properties: {
          feature_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'Feature IDs to export',
          },
          jira_project_key: {
            type: 'string',
            description: 'Target JIRA project key',
          },
          issue_type: {
            type: 'string',
            enum: ['Story', 'Task', 'Bug', 'Epic'],
            default: 'Story',
            description: 'JIRA issue type',
          },
          create_options: {
            type: 'object',
            properties: {
              include_description: {
                type: 'boolean',
                default: true,
                description: 'Include feature description',
              },
              include_attachments: {
                type: 'boolean',
                default: false,
                description: 'Include attachments',
              },
              include_notes_as_comments: {
                type: 'boolean',
                default: true,
                description: 'Convert notes to JIRA comments',
              },
              link_back_to_productboard: {
                type: 'boolean',
                default: true,
                description: 'Add link back to Productboard',
              },
            },
          },
          field_mapping: {
            type: 'object',
            properties: {
              priority: {
                type: 'object',
                description: 'Priority mapping',
              },
              custom_fields: {
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
    it('should validate required fields', async () => {
      await expect(tool.execute({} as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ feature_ids: ['feat_123'] } as any)).rejects.toThrow('Invalid parameters');
      await expect(tool.execute({ jira_project_key: 'PROJ' } as any)).rejects.toThrow('Invalid parameters');
    });

    it('should validate feature_ids array length', async () => {
      const input = {
        feature_ids: [],
        jira_project_key: 'PROJ',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should validate issue_type enum', async () => {
      const input = {
        feature_ids: ['feat_123'],
        jira_project_key: 'PROJ',
        issue_type: 'invalid_type',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });

    it('should accept valid input with minimal parameters', () => {
      const validInput = {
        feature_ids: ['feat_123', 'feat_456'],
        jira_project_key: 'MYPROJECT',
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should accept valid input with all parameters', () => {
      const validInput = {
        feature_ids: ['feat_123', 'feat_456'],
        jira_project_key: 'MYPROJECT',
        issue_type: 'Story' as const,
        create_options: {
          include_description: true,
          include_attachments: true,
          include_notes_as_comments: false,
          link_back_to_productboard: true,
        },
        field_mapping: {
          priority: { high: 'High', medium: 'Medium', low: 'Low' },
          custom_fields: { 'customfield_10001': 'story_points' },
        },
      };
      const validation = tool.validateParams(validInput);
      expect(validation.valid).toBe(true);
    });

    it('should validate feature_ids array contains strings', async () => {
      const input = {
        feature_ids: [123, 456],
        jira_project_key: 'PROJ',
      } as any;
      await expect(tool.execute(input)).rejects.toThrow('Invalid parameters');
    });
  });

  describe('execute', () => {
    it('should export features to JIRA with minimal parameters', async () => {
      const validInput = {
        feature_ids: ['feat_123', 'feat_456'],
        jira_project_key: 'MYPROJECT',
      };
      const expectedResponse = {
        exported_issues: [
          {
            feature_id: 'feat_123',
            jira_issue_key: 'MYPROJECT-101',
            jira_issue_id: '10001',
            created: true,
          },
          {
            feature_id: 'feat_456',
            jira_issue_key: 'MYPROJECT-102',
            jira_issue_id: '10002',
            created: true,
          },
        ],
        success_count: 2,
        error_count: 0,
        errors: [],
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/export', {
        feature_ids: ['feat_123', 'feat_456'],
        jira_project_key: 'MYPROJECT',
        issue_type: 'Story',
        options: {
          include_description: true,
          include_notes_as_comments: true,
          link_back_to_productboard: true,
        },
        field_mapping: undefined,
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Exporting features to JIRA',
        { count: 2, project: 'MYPROJECT' }
      );
    });

    it('should export features to JIRA with all parameters', async () => {
      const validInput = {
        feature_ids: ['feat_123'],
        jira_project_key: 'MYPROJECT',
        issue_type: 'Epic' as const,
        create_options: {
          include_description: false,
          include_attachments: true,
          include_notes_as_comments: false,
          link_back_to_productboard: false,
        },
        field_mapping: {
          priority: { high: 'Highest', medium: 'Medium', low: 'Lowest' },
          custom_fields: { 'customfield_10001': 'story_points' },
        },
      };
      const expectedResponse = {
        exported_issues: [
          {
            feature_id: 'feat_123',
            jira_issue_key: 'MYPROJECT-103',
            jira_issue_id: '10003',
            created: true,
          },
        ],
        success_count: 1,
        error_count: 0,
        errors: [],
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/export', {
        feature_ids: ['feat_123'],
        jira_project_key: 'MYPROJECT',
        issue_type: 'Epic',
        options: {
          include_description: false,
          include_attachments: true,
          include_notes_as_comments: false,
          link_back_to_productboard: false,
        },
        field_mapping: {
          priority: { high: 'Highest', medium: 'Medium', low: 'Lowest' },
          custom_fields: { 'customfield_10001': 'story_points' },
        },
      });
      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should handle API errors gracefully', async () => {
      const validInput = {
        feature_ids: ['feat_123'],
        jira_project_key: 'MYPROJECT',
      };
      
      mockClient.post.mockRejectedValueOnce(new Error('JIRA API connection failed'));

      const result = await tool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to export to JIRA: JIRA API connection failed',
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to export to JIRA',
        expect.any(Error)
      );
    });

    it('should handle authentication errors', async () => {
      const validInput = {
        feature_ids: ['feat_123'],
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
        error: 'Failed to export to JIRA: JIRA authentication failed',
      });
    });

    it('should handle JIRA project not found errors', async () => {
      const validInput = {
        feature_ids: ['feat_123'],
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
        error: 'Failed to export to JIRA: JIRA project not found',
      });
    });

    it('should handle partial export failures', async () => {
      const validInput = {
        feature_ids: ['feat_123', 'feat_456', 'feat_789'],
        jira_project_key: 'MYPROJECT',
      };
      
      const expectedResponse = {
        exported_issues: [
          {
            feature_id: 'feat_123',
            jira_issue_key: 'MYPROJECT-101',
            jira_issue_id: '10001',
            created: true,
          },
          {
            feature_id: 'feat_456',
            jira_issue_key: 'MYPROJECT-102',
            jira_issue_id: '10002',
            created: true,
          },
        ],
        success_count: 2,
        error_count: 1,
        errors: [
          {
            feature_id: 'feat_789',
            error: 'Feature not found',
          },
        ],
      };
      
      mockClient.post.mockResolvedValueOnce(expectedResponse);

      const result = await tool.execute(validInput);

      expect(result).toEqual({
        success: true,
        data: expectedResponse,
      });
    });

    it('should throw error if client not initialized', async () => {
      const uninitializedTool = new ExportToJiraTool(null as any, mockLogger);
      const validInput = {
        feature_ids: ['feat_123'],
        jira_project_key: 'MYPROJECT',
      };
      const result = await uninitializedTool.execute(validInput);
      
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining('Failed to export to JIRA:'),
      });
    });

    it('should set default issue_type to "Story" if not provided', async () => {
      const inputWithoutIssueType = {
        feature_ids: ['feat_123'],
        jira_project_key: 'MYPROJECT',
      };
      
      const expectedResponse = {
        exported_issues: [
          {
            feature_id: 'feat_123',
            jira_issue_key: 'MYPROJECT-101',
            jira_issue_id: '10001',
            created: true,
          },
        ],
        success_count: 1,
        error_count: 0,
        errors: [],
      };

      mockClient.post.mockResolvedValueOnce(expectedResponse);

      await tool.execute(inputWithoutIssueType);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/export', expect.objectContaining({
        issue_type: 'Story',
      }));
    });

    it('should set default create_options if not provided', async () => {
      const inputWithoutOptions = {
        feature_ids: ['feat_123'],
        jira_project_key: 'MYPROJECT',
      };
      
      const expectedResponse = {
        exported_issues: [
          {
            feature_id: 'feat_123',
            jira_issue_key: 'MYPROJECT-101',
            jira_issue_id: '10001',
            created: true,
          },
        ],
        success_count: 1,
        error_count: 0,
        errors: [],
      };

      mockClient.post.mockResolvedValueOnce(expectedResponse);

      await tool.execute(inputWithoutOptions);

      expect(mockClient.post).toHaveBeenCalledWith('/integrations/jira/export', expect.objectContaining({
        options: {
          include_description: true,
          include_notes_as_comments: true,
          link_back_to_productboard: true,
        },
      }));
    });
  });

  describe('response transformation', () => {
    it('should transform API response correctly', async () => {
      const apiResponse = {
        exported_issues: [
          {
            feature_id: 'feat_123',
            jira_issue_key: 'PROJ-101',
            jira_issue_id: '10001',
            created: true,
          },
        ],
        success_count: 1,
        error_count: 0,
        errors: [],
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        feature_ids: ['feat_123'],
        jira_project_key: 'PROJ',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data).toHaveProperty('exported_issues');
      expect((result as any).data).toHaveProperty('success_count', 1);
      expect((result as any).data).toHaveProperty('error_count', 0);
      expect((result as any).data.exported_issues[0]).toHaveProperty('jira_issue_key', 'PROJ-101');
    });

    it('should handle empty export results', async () => {
      const apiResponse = {
        exported_issues: [],
        success_count: 0,
        error_count: 1,
        errors: [
          {
            feature_id: 'feat_invalid',
            error: 'Feature not found',
          },
        ],
      };

      mockClient.post.mockResolvedValueOnce(apiResponse);

      const result = await tool.execute({
        feature_ids: ['feat_invalid'],
        jira_project_key: 'PROJ',
      });

      expect(result).toEqual({
        success: true,
        data: apiResponse,
      });
      expect((result as any).data.exported_issues).toHaveLength(0);
      expect((result as any).data.error_count).toBe(1);
    });
  });
});