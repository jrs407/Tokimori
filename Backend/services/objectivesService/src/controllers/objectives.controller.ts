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

/**
 * Get all objectives from a specific library
 */
export const getObjectivesByLibrary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary } = req.body as {
      idLibrary?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idLibrary) {
      return res.status(400).json({ message: 'idLibrary is required.' });
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
        `Security: User ${authenticatedUserId} attempted to access objectives for library ${idLibrary} owned by user ${libraryRows[0].Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only view objectives from your own library.' });
    }

    const [objectives] = await pool.query<RowDataPacket[]>(
      `SELECT idObjectives, library_idLibrary, title, description, colour, isFavorite, isPinned
       FROM objectives
       WHERE library_idLibrary = ?
       ORDER BY isPinned DESC, title ASC`,
      [idLibrary]
    );

    return res.status(200).json({ objectives });

  } catch (error) {
    console.error('Error fetching objectives:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Update an objective
 */
export const updateObjective = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idObjective, title, description, colour, isFavorite, isPinned } = req.body as {
      idObjective?: number;
      title?: string;
      description?: string;
      colour?: number;
      isFavorite?: boolean;
      isPinned?: boolean;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idObjective) {
      return res.status(400).json({ message: 'idObjective is required.' });
    }

    const [objectiveRows] = await pool.query<RowDataPacket[]>(
      `SELECT o.idObjectives, l.Users_idUsers
       FROM objectives o
       JOIN library l ON o.library_idLibrary = l.idLibrary
       WHERE o.idObjectives = ?`,
      [idObjective]
    );

    if (objectiveRows.length === 0) {
      return res.status(404).json({ message: 'Objective not found.' });
    }

    if (objectiveRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to update objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only update your own objectives.' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (colour !== undefined) {
      updates.push('colour = ?');
      values.push(colour);
    }

    if (isFavorite !== undefined) {
      updates.push('isFavorite = ?');
      values.push(isFavorite ? 1 : 0);
    }

    if (isPinned !== undefined) {
      updates.push('isPinned = ?');
      values.push(isPinned ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    values.push(idObjective);

    const query = `UPDATE objectives SET ${updates.join(', ')} WHERE idObjectives = ?`;

    await pool.execute(query, values);

    return res.status(200).json({ message: 'Objective updated successfully.' });

  } catch (error) {
    console.error('Error updating objective:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Delete an objective
 */
export const deleteObjective = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idObjective } = req.body as {
      idObjective?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idObjective) {
      return res.status(400).json({ message: 'idObjective is required.' });
    }

    const [objectiveRows] = await pool.query<RowDataPacket[]>(
      `SELECT o.idObjectives, l.Users_idUsers
       FROM objectives o
       JOIN library l ON o.library_idLibrary = l.idLibrary
       WHERE o.idObjectives = ?`,
      [idObjective]
    );

    if (objectiveRows.length === 0) {
      return res.status(404).json({ message: 'Objective not found.' });
    }

    if (objectiveRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to delete objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only delete your own objectives.' });
    }

    await pool.execute('DELETE FROM objectives WHERE idObjectives = ?', [idObjective]);

    return res.status(200).json({ message: 'Objective deleted successfully.' });

  } catch (error) {
    console.error('Error deleting objective:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get favorite objectives from a specific library
 */
export const getFavoriteObjectives = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary } = req.body as {
      idLibrary?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idLibrary) {
      return res.status(400).json({ message: 'idLibrary is required.' });
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
        `Security: User ${authenticatedUserId} attempted to access favorite objectives for library ${idLibrary} owned by user ${libraryRows[0].Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only view objectives from your own library.' });
    }

    const [objectives] = await pool.query<RowDataPacket[]>(
      `SELECT idObjectives, library_idLibrary, title, description, colour, isFavorite, isPinned
       FROM objectives
       WHERE library_idLibrary = ? AND isFavorite = 1
       ORDER BY isPinned DESC, title ASC`,
      [idLibrary]
    );

    return res.status(200).json({ objectives });

  } catch (error) {
    console.error('Error fetching favorite objectives:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get pinned objectives from a specific library
 */
export const getPinnedObjectives = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary } = req.body as {
      idLibrary?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idLibrary) {
      return res.status(400).json({ message: 'idLibrary is required.' });
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
        `Security: User ${authenticatedUserId} attempted to access pinned objectives for library ${idLibrary} owned by user ${libraryRows[0].Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only view objectives from your own library.' });
    }

    const [objectives] = await pool.query<RowDataPacket[]>(
      `SELECT idObjectives, library_idLibrary, title, description, colour, isFavorite, isPinned
       FROM objectives
       WHERE library_idLibrary = ? AND isPinned = 1
       ORDER BY title ASC`,
      [idLibrary]
    );

    return res.status(200).json({ objectives });

  } catch (error) {
    console.error('Error fetching pinned objectives:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get a single objective by ID
 */
export const getObjective = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idObjective } = req.body as {
      idObjective?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idObjective) {
      return res.status(400).json({ message: 'idObjective is required.' });
    }

    const [objectiveRows] = await pool.query<RowDataPacket[]>(
      `SELECT o.idObjectives, o.library_idLibrary, o.title, o.description, o.colour, o.isFavorite, o.isPinned, l.Users_idUsers
       FROM objectives o
       JOIN library l ON o.library_idLibrary = l.idLibrary
       WHERE o.idObjectives = ?`,
      [idObjective]
    );

    if (objectiveRows.length === 0) {
      return res.status(404).json({ message: 'Objective not found.' });
    }

    if (objectiveRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to view objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only view your own objectives.' });
    }

    return res.status(200).json({ objective: objectiveRows[0] });

  } catch (error) {
    console.error('Error fetching objective:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get all objectives by user ID
 */
export const getObjectivesByUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUser } = req.body as {
      idUser?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUser) {
      return res.status(400).json({ message: 'idUser is required.' });
    }

    if (idUser !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to access objectives for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own objectives.' });
    }

    const [objectives] = await pool.query<RowDataPacket[]>(
      `SELECT o.idObjectives, o.library_idLibrary, o.title, o.description, o.colour, o.isFavorite, o.isPinned
       FROM objectives o
       JOIN library l ON o.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ?
       ORDER BY o.isPinned DESC, o.title ASC`,
      [idUser]
    );

    return res.status(200).json({ objectives });

  } catch (error) {
    console.error('Error fetching user objectives:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Search objectives by title within a specific library
 */
export const searchObjectivesByTitle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary, searchTerm } = req.body as {
      idLibrary?: number;
      searchTerm?: string;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idLibrary || searchTerm === undefined) {
      return res.status(400).json({ message: 'idLibrary and searchTerm are required.' });
    }

    const [libraryRows] = await pool.query<RowDataPacket[]>(
      'SELECT Users_idUsers FROM library WHERE idLibrary = ?',
      [idLibrary]
    );

    if (libraryRows.length === 0) {
      return res.status(404).json({ message: 'Library not found.' });
    }

    if (libraryRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to search objectives in library ${idLibrary}.`
      );
      return res.status(403).json({ message: 'You can only search objectives in your own library.' });
    }

    const searchPattern = `%${searchTerm}%`;
    const [objectives] = await pool.query<RowDataPacket[]>(
      `SELECT idObjectives, library_idLibrary, title, description, colour, isFavorite, isPinned
       FROM objectives
       WHERE library_idLibrary = ? AND title LIKE ?
       ORDER BY isPinned DESC, title ASC`,
      [idLibrary, searchPattern]
    );

    return res.status(200).json({ objectives });

  } catch (error) {
    console.error('Error searching objectives by title:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
