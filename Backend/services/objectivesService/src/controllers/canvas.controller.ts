import type { Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getCanvasByLibrary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary } = req.body as { idLibrary?: number };
    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) return res.status(401).json({ message: 'User not authenticated.' });
    if (!idLibrary) return res.status(400).json({ message: 'idLibrary is required.' });

    const [libraryRows] = await pool.query<RowDataPacket[]>(
      'SELECT Users_idUsers FROM library WHERE idLibrary = ?',
      [idLibrary]
    );
    if (libraryRows.length === 0) return res.status(404).json({ message: 'Library entry not found.' });
    if (libraryRows[0].Users_idUsers !== authenticatedUserId && !isAdmin)
      return res.status(403).json({ message: 'You can only view canvas from your own library.' });

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT idcanvas, library_idLibrary, title, contenido FROM canvas WHERE library_idLibrary = ? ORDER BY idcanvas ASC',
      [idLibrary]
    );

    return res.status(200).json({ boards: rows });
  } catch (error) {
    console.error('Error fetching canvas:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createCanvas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary, title } = req.body as { idLibrary?: number; title?: string };
    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) return res.status(401).json({ message: 'User not authenticated.' });
    if (!idLibrary || !title) return res.status(400).json({ message: 'idLibrary and title are required.' });

    const [libraryRows] = await pool.query<RowDataPacket[]>(
      'SELECT Users_idUsers FROM library WHERE idLibrary = ?',
      [idLibrary]
    );
    if (libraryRows.length === 0) return res.status(404).json({ message: 'Library entry not found.' });
    if (libraryRows[0].Users_idUsers !== authenticatedUserId && !isAdmin)
      return res.status(403).json({ message: 'You can only create canvas in your own library.' });

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO canvas (library_idLibrary, title, contenido) VALUES (?, ?, ?)',
      [idLibrary, title, null]
    );

    return res.status(201).json({ canvasId: result.insertId });
  } catch (error) {
    console.error('Error creating canvas:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCanvas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idCanvas, title, contenido } = req.body as { idCanvas?: number; title?: string; contenido?: string };
    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) return res.status(401).json({ message: 'User not authenticated.' });
    if (!idCanvas) return res.status(400).json({ message: 'idCanvas is required.' });

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT c.idcanvas, l.Users_idUsers FROM canvas c JOIN library l ON c.library_idLibrary = l.idLibrary WHERE c.idcanvas = ?',
      [idCanvas]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Canvas not found.' });
    if (rows[0].Users_idUsers !== authenticatedUserId && !isAdmin)
      return res.status(403).json({ message: 'You can only update your own canvas.' });

    const updates: string[] = [];
    const values: unknown[] = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (contenido !== undefined) { updates.push('contenido = ?'); values.push(contenido); }
    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update.' });

    values.push(idCanvas);
    await pool.execute(`UPDATE canvas SET ${updates.join(', ')} WHERE idcanvas = ?`, values);

    return res.status(200).json({ message: 'Canvas updated successfully.' });
  } catch (error) {
    console.error('Error updating canvas:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteCanvas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idCanvas } = req.body as { idCanvas?: number };
    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) return res.status(401).json({ message: 'User not authenticated.' });
    if (!idCanvas) return res.status(400).json({ message: 'idCanvas is required.' });

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT c.idcanvas, l.Users_idUsers FROM canvas c JOIN library l ON c.library_idLibrary = l.idLibrary WHERE c.idcanvas = ?',
      [idCanvas]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Canvas not found.' });
    if (rows[0].Users_idUsers !== authenticatedUserId && !isAdmin)
      return res.status(403).json({ message: 'You can only delete your own canvas.' });

    await pool.execute('DELETE FROM canvas WHERE idcanvas = ?', [idCanvas]);

    return res.status(200).json({ message: 'Canvas deleted successfully.' });
  } catch (error) {
    console.error('Error deleting canvas:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
