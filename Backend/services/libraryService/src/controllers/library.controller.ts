import type { Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * Add a game to user's library
 */
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

/**
 * Get user's library ordered by pinned status and game name
 */
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
             WHERE l.Users_idUsers = ?
             ORDER BY l.isPinned DESC, g.name ASC`,
            [idUsers]
        );

        return res.status(200).json({ library });

    } catch (error) {
        console.error('Error fetching library:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get user's library ordered by pinned status and play hours (descending)
 */
export const getLibraryListHourByUserId = async (req: AuthenticatedRequest, res: Response) => {
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
             WHERE l.Users_idUsers = ?
             ORDER BY l.isPinned DESC, l.totalHours DESC`,
            [idUsers]
        );

        return res.status(200).json({ library });

    } catch (error) {
        console.error('Error fetching library by hours:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get list of public users who have a specific game in their library
 */
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

/**
 * Update library entry's favorite and/or pinned status
 */
export const updateLibrary = async (req: AuthenticatedRequest, res: Response) => {
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
            return res.status(400).json({ message: 'Library ID is required.' });
        }

        if (isFavorite === undefined && isPinned === undefined) {
            return res.status(400).json({ message: 'At least one field (isFavorite or isPinned) must be provided.' });
        }

        const [libraryRows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM library WHERE idLibrary = ?',
            [idLibrary]
        );

        if (libraryRows.length === 0) {
            return res.status(404).json({ message: 'Library entry not found.' });
        }

        const libraryEntry = libraryRows[0];

        if (libraryEntry.Users_idUsers !== authenticatedUserId && !isAdmin) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to update library entry ${idLibrary} owned by user ${libraryEntry.Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only update entries from your own library.' });
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

        return res.status(200).json({ message: 'Library entry updated successfully.' });

    } catch (error) {
        console.error('Error updating library:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Search for games NOT in user's library by name pattern
 */
export const searchGamesNotInLibrary = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to search games for user ${idUsers}.`
            );
            return res.status(403).json({ message: 'You can only search games for your own library.' });
        }

        const searchPattern = `%${searchTerm}%`;

        const [games] = await pool.query<RowDataPacket[]>(
            `SELECT g.idGames, g.name, g.img, g.description, g.developer, g.publisher, g.releaseDate
             FROM games g
             LEFT JOIN library l ON g.idGames = l.Games_idGames AND l.Users_idUsers = ?
             WHERE l.idLibrary IS NULL
             AND g.name LIKE ?
             ORDER BY g.name ASC`,
            [idUsers, searchPattern]
        );

        return res.status(200).json({ games });

    } catch (error) {
        console.error('Error searching games not in library:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Search for games IN user's library by name pattern
 */
export const searchGamesInLibrary = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to search library for user ${idUsers}.`
            );
            return res.status(403).json({ message: 'You can only search your own library.' });
        }

        const searchPattern = `%${searchTerm}%`;

        const [games] = await pool.query<RowDataPacket[]>(
            `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
             FROM library l
             JOIN games g ON l.Games_idGames = g.idGames
             WHERE l.Users_idUsers = ?
             AND g.name LIKE ?
             ORDER BY g.name ASC`,
            [idUsers, searchPattern]
        );

        return res.status(200).json({ games });

    } catch (error) {
        console.error('Error searching games in library:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get all games marked as favorite in user's library
 */
export const getFavoriteGames = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to access favorite games for user ${idUsers}.`
            );
            return res.status(403).json({ message: 'You can only access your own favorite games.' });
        }

        const [games] = await pool.query<RowDataPacket[]>(
            `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
             FROM library l
             JOIN games g ON l.Games_idGames = g.idGames
             WHERE l.Users_idUsers = ? AND l.isFavorite = 1
             ORDER BY g.name ASC`,
            [idUsers]
        );

        return res.status(200).json({ games });

    } catch (error) {
        console.error('Error fetching favorite games:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get all games marked as pinned in user's library
 */
export const getPinnedGames = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to access pinned games for user ${idUsers}.`
            );
            return res.status(403).json({ message: 'You can only access your own pinned games.' });
        }

        const [games] = await pool.query<RowDataPacket[]>(
            `SELECT g.idGames, g.name, g.img, l.totalHours, l.idLibrary, l.isFavorite, l.isPinned
             FROM library l
             JOIN games g ON l.Games_idGames = g.idGames
             WHERE l.Users_idUsers = ? AND l.isPinned = 1
             ORDER BY g.name ASC`,
            [idUsers]
        );

        return res.status(200).json({ games });

    } catch (error) {
        console.error('Error fetching pinned games:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Remove a game from user's library
 */
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

/**
 * Get detailed information for a specific library entry by ID
 */
export const getLibrary = async (req: AuthenticatedRequest, res: Response) => {
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
            return res.status(400).json({ message: 'Library ID is required.' });
        }

        const [libraryRows] = await pool.query<RowDataPacket[]>(
            `SELECT l.idLibrary, l.Users_idUsers, l.Games_idGames, l.totalHours, l.isFavorite, l.isPinned,
                    g.name as gameName, g.img as gameImage
             FROM library l
             JOIN games g ON l.Games_idGames = g.idGames
             WHERE l.idLibrary = ?`,
            [idLibrary]
        );

        if (libraryRows.length === 0) {
            return res.status(404).json({ message: 'Library entry not found.' });
        }

        const libraryEntry = libraryRows[0];

        if (libraryEntry.Users_idUsers !== authenticatedUserId && !isAdmin) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to access library entry ${idLibrary} owned by user ${libraryEntry.Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only access your own library entries.' });
        }

        const library = {
            idLibrary: libraryEntry.idLibrary,
            idUsers: libraryEntry.Users_idUsers,
            idGames: libraryEntry.Games_idGames,
            totalHours: libraryEntry.totalHours,
            isFavorite: libraryEntry.isFavorite,
            isPinned: libraryEntry.isPinned,
            gameName: libraryEntry.gameName,
            gameImage: libraryEntry.gameImage
        };

        return res.status(200).json({ library });

    } catch (error) {
        console.error('Error fetching library entry:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};