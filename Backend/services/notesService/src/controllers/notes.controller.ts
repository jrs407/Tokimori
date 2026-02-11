import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * Create a new note for a specific library entry
 */
export const createNote = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idLibrary, title, text } = req.body as { 
            idLibrary?: number;
            title?: string;
            text?: string;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idLibrary || !title || !text) {
            return res.status(400).json({ message: 'idLibrary, title, and text are required.' });
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
                `Security: User ${authenticatedUserId} attempted to create note for library ${idLibrary}.`
            );
            return res.status(403).json({ message: 'You can only create notes in your own library.' });
        }

        const [result] = await pool.execute<ResultSetHeader>(
            'INSERT INTO notes (library_idLibrary, title, text) VALUES (?, ?, ?)',
            [idLibrary, title, text]
        );

        return res.status(201).json({ 
            message: 'Note created successfully.',
            noteId: result.insertId 
        });

    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};