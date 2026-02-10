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

