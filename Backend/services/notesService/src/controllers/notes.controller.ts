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

/**
 * Update an existing note (title, text, colour, isFavorite, isPinned)
 */
export const updateNote = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idNote, title, text, colour, isFavorite, isPinned } = req.body as {
            idNote?: number;
            title?: string;
            text?: string;
            colour?: number;
            isFavorite?: boolean;
            isPinned?: boolean;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idNote) {
            return res.status(400).json({ message: 'idNote is required.' });
        }

        if (title === undefined && text === undefined && colour === undefined && isFavorite === undefined && isPinned === undefined) {
            return res.status(400).json({ message: 'At least one field must be provided for update.' });
        }

        const [noteRows] = await pool.query<RowDataPacket[]>(
            `SELECT n.idNotes, l.Users_idUsers 
             FROM notes n
             JOIN library l ON n.library_idLibrary = l.idLibrary
             WHERE n.idNotes = ?`,
            [idNote]
        );

        if (noteRows.length === 0) {
            return res.status(404).json({ message: 'Note not found.' });
        }

        if (noteRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to update note ${idNote} owned by user ${noteRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only update your own notes.' });
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (title !== undefined) {
            updates.push('title = ?');
            values.push(title);
        }

        if (text !== undefined) {
            updates.push('text = ?');
            values.push(text);
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

        values.push(idNote);

        const query = `UPDATE notes SET ${updates.join(', ')} WHERE idNotes = ?`;

        await pool.execute(query, values);

        return res.status(200).json({ message: 'Note updated successfully.' });

    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get all notes for a specific library entry
 */
export const getNotesByLibrary = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to access notes for library ${idLibrary} owned by user ${libraryRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view notes from your own library.' });
        }

        const [notes] = await pool.query<RowDataPacket[]>(
            `SELECT idNotes, library_idLibrary, title, text, colour, isFavorite, isPinned
             FROM notes
             WHERE library_idLibrary = ?
             ORDER BY isPinned DESC, isFavorite DESC, idNotes DESC`,
            [idLibrary]
        );

        return res.status(200).json({ notes });

    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};