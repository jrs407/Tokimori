import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const createObjective = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary, title, description } = req.body as {
      idLibrary?: number;
      title?: string;
      description?: string;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idLibrary || !title) {
      return res.status(400).json({ message: 'idLibrary and title are required.' });
    }

    const [libraryRows] = await pool.query<RowDataPacket[]>(
      'SELECT Users_idUsers FROM library WHERE idLibrary = ?',
      [idLibrary]
    );

    if (libraryRows.length === 0) {
      return res.status(404).json({ message: 'Library entry not found.' });
    }

    if (libraryRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to create objective for library ${idLibrary}.`
      );
      return res.status(403).json({ message: 'You can only create objectives in your own library.' });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO objectives (library_idLibrary, title, description) VALUES (?, ?, ?)',
      [idLibrary, title, description ?? null]
    );

    return res.status(201).json({
      message: 'Objective created successfully.',
      objectiveId: result.insertId
    });

  } catch (error) {
    console.error('Error creating objective:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
