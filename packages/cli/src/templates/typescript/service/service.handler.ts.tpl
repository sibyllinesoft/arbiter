import type { Request, Response, NextFunction } from 'express';

/**
 * {{serviceName}} Handler
 * HTTP request handlers for {{serviceName}}
 */

export class {{serviceName}}Handler {
  async handleGet(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ message: 'GET {{serviceName}}' });
    } catch (error) {
      next(error);
    }
  }

  async handlePost(_req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json({ message: 'POST {{serviceName}}' });
    } catch (error) {
      next(error);
    }
  }

  async handlePut(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ message: 'PUT {{serviceName}}' });
    } catch (error) {
      next(error);
    }
  }

  async handleDelete(_req: Request, res: Response, next: NextFunction) {
    try {
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const {{handlerInstanceName}} = new {{serviceName}}Handler();
