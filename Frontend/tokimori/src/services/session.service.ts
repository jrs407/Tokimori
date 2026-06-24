const SESSIONS_API_URL = 'http://localhost:8005';

export interface DayData {
  date: string;
  hours: number;
}

export const sessionService = {
  createSession: async (
    token: string,
    idLibrary: number,
    minutes: number
  ): Promise<{ sessionId: number; totalHours: number }> => {
    const response = await fetch(`${SESSIONS_API_URL}/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary, minutes }),
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
    const data = await response.json() as { dayOfWeek: number; dayName: string };
    return data;
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
};
