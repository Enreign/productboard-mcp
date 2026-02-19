import { ListCompaniesTool } from '@tools/companies/list-companies';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

/** Parse the MCP content wrapper to get the underlying result */
function parseResult(result: any): any {
  if (result?.content?.[0]?.text) {
    try { return JSON.parse(result.content[0].text); } catch { return result.content[0].text; }
  }
  return result;
}

describe('ListCompaniesTool', () => {
  let tool: ListCompaniesTool;
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

    tool = new ListCompaniesTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_company_list');
      expect(tool.description).toBe('List customer companies');
    });

    it('should define correct parameters schema', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search in company names',
          },
          size: {
            type: 'string',
            enum: ['small', 'medium', 'large', 'enterprise'],
            description: 'Filter by company size',
          },
          industry: {
            type: 'string',
            description: 'Filter by industry',
          },
        },
      });
    });
  });

  describe('execute', () => {
    const mockCompanies = [
      {
        id: 'comp-1',
        name: 'Acme Corp',
        size: 'large',
        industry: 'Technology',
        customer_count: 50,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'comp-2',
        name: 'StartupXYZ',
        size: 'small',
        industry: 'SaaS',
        customer_count: 5,
        created_at: '2024-06-01T00:00:00Z',
      },
    ];

    it('should list all companies with default parameters', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: mockCompanies,
        links: {},
      });

      const result = parseResult(await tool.execute({}));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/companies',
        params: {},
      });

      expect(result).toEqual({
        success: true,
        data: {
          companies: mockCompanies,
          total: 2,
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Listing companies');
    });

    it('should search companies by name', async () => {
      const searchResults = [mockCompanies[0]];

      mockApiClient.makeRequest.mockResolvedValue({
        data: searchResults,
        links: {},
      });

      const result = parseResult(await tool.execute({ search: 'Acme' }));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/companies',
        params: { search: 'Acme' },
      });

      expect(result.data.companies).toHaveLength(1);
      expect(result.data.companies[0].name).toContain('Acme');
    });

    it('should filter by company size', async () => {
      const smallCompanies = [mockCompanies[1]];

      mockApiClient.makeRequest.mockResolvedValue({
        data: smallCompanies,
        links: {},
      });

      const result = parseResult(await tool.execute({ size: 'small' }));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/companies',
        params: { size: 'small' },
      });

      expect(result.data.companies).toHaveLength(1);
      expect(result.data.companies[0].size).toBe('small');
    });

    it('should filter by industry', async () => {
      const techCompanies = [mockCompanies[0]];

      mockApiClient.makeRequest.mockResolvedValue({
        data: techCompanies,
        links: {},
      });

      const result = parseResult(await tool.execute({ industry: 'Technology' }));

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/companies',
        params: { industry: 'Technology' },
      });

      expect(result.data.companies[0].industry).toBe('Technology');
    });

    it('should combine multiple filters', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: [],
        links: {},
      });

      await tool.execute({
        search: 'startup',
        size: 'small',
        industry: 'SaaS',
      });

      expect(mockApiClient.makeRequest).toHaveBeenCalledWith({
        method: 'GET',
        endpoint: '/companies',
        params: {
          search: 'startup',
          size: 'small',
          industry: 'SaaS',
        },
      });
    });

    it('should validate size enum values', async () => {
      const invalidParams = { size: 'extra-large' };

      await expect(tool.execute(invalidParams as any)).rejects.toThrow('Invalid parameters');
    });

    it('should handle companies with additional metadata', async () => {
      const companiesWithMetadata = mockCompanies.map(c => ({
        ...c,
        metadata: {
          contract_value: 50000,
          renewal_date: '2025-12-31',
        },
      }));

      mockApiClient.makeRequest.mockResolvedValue({
        data: companiesWithMetadata,
        links: {},
      });

      const result = parseResult(await tool.execute({}));

      expect(result.data.companies[0]).toHaveProperty('metadata');
    });

    it('should handle empty results', async () => {
      mockApiClient.makeRequest.mockResolvedValue({
        data: [],
        links: {},
      });

      const result = parseResult(await tool.execute({ industry: 'Non-existent' }));

      expect(result).toEqual({
        success: true,
        data: {
          companies: [],
          total: 0,
        },
      });
    });

    it('should handle API errors', async () => {
      mockApiClient.makeRequest.mockRejectedValue(new Error('API Error'));

      await expect(tool.execute({})).rejects.toThrow('Tool pb_company_list execution failed');
    });
  });
});