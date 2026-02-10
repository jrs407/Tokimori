import type { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { getImagePath, deleteImage } from '../middlewares/upload.middleware';


// Revisar creacion de juegos con imagenes, desde el terminal no consigo que funcione, 
// quizá desde algun desplegable frontend funcione, desde el terminal no
export const createGame = async (req: Request, res: Response) => {
  try {
    const { name } = req.body as {
      name?: string;
    };

    if (!name) {
      return res.status(400).json({ message: 'Game name is required.' });
    }

    let imagePath: string | null = null;

    if (req.file) {
      imagePath = getImagePath(req.file.filename);
    } else {
      imagePath = 'Miscelanius/gameImage/prueba.jpg';
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO games (name, img) VALUES (?, ?)',
      [name, imagePath]
    );

    return res.status(201).json({
      message: 'Game created successfully.',
      game: {
        id: result.insertId,
        name,
        img: imagePath,
      },
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const gamesList = async (req: Request, res: Response) => {
  try {

    const [games] = await pool.query<RowDataPacket[]>('SELECT idGames, name, img FROM games');

    return res.status(200).json({ games });

  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteGame = async (req: AuthenticatedRequest, res: Response) => {
    try{
        const { gameIdToDelete } = req.body as {
            gameIdToDelete?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!isAdmin) {
            console.warn(
                `Security: Non-admin user ${authenticatedUserId} attempted to delete game ${gameIdToDelete}.`
            );
            return res.status(403).json({ message: 'Only admins can delete games.' });
        }

        if (!gameIdToDelete) {
            return res.status(400).json({ message: 'Game ID is required.' });
        }

        const [gameRows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM games WHERE idGames = ?',
            [gameIdToDelete]
        );

        if (gameRows.length === 0) {
            return res.status(404).json({ message: 'Game not found.' });
        }

        const game = gameRows[0];

        await pool.execute(
            'DELETE FROM games WHERE idGames = ?',
            [gameIdToDelete]
        );

        if (game.img) {
            await deleteImage(game.img);
        }

        console.info(`Admin ${authenticatedUserId} deleted game ${gameIdToDelete}.`);

        return res.status(200).json({ message: 'Game deleted successfully.' });


    }catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateGame = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { gameIdToUpdate, name } = req.body as {
            gameIdToUpdate?: number;
            name?: string;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!isAdmin) {
            console.warn(
                `Security: Non-admin user ${authenticatedUserId} attempted to update game ${gameIdToUpdate}.`
            );
            return res.status(403).json({ message: 'Only admins can update games.' });
        }

        if (!gameIdToUpdate) {
            return res.status(400).json({ message: 'Game ID is required.' });
        }

        if (!name && !req.file) {
            return res.status(400).json({ message: 'At least a game name or image is required to update.' });
        }

        const [gameRows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM games WHERE idGames = ?',
            [gameIdToUpdate]
        );

        if (gameRows.length === 0) {
            return res.status(404).json({ message: 'Game not found.' });
        }

        const game = gameRows[0];
        let newImagePath = game.img;

        if (req.file) {
            newImagePath = getImagePath(req.file.filename);
            if (game.img) {
                await deleteImage(game.img);
            }
        }

        await pool.execute(
            'UPDATE games SET name = ?, img = ? WHERE idGames = ?',
            [name || game.name, newImagePath, gameIdToUpdate]
        );

        console.info(`Admin ${authenticatedUserId} updated game ${gameIdToUpdate}.`);

        return res.status(200).json({
            message: 'Game updated successfully.',
            game: {
                id: gameIdToUpdate,
                name: name || game.name,
                img: newImagePath,
            },
        });

    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const fuseGames = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { gameIdToFuse, gameIdToKeep } = req.body as {
            gameIdToFuse?: number;
            gameIdToKeep?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!isAdmin) {
            console.warn(
                `Security: Non-admin user ${authenticatedUserId} attempted to fuse games.`
            );
            return res.status(403).json({ message: 'Only admins can fuse games.' });
        }

        if (!gameIdToFuse || !gameIdToKeep) {
            return res.status(400).json({ message: 'Both game IDs are required.' });
        }

        if (gameIdToFuse === gameIdToKeep) {
            return res.status(400).json({ message: 'Cannot fuse a game with itself.' });
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [gameToFuseRows] = await connection.query<RowDataPacket[]>(
                'SELECT * FROM games WHERE idGames = ?',
                [gameIdToFuse]
            );

            const [gameToKeepRows] = await connection.query<RowDataPacket[]>(
                'SELECT * FROM games WHERE idGames = ?',
                [gameIdToKeep]
            );

            if (gameToFuseRows.length === 0 || gameToKeepRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'One or both games not found.' });
            }

            const [libraryEntries] = await connection.query<RowDataPacket[]>(
                'SELECT * FROM library WHERE Games_idGames = ?',
                [gameIdToFuse]
            );

            for (const fuseEntry of libraryEntries) {
                const userId = fuseEntry.Users_idUsers;

                const [existingEntry] = await connection.query<RowDataPacket[]>(
                    'SELECT * FROM library WHERE Games_idGames = ? AND Users_idUsers = ?',
                    [gameIdToKeep, userId]
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
                    await connection.execute(
                        'UPDATE library SET totalHours = ? WHERE idLibrary = ?',
                        [newTotalHours, targetLibraryId]
                    );

                    await connection.execute(
                        'DELETE FROM library WHERE idLibrary = ?',
                        [sourceLibraryId]
                    );
                } else {

                    await connection.execute(
                        'UPDATE library SET Games_idGames = ? WHERE idLibrary = ?',
                        [gameIdToKeep, fuseEntry.idLibrary]
                    );
                }
            }


            if (gameToFuseRows[0].img) {
                await deleteImage(gameToFuseRows[0].img);
            }

            await connection.execute(
                'DELETE FROM games WHERE idGames = ?',
                [gameIdToFuse]
            );

            await connection.commit();

            console.info(`Admin ${authenticatedUserId} fused game ${gameIdToFuse} into game ${gameIdToKeep}.`);

            return res.status(200).json({
                message: `Game ${gameIdToFuse} successfully fused into game ${gameIdToKeep}.`,
                libraryEntriesProcessed: libraryEntries.length,
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error fusing games:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getGameById = async (req: Request, res: Response) => {
    try {
        const { idGames } = req.body as {
            idGames?: number;
        };

        if (!idGames) {
            return res.status(400).json({ message: 'Game ID is required.' });
        }

        const [gameRows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM games WHERE idGames = ?',
            [idGames]
        );

        if (gameRows.length === 0) {
            return res.status(404).json({ message: 'Game not found.' });
        }

        const game = gameRows[0];
    
        return res.status(200).json({ game });

    } catch (error) {
        console.error('Error fetching game by ID:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


export const getGameListByName = async (req: Request, res: Response) => {
    try {
        const { gameName } = req.body as {
            gameName?: number;
        };

        if (!gameName) {
            return res.status(400).json({ message: 'Game name is required.' });
        }

        const [gameRows] = await pool.query<RowDataPacket[]>(
            'SELECT * FROM games WHERE name LIKE ?',
            [`%${gameName}%`]
        );

        if (gameRows.length === 0) {
            return res.status(404).json({ message: 'No games found with that name.' });
        }
     
        return res.status(200).json({ games: gameRows });


    } catch (error) {
        console.error('Error fetching game by ID:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

