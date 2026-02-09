import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const [existingUsers] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );

    const jwtSecret: string = process.env.JWT_SECRET || 'dev_secret';
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign(
      { sub: result.insertId, email },
      jwtSecret,
      signOptions
    );

    return res.status(201).json({
      token,
      user: {
        id: result.insertId,
        name,
        email,
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ message: 'Unexpected error while registering user.' });
  }
};
