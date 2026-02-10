import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

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
      'INSERT INTO users (name, email, password, isAdmin, isPublic) VALUES (?, ?, ?, ?, ?)',
      [name, email, passwordHash, false, true]
    );

    const jwtSecret: string = process.env.JWT_SECRET || 'dev_secret';
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign(
      { sub: result.insertId, email, isAdmin: false },
      jwtSecret,
      signOptions
    );

    return res.status(201).json({
      token,
      user: {
        id: result.insertId,
        name,
        email,
        isAdmin: false,
        isPublic: true,
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ message: 'Unexpected error while registering user.' });
  }
};


export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers, name, email, password, isAdmin, isPublic FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password as string);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const jwtSecret: string = process.env.JWT_SECRET || 'dev_secret';
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign(
      { sub: user.idUsers, email: user.email, isAdmin: user.isAdmin },
      jwtSecret,
      signOptions
    );

    return res.status(200).json({
      token,
      user: {
        id: user.idUsers,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPublic: user.isPublic,
      },
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    return res.status(500).json({ message: 'Unexpected error while logging in.' });
  }
};


export const usersList = async (req: Request, res: Response) => {
  try {
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers, name, email, isAdmin, isPublic FROM users'
    );

    return res.status(200).json({ users });
  
  }catch (error) {
    console.error('Error fetching users list:', error);
    return res.status(500).json({ message: 'Unexpected error while fetching users list.' });
  }

}


export const getUserById = async (req: Request, res: Response) => {
  try {
    const { idUsers } = req.body as {
      idUsers?: number;
    };

    if (!idUsers) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers, name, email, isAdmin, isPublic FROM users WHERE idUsers = ? LIMIT 1',
      [idUsers]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = users[0];

    return res.status(200).json({
      user: {
        id: user.idUsers,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPublic: user.isPublic,
      },
    });
  
  }catch (error) {
    console.error('Error fetching user by ID:', error);
    return res.status(500).json({ message: 'Unexpected error while fetching user by ID.' });
  }
};


export const getUserByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as {
      email?: string;
    };

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers, name, email, isAdmin, isPublic FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = users[0];

    return res.status(200).json({
      user: {
        id: user.idUsers,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPublic: user.isPublic,
      },
    });
  }catch (error) {
    console.error('Error fetching user by email:', error);
    return res.status(500).json({ message: 'Unexpected error while fetching user by email.' });
  }
}

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userIdToDelete } = req.body as {
      userIdToDelete?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!userIdToDelete) {
      return res.status(400).json({ message: 'User ID to delete is required.' });
    }

    if (userIdToDelete !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to delete user ${userIdToDelete}.`
      );
      return res.status(403).json({ message: 'You can only delete your own account.' });
    }

    if (isAdmin && userIdToDelete === authenticatedUserId) {
      return res.status(400).json({ message: 'You cannot delete your own admin account. Another admin must delete it.' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers FROM users WHERE idUsers = ? LIMIT 1',
      [userIdToDelete]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await pool.execute<ResultSetHeader>(
      'DELETE FROM users WHERE idUsers = ?',
      [userIdToDelete]
    );

    return res.status(200).json({ message: 'User account deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Unexpected error while deleting user.' });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userIdToUpdate, name, email, password, isAdmin, isPublic } = req.body as {
      userIdToUpdate?: number;
      name?: string;
      email?: string;
      password?: string;
      isAdmin?: boolean;
      isPublic?: boolean;
    };

    const authenticatedUserId = req.user?.id;
    const isAdminUser = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!userIdToUpdate) {
      return res.status(400).json({ message: 'User ID to update is required.' });
    }

    if (userIdToUpdate !== authenticatedUserId && !isAdminUser) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to update user ${userIdToUpdate}.`
      );
      return res.status(403).json({ message: 'You can only update your own account unless you are an admin.' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers FROM users WHERE idUsers = ? LIMIT 1',
      [userIdToUpdate]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const fieldsToUpdate: string[] = [];
    const values: (string | number | boolean)[] = [];

    if (name) {
      fieldsToUpdate.push('name = ?');
      values.push(name);
    }

    if (email) {
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
      }
      fieldsToUpdate.push('email = ?');
      values.push(email);
    }

    if (password) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      }
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
      const passwordHash = await bcrypt.hash(password, saltRounds);
      fieldsToUpdate.push('password = ?');
      values.push(passwordHash);
    }

    if (isPublic !== undefined) {
      if (userIdToUpdate === authenticatedUserId || isAdminUser) {
        fieldsToUpdate.push('isPublic = ?');
        values.push(isPublic);
      } else {
        return res.status(403).json({ message: 'You can only change the public status of your own account.' });
      }
    }

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({ message: 'At least one field must be provided for update.' });
    }

    values.push(userIdToUpdate);
    const updateQuery = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE idUsers = ?`;

    await pool.execute<ResultSetHeader>(updateQuery, values);
    return res.status(200).json({ message: 'User account updated successfully.' });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Unexpected error while updating user.' });
  }
};

export const promoteToAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userIdToPromote } = req.body as {
      userIdToPromote?: number;
    };

    const adminUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!adminUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!isAdmin) {
      console.warn(`Security: Non-admin user ${adminUserId} attempted to promote user ${userIdToPromote} to admin.`);
      return res.status(403).json({ message: 'Only admins can promote users to admin.' });
    }

    if (!userIdToPromote) {
      return res.status(400).json({ message: 'User ID to promote is required.' });
    }

    if (userIdToPromote === adminUserId) {
      return res.status(400).json({ message: 'You cannot promote yourself.' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers, isAdmin FROM users WHERE idUsers = ? LIMIT 1',
      [userIdToPromote]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = users[0];

    if (user.isAdmin) {
      return res.status(400).json({ message: 'User is already an admin.' });
    }

    await pool.execute<ResultSetHeader>(
      'UPDATE users SET isAdmin = TRUE WHERE idUsers = ?',
      [userIdToPromote]
    );

    console.info(`Admin ${adminUserId} promoted user ${userIdToPromote} to admin.`);

    return res.status(200).json({ message: 'User promoted to admin successfully.' });
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    return res.status(500).json({ message: 'Unexpected error while promoting user to admin.' });
  }
};

export const createFirstAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    const [existingAdmins] = await pool.query<RowDataPacket[]>(
      'SELECT idUsers FROM users WHERE isAdmin = TRUE LIMIT 1'
    );

    if (existingAdmins.length > 0) {
      console.warn('Security: Attempt to create first admin when admins already exist.');
      return res.status(403).json({ message: 'An admin already exists. Cannot create another admin with this endpoint.' });
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
      'INSERT INTO users (name, email, password, isAdmin, isPublic) VALUES (?, ?, ?, ?, ?)',
      ['Admin', email, passwordHash, true, true]
    );

    const jwtSecret: string = process.env.JWT_SECRET || 'dev_secret';
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign(
      { sub: result.insertId, email, isAdmin: true },
      jwtSecret,
      signOptions
    );

    console.info(`First admin created with ID ${result.insertId} and email ${email}.`);

    return res.status(201).json({
      token,
      user: {
        id: result.insertId,
        name: 'Admin',
        email,
        isAdmin: true,
        isPublic: true,
      },
    });
  } catch (error) {
    console.error('Error creating first admin:', error);
    return res.status(500).json({ message: 'Unexpected error while creating first admin.' });
  }
};