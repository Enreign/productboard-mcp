import express, { Request, Response } from 'express';
import { Server } from 'http';

export class MockProductboardServer {
  private app: express.Application;
  private server?: Server;
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    // Mock authentication endpoint
    this.app.get('/users/me', (_req: Request, res: Response): void => {
      res.json({
        data: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin',
        }
      });
    });

    // Mock features endpoints
    this.app.post('/features', (req: Request, res: Response): void => {
      const { name, description } = req.body;
      
      if (!name || !description) {
        res.status(400).json({
          message: 'Validation failed',
          errors: [
            { field: 'name', message: 'Name is required' },
            { field: 'description', message: 'Description is required' }
          ]
        });
        return;
      }

      res.status(201).json({
        data: {
          id: 'feature-123',
          name,
          description,
          status: 'new',
        }
      });
    });

    this.app.get('/features/:id', (req: Request, res: Response): void => {
      const { id } = req.params;
      res.json({
        data: {
          id,
          name: 'Test Feature',
          description: 'Test Description',
          status: 'new',
        }
      });
    });

    this.app.get('/features', (_req: Request, res: Response): void => {
      res.json({
        data: [
          {
            id: 'feature-1',
            name: 'Feature 1',
            description: 'Description 1',
            status: 'new',
          }
        ],
        pagination: { hasMore: false },
      });
    });

    // Mock products endpoints
    this.app.get('/products', (_req: Request, res: Response): void => {
      res.json({
        data: [],
        total: 0,
      });
    });

    // Mock companies endpoints
    this.app.get('/companies', (_req: Request, res: Response): void => {
      res.json({
        data: [],
        total: 0,
      });
    });

    // Error simulation endpoint
    this.app.post('/features-error', (_req: Request, res: Response): void => {
      res.status(400).json({
        message: 'Invalid feature data',
        errors: [{ field: 'name', message: 'Name is too long' }],
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Mock Productboard server running on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock Productboard server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}