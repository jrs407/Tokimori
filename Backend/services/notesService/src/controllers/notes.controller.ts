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
             ORDER BY isPinned DESC, title ASC`,
            [idLibrary]
        );

        return res.status(200).json({ notes });

    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get pinned notes for a specific library entry
 */
export const getPinnedNotes = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to access pinned notes for library ${idLibrary} owned by user ${libraryRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view notes from your own library.' });
        }

        const [notes] = await pool.query<RowDataPacket[]>(
            `SELECT idNotes, library_idLibrary, title, text, colour, isFavorite, isPinned
             FROM notes
             WHERE library_idLibrary = ? AND isPinned = 1
             ORDER BY title ASC`,
            [idLibrary]
        );

        return res.status(200).json({ notes });

    } catch (error) {
        console.error('Error fetching pinned notes:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get favorite notes for a specific library entry
 */
export const getFavoriteNotes = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to access favorite notes for library ${idLibrary} owned by user ${libraryRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view notes from your own library.' });
        }

        const [notes] = await pool.query<RowDataPacket[]>(
            `SELECT idNotes, library_idLibrary, title, text, colour, isFavorite, isPinned
             FROM notes
             WHERE library_idLibrary = ? AND isFavorite = 1
             ORDER BY title ASC`,
            [idLibrary]
        );

        return res.status(200).json({ notes });

    } catch (error) {
        console.error('Error fetching favorite notes:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Delete a note by ID
 */
export const deleteNote = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idNote } = req.body as {
            idNote?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idNote) {
            return res.status(400).json({ message: 'idNote is required.' });
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
                `Security: User ${authenticatedUserId} attempted to delete note ${idNote} owned by user ${noteRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only delete your own notes.' });
        }

        await pool.execute(
            'DELETE FROM notes WHERE idNotes = ?',
            [idNote]
        );

        return res.status(200).json({ message: 'Note deleted successfully.' });

    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get a specific note by ID
 */
export const getNote = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idNote } = req.body as {
            idNote?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idNote) {
            return res.status(400).json({ message: 'idNote is required.' });
        }

        const [noteRows] = await pool.query<RowDataPacket[]>(
            `SELECT n.idNotes, n.library_idLibrary, n.title, n.text, n.colour, n.isFavorite, n.isPinned, l.Users_idUsers
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
                `Security: User ${authenticatedUserId} attempted to access note ${idNote} owned by user ${noteRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view your own notes.' });
        }

        const note = {
            idNotes: noteRows[0].idNotes,
            library_idLibrary: noteRows[0].library_idLibrary,
            title: noteRows[0].title,
            text: noteRows[0].text,
            colour: noteRows[0].colour,
            isFavorite: noteRows[0].isFavorite,
            isPinned: noteRows[0].isPinned
        };

        return res.status(200).json({ note });

    } catch (error) {
        console.error('Error fetching note:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get all notes for a specific user (across all libraries)
 */
export const getNotesByUser = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to access notes for user ${idUser}.`
            );
            return res.status(403).json({ message: 'You can only view your own notes.' });
        }

        const [notes] = await pool.query<RowDataPacket[]>(
            `SELECT n.idNotes, n.library_idLibrary, n.title, n.text, n.colour, n.isFavorite, n.isPinned
             FROM notes n
             JOIN library l ON n.library_idLibrary = l.idLibrary
             WHERE l.Users_idUsers = ?
             ORDER BY n.isPinned DESC, n.title ASC`,
            [idUser]
        );

        return res.status(200).json({ notes });

    } catch (error) {
        console.error('Error fetching user notes:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Search notes by title within a specific library
 */
export const searchNotesByTitle = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to search notes in library ${idLibrary}.`
            );
            return res.status(403).json({ message: 'You can only search notes in your own library.' });
        }

        const searchPattern = `%${searchTerm}%`;
        const [notes] = await pool.query<RowDataPacket[]>(
            `SELECT idNotes, library_idLibrary, title, text, colour, isFavorite, isPinned
             FROM notes
             WHERE library_idLibrary = ? AND title LIKE ?
             ORDER BY isPinned DESC, title ASC`,
            [idLibrary, searchPattern]
        );

        return res.status(200).json({ notes });

    } catch (error) {
        console.error('Error searching notes by title:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};