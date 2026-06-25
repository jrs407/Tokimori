const CANVAS_API_URL = 'http://localhost:8004';

export interface CanvasBoardDB {
  idcanvas: number;
  library_idLibrary: number;
  title: string;
  contenido: string | null;
}

export const canvasService = {
  getByLibrary: async (token: string, idLibrary: number): Promise<CanvasBoardDB[]> => {
    const res = await fetch(`${CANVAS_API_URL}/canvas/listByLibrary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary }),
    });
    if (!res.ok) throw new Error('Error al obtener los canvas');
    const data = await res.json() as { boards: CanvasBoardDB[] };
    return data.boards ?? [];
  },

  create: async (token: string, idLibrary: number, title: string): Promise<number> => {
    const res = await fetch(`${CANVAS_API_URL}/canvas/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary, title }),
    });
    if (!res.ok) throw new Error('Error al crear el canvas');
    const data = await res.json() as { canvasId: number };
    return data.canvasId;
  },

  update: async (token: string, idCanvas: number, fields: { title?: string; contenido?: string }): Promise<void> => {
    const res = await fetch(`${CANVAS_API_URL}/canvas/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idCanvas, ...fields }),
    });
    if (!res.ok) throw new Error('Error al actualizar el canvas');
  },

  delete: async (token: string, idCanvas: number): Promise<void> => {
    const res = await fetch(`${CANVAS_API_URL}/canvas/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idCanvas }),
    });
    if (!res.ok) throw new Error('Error al eliminar el canvas');
  },
};
