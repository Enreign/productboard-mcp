import { RetryOptions } from './types.js';

export class RetryHandler {
  private readonly options: RetryOptions;

  constructor(options: RetryOptions) {
    this.options = {
      ...options,
      retryCondition: options.retryCondition || (() => true),
    };
  }

  async withRetries<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.options.maxAttempts || !this.options.retryCondition!(error)) {
          throw error;
        }
        
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    let delay: number;
    
    if (this.options.backoffStrategy === 'exponential') {
      delay = this.exponentialBackoff(attempt);
    } else {
      delay = this.linearBackoff(attempt);
    }
    
    return Math.min(delay, this.options.maxDelay);
  }

  private exponentialBackoff(attempt: number): number {
    return this.options.initialDelay * Math.pow(2, attempt - 1);
  }

  private linearBackoff(attempt: number): number {
    return this.options.initialDelay * attempt;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}