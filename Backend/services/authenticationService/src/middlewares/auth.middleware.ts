import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token is required.' });
    }

    const token = authHeader.slice(7);
    const jwtSecret: string = process.env.JWT_SECRET || 'dev_secret';

    const decoded = jwt.verify(token, jwtSecret) as unknown as {
      sub: number;
      email: string;
    };

    req.user = {
      id: decoded.sub,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Token has expired.' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid or malformed token.' });
    }
    console.error('Error in authMiddleware:', error);
    return res.status(500).json({ message: 'Unexpected error during authentication.' });
  }
};
