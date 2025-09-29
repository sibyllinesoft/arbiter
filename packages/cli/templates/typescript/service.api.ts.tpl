import express from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = express.Router();

/**
 * {{serviceName}} API Routes
 * Handles all {{serviceName}} related endpoints
 */

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ message: '{{serviceName}} API working' });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ message: '{{serviceName}} created' });
  } catch (error) {
    next(error);
  }
});

export { router as {{routerName}} };
