import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  email: string;
}

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    c.set('userId', payload.userId);
    c.set('email', payload.email);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};

export const optionalAuth = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      c.set('userId', payload.userId);
      c.set('email', payload.email);
    } catch {
      // Token invalid — continue without auth
    }
  }
  await next();
};
