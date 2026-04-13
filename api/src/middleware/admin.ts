import { Context, Next } from 'hono';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const adminMiddleware = async (c: Context, next: Next) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return c.json({ error: 'Forbidden: admin access required' }, 403);
  }

  await next();
};
