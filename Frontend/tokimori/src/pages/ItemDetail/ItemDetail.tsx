import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { notesService, type Note } from '../../services/notes.service';
import { objectivesService, type Objective, type Task } from '../../services/objectives.service';
import styles from './ItemDetail.module.css';

type Tab = 'notes' | 'checklist' | 'canvas';
type NoteFilter = 'all' | 'favorites' | 'pinned';
type ObjFilter = 'all' | 'favorites' | 'pinned';

interface LocationState {
  itemName?: string;
  itemImg?: string;
}

const sortByPinnedThenTitle = <T extends { isPinned?: number | boolean; title: string }>(arr: T[]): T[] =>
  [...arr].sort((a, b) => {
    const ap = Boolean(a.isPinned);
    const bp = Boolean(b.isPinned);
    if (ap !== bp) return bp ? 1 : -1;
    return a.title.localeCompare(b.title);
  });

/* ─────────────────────────────────────────
   NOTES SECTION
───────────────────────────────────────── */
interface NotesSectionProps {
  idLibrary: number;
  token: string;
}

const NotesSection = ({ idLibrary, token }: NotesSectionProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [noteFilter, setNoteFilter] = useState<NoteFilter>('all');
  const [noteSearch, setNoteSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await notesService.getNotesByLibrary(token, idLibrary);
      setNotes(data);
    } catch {
      setError('Error al cargar las notas');
    } finally {
      setIsLoading(false);
    }
  }, [token, idLibrary]);

  useEffect(() => { load(); }, [load]);

  // Filtered + sorted display list — computed at render time so pin changes instantly reorder
  const displayedNotes = useMemo(() => {
    const filtered = notes.filter(n => {
      if (noteFilter === 'favorites') return Boolean(n.isFavorite);
      if (noteFilter === 'pinned') return Boolean(n.isPinned);
      return true;
    }).filter(n =>
      !noteSearch || n.title.toLowerCase().includes(noteSearch.toLowerCase())
    );
    return sortByPinnedThenTitle(filtered);
  }, [notes, noteFilter, noteSearch]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newText.trim()) return;
    setCreating(true);
    try {
      const id = await notesService.createNote(token, idLibrary, newTitle.trim(), newText.trim());
      setNotes(prev => [...prev, {
        idNotes: id, library_idLibrary: idLibrary,
        title: newTitle.trim(), text: newText.trim(),
        isFavorite: false, isPinned: false,
      }]);
      setNewTitle('');
      setNewText('');
      setShowCreate(false);
    } catch {
      setError('Error al crear la nota');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (idNote: number) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      await notesService.deleteNote(token, idNote);
      setNotes(prev => prev.filter(n => n.idNotes !== idNote));
    } catch {
      setError('Error al eliminar la nota');
    }
  };

  const startEdit = (note: Note) => {
    setEditingId(note.idNotes);
    setEditTitle(note.title);
    setEditText(note.text);
  };

  const handleSaveEdit = async (idNote: number) => {
    if (!editTitle.trim() || !editText.trim()) return;
    try {
      await notesService.updateNote(token, idNote, { title: editTitle.trim(), text: editText.trim() });
      setNotes(prev => prev.map(n =>
        n.idNotes === idNote ? { ...n, title: editTitle.trim(), text: editText.trim() } : n
      ));
      setEditingId(null);
    } catch {
      setError('Error al guardar la nota');
    }
  };

  const handleTogglePin = async (note: Note) => {
    const newVal = !note.isPinned;
    // Optimistic update — displayedNotes re-sorts automatically via useMemo
    setNotes(prev => prev.map(n => n.idNotes === note.idNotes ? { ...n, isPinned: newVal } : n));
    try {
      await notesService.updateNote(token, note.idNotes, { isPinned: newVal });
    } catch {
      setNotes(prev => prev.map(n => n.idNotes === note.idNotes ? { ...n, isPinned: note.isPinned } : n));
    }
  };

  const handleToggleFav = async (note: Note) => {
    const newVal = !note.isFavorite;
    setNotes(prev => prev.map(n => n.idNotes === note.idNotes ? { ...n, isFavorite: newVal } : n));
    try {
      await notesService.updateNote(token, note.idNotes, { isFavorite: newVal });
    } catch {
      setNotes(prev => prev.map(n => n.idNotes === note.idNotes ? { ...n, isFavorite: note.isFavorite } : n));
    }
  };

  if (isLoading) return <p className={styles.loadingText}>Cargando notas...</p>;

  return (
    <div className={styles.sectionContent}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Notas</h2>
        <button className={styles.addBtn} onClick={() => { setShowCreate(s => !s); setEditingId(null); }}>
          {showCreate ? 'Cancelar' : '+ Nueva nota'}
        </button>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <input
          className={styles.searchBarInput}
          placeholder="Buscar por título..."
          value={noteSearch}
          onChange={e => setNoteSearch(e.target.value)}
        />
        <button
          className={`${styles.filterPill} ${noteFilter === 'all' ? styles.activePill : ''}`}
          onClick={() => setNoteFilter('all')}
        >Todas</button>
        <button
          className={`${styles.filterPill} ${noteFilter === 'favorites' ? styles.activePill : ''}`}
          onClick={() => setNoteFilter('favorites')}
        >⭐ Favoritas</button>
        <button
          className={`${styles.filterPill} ${noteFilter === 'pinned' ? styles.activePill : ''}`}
          onClick={() => setNoteFilter('pinned')}
        >📌 Fijadas</button>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.scrollList}>
        {showCreate && (
          <div className={styles.createPanel}>
            <p className={styles.createPanelTitle}>Nueva nota</p>
            <div className={styles.noteEditForm}>
              <input
                className={styles.noteInput}
                placeholder="Título *"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                autoFocus
              />
              <textarea
                className={styles.noteTextarea}
                placeholder="Contenido *"
                value={newText}
                onChange={e => setNewText(e.target.value)}
                rows={4}
              />
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancelar</button>
                <button
                  className={styles.saveBtn}
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim() || !newText.trim()}
                >
                  {creating ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {notes.length === 0 && !showCreate ? (
          <div className={styles.emptyState}>
            <span>No hay notas todavía</span>
            <span style={{ fontSize: '13px' }}>Crea tu primera nota con el botón de arriba</span>
          </div>
        ) : displayedNotes.length === 0 && !showCreate ? (
          <div className={styles.emptyState}>
            <span>No hay notas con ese filtro</span>
          </div>
        ) : (
          displayedNotes.map(note => {
            const isExpanded = expandedId === note.idNotes;
            const isEditing = editingId === note.idNotes;
            let cardClass = styles.noteCard;
            if (note.isPinned) cardClass += ' ' + styles.pinned;
            else if (note.isFavorite) cardClass += ' ' + styles.favorite;

            return (
              <div key={note.idNotes} className={cardClass}>
                <div className={styles.noteCardTop}>
                  <h3 className={styles.noteTitle}>{note.title}</h3>
                  <div className={styles.noteActions}>
                    <button
                      className={`${styles.iconBtn} ${note.isPinned ? styles.active : ''}`}
                      title={note.isPinned ? 'Despinnear' : 'Pinnear'}
                      onClick={() => handleTogglePin(note)}
                    >📌</button>
                    <button
                      className={`${styles.iconBtn} ${note.isFavorite ? styles.active : ''}`}
                      title={note.isFavorite ? 'Quitar favorito' : 'Favorito'}
                      onClick={() => handleToggleFav(note)}
                    >⭐</button>
                    <button
                      className={styles.iconBtn}
                      title="Editar"
                      onClick={() => isEditing ? setEditingId(null) : startEdit(note)}
                    >✏️</button>
                    <button
                      className={styles.deleteIconBtn}
                      title="Eliminar"
                      onClick={() => handleDelete(note.idNotes)}
                    >🗑️</button>
                  </div>
                </div>

                {isEditing ? (
                  <div className={styles.noteEditForm}>
                    <input
                      className={styles.noteInput}
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                    />
                    <textarea
                      className={styles.noteTextarea}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={4}
                    />
                    <div className={styles.formActions}>
                      <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancelar</button>
                      <button
                        className={styles.saveBtn}
                        onClick={() => handleSaveEdit(note.idNotes)}
                        disabled={!editTitle.trim() || !editText.trim()}
                      >Guardar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={`${styles.noteText} ${isExpanded ? styles.expanded : ''}`}>{note.text}</p>
                    {note.text.length > 150 && (
                      <button
                        className={styles.noteExpandBtn}
                        onClick={() => setExpandedId(isExpanded ? null : note.idNotes)}
                      >
                        {isExpanded ? 'Ver menos' : 'Ver más'}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   CHECKLIST SECTION
───────────────────────────────────────── */
interface ChecklistSectionProps {
  idLibrary: number;
  token: string;
}

interface ObjectiveWithTasks extends Objective {
  tasks: Task[];
  isOpen: boolean;
  taskInput: string;
  loadingTasks: boolean;
}

const ChecklistSection = ({ idLibrary, token }: ChecklistSectionProps) => {
  const [objectives, setObjectives] = useState<ObjectiveWithTasks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [objFilter, setObjFilter] = useState<ObjFilter>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newObjTitle, setNewObjTitle] = useState('');
  const [newObjDesc, setNewObjDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await objectivesService.getObjectivesByLibrary(token, idLibrary);
      setObjectives(data.map(o => ({ ...o, tasks: [], isOpen: false, taskInput: '', loadingTasks: false })));
    } catch {
      setError('Error al cargar los objetivos');
    } finally {
      setIsLoading(false);
    }
  }, [token, idLibrary]);

  useEffect(() => { load(); }, [load]);

  // Filtered + sorted display list
  const displayedObjectives = useMemo(() => {
    const filtered = objectives.filter(o => {
      if (objFilter === 'favorites') return Boolean(o.isFavorite);
      if (objFilter === 'pinned') return Boolean(o.isPinned);
      return true;
    });
    return sortByPinnedThenTitle(filtered);
  }, [objectives, objFilter]);

  const toggleObjective = async (idObjectives: number) => {
    const obj = objectives.find(o => o.idObjectives === idObjectives);
    if (!obj) return;

    if (!obj.isOpen && obj.tasks.length === 0) {
      setObjectives(prev => prev.map(o => o.idObjectives === idObjectives ? { ...o, loadingTasks: true } : o));
      try {
        const tasks = await objectivesService.getTasksByObjective(token, idObjectives);
        setObjectives(prev => prev.map(o =>
          o.idObjectives === idObjectives ? { ...o, tasks, isOpen: true, loadingTasks: false } : o
        ));
      } catch {
        setObjectives(prev => prev.map(o => o.idObjectives === idObjectives ? { ...o, loadingTasks: false } : o));
      }
    } else {
      setObjectives(prev => prev.map(o =>
        o.idObjectives === idObjectives ? { ...o, isOpen: !o.isOpen } : o
      ));
    }
  };

  const handleToggleObjPin = async (obj: ObjectiveWithTasks) => {
    const newVal = !obj.isPinned;
    setObjectives(prev => prev.map(o =>
      o.idObjectives === obj.idObjectives ? { ...o, isPinned: newVal } : o
    ));
    try {
      await objectivesService.updateObjective(token, obj.idObjectives, { isPinned: newVal });
    } catch {
      setObjectives(prev => prev.map(o =>
        o.idObjectives === obj.idObjectives ? { ...o, isPinned: obj.isPinned } : o
      ));
    }
  };

  const handleToggleObjFav = async (obj: ObjectiveWithTasks) => {
    const newVal = !obj.isFavorite;
    setObjectives(prev => prev.map(o =>
      o.idObjectives === obj.idObjectives ? { ...o, isFavorite: newVal } : o
    ));
    try {
      await objectivesService.updateObjective(token, obj.idObjectives, { isFavorite: newVal });
    } catch {
      setObjectives(prev => prev.map(o =>
        o.idObjectives === obj.idObjectives ? { ...o, isFavorite: obj.isFavorite } : o
      ));
    }
  };

  const handleCreateObjective = async () => {
    if (!newObjTitle.trim()) return;
    setCreating(true);
    try {
      const id = await objectivesService.createObjective(
        token, idLibrary, newObjTitle.trim(), newObjDesc.trim() || undefined
      );
      const newObj: ObjectiveWithTasks = {
        idObjectives: id, library_idLibrary: idLibrary,
        title: newObjTitle.trim(), description: newObjDesc.trim() || undefined,
        isFavorite: false, isPinned: false,
        tasks: [], isOpen: true, taskInput: '', loadingTasks: false,
      };
      setObjectives(prev => [...prev, newObj]);
      setNewObjTitle('');
      setNewObjDesc('');
      setShowCreate(false);
    } catch {
      setError('Error al crear el objetivo');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteObjective = async (idObjective: number) => {
    if (!window.confirm('¿Eliminar este objetivo y todas sus tareas?')) return;
    try {
      await objectivesService.deleteObjective(token, idObjective);
      setObjectives(prev => prev.filter(o => o.idObjectives !== idObjective));
    } catch {
      setError('Error al eliminar el objetivo');
    }
  };

  const handleAddTask = async (idObjectives: number) => {
    const obj = objectives.find(o => o.idObjectives === idObjectives);
    if (!obj || !obj.taskInput.trim()) return;
    try {
      const taskId = await objectivesService.createTask(token, idObjectives, obj.taskInput.trim());
      const newTask: Task = {
        idTask: taskId, objectives_idObjectives: idObjectives,
        title: obj.taskInput.trim(), completed: false,
      };
      setObjectives(prev => prev.map(o =>
        o.idObjectives === idObjectives ? { ...o, tasks: [...o.tasks, newTask], taskInput: '' } : o
      ));
    } catch {
      setError('Error al crear la tarea');
    }
  };

  const handleToggleTask = async (idObjectives: number, task: Task) => {
    const newCompleted = !task.completed;
    setObjectives(prev => prev.map(o =>
      o.idObjectives === idObjectives
        ? { ...o, tasks: o.tasks.map(t => t.idTask === task.idTask ? { ...t, completed: newCompleted } : t) }
        : o
    ));
    try {
      await objectivesService.updateTask(token, task.idTask, { completed: newCompleted });
    } catch {
      setObjectives(prev => prev.map(o =>
        o.idObjectives === idObjectives
          ? { ...o, tasks: o.tasks.map(t => t.idTask === task.idTask ? { ...t, completed: task.completed } : t) }
          : o
      ));
    }
  };

  const handleDeleteTask = async (idObjectives: number, idTask: number) => {
    try {
      await objectivesService.deleteTask(token, idTask);
      setObjectives(prev => prev.map(o =>
        o.idObjectives === idObjectives ? { ...o, tasks: o.tasks.filter(t => t.idTask !== idTask) } : o
      ));
    } catch {
      setError('Error al eliminar la tarea');
    }
  };

  const handleMarkAll = async (idObjectives: number, completed: boolean) => {
    const prev = objectives;
    setObjectives(p => p.map(o =>
      o.idObjectives === idObjectives
        ? { ...o, tasks: o.tasks.map(t => ({ ...t, completed })) }
        : o
    ));
    try {
      if (completed) {
        await objectivesService.markAllTasksCompleted(token, idObjectives);
      } else {
        await objectivesService.markAllTasksIncomplete(token, idObjectives);
      }
    } catch {
      setError(completed ? 'Error al completar todas las tareas' : 'Error al descompletar las tareas');
      setObjectives(prev);
    }
  };

  if (isLoading) return <p className={styles.loadingText}>Cargando checklist...</p>;

  return (
    <div className={styles.sectionContent}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Checklist</h2>
        <button className={styles.addBtn} onClick={() => setShowCreate(s => !s)}>
          {showCreate ? 'Cancelar' : '+ Nuevo objetivo'}
        </button>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <button
          className={`${styles.filterPill} ${objFilter === 'all' ? styles.activePill : ''}`}
          onClick={() => setObjFilter('all')}
        >Todos</button>
        <button
          className={`${styles.filterPill} ${objFilter === 'favorites' ? styles.activePill : ''}`}
          onClick={() => setObjFilter('favorites')}
        >⭐ Favoritos</button>
        <button
          className={`${styles.filterPill} ${objFilter === 'pinned' ? styles.activePill : ''}`}
          onClick={() => setObjFilter('pinned')}
        >📌 Fijados</button>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.scrollList}>
        {showCreate && (
          <div className={styles.createObjectivePanel}>
            <p className={styles.createPanelTitle}>Nuevo objetivo</p>
            <div className={styles.noteEditForm}>
              <input
                className={styles.noteInput}
                placeholder="Título del objetivo *"
                value={newObjTitle}
                onChange={e => setNewObjTitle(e.target.value)}
                autoFocus
              />
              <input
                className={styles.noteInput}
                placeholder="Descripción (opcional)"
                value={newObjDesc}
                onChange={e => setNewObjDesc(e.target.value)}
              />
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancelar</button>
                <button
                  className={styles.saveBtn}
                  onClick={handleCreateObjective}
                  disabled={creating || !newObjTitle.trim()}
                >
                  {creating ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {objectives.length === 0 && !showCreate ? (
          <div className={styles.emptyState}>
            <span>No hay objetivos todavía</span>
            <span style={{ fontSize: '13px' }}>Crea tu primer objetivo con el botón de arriba</span>
          </div>
        ) : displayedObjectives.length === 0 && !showCreate ? (
          <div className={styles.emptyState}>
            <span>No hay objetivos con ese filtro</span>
          </div>
        ) : (
          displayedObjectives.map(obj => {
            const completedCount = obj.tasks.filter(t => t.completed).length;
            const totalCount = obj.tasks.length;

            return (
              <div key={obj.idObjectives} className={styles.objectiveCard}>
                <div className={styles.objectiveHeader} onClick={() => toggleObjective(obj.idObjectives)}>
                  <span className={`${styles.objectiveChevron} ${obj.isOpen ? styles.open : ''}`}>▶</span>
                  <div className={styles.objectiveInfo}>
                    <p className={styles.objectiveName}>{obj.title}</p>
                    {obj.description && <p className={styles.objectiveDesc}>{obj.description}</p>}
                  </div>
                  {obj.isOpen && totalCount > 0 && (
                    <span className={`${styles.objectiveProgress} ${completedCount === totalCount ? styles.progressDone : ''}`}>
                      {completedCount}/{totalCount}
                    </span>
                  )}
                  {/* Action buttons — stopPropagation so they don't toggle expand */}
                  <button
                    className={`${styles.iconBtn} ${obj.isPinned ? styles.active : ''}`}
                    title={obj.isPinned ? 'Despinnear' : 'Pinnear'}
                    onClick={e => { e.stopPropagation(); handleToggleObjPin(obj); }}
                  >📌</button>
                  <button
                    className={`${styles.iconBtn} ${obj.isFavorite ? styles.active : ''}`}
                    title={obj.isFavorite ? 'Quitar favorito' : 'Favorito'}
                    onClick={e => { e.stopPropagation(); handleToggleObjFav(obj); }}
                  >⭐</button>
                  <button
                    className={styles.objectiveDeleteBtn}
                    title="Eliminar objetivo"
                    onClick={e => { e.stopPropagation(); handleDeleteObjective(obj.idObjectives); }}
                  >🗑️</button>
                </div>

                {obj.loadingTasks && (
                  <p className={styles.loadingText} style={{ padding: '10px 16px', margin: 0 }}>
                    Cargando...
                  </p>
                )}

                {obj.isOpen && !obj.loadingTasks && (
                  <div className={styles.taskList}>
                    {/* Bulk-action buttons */}
                    {totalCount > 0 && (
                      <div className={styles.taskListActions}>
                        <button
                          className={styles.smallActionBtn}
                          onClick={() => handleMarkAll(obj.idObjectives, true)}
                          disabled={completedCount === totalCount}
                        >
                          ✓ Completar todo
                        </button>
                        <button
                          className={styles.smallActionBtn}
                          onClick={() => handleMarkAll(obj.idObjectives, false)}
                          disabled={completedCount === 0}
                        >
                          ✗ Descompletar todo
                        </button>
                      </div>
                    )}

                    {totalCount === 0 && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '8px 0' }}>
                        Sin tareas aún
                      </p>
                    )}

                    {obj.tasks.map(task => (
                      <div key={task.idTask} className={styles.taskRow}>
                        <input
                          type="checkbox"
                          className={styles.taskCheckbox}
                          checked={Boolean(task.completed)}
                          onChange={() => handleToggleTask(obj.idObjectives, task)}
                        />
                        <p className={`${styles.taskTitle} ${task.completed ? styles.done : ''}`}>
                          {task.title}
                        </p>
                        <button
                          className={styles.taskDeleteBtn}
                          onClick={() => handleDeleteTask(obj.idObjectives, task.idTask)}
                        >✕</button>
                      </div>
                    ))}

                    <div className={styles.addTaskRow}>
                      <input
                        className={styles.taskInput}
                        placeholder="Añadir tarea..."
                        value={obj.taskInput}
                        onChange={e => setObjectives(prev => prev.map(o =>
                          o.idObjectives === obj.idObjectives ? { ...o, taskInput: e.target.value } : o
                        ))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTask(obj.idObjectives); }}
                      />
                      <button
                        className={styles.addTaskBtn}
                        onClick={() => handleAddTask(obj.idObjectives)}
                        disabled={!obj.taskInput.trim()}
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   ITEM DETAIL PAGE
───────────────────────────────────────── */
export const ItemDetail = () => {
  const { idLibrary } = useParams<{ idLibrary: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('notes');

  const state = (location.state as LocationState) || {};
  const itemName = state.itemName ?? 'Elemento';
  const itemImg = state.itemImg;

  const token = localStorage.getItem('auth_token') || '';
  const libraryId = parseInt(idLibrary ?? '0', 10);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated || !libraryId) return null;

  return (
    <div className={styles.mainLayout}>
      <Sidebar />

      <div className={styles.mainContent}>
        <div className={styles.itemHeader}>
          {itemImg
            ? <img src={itemImg} alt={itemName} className={styles.itemImage} />
            : <div className={styles.itemImagePlaceholder} />
          }
          <h1 className={styles.itemTitle}>{itemName}</h1>
        </div>

        <div className={styles.tabBar}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'notes' ? styles.active : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            Notas
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'checklist' ? styles.active : ''}`}
            onClick={() => setActiveTab('checklist')}
          >
            Checklist
          </button>
          <button className={styles.tabBtn} disabled title="Próximamente">
            Canvas
          </button>
        </div>

        {activeTab === 'notes' && <NotesSection idLibrary={libraryId} token={token} />}
        {activeTab === 'checklist' && <ChecklistSection idLibrary={libraryId} token={token} />}
      </div>
    </div>
  );
};
