import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../db';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * Create a new session record for a specific library entry
 */
export const createSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idLibrary, minutes } = req.body as {
      idLibrary?: number;
      minutes?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idLibrary || minutes === undefined) {
      return res.status(400).json({ message: 'idLibrary and minutes are required.' });
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
        `Security: User ${authenticatedUserId} attempted to create session for library ${idLibrary}.`
      );
      return res.status(403).json({ message: 'You can only create sessions in your own library.' });
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO sessions (library_idLibrary, minutes) VALUES (?, ?)',
      [idLibrary, minutes]
    );

    // update library totalHours (stored in hours) by adding minutes/60
    await pool.execute(
      'UPDATE library SET totalHours = totalHours + (?/60) WHERE idLibrary = ?',
      [minutes, idLibrary]
    );

    // fetch updated totalHours to return to client
    const [libRows] = await pool.query<RowDataPacket[]>(
      'SELECT totalHours FROM library WHERE idLibrary = ?',
      [idLibrary]
    );

    const updatedTotalHours = libRows[0]?.totalHours ?? null;

    return res.status(201).json({
      message: 'Session created successfully.',
      sessionId: result.insertId,
      totalHours: updatedTotalHours
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get the game the user has played the most (total minutes/hours)
 */
export const getMostPlayedGameByUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUser } = req.body as { idUser?: number };

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
        `Security: User ${authenticatedUserId} attempted to get most played game for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own data.' });
    }

    // Use the persisted `totalHours` in `library` as the canonical source
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT l.Games_idGames AS idGame, g.name AS gameName, l.totalHours AS totalHours, ROUND(l.totalHours * 60) AS totalMinutes
       FROM library l
       JOIN games g ON l.Games_idGames = g.idGames
       WHERE l.Users_idUsers = ?
       ORDER BY l.totalHours DESC
       LIMIT 1`,
      [idUser]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No library entries found for user.' });
    }

    const top = rows[0];
    return res.status(200).json({
      idGame: top.idGame,
      gameName: top.gameName,
      totalMinutes: Number(top.totalMinutes ?? 0),
      totalHours: Number(top.totalHours ?? 0)
    });

  } catch (error) {
    console.error('Error fetching most played game for user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Count sessions for a given user and game
 */
export const getSessionCountByUserGame = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUser, idGame } = req.body as {
      idUser?: number;
      idGame?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUser || !idGame) {
      return res.status(400).json({ message: 'idUser and idGame are required.' });
    }

    if (idUser !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to count sessions for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own session counts.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ? AND l.Games_idGames = ?`,
      [idUser, idGame]
    );

    const count = rows[0]?.count ?? 0;
    return res.status(200).json({ count });

  } catch (error) {
    console.error('Error counting sessions by user/game:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Count all sessions for a given user (across all games)
 */
export const getSessionCountByUser = async (req: AuthenticatedRequest, res: Response) => {
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
        `Security: User ${authenticatedUserId} attempted to count sessions for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own session counts.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ?`,
      [idUser]
    );

    const count = rows[0]?.count ?? 0;
    return res.status(200).json({ count });

  } catch (error) {
    console.error('Error counting sessions by user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get average hours played for a user-game combination
 */
export const getAverageHoursByUserGame = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUser, idGame } = req.body as {
      idUser?: number;
      idGame?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUser || !idGame) {
      return res.status(400).json({ message: 'idUser and idGame are required.' });
    }

    if (idUser !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to get average hours for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own averages.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT AVG(s.minutes) as avgMinutes
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ? AND l.Games_idGames = ?`,
      [idUser, idGame]
    );

    const avgMinutes = rows[0]?.avgMinutes ?? 0;
    const avgHours = parseFloat((avgMinutes / 60).toFixed(2));
    return res.status(200).json({ avgHours });

  } catch (error) {
    console.error('Error computing average hours by user/game:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get average hours played for a user across all games
 */
export const getAverageHoursByUser = async (req: AuthenticatedRequest, res: Response) => {
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
        `Security: User ${authenticatedUserId} attempted to get average hours for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own averages.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT AVG(s.minutes) as avgMinutes
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ?`,
      [idUser]
    );

    const avgMinutes = rows[0]?.avgMinutes ?? 0;
    const avgHours = parseFloat((avgMinutes / 60).toFixed(2));
    return res.status(200).json({ avgHours });

  } catch (error) {
    console.error('Error computing average hours by user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Retrieve a single session's details by its ID
 */
export const getSessionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idSession } = req.body as {
      idSession?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idSession) {
      return res.status(400).json({ message: 'idSession is required.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.idSessions, s.library_idLibrary, s.date, s.minutes, l.Users_idUsers, l.Games_idGames
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE s.idSessions = ?`,
      [idSession]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    const session = rows[0];

    if (session.Users_idUsers !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to access session ${idSession} owned by user ${session.Users_idUsers}.`
      );
      return res.status(403).json({ message: 'You can only view your own sessions.' });
    }

    return res.status(200).json({ session });

  } catch (error) {
    console.error('Error fetching session by id:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Average hours per weekday for a user-game combination
 * Returns an array sorted by dayOfWeek (1=Sunday..7=Saturday)
 */
export const getDailyAverageHoursByUserGame = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUser, idGame } = req.body as {
      idUser?: number;
      idGame?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUser || !idGame) {
      return res.status(400).json({ message: 'idUser and idGame are required.' });
    }

    if (idUser !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to get daily averages for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own daily averages.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DAYOFWEEK(s.date) AS dayOfWeek, AVG(s.minutes) AS avgMinutes
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ? AND l.Games_idGames = ?
       GROUP BY DAYOFWEEK(s.date)
       ORDER BY DAYOFWEEK(s.date)`,
      [idUser, idGame]
    );

    const result = rows.map(r => ({ dayOfWeek: r.dayOfWeek, avgHours: parseFloat((r.avgMinutes/60).toFixed(2)) }));
    return res.status(200).json({ dailyAverages: result });

  } catch (error) {
    console.error('Error computing daily average hours by user/game:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Average hours per weekday for a user across all games
 */
export const getDailyAverageHoursByUser = async (req: AuthenticatedRequest, res: Response) => {
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
        `Security: User ${authenticatedUserId} attempted to get daily averages for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own daily averages.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DAYOFWEEK(s.date) AS dayOfWeek, AVG(s.minutes) AS avgMinutes
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ?
       GROUP BY DAYOFWEEK(s.date)
       ORDER BY DAYOFWEEK(s.date)`,
      [idUser]
    );

    const result = rows.map(r => ({ dayOfWeek: r.dayOfWeek, avgHours: parseFloat((r.avgMinutes/60).toFixed(2)) }));
    return res.status(200).json({ dailyAverages: result });

  } catch (error) {
    console.error('Error computing daily average hours by user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// helper mapping
const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

/**
 * Determine which weekday has the highest average hours for user+game
 */
export const getFavoriteDayByUserGame = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUser, idGame } = req.body as {
      idUser?: number;
      idGame?: number;
    };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUser || !idGame) {
      return res.status(400).json({ message: 'idUser and idGame are required.' });
    }

    if (idUser !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to get favorite day for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own favorite days.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DAYOFWEEK(s.date) AS dayOfWeek, AVG(s.minutes) AS avgMinutes
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ? AND l.Games_idGames = ?
       GROUP BY DAYOFWEEK(s.date)
       ORDER BY avgMinutes DESC
       LIMIT 1`,
      [idUser, idGame]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No sessions found.' });
    }

    const { dayOfWeek } = rows[0];
    const name = dayNames[dayOfWeek - 1];
    return res.status(200).json({ dayOfWeek, dayName: name });

  } catch (error) {
    console.error('Error determining favorite day by user/game:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Determine which weekday has the highest average hours for a user overall
 */
export const getFavoriteDayByUser = async (req: AuthenticatedRequest, res: Response) => {
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
        `Security: User ${authenticatedUserId} attempted to get favorite day for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own favorite days.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DAYOFWEEK(s.date) AS dayOfWeek, AVG(s.minutes) AS avgMinutes
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ?
       GROUP BY DAYOFWEEK(s.date)
       ORDER BY avgMinutes DESC
       LIMIT 1`,
      [idUser]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No sessions found.' });
    }

    const { dayOfWeek } = rows[0];
    const name = dayNames[dayOfWeek - 1];
    return res.status(200).json({ dayOfWeek, dayName: name });

  } catch (error) {
    console.error('Error determining favorite day by user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get total hours played for each of the last 7 days for a user+game
 * Returns an array of objects [{ date: '2026-03-01', hours: 1.50 }, ...] ordered from oldest to newest
 */
export const getLast7DaysByUserGame = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUser, idGame } = req.body as { idUser?: number; idGame?: number };

    const authenticatedUserId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    if (!authenticatedUserId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    if (!idUser || !idGame) {
      return res.status(400).json({ message: 'idUser and idGame are required.' });
    }

    if (idUser !== authenticatedUserId && !isAdmin) {
      console.warn(
        `Security: User ${authenticatedUserId} attempted to get last7 days for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own data.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(s.date) AS dayDate, IFNULL(SUM(s.minutes),0) AS totalMinutes
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ? AND l.Games_idGames = ? AND s.date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(s.date)
       ORDER BY DATE(s.date)`,
      [idUser, idGame]
    );

    // build a map day -> minutes
    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.dayDate as string] = Number(r.totalMinutes ?? 0);
    }

    // construct last 7 days array (oldest -> newest)
    const result: Array<{ date: string; hours: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      const minutes = map[key] ?? 0;
      const hours = parseFloat((minutes / 60).toFixed(2));
      result.push({ date: key, hours });
    }

    return res.status(200).json({ last7Days: result });

  } catch (error) {
    console.error('Error fetching last7 days by user/game:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get total hours played for each of the last 7 days for a user (all games)
 */
export const getLast7DaysByUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idUser } = req.body as { idUser?: number };

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
        `Security: User ${authenticatedUserId} attempted to get last7 days for user ${idUser}.`
      );
      return res.status(403).json({ message: 'You can only view your own data.' });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(s.date) AS dayDate, IFNULL(SUM(s.minutes),0) AS totalMinutes
       FROM sessions s
       JOIN library l ON s.library_idLibrary = l.idLibrary
       WHERE l.Users_idUsers = ? AND s.date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(s.date)
       ORDER BY DATE(s.date)`,
      [idUser]
    );

    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.dayDate as string] = Number(r.totalMinutes ?? 0);
    }

    const result: Array<{ date: string; hours: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      const minutes = map[key] ?? 0;
      const hours = parseFloat((minutes / 60).toFixed(2));
      result.push({ date: key, hours });
    }

    return res.status(200).json({ last7Days: result });

  } catch (error) {
    console.error('Error fetching last7 days by user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

