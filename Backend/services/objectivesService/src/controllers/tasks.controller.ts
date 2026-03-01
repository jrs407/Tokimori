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
 * Update a task
 */
export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idTask, title, completed, isFavorite, isPinned } = req.body as {
            idTask?: number;
            title?: string;
            completed?: boolean;
            isFavorite?: boolean;
            isPinned?: boolean;
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
                `Security: User ${authenticatedUserId} attempted to update task ${idTask} owned by user ${taskRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only update your own tasks.' });
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (title !== undefined) {
            updates.push('title = ?');
            values.push(title);
        }
        if (completed !== undefined) {
            updates.push('completed = ?');
            values.push(completed ? 1 : 0);
        }
        if (isFavorite !== undefined) {
            updates.push('isFavorite = ?');
            values.push(isFavorite ? 1 : 0);
        }
        if (isPinned !== undefined) {
            updates.push('isPinned = ?');
            values.push(isPinned ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update.' });
        }

        values.push(idTask);
        const query = `UPDATE tasks SET ${updates.join(', ')} WHERE idTask = ?`;
        await pool.execute(query, values);

        return res.status(200).json({ message: 'Task updated successfully.' });

    } catch (error) {
        console.error('Error updating task:', error);
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
 * Get favorite completed tasks for a specific objective
 */
export const getFavoriteCompletedTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as { idObjective?: number };
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
                `Security: User ${authenticatedUserId} attempted to view favorite completed tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND completed = 1 AND isFavorite = 1
             ORDER BY isPinned DESC, idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching favorite completed tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get favorite incomplete tasks for a specific objective
 */
export const getFavoriteIncompleteTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as { idObjective?: number };
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
                `Security: User ${authenticatedUserId} attempted to view favorite incomplete tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND completed = 0 AND isFavorite = 1
             ORDER BY isPinned DESC, idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching favorite incomplete tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get pinned completed tasks for a specific objective
 */
export const getPinnedCompletedTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as { idObjective?: number };
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
                `Security: User ${authenticatedUserId} attempted to view pinned completed tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND completed = 1 AND isPinned = 1
             ORDER BY idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching pinned completed tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get pinned incomplete tasks for a specific objective
 */
export const getPinnedIncompleteTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as { idObjective?: number };
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
                `Security: User ${authenticatedUserId} attempted to view pinned incomplete tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND completed = 0 AND isPinned = 1
             ORDER BY idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching pinned incomplete tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get all favorite tasks for a specific objective
 * Ordered by isPinned desc then idTask asc
 */
export const getAllFavoriteTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as { idObjective?: number };
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
                `Security: User ${authenticatedUserId} attempted to view all favorite tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND isFavorite = 1
             ORDER BY isPinned DESC, idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching all favorite tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get all pinned tasks for a specific objective
 * Ordered by idTask asc
 */
export const getAllPinnedTasksByObjective = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective } = req.body as { idObjective?: number };
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
                `Security: User ${authenticatedUserId} attempted to view all pinned tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only view tasks from your own objectives.' });
        }

        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND isPinned = 1
             ORDER BY idTask ASC`,
            [idObjective]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error fetching all pinned tasks:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Search tasks by title within a specific objective
 * Ordered by isPinned desc, idTask asc
 */
export const searchTasksByTitle = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { idObjective, searchTerm } = req.body as {
            idObjective?: number;
            searchTerm?: string;
        };

        const authenticatedUserId = req.user?.id;
        const isAdmin = req.user?.isAdmin;

        if (!authenticatedUserId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        if (!idObjective || searchTerm === undefined) {
            return res.status(400).json({ message: 'idObjective and searchTerm are required.' });
        }

        const [objectiveRows] = await pool.query<RowDataPacket[]>(
            'SELECT l.Users_idUsers FROM objectives o JOIN library l ON o.library_idLibrary = l.idLibrary WHERE o.idObjectives = ?',
            [idObjective]
        );

        if (objectiveRows.length === 0) {
            return res.status(404).json({ message: 'Objective not found.' });
        }

        if (objectiveRows[0].Users_idUsers !== authenticatedUserId && !isAdmin) {
            console.warn(
                `Security: User ${authenticatedUserId} attempted to search tasks for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only search tasks from your own objectives.' });
        }

        const searchPattern = `%${searchTerm}%`;
        const [tasks] = await pool.query<RowDataPacket[]>(
            `SELECT idTask, objectives_idObjectives, completed, title, isFavorite, isPinned
             FROM tasks
             WHERE objectives_idObjectives = ? AND title LIKE ?
             ORDER BY isPinned DESC, idTask ASC`,
            [idObjective, searchPattern]
        );

        return res.status(200).json({ tasks });

    } catch (error) {
        console.error('Error searching tasks by title:', error);
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
 * Mark all tasks for an objective as completed
 */
export const markAllTasksCompletedByObjective = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to mark all tasks completed for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only modify tasks in your own objectives.' });
        }

        await pool.execute(`UPDATE tasks SET completed = 1 WHERE objectives_idObjectives = ?`, [
            idObjective,
        ]);

        return res.status(200).json({ message: 'All tasks marked completed successfully.' });

    } catch (error) {
        console.error('Error marking tasks completed:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Mark all tasks for an objective as incomplete
 */
export const markAllTasksIncompleteByObjective = async (req: AuthenticatedRequest, res: Response) => {
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
                `Security: User ${authenticatedUserId} attempted to mark all tasks incomplete for objective ${idObjective} owned by user ${objectiveRows[0].Users_idUsers}.`
            );
            return res.status(403).json({ message: 'You can only modify tasks in your own objectives.' });
        }

        await pool.execute(`UPDATE tasks SET completed = 0 WHERE objectives_idObjectives = ?`, [
            idObjective,
        ]);

        return res.status(200).json({ message: 'All tasks marked incomplete successfully.' });

    } catch (error) {
        console.error('Error marking tasks incomplete:', error);
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