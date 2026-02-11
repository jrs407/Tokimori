import type { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { getImagePath, deleteImage } from '../middlewares/upload.middleware';

export const createLibrary = async (req: AuthenticatedRequest, res: Response) => {
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
            return res.status(400).json({ message: 'Game ID and User ID are required.' });
        }

        if (idUsers !== authenticatedUserId && !isAdmin) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to create library entry for user ${idUsers}.`
            );
            return res.status(403).json({ message: 'You can only add games to your own library.' });
        }

        const [existingLibrary] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM library WHERE Games_idGames = ? AND Users_idUsers = ?',
            [idGames, idUsers]
        );

        if (existingLibrary.length > 0) {
            return res.status(400).json({ message: 'This game is already in the user\'s library.' });
        }

        await pool.execute(
            'INSERT INTO library (Games_idGames, Users_idUsers, isFavorite, isPinned) VALUES (?, ?, ?, ?)',
            [idGames, idUsers, 0, 0]
        );

        return res.status(201).json({ message: 'Game added to library successfully.' });

    } catch (error) {
        console.error('Error creating library:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getLibraryListByUserId = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to access library for user ${idUsers}.`
            );
            return res.status(403).json({ message: 'You can only access your own library.' });
        }

        const [library] = await pool.query<RowDataPacket[]>(
            `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
             FROM library l 
             JOIN games g ON l.Games_idGames = g.idGames 
             WHERE l.Users_idUsers = ?`,
            [idUsers]
        );

        return res.status(200).json({ library });

    } catch (error) {
        console.error('Error fetching library:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUsersListByGameId = async (req: Request, res: Response) => {
    try {
        const { idGames } = req.params as {
            idGames?: number;
        };

        if (!idGames) {
            return res.status(400).json({ message: 'Game ID is required.' });
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
        console.error('Error fetching users by game:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteLibrary = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idLibrary } = req.body as {
            idLibrary?: number;
        };

        const authenticatedUserId = req.user?.id;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idLibrary) {
            return res.status(400).json({ message: 'Library ID is required.' });
        }

        const [libraryRows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM library WHERE idLibrary = ?',
            [idLibrary]
        );

        if (libraryRows.length === 0) {
            return res.status(404).json({ message: 'Library entry not found.' });
        }

        const libraryEntry = libraryRows[0];

        if (libraryEntry.Users_idUsers !== authenticatedUserId) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to delete library entry ${idLibrary} owned by user ${libraryEntry.Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only delete entries from your own library.' });
        }

        await pool.execute(
            'DELETE FROM library WHERE idLibrary = ?',
            [idLibrary]
         );

        return res.status(200).json({ message: 'Library entry deleted successfully.' });

    } catch (error) {
        console.error('Error deleting library:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};