export interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total?: number;
    limit: number;
    offset?: number;
    cursor?: string;
    hasMore: boolean;
  };
}

export interface BatchOperation {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: unknown;
  params?: QueryParams;
}

export interface BatchResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface APIClientConfig {
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  params?: QueryParams;
}

export interface MakeRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: unknown;
  params?: QueryParams;
  headers?: Record<string, string>;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  status: 'new' | 'in_progress' | 'validation' | 'done' | 'archived';
  productId?: string;
  componentId?: string;
  ownerEmail?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  type: 'product' | 'component';
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  content: string;
  title?: string;
  customerEmail?: string;
  tags?: string[];
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Objective {
  id: string;
  name: string;
  description?: string;
  type: 'company' | 'product' | 'personal';
  status: 'active' | 'completed' | 'cancelled';
  timeframe?: {
    startDate: string;
    endDate: string;
  };
  createdAt: string;
  updatedAt: string;
}