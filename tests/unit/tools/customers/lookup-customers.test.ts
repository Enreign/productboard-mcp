import { LookupCustomersTool } from '@tools/customers/lookup-customers';
import { ProductboardAPIClient } from '@api/index';
import { Logger } from '@utils/logger';

describe('LookupCustomersTool', () => {
  let tool: LookupCustomersTool;
  let mockApiClient: jest.Mocked<ProductboardAPIClient>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: jest.fn(),
      getAllPages: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    tool = new LookupCustomersTool(mockApiClient, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('pb_customer_lookup');
      expect(tool.description).toContain('users and companies');
    });

    it('should require query param', () => {
      expect(tool.parameters).toMatchObject({
        type: 'object',
        required: ['query'],
      });
    });
  });

  describe('execute', () => {
    it('passes query, type[]=user+company, and archived=false by default', async () => {
      mockApiClient.getAllPages.mockResolvedValueOnce([]);

      await tool.execute({ query: 'wright' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': ['user', 'company'],
        name: 'wright',
        archived: false,
      });
    });

    it('passes archived=true when explicitly requested', async () => {
      mockApiClient.getAllPages.mockResolvedValueOnce([]);

      await tool.execute({ query: 'wright', archived: true });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': ['user', 'company'],
        name: 'wright',
        archived: true,
      });
    });

    it('returns "no customers found" when results are empty', async () => {
      mockApiClient.getAllPages.mockResolvedValueOnce([]);

      const result: any = await tool.execute({ query: 'nobody' });

      expect(result.content[0].text).toContain('No customers found');
      expect(result.content[0].text).toContain('nobody');
    });

    it('groups results into companies and users', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([
          { id: 'c1', type: 'company', fields: { name: 'Wright Tank Services', domain: 'wrighttank.com' } },
          { id: 'u1', type: 'user', fields: { name: 'Ethan Wright', email: 'ethan@wright.com' } },
        ])
        .mockResolvedValueOnce([]); // users under c1

      const result: any = await tool.execute({ query: 'wright' });
      const text = result.content[0].text;

      expect(text).toContain('Companies (1):');
      expect(text).toContain('Wright Tank Services');
      expect(text).toContain('wrighttank.com');
      expect(text).toContain('Users matching "wright" (1):');
      expect(text).toContain('Ethan Wright');
      expect(text).toContain('ethan@wright.com');
    });

    it('lists users belonging to each matched company', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([
          { id: 'c1', type: 'company', fields: { name: 'Empty Kitchens, Full Hearts' } },
        ])
        .mockResolvedValueOnce([
          { id: 'u1', type: 'user', fields: { name: 'Andrew', email: 'andrew@ekfh.org' } },
          { id: 'u2', type: 'user', fields: { name: 'Bea', email: '' } },
        ]);

      const result: any = await tool.execute({ query: 'empty' });
      const text = result.content[0].text;

      expect(text).toContain('Empty Kitchens, Full Hearts');
      expect(text).toContain('Users (2):');
      expect(text).toContain('Andrew');
      expect(text).toContain('andrew@ekfh.org');
      expect(text).toContain('Bea');
    });

    it('shows "Users: none" when a matched company has no users', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([
          { id: 'c1', type: 'company', fields: { name: 'Acme' } },
        ])
        .mockResolvedValueOnce([]);

      const result: any = await tool.execute({ query: 'acme' });
      expect(result.content[0].text).toContain('Users: none');
    });

    it('fetches users per matched company with parent[id] filter', async () => {
      mockApiClient.getAllPages
        .mockResolvedValueOnce([
          { id: 'c1', type: 'company', fields: { name: 'Co1' } },
          { id: 'c2', type: 'company', fields: { name: 'Co2' } },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await tool.execute({ query: 'co' });

      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': 'user',
        'parent[id]': 'c1',
        archived: false,
      });
      expect(mockApiClient.getAllPages).toHaveBeenCalledWith('/entities', {
        'type[]': 'user',
        'parent[id]': 'c2',
        archived: false,
      });
    });

    it('respects limit on initial search results', async () => {
      const many = Array.from({ length: 5 }, (_, i) => ({
        id: `u${i}`,
        type: 'user',
        fields: { name: `User ${i}` },
      }));
      mockApiClient.getAllPages.mockResolvedValueOnce(many);

      const result: any = await tool.execute({ query: 'user', limit: 2 });
      const text = result.content[0].text;

      expect(text).toContain('Found 5 customers matching "user", showing 2');
      expect(text).toContain('User 0');
      expect(text).toContain('User 1');
      expect(text).not.toContain('User 2');
    });
  });
});
