import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  APIClientConfig,
  QueryParams,
  PaginatedResponse,
  BatchOperation,
  BatchResult,
  RequestConfig,
  MakeRequestConfig,
} from './types.js';
import {
  ProductboardAPIError,
  APIValidationError,
  APIAuthenticationError,
  APIAuthorizationError,
  APINotFoundError,
  APIRateLimitError,
  APIServerError,
  isRetryableError,
} from './errors.js';
import { AuthenticationManager } from '@auth/index.js';
import { Logger } from '@utils/logger.js';
import { RetryHandler } from '@utils/retry.js';
import { RateLimiter } from '@middleware/rateLimiter.js';

export class ProductboardAPIClient {
  private readonly axios: AxiosInstance;
  private readonly authManager: AuthenticationManager;
  private readonly logger: Logger;
  private readonly retryHandler: RetryHandler;
  private readonly rateLimiter: RateLimiter;
  private readonly config: APIClientConfig; // Used for configuration reference

  constructor(
    config: APIClientConfig,
    authManager: AuthenticationManager,
    logger: Logger,
    rateLimiter: RateLimiter,
  ) {
    this.config = config;
    this.authManager = authManager;
    this.logger = logger;
    this.rateLimiter = rateLimiter;

    this.retryHandler = new RetryHandler({
      maxAttempts: config.retryAttempts || 3,
      backoffStrategy: 'exponential',
      initialDelay: config.retryDelay || 1000,
      maxDelay: 30000,
      retryCondition: isRetryableError,
    });

    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 10000,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axios.interceptors.request.use(
      async (config) => {
        const authHeaders = this.authManager.getAuthHeaders();
        config.headers = { ...config.headers, ...authHeaders } as any;
        
        await this.rateLimiter.waitForSlot('global');
        
        this.logger.debug('API Request', {
          method: config.method,
          url: config.url,
          params: config.params,
        });
        
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error', error);
        return Promise.reject(error);
      },
    );

    this.axios.interceptors.response.use(
      (response) => {
        this.logger.debug('API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      async (error: AxiosError) => {
        if (error.response) {
          const apiError = this.handleAPIError(error);
          this.logger.error('API Error', apiError.toJSON());
          throw apiError;
        }
        throw error;
      },
    );
  }

  private handleAPIError(error: AxiosError): ProductboardAPIError {
    const status = error.response?.status || 0;
    const data = error.response?.data as Record<string, unknown> | undefined;
    const message = data?.message || error.message;

    switch (status) {
      case 400:
        return new APIValidationError(String(message), data);
      case 401:
        return new APIAuthenticationError(String(message));
      case 403:
        return new APIAuthorizationError(String(message));
      case 404:
        return new APINotFoundError(String(message), data?.resource as string);
      case 429:
        const retryAfter = parseInt(error.response?.headers['retry-after'] || '60');
        return new APIRateLimitError(String(message), retryAfter);
      default:
        if (status >= 500) {
          return new APIServerError(String(message), status);
        }
        return new ProductboardAPIError(
          String(message),
          'API_ERROR',
          error,
          status,
          data,
        );
    }
  }

  async get<T>(endpoint: string, params?: QueryParams, config?: RequestConfig): Promise<T> {
    return this.retryHandler.withRetries(async () => {
      const response = await this.axios.get<T>(endpoint, {
        params,
        ...config,
      });
      return response.data;
    });
  }

  async post<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
    return this.retryHandler.withRetries(async () => {
      const response = await this.axios.post<T>(endpoint, data, config);
      return response.data;
    });
  }

  async put<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
    return this.retryHandler.withRetries(async () => {
      const response = await this.axios.put<T>(endpoint, data, config);
      return response.data;
    });
  }

  async patch<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<T> {
    return this.retryHandler.withRetries(async () => {
      const response = await this.axios.patch<T>(endpoint, data, config);
      return response.data;
    });
  }

  async delete(endpoint: string, config?: RequestConfig): Promise<void> {
    return this.retryHandler.withRetries(async () => {
      await this.axios.delete(endpoint, config);
    });
  }

  async getAllPages<T>(
    endpoint: string,
    params?: QueryParams,
    config?: RequestConfig,
  ): Promise<T[]> {
    const allData: T[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    const limit = params?.limit || 100;

    while (hasMore) {
      const paginatedParams = {
        ...params,
        limit,
        ...(cursor && { cursor }),
      };

      const response = await this.get<PaginatedResponse<T>>(endpoint, paginatedParams, config);
      allData.push(...response.data);

      hasMore = response.pagination.hasMore;
      cursor = response.pagination.cursor;

      if (!cursor && hasMore) {
        const offset = ((response.pagination as any).offset || 0) + limit;
        (paginatedParams as any).offset = offset;
      }
    }

    return allData;
  }

  async batch(operations: BatchOperation[]): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (const operation of operations) {
      try {
        let data: unknown;
        
        switch (operation.method) {
          case 'GET':
            data = await this.get(operation.endpoint, operation.params);
            break;
          case 'POST':
            data = await this.post(operation.endpoint, operation.data);
            break;
          case 'PUT':
            data = await this.put(operation.endpoint, operation.data);
            break;
          case 'DELETE':
            await this.delete(operation.endpoint);
            data = { success: true };
            break;
        }

        results.push({ success: true, data });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  async makeRequest<T = unknown>(config: MakeRequestConfig): Promise<T> {
    const { method, endpoint, data, params, headers } = config;
    
    const requestConfig: RequestConfig = {
      headers,
      params,
    };

    switch (method) {
      case 'GET':
        return this.get<T>(endpoint, params, requestConfig);
      case 'POST':
        return this.post<T>(endpoint, data, requestConfig);
      case 'PUT':
        return this.put<T>(endpoint, data, requestConfig);
      case 'PATCH':
        return this.patch<T>(endpoint, data, requestConfig);
      case 'DELETE':
        await this.delete(endpoint, requestConfig);
        return { success: true } as T;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.get('/features');
      return true;
    } catch (error) {
      if (error instanceof APIAuthenticationError) {
        return false;
      }
      throw error;
    }
  }

  getConfig(): APIClientConfig {
    return this.config;
  }
}