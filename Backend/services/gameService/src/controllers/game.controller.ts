import type { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { getImagePath, deleteImage } from '../middlewares/upload.middleware';

export const createItem = async (req: Request, res: Response) => {
  try {
    const { name } = req.body as {
      name?: string;
    };

    if (!name) {
      return res.status(400).json({ message: 'Item name is required.' });
    }

    let imagePath: string | null = null;

    if (req.file) {
      imagePath = getImagePath(req.file.filename);
    } else {
      imagePath = '/gameImage/prueba.jpg';
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO games (name, img) VALUES (?, ?)',
      [name, imagePath]
    );

    return res.status(201).json({
      message: 'Item created successfully.',
      item: {
        id: result.insertId,
        name,
        img: imagePath,
      },
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const itemsList = async (req: Request, res: Response) => {
  try {
    const [items] = await pool.query<RowDataPacket[]>('SELECT idGames, name, img FROM games');
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemIdToDelete } = req.body as {
      itemIdToDelete?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!isAdmin) {
      console.warn(
        `Security: Non-admin user ${authenticatedUserId} attempted to delete item ${itemIdToDelete}.`
      );
      return res.status(403).json({ message: 'Only admins can delete items.' });
    }

    if (!itemIdToDelete) {
      return res.status(400).json({ message: 'Item ID is required.' });
    }

    const [itemRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM games WHERE idGames = ?',
      [itemIdToDelete]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const item = itemRows[0];

    await pool.execute('DELETE FROM games WHERE idGames = ?', [itemIdToDelete]);

    if (item.img) {
      await deleteImage(item.img);
    }

    console.info(`Admin ${authenticatedUserId} deleted item ${itemIdToDelete}.`);

    return res.status(200).json({ message: 'Item deleted successfully.' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateItem = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemIdToUpdate, name } = req.body as {
      itemIdToUpdate?: number;
      name?: string;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!isAdmin) {
      console.warn(
        `Security: Non-admin user ${authenticatedUserId} attempted to update item ${itemIdToUpdate}.`
      );
      return res.status(403).json({ message: 'Only admins can update items.' });
    }

    if (!itemIdToUpdate) {
      return res.status(400).json({ message: 'Item ID is required.' });
    }

    if (!name && !req.file) {
      return res.status(400).json({ message: 'At least an item name or image is required to update.' });
    }

    const [itemRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM games WHERE idGames = ?',
      [itemIdToUpdate]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const item = itemRows[0];
    let newImagePath = item.img;

    if (req.file) {
      newImagePath = getImagePath(req.file.filename);
      if (item.img) {
        await deleteImage(item.img);
      }
    }

    await pool.execute(
      'UPDATE games SET name = ?, img = ? WHERE idGames = ?',
      [name || item.name, newImagePath, itemIdToUpdate]
    );

    console.info(`Admin ${authenticatedUserId} updated item ${itemIdToUpdate}.`);

    return res.status(200).json({
      message: 'Item updated successfully.',
      item: {
        id: itemIdToUpdate,
        name: name || item.name,
        img: newImagePath,
      },
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const fuseItems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { itemIdToFuse, itemIdToKeep } = req.body as {
      itemIdToFuse?: number;
      itemIdToKeep?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!isAdmin) {
      console.warn(
        `Security: Non-admin user ${authenticatedUserId} attempted to fuse items.`
      );
      return res.status(403).json({ message: 'Only admins can fuse items.' });
    }

    if (!itemIdToFuse || !itemIdToKeep) {
      return res.status(400).json({ message: 'Both item IDs are required.' });
    }

    if (itemIdToFuse === itemIdToKeep) {
      return res.status(400).json({ message: 'Cannot fuse an item with itself.' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [itemToFuseRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM games WHERE idGames = ?',
        [itemIdToFuse]
      );

      const [itemToKeepRows] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM games WHERE idGames = ?',
        [itemIdToKeep]
      );

      if (itemToFuseRows.length === 0 || itemToKeepRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'One or both items not found.' });
      }

      const [libraryEntries] = await connection.query<RowDataPacket[]>(
        'SELECT * FROM library WHERE Games_idGames = ?',
        [itemIdToFuse]
      );

      for (const fuseEntry of libraryEntries) {
        const userId = fuseEntry.Users_idUsers;

        const [existingEntry] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM library WHERE Games_idGames = ? AND Users_idUsers = ?',
          [itemIdToKeep, userId]
        );

        if (existingEntry.length > 0) {
          const targetLibraryId = existingEntry[0].idLibrary;
          const sourceLibraryId = fuseEntry.idLibrary;

          await connection.execute(
            'UPDATE sessions SET Library_idLibrary = ? WHERE Library_idLibrary = ?',
            [targetLibraryId, sourceLibraryId]
          );

          const [objectives] = await connection.query<RowDataPacket[]>(
            'SELECT idObjectives FROM objectives WHERE library_idLibrary = ?',
            [sourceLibraryId]
          );

          for (const obj of objectives) {
            await connection.execute(
              'UPDATE objectives SET library_idLibrary = ? WHERE idObjectives = ?',
              [targetLibraryId, obj.idObjectives]
            );
          }

          await connection.execute(
            'UPDATE notes SET library_idLibrary = ? WHERE library_idLibrary = ?',
            [targetLibraryId, sourceLibraryId]
          );

          await connection.execute(
            'UPDATE canvas SET library_idLibrary = ? WHERE library_idLibrary = ?',
            [targetLibraryId, sourceLibraryId]
          );

          const newTotalHours = (existingEntry[0].totalHours || 0) + (fuseEntry.totalHours || 0);
          const newIsFavorite = ((existingEntry[0].isFavorite || 0) || (fuseEntry.isFavorite || 0)) ? 1 : 0;
          const newIsPinned = ((existingEntry[0].isPinned || 0) || (fuseEntry.isPinned || 0)) ? 1 : 0;

          await connection.execute(
            'UPDATE library SET totalHours = ?, isFavorite = ?, isPinned = ? WHERE idLibrary = ?',
            [newTotalHours, newIsFavorite, newIsPinned, targetLibraryId]
          );

          await connection.execute(
            'DELETE FROM library WHERE idLibrary = ?',
            [sourceLibraryId]
          );
        } else {
          await connection.execute(
            'UPDATE library SET Games_idGames = ? WHERE idLibrary = ?',
            [itemIdToKeep, fuseEntry.idLibrary]
          );
        }
      }

      if (itemToFuseRows[0].img) {
        await deleteImage(itemToFuseRows[0].img);
      }

      await connection.execute('DELETE FROM games WHERE idGames = ?', [itemIdToFuse]);

      await connection.commit();

      console.info(`Admin ${authenticatedUserId} fused item ${itemIdToFuse} into item ${itemIdToKeep}.`);

      return res.status(200).json({
        message: `Item ${itemIdToFuse} successfully fused into item ${itemIdToKeep}.`,
        collectionEntriesProcessed: libraryEntries.length,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fusing items:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Bug fix: GET route must use req.query, not req.body
export const getItemById = async (req: Request, res: Response) => {
  try {
    const idGames = req.query.idItem ? parseInt(req.query.idItem as string, 10) : undefined;

    if (!idGames) {
      return res.status(400).json({ message: 'Item ID is required.' });
    }

    const [itemRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM games WHERE idGames = ?',
      [idGames]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    return res.status(200).json({ item: itemRows[0] });
  } catch (error) {
    console.error('Error fetching item by ID:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Bug fix: GET route must use req.query, not req.body
export const getItemListByName = async (req: Request, res: Response) => {
  try {
    const itemName = req.query.itemName as string | undefined;

    if (!itemName) {
      return res.status(400).json({ message: 'Item name is required.' });
    }

    const [itemRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM games WHERE name LIKE ?',
      [`%${itemName}%`]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({ message: 'No items found with that name.' });
    }

    return res.status(200).json({ items: itemRows });
  } catch (error) {
    console.error('Error fetching items by name:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
