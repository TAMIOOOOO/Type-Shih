import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DBUser } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'typing_speed_challenge_jwt_secret_2026';
const SALT_ROUNDS = 6;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: Pick<DBUser, 'id' | 'email' | 'username'>): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): { userId: string; email: string; username: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      username: string;
    };
    return decoded;
  } catch {
    return null;
  }
}
