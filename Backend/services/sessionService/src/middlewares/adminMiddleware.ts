import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export const adminMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!req.user.isAdmin) {
      console.warn(`Security: Non-admin user ${req.user.id} attempted to access admin endpoint.`);
      return res.status(403).json({ message: 'Admin privileges required.' });
    }

    next();
  } catch (error) {
    console.error('Error in adminMiddleware:', error);
    return res.status(500).json({ message: 'Unexpected error during authorization check.' });
  }
};
