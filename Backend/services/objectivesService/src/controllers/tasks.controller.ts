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

/**
 * Delete a task by ID
 */
export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idTask } = req.body as {
            idTask?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idTask) {
            return res.status(400).json({ message: 'idTask is required.' });
        }

        const [taskRows] = await pool.query<RowDataPacket[]>(
            `SELECT t.idTask, l.Users_idUsers
             FROM tasks t
             JOIN objectives o ON t.objectives_idObjectives = o.idObjectives
             JOIN library l ON o.library_idLibrary = l.idLibrary
             WHERE t.idTask = ?`,
            [idTask]
        );

        if (taskRows.length === 0) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        if (taskRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to delete task ${idTask} owned by user ${taskRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only delete your own tasks.' });
        }

        await pool.execute('DELETE FROM tasks WHERE idTask = ?', [idTask]);

        return res.status(200).json({ message: 'Task deleted successfully.' });

    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get all tasks for a specific objective
 * Ordered by pinned status (pinned first) and then by idTask ascending
 */
export const getTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as {
            idObjective?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idObjective) {
            return res.status(400).json({ message: 'idObjective is required.' });
        }

        const [objectiveRows] = await pool.query<RowDataPacket[]>(
            `SELECT l.Users_idUsers
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
                `Security: User ${authenticatedUserId} attempted to view tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ?
             ORDER BY isPinned DESC, idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get incomplete tasks for a specific objective
 * Only tasks where completed = 0
 */
export const getIncompleteTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as {
            idObjective?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idObjective) {
            return res.status(400).json({ message: 'idObjective is required.' });
        }

        const [objectiveRows] = await pool.query<RowDataPacket[]>(
            `SELECT l.Users_idUsers
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
                `Security: User ${authenticatedUserId} attempted to view incomplete tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND completed = 0
             ORDER BY isPinned DESC, idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching incomplete tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get completed tasks for a specific objective
 * Only tasks where completed = 1
 */
export const getCompletedTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as {
            idObjective?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idObjective) {
            return res.status(400).json({ message: 'idObjective is required.' });
        }

        const [objectiveRows] = await pool.query<RowDataPacket[]>(
            `SELECT l.Users_idUsers
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
                `Security: User ${authenticatedUserId} attempted to view completed tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND completed = 1
             ORDER BY isPinned DESC, idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching completed tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Delete all completed tasks for a specific objective
 */
export const deleteCompletedTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as {
            idObjective?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idObjective) {
            return res.status(400).json({ message: 'idObjective is required.' });
        }

        const [objectiveRows] = await pool.query<RowDataPacket[]>(
            `SELECT l.Users_idUsers
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
                `Security: User ${authenticatedUserId} attempted to delete completed tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only delete tasks from your own objectives.' });
        }

        await pool.execute(`DELETE FROM tasks WHERE objectives_idObjectives = ? AND completed = 1`, [
            idObjective,
        ]);

        return res.status(200).json({ message: 'Completed tasks deleted successfully.' });

    } catch (error) {
        console.error('Error deleting completed tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get a single task by its ID
 */
export const getTaskById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idTask } = req.body as {
            idTask?: number;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idTask) {
            return res.status(400).json({ message: 'idTask is required.' });
        }

        const [taskRows] = await pool.query<RowDataPacket[]>(
            `SELECT t.idTask, t.objectives_idObjectives, t.completed, t.title, t.isFavorite, t.isPinned, l.Users_idUsers
             FROM tasks t
             JOIN objectives o ON t.objectives_idObjectives = o.idObjectives
             JOIN library l ON o.library_idLibrary = l.idLibrary
             WHERE t.idTask = ?`,
            [idTask]
        );

        if (taskRows.length === 0) {
            return res.status(404).json({ message: 'Task not found.' });
        }

        if (taskRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to view task ${idTask} owned by user ${taskRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view your own tasks.' });
        }

        return res.status(200).json({ task: taskRows[0] });

    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};