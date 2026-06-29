const NOTES_API_URL = 'http://localhost:8003';

export interface Note {
  idNotes: number;
  library_idLibrary: number;
  title: string;
  text: string;
  colour?: number;
  isFavorite?: number | boolean;
  isPinned?: number | boolean;
  isMinimized?: number | boolean;
}

interface RawNote {
  idNotes: number;
  library_idLibrary: number;
  title: string;
  text: string;
  colour?: number;
  isFavorite?: number | boolean;
  isPinned?: number | boolean;
  isMinimized?: number | boolean;
}

const normalizeNote = (note: RawNote): Note => ({
  ...note,
  isFavorite: Boolean(note.isFavorite),
  isPinned: Boolean(note.isPinned),
  isMinimized: Boolean(note.isMinimized),
});

export const notesService = {
  getNotesByLibrary: async (token: string, idLibrary: number): Promise<Note[]> => {
    const response = await fetch(`${NOTES_API_URL}/notes/listByLibrary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary }),
    });
    if (!response.ok) throw new Error('Error al obtener las notas');
    const data = await response.json() as { notes: RawNote[] };
    return (data.notes || []).map(normalizeNote);
  },

  createNote: async (token: string, idLibrary: number, title: string, text: string): Promise<number> => {
    const response = await fetch(`${NOTES_API_URL}/notes/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary, title, text }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(err?.message || 'Error al crear la nota');
    }
    const data = await response.json() as { noteId: number };
    return data.noteId;
  },

  updateNote: async (
    token: string,
    idNote: number,
    fields: { title?: string; text?: string; isFavorite?: boolean; isPinned?: boolean; isMinimized?: boolean }
  ): Promise<void> => {
    const response = await fetch(`${NOTES_API_URL}/notes/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idNote, ...fields }),
    });
    if (!response.ok) throw new Error('Error al actualizar la nota');
  },

  deleteNote: async (token: string, idNote: number): Promise<void> => {
    const response = await fetch(`${NOTES_API_URL}/notes/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idNote }),
    });
    if (!response.ok) throw new Error('Error al eliminar la nota');
  },
};
