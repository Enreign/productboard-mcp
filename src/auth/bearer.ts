import { AuthHeaders } from './types.js';
import { ProductboardAPIError } from '@api/errors.js';
import axios, { AxiosError } from 'axios';
import { Logger } from '@utils/logger.js';

export class BearerTokenAuth {
  private readonly baseUrl: string;
  private readonly logger: Logger;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.logger = new Logger({ level: 'debug', name: 'bearer-auth' });
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/features`;
      this.logger.debug('Bearer token validation URL', { url });
      this.logger.debug('Headers', this.getHeaders(token));
      
      // Use /features endpoint for token validation (without parameters)
      const response = await axios.get(url, {
        headers: this.getHeaders(token),
        timeout: 5000,
      });

      this.logger.debug('Token validation successful', { status: response.status });
      return response.status === 200;
    } catch (error) {
      this.logger.error('Token validation error', error);
      if (error instanceof AxiosError) {
        this.logger.error('Response details', { 
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url 
        });
        
        if (error.response?.status === 401) {
          return false;
        }
      }
      throw new ProductboardAPIError(
        'Failed to validate bearer token',
        'AUTH_VALIDATION_ERROR',
        error instanceof Error ? error : undefined,
      );
    }
  }

  getHeaders(token: string): AuthHeaders {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Version': '1',
    };
  }
}