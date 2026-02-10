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


