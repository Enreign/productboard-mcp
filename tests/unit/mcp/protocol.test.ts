import { MCPProtocolHandler } from '../../../src/core/protocol.js';
import { ToolRegistry } from '../../../src/core/registry.js';
import { Logger } from '../../../src/utils/logger.js';
import { ProtocolError, ToolExecutionError } from '../../../src/utils/errors.js';
import { MCPRequest, MCPResponse } from '../../../src/core/types.js';

describe('MCPProtocolHandler', () => {
  let protocolHandler: MCPProtocolHandler;
  let mockToolRegistry: jest.Mocked<ToolRegistry>;
  let mockLogger: jest.Mocked<Logger>;
  let mockTool: any;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockTool = {
      name: 'pb_feature_create',
      description: 'Create a new feature',
      parameters: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      execute: jest.fn().mockResolvedValue({ success: true, data: { id: 'feature-1' } }),
    };

    mockToolRegistry = {
      getTool: jest.fn().mockReturnValue(mockTool),
      hasTool: jest.fn().mockReturnValue(true),
      getToolSchema: jest.fn().mockReturnValue(mockTool.parameters),
      getToolNames: jest.fn().mockReturnValue(['pb_feature_create', 'pb_feature_list']),
      registerTool: jest.fn(),
      unregisterTool: jest.fn(),
      listTools: jest.fn(),
      clear: jest.fn(),
      size: jest.fn(),
      getToolDescription: jest.fn(),
    } as any;

    protocolHandler = new MCPProtocolHandler(mockToolRegistry, mockLogger);
  });

  describe('Request Parsing', () => {
    it('should parse valid JSON request', () => {
      const requestString = JSON.stringify({
        id: '1',
        method: 'pb_feature_create',
        params: { name: 'Test Feature', description: 'A test feature' },
      });

      const parsed = protocolHandler.parseRequest(requestString);

      expect(parsed).toEqual({
        id: '1',
        method: 'pb_feature_create',
        params: { name: 'Test Feature', description: 'A test feature' },
      });
    });

    it('should throw ProtocolError for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => protocolHandler.parseRequest(invalidJson)).toThrow(ProtocolError);
      expect(() => protocolHandler.parseRequest(invalidJson)).toThrow('Invalid JSON');
    });

    it('should throw ProtocolError for invalid request structure', () => {
      const invalidRequest = JSON.stringify({ method: 'test' }); // Missing id

      expect(() => protocolHandler.parseRequest(invalidRequest)).toThrow(ProtocolError);
      expect(() => protocolHandler.parseRequest(invalidRequest)).toThrow('Invalid request structure');
    });

    it('should handle non-object input', () => {
      const nonObjectRequest = JSON.stringify('not an object');

      expect(() => protocolHandler.parseRequest(nonObjectRequest)).toThrow(ProtocolError);
    });

    it('should handle null input', () => {
      const nullRequest = JSON.stringify(null);

      expect(() => protocolHandler.parseRequest(nullRequest)).toThrow(ProtocolError);
    });
  });

  describe('Response Formatting', () => {
    it('should format response as JSON string', () => {
      const response: MCPResponse = {
        id: '1',
        result: { success: true, data: { id: 'feature-1' } },
      };

      const formatted = protocolHandler.formatResponse(response);

      expect(formatted).toBe(JSON.stringify(response));
      expect(() => JSON.parse(formatted)).not.toThrow();
    });

    it('should format error response correctly', () => {
      const response: MCPResponse = {
        id: '1',
        error: {
          code: -32603,
          message: 'Internal error',
          data: { details: 'Something went wrong' },
        },
      };

      const formatted = protocolHandler.formatResponse(response);
      const parsed = JSON.parse(formatted);

      expect(parsed).toEqual(response);
    });
  });

  describe('Request Validation', () => {
    it('should validate valid request', () => {
      const request: MCPRequest = {
        id: '1',
        method: 'pb_feature_create',
        params: { name: 'Test Feature', description: 'A test feature' },
      };

      const validation = protocolHandler.validateRequest(request);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('should reject request without id', () => {
      const request = {
        method: 'pb_feature_create',
        params: {},
      } as MCPRequest;

      const validation = protocolHandler.validateRequest(request);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Request id is required');
    });

    it('should reject request without method', () => {
      const request = {
        id: '1',
        params: {},
      } as MCPRequest;

      const validation = protocolHandler.validateRequest(request);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Request method is required');
    });

    it('should reject request for unknown tool', () => {
      mockToolRegistry.hasTool.mockReturnValue(false);

      const request: MCPRequest = {
        id: '1',
        method: 'pb_unknown_tool',
        params: {},
      };

      const validation = protocolHandler.validateRequest(request);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Tool not found: pb_unknown_tool');
    });

    it('should validate tool parameters against schema', () => {
      // Mock validator to return invalid result
      const mockValidator = {
        validateSchema: jest.fn().mockReturnValue({
          valid: false,
          errors: [{ message: 'name is required' }, { message: 'description must be string' }],
        }),
      };

      // Replace the validator in the protocol handler
      (protocolHandler as any).validator = mockValidator;

      const request: MCPRequest = {
        id: '1',
        method: 'pb_feature_create',
        params: { invalid: 'params' },
      };

      const validation = protocolHandler.validateRequest(request);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('name is required');
      expect(validation.errors).toContain('description must be string');
    });

    it('should handle non-tool methods without validation', () => {
      const request: MCPRequest = {
        id: '1',
        method: 'tools/list',
        params: {},
      };

      const validation = protocolHandler.validateRequest(request);

      expect(validation.valid).toBe(true);
    });
  });

  describe('Tool Invocation', () => {
    it('should invoke tool successfully', async () => {
      const params = { name: 'Test Feature', description: 'A test feature' };
      const expectedResult = { success: true, data: { id: 'feature-1' } };

      mockTool.execute.mockResolvedValue(expectedResult);

      const result = await protocolHandler.invokeTool('pb_feature_create', params);

      expect(mockToolRegistry.getTool).toHaveBeenCalledWith('pb_feature_create');
      expect(mockTool.execute).toHaveBeenCalledWith(params);
      expect(result).toEqual(expectedResult);
      expect(mockLogger.debug).toHaveBeenCalledWith('Invoking tool: pb_feature_create', { params });
      expect(mockLogger.debug).toHaveBeenCalledWith('Tool pb_feature_create completed successfully');
    });

    it('should throw ProtocolError for non-existent tool', async () => {
      mockToolRegistry.getTool.mockReturnValue(null);

      await expect(protocolHandler.invokeTool('pb_nonexistent_tool', {})).rejects.toThrow(ProtocolError);
      await expect(protocolHandler.invokeTool('pb_nonexistent_tool', {})).rejects.toThrow(
        'Tool not found: pb_nonexistent_tool'
      );
    });

    it('should handle tool execution errors', async () => {
      const toolError = new Error('Tool execution failed');
      mockTool.execute.mockRejectedValue(toolError);

      await expect(protocolHandler.invokeTool('pb_feature_create', {})).rejects.toThrow(ToolExecutionError);
      await expect(protocolHandler.invokeTool('pb_feature_create', {})).rejects.toThrow(
        'Failed to execute tool pb_feature_create'
      );

      expect(mockLogger.error).toHaveBeenCalledWith('Tool pb_feature_create execution failed', toolError);
    });

    it('should handle non-Error exceptions', async () => {
      const nonErrorException = 'String error';
      mockTool.execute.mockRejectedValue(nonErrorException);

      await expect(protocolHandler.invokeTool('pb_feature_create', {})).rejects.toThrow(ToolExecutionError);
    });
  });

  describe('Response Creation', () => {
    it('should create success response', () => {
      const result = { success: true, data: { id: 'feature-1' } };

      const response = protocolHandler.createSuccessResponse('1', result);

      expect(response).toEqual({
        id: '1',
        result,
      });
    });

    it('should create error response for ProtocolError', () => {
      const error = new ProtocolError('Invalid request format', { field: 'method' });

      const response = protocolHandler.createErrorResponse('1', error);

      expect(response).toEqual({
        id: '1',
        error: {
          code: -32602,
          message: 'Invalid request format',
          data: { field: 'method' },
        },
      });
    });

    it('should create error response for ToolExecutionError', () => {
      const error = new ToolExecutionError('Tool failed', 'pb_feature_create', new Error('Underlying error'));

      const response = protocolHandler.createErrorResponse('1', error);

      expect(response).toEqual({
        id: '1',
        error: {
          code: -32603,
          message: 'Tool failed',
          data: error.details,
        },
      });
    });

    it('should create error response for generic Error', () => {
      const error = new Error('Generic error');

      const response = protocolHandler.createErrorResponse('1', error);

      expect(response).toEqual({
        id: '1',
        error: {
          code: -32603,
          message: 'Internal error',
          data: { originalError: 'Generic error' },
        },
      });
    });

    it('should handle numeric request IDs', () => {
      const result = { success: true };

      const response = protocolHandler.createSuccessResponse(123, result);

      expect(response.id).toBe(123);
    });
  });

  describe('Supported Methods', () => {
    it('should return list of supported methods', () => {
      const methods = protocolHandler.getSupportedMethods();

      expect(methods).toContain('initialize');
      expect(methods).toContain('tools/list');
      expect(methods).toContain('ping');
      expect(methods).toContain('shutdown');
      expect(methods).toContain('pb_feature_create');
      expect(methods).toContain('pb_feature_list');
    });

    it('should include all registered tool methods', () => {
      mockToolRegistry.getToolNames.mockReturnValue([
        'pb_feature_create',
        'pb_feature_list',
        'pb_product_create',
      ]);

      const methods = protocolHandler.getSupportedMethods();

      expect(methods).toContain('pb_feature_create');
      expect(methods).toContain('pb_feature_list');
      expect(methods).toContain('pb_product_create');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty parameters', async () => {
      await protocolHandler.invokeTool('pb_feature_create', undefined);

      expect(mockTool.execute).toHaveBeenCalledWith(undefined);
    });

    it('should handle null parameters', async () => {
      await protocolHandler.invokeTool('pb_feature_create', null);

      expect(mockTool.execute).toHaveBeenCalledWith(null);
    });

    it('should handle complex nested parameters', async () => {
      const complexParams = {
        feature: {
          name: 'Complex Feature',
          metadata: {
            tags: ['tag1', 'tag2'],
            priority: 'high',
            nested: {
              deep: {
                value: 42,
              },
            },
          },
        },
      };

      await protocolHandler.invokeTool('pb_feature_create', complexParams);

      expect(mockTool.execute).toHaveBeenCalledWith(complexParams);
    });

    it('should handle very long method names', () => {
      const longMethodName = 'pb_' + 'a'.repeat(1000);
      const request: MCPRequest = {
        id: '1',
        method: longMethodName,
        params: {},
      };

      mockToolRegistry.hasTool.mockReturnValue(false);

      const validation = protocolHandler.validateRequest(request);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(`Tool not found: ${longMethodName}`);
    });

    it('should handle concurrent tool invocations', async () => {
      const params1 = { name: 'Feature 1' };
      const params2 = { name: 'Feature 2' };
      const params3 = { name: 'Feature 3' };

      mockTool.execute
        .mockResolvedValueOnce({ id: 'feature-1' })
        .mockResolvedValueOnce({ id: 'feature-2' })
        .mockResolvedValueOnce({ id: 'feature-3' });

      const promises = [
        protocolHandler.invokeTool('pb_feature_create', params1),
        protocolHandler.invokeTool('pb_feature_create', params2),
        protocolHandler.invokeTool('pb_feature_create', params3),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ id: 'feature-1' });
      expect(results[1]).toEqual({ id: 'feature-2' });
      expect(results[2]).toEqual({ id: 'feature-3' });
    });
  });

  describe('Integration with Tool Registry', () => {
    it('should properly integrate with tool registry methods', () => {
      // Test getTool integration
      protocolHandler.invokeTool('pb_feature_create', {});
      expect(mockToolRegistry.getTool).toHaveBeenCalledWith('pb_feature_create');

      // Test hasTool integration
      const request: MCPRequest = {
        id: '1',
        method: 'pb_feature_create',
        params: {},
      };
      protocolHandler.validateRequest(request);
      expect(mockToolRegistry.hasTool).toHaveBeenCalledWith('pb_feature_create');

      // Test getToolSchema integration
      expect(mockToolRegistry.getToolSchema).toHaveBeenCalledWith('pb_feature_create');

      // Test getToolNames integration
      protocolHandler.getSupportedMethods();
      expect(mockToolRegistry.getToolNames).toHaveBeenCalled();
    });

    it('should handle tool registry errors gracefully', async () => {
      mockToolRegistry.getTool.mockImplementation(() => {
        throw new Error('Registry error');
      });

      await expect(protocolHandler.invokeTool('pb_feature_create', {})).rejects.toThrow('Registry error');
    });
  });

  describe('Logging Integration', () => {
    it('should log tool invocation details', async () => {
      const params = { name: 'Test Feature' };

      await protocolHandler.invokeTool('pb_feature_create', params);

      expect(mockLogger.debug).toHaveBeenCalledWith('Invoking tool: pb_feature_create', { params });
      expect(mockLogger.debug).toHaveBeenCalledWith('Tool pb_feature_create completed successfully');
    });

    it('should log tool execution failures', async () => {
      const error = new Error('Tool failed');
      mockTool.execute.mockRejectedValue(error);

      try {
        await protocolHandler.invokeTool('pb_feature_create', {});
      } catch (e) {
        // Expected to fail
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Tool pb_feature_create execution failed', error);
    });
  });
});