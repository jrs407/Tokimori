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
            'SELECT * FROM library WHERE idGames = ? AND idUsers = ?',
            [idGames, idUsers]
        );

        if (existingLibrary.length > 0) {
            return res.status(400).json({ message: 'This game is already in the user\'s library.' });
        }

        await pool.execute(
            'INSERT INTO library (idGames, idUsers, totalHours) VALUES (?, ?, ?)',
            [idGames, idUsers, 0]
        );

        return res.status(201).json({ message: 'Game added to library successfully.' });

    } catch (error) {
        console.error('Error creating library:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};