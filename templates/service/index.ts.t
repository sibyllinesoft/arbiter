import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
{{if .database}}
import { DatabaseConnection } from './lib/database';
{{end}}

// Load environment variables
dotenv.config();

export class {{.serviceName}} {
  private app: express.Application;
  private port: number;
  {{if .database}}
  private db: DatabaseConnection;
  {{end}}

  constructor() {
    this.app = express();
    this.port = process.env.PORT ? parseInt(process.env.PORT) : {{.port}};
    {{if .database}}
    this.db = new DatabaseConnection();
    {{end}}
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS middleware
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));
    
    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: '{{.serviceName}}'
      });
    });

    // API routes will be added here
    // Example: this.app.use('/api/v1', routes);
  }

  {{if .database}}
  public async initialize(): Promise<void> {
    try {
      await this.db.connect();
      console.log('Database connection established');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      process.exit(1);
    }
  }
  {{end}}

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`{{.serviceName}} is running on port ${this.port}`);
      console.log(`Health check available at http://localhost:${this.port}/health`);
    });
  }

  public getApp(): express.Application {
    return this.app;
  }
}

// Start the service if this file is run directly
if (require.main === module) {
  const service = new {{.serviceName}}();
  
  {{if .database}}
  service.initialize().then(() => {
    service.start();
  });
  {{else}}
  service.start();
  {{end}}
}