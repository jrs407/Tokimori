import type { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const createCollection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idGames, idUsers } = req.body as {
      idGames?: number;
      idUsers?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idGames || !idUsers) {
      return res.status(400).json({ message: 'Item ID and User ID are required.' });
    }

    if (idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to create collection entry for user ${idUsers}.`
      );
      return res.status(403).json({ message: 'You can only add items to your own collection.' });
    }

    const [existingEntry] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM library WHERE Games_idGames = ? AND Users_idUsers = ?',
      [idGames, idUsers]
    );

    if (existingEntry.length > 0) {
      return res.status(400).json({ message: 'This item is already in the user\'s collection.' });
    }

    await pool.execute(
      'INSERT INTO library (Games_idGames, Users_idUsers, isFavorite, isPinned) VALUES (?, ?, ?, ?)',
      [idGames, idUsers, 0, 0]
    );

    return res.status(201).json({ message: 'Item added to collection successfully.' });
  } catch (error) {
    console.error('Error creating collection entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCollectionListByUserId = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUsers } = req.body as {
      idUsers?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUsers) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    if (idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to access collection for user ${idUsers}.`
      );
      return res.status(403).json({ message: 'You can only access your own collection.' });
    }

    const [collection] = await pool.query<RowDataPacket[]>(
      `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
       FROM library l
       JOIN games g ON l.Games_idGames = g.idGames
       WHERE l.Users_idUsers = ?
       ORDER BY l.isPinned DESC, g.name ASC`,
      [idUsers]
    );

    return res.status(200).json({ collection });
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCollectionListHourByUserId = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUsers } = req.body as {
      idUsers?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUsers) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    if (idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to access collection for user ${idUsers}.`
      );
      return res.status(403).json({ message: 'You can only access your own collection.' });
    }

    const [collection] = await pool.query<RowDataPacket[]>(
      `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
       FROM library l
       JOIN games g ON l.Games_idGames = g.idGames
       WHERE l.Users_idUsers = ?
       ORDER BY l.isPinned DESC, l.totalHours DESC`,
      [idUsers]
    );

    return res.status(200).json({ collection });
  } catch (error) {
    console.error('Error fetching collection by hours:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Bug fix: use req.query instead of req.params (no route param defined)
export const getUsersListByItemId = async (req: Request, res: Response) => {
  try {
    const idGames = req.query.idItem ? parseInt(req.query.idItem as string, 10) : undefined;

    if (!idGames) {
      return res.status(400).json({ message: 'Item ID is required.' });
    }

    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT u.idUsers, u.name
       FROM library l
       JOIN users u ON l.Users_idUsers = u.idUsers
       WHERE l.Games_idGames = ? AND u.isPublic = true`,
      [idGames]
    );

    return res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users by item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCollection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary, isFavorite, isPinned } = req.body as {
      idLibrary?: number;
      isFavorite?: boolean;
      isPinned?: boolean;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idLibrary) {
      return res.status(400).json({ message: 'Collection entry ID is required.' });
    }

    if (isFavorite === undefined && isPinned === undefined) {
      return res.status(400).json({ message: 'At least one field (isFavorite or isPinned) must be provided.' });
    }

    const [entryRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM library WHERE idLibrary = ?',
      [idLibrary]
    );

    if (entryRows.length === 0) {
      return res.status(404).json({ message: 'Collection entry not found.' });
    }

    const entry = entryRows[0];

    if (entry.Users_idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to update collection entry ${idLibrary} owned by user ${entry.Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only update entries from your own collection.' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (isFavorite !== undefined) {
      updates.push('isFavorite = ?');
      values.push(isFavorite ? 1 : 0);
    }

    if (isPinned !== undefined) {
      updates.push('isPinned = ?');
      values.push(isPinned ? 1 : 0);
    }

    values.push(idLibrary);

    const query = `UPDATE library SET ${updates.join(', ')} WHERE idLibrary = ?`;

    await pool.execute(query, values);

    return res.status(200).json({ message: 'Collection entry updated successfully.' });
  } catch (error) {
    console.error('Error updating collection entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const searchItemsNotInCollection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUsers, searchTerm } = req.body as {
      idUsers?: number;
      searchTerm?: string;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUsers) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    if (!searchTerm) {
      return res.status(400).json({ message: 'Search term is required.' });
    }

    if (idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to search items for user ${idUsers}.`
      );
      return res.status(403).json({ message: 'You can only search items for your own collection.' });
    }

    const searchPattern = `%${searchTerm}%`;

    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT g.idGames, g.name, g.img
       FROM games g
       LEFT JOIN library l ON g.idGames = l.Games_idGames AND l.Users_idUsers = ?
       WHERE l.idLibrary IS NULL
       AND g.name LIKE ?
       ORDER BY g.name ASC`,
      [idUsers, searchPattern]
    );

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Error searching items not in collection:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const searchItemsInCollection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUsers, searchTerm } = req.body as {
      idUsers?: number;
      searchTerm?: string;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUsers) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    if (!searchTerm) {
      return res.status(400).json({ message: 'Search term is required.' });
    }

    if (idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to search collection for user ${idUsers}.`
      );
      return res.status(403).json({ message: 'You can only search your own collection.' });
    }

    const searchPattern = `%${searchTerm}%`;

    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
       FROM library l
       JOIN games g ON l.Games_idGames = g.idGames
       WHERE l.Users_idUsers = ?
       AND g.name LIKE ?
       ORDER BY g.name ASC`,
      [idUsers, searchPattern]
    );

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Error searching items in collection:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getFavoriteItems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUsers } = req.body as {
      idUsers?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUsers) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    if (idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to access favorite items for user ${idUsers}.`
      );
      return res.status(403).json({ message: 'You can only access your own favorite items.' });
    }

    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
       FROM library l
       JOIN games g ON l.Games_idGames = g.idGames
       WHERE l.Users_idUsers = ? AND l.isFavorite = 1
       ORDER BY l.isPinned DESC, g.name ASC`,
      [idUsers]
    );

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Error fetching favorite items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPinnedItems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUsers } = req.body as {
      idUsers?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUsers) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    if (idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to access pinned items for user ${idUsers}.`
      );
      return res.status(403).json({ message: 'You can only access your own pinned items.' });
    }

    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
       FROM library l
       JOIN games g ON l.Games_idGames = g.idGames
       WHERE l.Users_idUsers = ? AND l.isPinned = 1
       ORDER BY l.isPinned DESC, g.name ASC`,
      [idUsers]
    );

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Error fetching pinned items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteCollection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary } = req.body as {
      idLibrary?: number;
    };

    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idLibrary) {
      return res.status(400).json({ message: 'Collection entry ID is required.' });
    }

    const [entryRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM library WHERE idLibrary = ?',
      [idLibrary]
    );

    if (entryRows.length === 0) {
      return res.status(404).json({ message: 'Collection entry not found.' });
    }

    const entry = entryRows[0];

    if (entry.Users_idUsers !== authenticatedUserId) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to delete collection entry ${idLibrary} owned by user ${entry.Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only delete entries from your own collection.' });
    }

    await pool.execute('DELETE FROM library WHERE idLibrary = ?', [idLibrary]);

    return res.status(200).json({ message: 'Collection entry deleted successfully.' });
  } catch (error) {
    console.error('Error deleting collection entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCollection = async (req: AuthenticatedRequest, res: Response) => {
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
      return res.status(400).json({ message: 'Collection entry ID is required.' });
    }

    const [entryRows] = await pool.query<RowDataPacket[]>(
      `SELECT l.idLibrary, l.Users_idUsers, l.Games_idGames, l.totalHours, l.isFavorite, l.isPinned,
              g.name as itemName, g.img as itemImage
       FROM library l
       JOIN games g ON l.Games_idGames = g.idGames
       WHERE l.idLibrary = ?`,
      [idLibrary]
    );

    if (entryRows.length === 0) {
      return res.status(404).json({ message: 'Collection entry not found.' });
    }

    const entry = entryRows[0];

    if (entry.Users_idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to access collection entry ${idLibrary} owned by user ${entry.Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only access your own collection entries.' });
    }

    const collection = {
      idLibrary: entry.idLibrary,
      idUsers: entry.Users_idUsers,
      idItem: entry.Games_idGames,
      totalHours: entry.totalHours,
      isFavorite: entry.isFavorite,
      isPinned: entry.isPinned,
      itemName: entry.itemName,
      itemImage: entry.itemImage,
    };

    return res.status(200).json({ collection });
  } catch (error) {
    console.error('Error fetching collection entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
