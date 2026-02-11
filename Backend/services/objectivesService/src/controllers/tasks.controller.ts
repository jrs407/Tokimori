import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';


export const createTask = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective, title } = req.body as {
            idObjective?: number;
            title?: string;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idObjective || !title) {
            return res.status(400).json({ message: 'idObjective and title are required.' });
        }

        const [objectiveRows] = await pool.query<RowDataPacket[]>(
            `SELECT o.idObjectives, l.Users_idUsers 
             FROM objectives o
             JOIN library l ON o.library_idLibrary = l.idLibrary
             WHERE o.idObjectives = ?`,
            [idObjective]
        );

        if (objectiveRows.length === 0) {
            return res.status(404).json({ message: 'Objective not found.' });
        }

        if (objectiveRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to create task for objective ${idObjective}.`
            );
            return res.status(403).json({ message: 'You can only create tasks in your own objectives.' });
        }

        const [result] = await pool.execute<ResultSetHeader>(
            'INSERT INTO tasks (objectives_idObjectives, title) VALUES (?, ?)',
            [idObjective, title]
        );

        return res.status(201).json({
            message: 'Task created successfully.',
            taskId: result.insertId
        });

    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};