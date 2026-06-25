const SESSIONS_API_URL = 'http://localhost:8005';

export interface DayData {
  date: string;
  hours: number;
}

export const sessionService = {
  createSession: async (
    token: string,
    idLibrary: number,
    minutes: number,
    date?: string
  ): Promise<{ sessionId: number; totalHours: number }> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary, minutes, ...(date ? { date } : {}) }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(err?.message || 'Error al guardar la sesión');
    }
    const data = await response.json() as { sessionId: number; totalHours: number };
    return data;
  },

  getSessionCount: async (token: string, idUser: number, idGame: number): Promise<number> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/countByUserGame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser, idGame }),
    });
    if (!response.ok) throw new Error('Error al obtener el número de sesiones');
    const data = await response.json() as { count: number };
    return Number(data.count ?? 0);
  },

  getAverageHours: async (token: string, idUser: number, idGame: number): Promise<number> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/avgByUserGame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser, idGame }),
    });
    if (!response.ok) throw new Error('Error al obtener el promedio');
    const data = await response.json() as { avgHours: number };
    return Number(data.avgHours ?? 0);
  },

  getFavoriteDay: async (
    token: string,
    idUser: number,
    idGame: number
  ): Promise<{ dayOfWeek: number; dayName: string } | null> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/favoriteDayByUserGame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser, idGame }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Error al obtener el día favorito');
    const data = await response.json() as { dayOfWeek: number; dayName?: string };
    // Map locally to avoid server encoding issues (MySQL DAYOFWEEK: 1=Sun..7=Sat)
    const localNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayName = localNames[data.dayOfWeek - 1] ?? data.dayName ?? '—';
    return { dayOfWeek: data.dayOfWeek, dayName };
  },

  getTotalHoursByLibrary: async (token: string, idLibrary: number): Promise<{ totalHours: number; idGame: number }> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/totalHoursByLibrary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary }),
    });
    if (!response.ok) throw new Error('Error al obtener las horas totales');
    return response.json() as Promise<{ totalHours: number; idGame: number }>;
  },

  getLast7Days: async (token: string, idUser: number, idGame: number): Promise<DayData[]> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/last7ByUserGame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser, idGame }),
    });
    if (!response.ok) throw new Error('Error al obtener los últimos 7 días');
    const data = await response.json() as { last7Days: DayData[] };
    return data.last7Days ?? [];
  },

  /* ── Global (all games) endpoints ── */

  getGlobalSessionCount: async (token: string, idUser: number): Promise<number> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/countByUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser }),
    });
    if (!response.ok) throw new Error('Error al obtener el número de sesiones globales');
    const data = await response.json() as { count: number };
    return Number(data.count ?? 0);
  },

  getGlobalAverageHours: async (token: string, idUser: number): Promise<number> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/avgByUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser }),
    });
    if (!response.ok) throw new Error('Error al obtener el promedio global');
    const data = await response.json() as { avgHours: number };
    return Number(data.avgHours ?? 0);
  },

  getGlobalFavoriteDay: async (
    token: string,
    idUser: number
  ): Promise<{ dayOfWeek: number; dayName: string } | null> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/favoriteDayByUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Error al obtener el día favorito global');
    const data = await response.json() as { dayOfWeek: number; dayName?: string };
    const localNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayName = localNames[data.dayOfWeek - 1] ?? data.dayName ?? '—';
    return { dayOfWeek: data.dayOfWeek, dayName };
  },

  getGlobalLast7Days: async (token: string, idUser: number): Promise<DayData[]> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/last7ByUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser }),
    });
    if (!response.ok) throw new Error('Error al obtener los últimos 7 días globales');
    const data = await response.json() as { last7Days: DayData[] };
    return data.last7Days ?? [];
  },

  getMostPlayedGame: async (
    token: string,
    idUser: number
  ): Promise<{ idGame: number; gameName: string; totalHours: number; totalMinutes: number } | null> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/mostPlayedGameByUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Error al obtener el juego más jugado');
    return response.json() as Promise<{ idGame: number; gameName: string; totalHours: number; totalMinutes: number }>;
  },

  getGlobalDailyAverage: async (
    token: string,
    idUser: number
  ): Promise<Array<{ dayOfWeek: number; avgHours: number }>> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/dailyAvgByUser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idUser }),
    });
    if (!response.ok) throw new Error('Error al obtener el promedio diario global');
    const data = await response.json() as { dailyAverages: Array<{ dayOfWeek: number; avgHours: number }> };
    return data.dailyAverages ?? [];
  },
};
