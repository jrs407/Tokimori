const OBJECTIVES_API_URL = 'http://localhost:8004';

export interface Objective {
  idObjectives: number;
  library_idLibrary: number;
  title: string;
  description?: string;
  colour?: number;
  isFavorite?: number | boolean;
  isPinned?: number | boolean;
}

export interface Task {
  idTask: number;
  objectives_idObjectives: number;
  title: string;
  completed: number | boolean;
  isFavorite?: number | boolean;
  isPinned?: number | boolean;
  orderIndex?: number;
}

interface RawObjective {
  idObjectives: number;
  library_idLibrary: number;
  title: string;
  description?: string;
  colour?: number;
  isFavorite?: number | boolean;
  isPinned?: number | boolean;
}

interface RawTask {
  idTask: number;
  objectives_idObjectives: number;
  title: string;
  completed: number | boolean;
  isFavorite?: number | boolean;
  isPinned?: number | boolean;
}

const normalizeObjective = (o: RawObjective): Objective => ({
  ...o,
  isFavorite: Boolean(o.isFavorite),
  isPinned: Boolean(o.isPinned),
});

const normalizeTask = (t: RawTask): Task => ({
  ...t,
  completed: Boolean(t.completed),
  isFavorite: Boolean(t.isFavorite),
  isPinned: Boolean(t.isPinned),
});

export const objectivesService = {
  getObjectivesByLibrary: async (token: string, idLibrary: number): Promise<Objective[]> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/listByLibrary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary }),
    });
    if (!response.ok) throw new Error('Error al obtener los objetivos');
    const data = await response.json() as { objectives: RawObjective[] };
    return (data.objectives || []).map(normalizeObjective);
  },

  createObjective: async (token: string, idLibrary: number, title: string, description?: string): Promise<number> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idLibrary, title, description }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(err?.message || 'Error al crear el objetivo');
    }
    const data = await response.json() as { objectiveId: number };
    return data.objectiveId;
  },

  deleteObjective: async (token: string, idObjective: number): Promise<void> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idObjective }),
    });
    if (!response.ok) throw new Error('Error al eliminar el objetivo');
  },

  getTasksByObjective: async (token: string, idObjective: number): Promise<Task[]> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/tasksByObjective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idObjective }),
    });
    if (!response.ok) throw new Error('Error al obtener las tareas');
    const data = await response.json() as { tasks: RawTask[] };
    return (data.tasks || []).map(normalizeTask);
  },

  createTask: async (token: string, idObjective: number, title: string): Promise<number> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idObjective, title }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(err?.message || 'Error al crear la tarea');
    }
    const data = await response.json() as { taskId: number };
    return data.taskId;
  },

  updateTask: async (token: string, idTask: number, fields: { completed?: boolean; title?: string }): Promise<void> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/updateTask`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idTask, ...fields }),
    });
    if (!response.ok) throw new Error('Error al actualizar la tarea');
  },

  deleteTask: async (token: string, idTask: number): Promise<void> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/deleteTask`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idTask }),
    });
    if (!response.ok) throw new Error('Error al eliminar la tarea');
  },

  updateObjective: async (
    token: string,
    idObjective: number,
    fields: { title?: string; description?: string; isPinned?: boolean; isFavorite?: boolean }
  ): Promise<void> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/update`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idObjective, ...fields }),
    });
    if (!response.ok) throw new Error('Error al actualizar el objetivo');
  },

  markAllTasksCompleted: async (token: string, idObjective: number): Promise<void> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/tasksByObjective/markCompleted`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idObjective }),
    });
    if (!response.ok) throw new Error('Error al completar las tareas');
  },

  markAllTasksIncomplete: async (token: string, idObjective: number): Promise<void> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/tasksByObjective/markIncomplete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idObjective }),
    });
    if (!response.ok) throw new Error('Error al descompletar las tareas');
  },

  reorderTasks: async (token: string, idObjective: number, taskIds: number[]): Promise<void> => {
    const response = await fetch(`${OBJECTIVES_API_URL}/objectives/reorderTasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ idObjective, taskIds }),
    });
    if (!response.ok) throw new Error('Error al reordenar las tareas');
  },
};
