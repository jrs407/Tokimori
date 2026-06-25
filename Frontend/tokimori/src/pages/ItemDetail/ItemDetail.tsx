import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { notesService, type Note } from '../../services/notes.service';
import { objectivesService, type Objective, type Task } from '../../services/objectives.service';
import { sessionService, type DayData } from '../../services/session.service';
import { timerStorage, computeRemaining, computeProgress } from '../../services/timer.storage';
import { CanvasSection } from './CanvasSection';
import styles from './ItemDetail.module.css';

type Tab = 'notes' | 'checklist' | 'sessions' | 'canvas';
type NoteFilter = 'all' | 'favorites' | 'pinned';
type ObjFilter = 'all' | 'favorites' | 'pinned';

interface LocationState {
  itemName?: string;
  itemImg?: string;
  idGame?: number;
  totalHours?: number;
  activeTab?: Tab;
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
interface NotesSectionProps { idLibrary: number; token: string; }

const NOTE_TITLE_MAX = 200;
const NOTE_TEXT_MAX  = 3000;
const noteCC = (len: number, max: number) =>
  len >= max ? styles.charDanger : len >= Math.floor(max * 0.85) ? styles.charWarn : '';

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

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await notesService.getNotesByLibrary(token, idLibrary);
      setNotes(data);
    } catch { setError('Error al cargar las notas'); }
    finally { setIsLoading(false); }
  }, [token, idLibrary]);

  useEffect(() => { load(); }, [load]);

  const displayedNotes = useMemo(() => {
    const filtered = notes
      .filter(n => {
        if (noteFilter === 'favorites') return Boolean(n.isFavorite);
        if (noteFilter === 'pinned') return Boolean(n.isPinned);
        return true;
      })
      .filter(n => !noteSearch || n.title.toLowerCase().includes(noteSearch.toLowerCase()));
    return sortByPinnedThenTitle(filtered);
  }, [notes, noteFilter, noteSearch]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newText.trim()) return;
    setCreating(true);
    try {
      const id = await notesService.createNote(token, idLibrary, newTitle.trim(), newText.trim());
      setNotes(prev => [...prev, {
        idNotes: id, library_idLibrary: idLibrary,
        title: newTitle.trim(), text: newText.trim(), isFavorite: false, isPinned: false,
      }]);
      setNewTitle(''); setNewText(''); setShowCreate(false);
    } catch { setError('Error al crear la nota'); }
    finally { setCreating(false); }
  };

  const handleDelete = async (idNote: number) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      await notesService.deleteNote(token, idNote);
      setNotes(prev => prev.filter(n => n.idNotes !== idNote));
    } catch { setError('Error al eliminar la nota'); }
  };

  const startEdit = (note: Note) => { setEditingId(note.idNotes); setEditTitle(note.title); setEditText(note.text); };

  const handleSaveEdit = async (idNote: number) => {
    if (!editTitle.trim() || !editText.trim()) return;
    try {
      await notesService.updateNote(token, idNote, { title: editTitle.trim(), text: editText.trim() });
      setNotes(prev => prev.map(n => n.idNotes === idNote ? { ...n, title: editTitle.trim(), text: editText.trim() } : n));
      setEditingId(null);
    } catch { setError('Error al guardar la nota'); }
  };

  const handleTogglePin = async (note: Note) => {
    const newVal = !note.isPinned;
    setNotes(prev => prev.map(n => n.idNotes === note.idNotes ? { ...n, isPinned: newVal } : n));
    try { await notesService.updateNote(token, note.idNotes, { isPinned: newVal }); }
    catch { setNotes(prev => prev.map(n => n.idNotes === note.idNotes ? { ...n, isPinned: note.isPinned } : n)); }
  };

  const handleToggleFav = async (note: Note) => {
    const newVal = !note.isFavorite;
    setNotes(prev => prev.map(n => n.idNotes === note.idNotes ? { ...n, isFavorite: newVal } : n));
    try { await notesService.updateNote(token, note.idNotes, { isFavorite: newVal }); }
    catch { setNotes(prev => prev.map(n => n.idNotes === note.idNotes ? { ...n, isFavorite: note.isFavorite } : n)); }
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
      <div className={styles.filterBar}>
        <input className={styles.searchBarInput} placeholder="Buscar por título..." value={noteSearch} onChange={e => setNoteSearch(e.target.value)} />
        <button className={`${styles.filterPill} ${noteFilter === 'all' ? styles.activePill : ''}`} onClick={() => setNoteFilter('all')}>Todas</button>
        <button className={`${styles.filterPill} ${noteFilter === 'favorites' ? styles.activePill : ''}`} onClick={() => setNoteFilter('favorites')}>⭐ Favoritas</button>
        <button className={`${styles.filterPill} ${noteFilter === 'pinned' ? styles.activePill : ''}`} onClick={() => setNoteFilter('pinned')}>📌 Fijadas</button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      <div className={styles.scrollList}>
        {showCreate && (
          <div className={styles.createPanel}>
            <p className={styles.createPanelTitle}>Nueva nota</p>
            <div className={styles.noteEditForm}>
              <input className={styles.noteInput} placeholder="Título *" value={newTitle} maxLength={NOTE_TITLE_MAX}
                onChange={e => setNewTitle(e.target.value)} autoFocus />
              <span className={`${styles.charCounter} ${noteCC(newTitle.length, NOTE_TITLE_MAX)}`}>{newTitle.length} / {NOTE_TITLE_MAX}</span>
              <textarea className={styles.noteTextarea} placeholder="Contenido *" value={newText} maxLength={NOTE_TEXT_MAX} rows={4}
                onChange={e => setNewText(e.target.value)} />
              <span className={`${styles.charCounter} ${noteCC(newText.length, NOTE_TEXT_MAX)}`}>{newText.length} / {NOTE_TEXT_MAX}</span>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancelar</button>
                <button className={styles.saveBtn} onClick={handleCreate} disabled={creating || !newTitle.trim() || !newText.trim()}>{creating ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        )}
        {notes.length === 0 && !showCreate ? (
          <div className={styles.emptyState}><span>No hay notas todavía</span><span style={{ fontSize: '13px' }}>Crea tu primera nota con el botón de arriba</span></div>
        ) : displayedNotes.length === 0 && !showCreate ? (
          <div className={styles.emptyState}><span>No hay notas con ese filtro</span></div>
        ) : (
          displayedNotes.map(note => {
            const isEditing = editingId === note.idNotes;
            let cardClass = styles.noteCard;
            if (note.isPinned) cardClass += ' ' + styles.pinned;
            else if (note.isFavorite) cardClass += ' ' + styles.favorite;
            return (
              <div key={note.idNotes} className={cardClass}>
                <div className={styles.noteCardTop}>
                  <h3 className={styles.noteTitle}>{note.title}</h3>
                  <div className={styles.noteActions}>
                    <button className={`${styles.iconBtn} ${note.isPinned ? styles.active : ''}`} title={note.isPinned ? 'Despinnear' : 'Pinnear'} onClick={() => handleTogglePin(note)}>📌</button>
                    <button className={`${styles.iconBtn} ${note.isFavorite ? styles.active : ''}`} title={note.isFavorite ? 'Quitar favorito' : 'Favorito'} onClick={() => handleToggleFav(note)}>⭐</button>
                    <button className={styles.iconBtn} title="Editar" onClick={() => isEditing ? setEditingId(null) : startEdit(note)}>✏️</button>
                    <button className={styles.deleteIconBtn} title="Eliminar" onClick={() => handleDelete(note.idNotes)}>🗑️</button>
                  </div>
                </div>
                {isEditing ? (
                  <div className={styles.noteEditForm}>
                    <input className={styles.noteInput} value={editTitle} maxLength={NOTE_TITLE_MAX} onChange={e => setEditTitle(e.target.value)} />
                    <span className={`${styles.charCounter} ${noteCC(editTitle.length, NOTE_TITLE_MAX)}`}>{editTitle.length} / {NOTE_TITLE_MAX}</span>
                    <textarea className={styles.noteTextarea} value={editText} maxLength={NOTE_TEXT_MAX} rows={4} onChange={e => setEditText(e.target.value)} />
                    <span className={`${styles.charCounter} ${noteCC(editText.length, NOTE_TEXT_MAX)}`}>{editText.length} / {NOTE_TEXT_MAX}</span>
                    <div className={styles.formActions}>
                      <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancelar</button>
                      <button className={styles.saveBtn} onClick={() => handleSaveEdit(note.idNotes)} disabled={!editTitle.trim() || !editText.trim()}>Guardar</button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.noteText}>{note.text}</p>
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
const OBJ_TITLE_MAX = 200;
const OBJ_DESC_MAX  = 500;
const TASK_MAX      = 200;
const clCC = (len: number, max: number) =>
  len >= max ? styles.charDanger : len >= Math.floor(max * 0.85) ? styles.charWarn : '';

interface ChecklistSectionProps { idLibrary: number; token: string; }

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
  const [objSearch, setObjSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newObjTitle, setNewObjTitle] = useState('');
  const [newObjDesc, setNewObjDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingObjId, setEditingObjId] = useState<number | null>(null);
  const [editObjTitle, setEditObjTitle] = useState('');
  const [editObjDesc, setEditObjDesc] = useState('');

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await objectivesService.getObjectivesByLibrary(token, idLibrary);
      setObjectives(data.map(o => ({ ...o, tasks: [], isOpen: false, taskInput: '', loadingTasks: false })));
    } catch { setError('Error al cargar los objetivos'); }
    finally { setIsLoading(false); }
  }, [token, idLibrary]);

  useEffect(() => { load(); }, [load]);

  const displayedObjectives = useMemo(() => {
    const filtered = objectives
      .filter(o => {
        if (objFilter === 'favorites') return Boolean(o.isFavorite);
        if (objFilter === 'pinned') return Boolean(o.isPinned);
        return true;
      })
      .filter(o => !objSearch || o.title.toLowerCase().includes(objSearch.toLowerCase()));
    return sortByPinnedThenTitle(filtered);
  }, [objectives, objFilter, objSearch]);

  const toggleObjective = async (idObjectives: number) => {
    const obj = objectives.find(o => o.idObjectives === idObjectives);
    if (!obj) return;
    if (!obj.isOpen && obj.tasks.length === 0) {
      setObjectives(prev => prev.map(o => o.idObjectives === idObjectives ? { ...o, loadingTasks: true } : o));
      try {
        const tasks = await objectivesService.getTasksByObjective(token, idObjectives);
        setObjectives(prev => prev.map(o => o.idObjectives === idObjectives ? { ...o, tasks, isOpen: true, loadingTasks: false } : o));
      } catch {
        setObjectives(prev => prev.map(o => o.idObjectives === idObjectives ? { ...o, loadingTasks: false } : o));
      }
    } else {
      setObjectives(prev => prev.map(o => o.idObjectives === idObjectives ? { ...o, isOpen: !o.isOpen } : o));
    }
  };

  const handleToggleObjPin = async (obj: ObjectiveWithTasks) => {
    const newVal = !obj.isPinned;
    setObjectives(prev => prev.map(o => o.idObjectives === obj.idObjectives ? { ...o, isPinned: newVal } : o));
    try { await objectivesService.updateObjective(token, obj.idObjectives, { isPinned: newVal }); }
    catch { setObjectives(prev => prev.map(o => o.idObjectives === obj.idObjectives ? { ...o, isPinned: obj.isPinned } : o)); }
  };

  const handleToggleObjFav = async (obj: ObjectiveWithTasks) => {
    const newVal = !obj.isFavorite;
    setObjectives(prev => prev.map(o => o.idObjectives === obj.idObjectives ? { ...o, isFavorite: newVal } : o));
    try { await objectivesService.updateObjective(token, obj.idObjectives, { isFavorite: newVal }); }
    catch { setObjectives(prev => prev.map(o => o.idObjectives === obj.idObjectives ? { ...o, isFavorite: obj.isFavorite } : o)); }
  };

  const handleCreateObjective = async () => {
    if (!newObjTitle.trim()) return;
    setCreating(true);
    try {
      const id = await objectivesService.createObjective(token, idLibrary, newObjTitle.trim(), newObjDesc.trim() || undefined);
      setObjectives(prev => [...prev, {
        idObjectives: id, library_idLibrary: idLibrary,
        title: newObjTitle.trim(), description: newObjDesc.trim() || undefined,
        isFavorite: false, isPinned: false,
        tasks: [], isOpen: true, taskInput: '', loadingTasks: false,
      }]);
      setNewObjTitle(''); setNewObjDesc(''); setShowCreate(false);
    } catch { setError('Error al crear el objetivo'); }
    finally { setCreating(false); }
  };

  const handleDeleteObjective = async (idObjective: number) => {
    if (!window.confirm('¿Eliminar este objetivo y todas sus tareas?')) return;
    try {
      await objectivesService.deleteObjective(token, idObjective);
      setObjectives(prev => prev.filter(o => o.idObjectives !== idObjective));
    } catch { setError('Error al eliminar el objetivo'); }
  };

  const startEditObj = (obj: ObjectiveWithTasks) => {
    setEditingObjId(obj.idObjectives);
    setEditObjTitle(obj.title);
    setEditObjDesc(obj.description ?? '');
  };

  const handleSaveEditObj = async (idObjective: number) => {
    if (!editObjTitle.trim()) return;
    try {
      await objectivesService.updateObjective(token, idObjective, {
        title: editObjTitle.trim(),
        description: editObjDesc.trim() || undefined,
      });
      setObjectives(prev => prev.map(o =>
        o.idObjectives === idObjective
          ? { ...o, title: editObjTitle.trim(), description: editObjDesc.trim() || undefined }
          : o
      ));
      setEditingObjId(null);
    } catch { setError('Error al guardar el objetivo'); }
  };

  const handleAddTask = async (idObjectives: number) => {
    const obj = objectives.find(o => o.idObjectives === idObjectives);
    if (!obj || !obj.taskInput.trim()) return;
    try {
      const taskId = await objectivesService.createTask(token, idObjectives, obj.taskInput.trim());
      const newTask: Task = { idTask: taskId, objectives_idObjectives: idObjectives, title: obj.taskInput.trim(), completed: false };
      setObjectives(prev => prev.map(o => o.idObjectives === idObjectives ? { ...o, tasks: [...o.tasks, newTask], taskInput: '' } : o));
    } catch { setError('Error al crear la tarea'); }
  };

  const handleToggleTask = async (idObjectives: number, task: Task) => {
    const newCompleted = !task.completed;
    setObjectives(prev => prev.map(o =>
      o.idObjectives === idObjectives ? { ...o, tasks: o.tasks.map(t => t.idTask === task.idTask ? { ...t, completed: newCompleted } : t) } : o
    ));
    try { await objectivesService.updateTask(token, task.idTask, { completed: newCompleted }); }
    catch {
      setObjectives(prev => prev.map(o =>
        o.idObjectives === idObjectives ? { ...o, tasks: o.tasks.map(t => t.idTask === task.idTask ? { ...t, completed: task.completed } : t) } : o
      ));
    }
  };

  const handleDeleteTask = async (idObjectives: number, idTask: number) => {
    try {
      await objectivesService.deleteTask(token, idTask);
      setObjectives(prev => prev.map(o => o.idObjectives === idObjectives ? { ...o, tasks: o.tasks.filter(t => t.idTask !== idTask) } : o));
    } catch { setError('Error al eliminar la tarea'); }
  };

  const handleMarkAll = async (idObjectives: number, completed: boolean) => {
    const snapshot = objectives;
    setObjectives(p => p.map(o =>
      o.idObjectives === idObjectives ? { ...o, tasks: o.tasks.map(t => ({ ...t, completed })) } : o
    ));
    try {
      if (completed) await objectivesService.markAllTasksCompleted(token, idObjectives);
      else await objectivesService.markAllTasksIncomplete(token, idObjectives);
    } catch {
      setError(completed ? 'Error al completar todas las tareas' : 'Error al descompletar las tareas');
      setObjectives(snapshot);
    }
  };

  if (isLoading) return <p className={styles.loadingText}>Cargando checklist...</p>;

  return (
    <div className={styles.sectionContent}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Checklist</h2>
        <button className={styles.addBtn} onClick={() => setShowCreate(s => !s)}>{showCreate ? 'Cancelar' : '+ Nuevo objetivo'}</button>
      </div>
      <div className={styles.filterBar}>
        <input className={styles.searchBarInput} placeholder="Buscar por título..." value={objSearch} onChange={e => setObjSearch(e.target.value)} />
        <button className={`${styles.filterPill} ${objFilter === 'all' ? styles.activePill : ''}`} onClick={() => setObjFilter('all')}>Todos</button>
        <button className={`${styles.filterPill} ${objFilter === 'favorites' ? styles.activePill : ''}`} onClick={() => setObjFilter('favorites')}>⭐ Favoritos</button>
        <button className={`${styles.filterPill} ${objFilter === 'pinned' ? styles.activePill : ''}`} onClick={() => setObjFilter('pinned')}>📌 Fijados</button>
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
      <div className={styles.scrollList}>
        {showCreate && (
          <div className={styles.createObjectivePanel}>
            <p className={styles.createPanelTitle}>Nuevo objetivo</p>
            <div className={styles.noteEditForm}>
              <input className={styles.noteInput} placeholder="Título del objetivo *" value={newObjTitle} maxLength={OBJ_TITLE_MAX} onChange={e => setNewObjTitle(e.target.value)} autoFocus />
              <span className={`${styles.charCounter} ${clCC(newObjTitle.length, OBJ_TITLE_MAX)}`}>{newObjTitle.length} / {OBJ_TITLE_MAX}</span>
              <input className={styles.noteInput} placeholder="Descripción (opcional)" value={newObjDesc} maxLength={OBJ_DESC_MAX} onChange={e => setNewObjDesc(e.target.value)} />
              <span className={`${styles.charCounter} ${clCC(newObjDesc.length, OBJ_DESC_MAX)}`}>{newObjDesc.length} / {OBJ_DESC_MAX}</span>
              <div className={styles.formActions}>
                <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancelar</button>
                <button className={styles.saveBtn} onClick={handleCreateObjective} disabled={creating || !newObjTitle.trim()}>{creating ? 'Creando...' : 'Crear'}</button>
              </div>
            </div>
          </div>
        )}
        {objectives.length === 0 && !showCreate ? (
          <div className={styles.emptyState}><span>No hay objetivos todavía</span><span style={{ fontSize: '13px' }}>Crea tu primer objetivo con el botón de arriba</span></div>
        ) : displayedObjectives.length === 0 && !showCreate ? (
          <div className={styles.emptyState}><span>No hay objetivos con ese filtro</span></div>
        ) : (
          displayedObjectives.map(obj => {
            const completedCount = obj.tasks.filter(t => t.completed).length;
            const totalCount = obj.tasks.length;
            return (
              <div key={obj.idObjectives} className={styles.objectiveCard}>
                <div className={styles.objectiveHeader} onClick={() => editingObjId !== obj.idObjectives && toggleObjective(obj.idObjectives)}>
                  <span className={`${styles.objectiveChevron} ${obj.isOpen ? styles.open : ''}`}>▶</span>
                  <div className={styles.objectiveInfo}>
                    <p className={styles.objectiveName}>{obj.title}</p>
                    {obj.description && <p className={styles.objectiveDesc}>{obj.description}</p>}
                  </div>
                  {obj.isOpen && totalCount > 0 && (
                    <span className={`${styles.objectiveProgress} ${completedCount === totalCount ? styles.progressDone : ''}`}>{completedCount}/{totalCount}</span>
                  )}
                  <button className={styles.iconBtn} title="Editar" onClick={e => { e.stopPropagation(); editingObjId === obj.idObjectives ? setEditingObjId(null) : startEditObj(obj); }}>✏️</button>
                  <button className={`${styles.iconBtn} ${obj.isPinned ? styles.active : ''}`} title={obj.isPinned ? 'Despinnear' : 'Pinnear'} onClick={e => { e.stopPropagation(); handleToggleObjPin(obj); }}>📌</button>
                  <button className={`${styles.iconBtn} ${obj.isFavorite ? styles.active : ''}`} title={obj.isFavorite ? 'Quitar favorito' : 'Favorito'} onClick={e => { e.stopPropagation(); handleToggleObjFav(obj); }}>⭐</button>
                  <button className={styles.objectiveDeleteBtn} title="Eliminar objetivo" onClick={e => { e.stopPropagation(); handleDeleteObjective(obj.idObjectives); }}>🗑️</button>
                </div>
                {editingObjId === obj.idObjectives && (
                  <div className={styles.objectiveEditForm}>
                    <input
                      className={styles.noteInput}
                      placeholder="Título *"
                      value={editObjTitle}
                      maxLength={OBJ_TITLE_MAX}
                      onChange={e => setEditObjTitle(e.target.value)}
                      autoFocus
                    />
                    <span className={`${styles.charCounter} ${clCC(editObjTitle.length, OBJ_TITLE_MAX)}`}>{editObjTitle.length} / {OBJ_TITLE_MAX}</span>
                    <input
                      className={styles.noteInput}
                      placeholder="Descripción (opcional)"
                      value={editObjDesc}
                      maxLength={OBJ_DESC_MAX}
                      onChange={e => setEditObjDesc(e.target.value)}
                    />
                    <span className={`${styles.charCounter} ${clCC(editObjDesc.length, OBJ_DESC_MAX)}`}>{editObjDesc.length} / {OBJ_DESC_MAX}</span>
                    <div className={styles.formActions}>
                      <button className={styles.cancelBtn} onClick={() => setEditingObjId(null)}>Cancelar</button>
                      <button className={styles.saveBtn} onClick={() => handleSaveEditObj(obj.idObjectives)} disabled={!editObjTitle.trim()}>Guardar</button>
                    </div>
                  </div>
                )}
                {obj.loadingTasks && <p className={styles.loadingText} style={{ padding: '10px 16px', margin: 0 }}>Cargando...</p>}
                {obj.isOpen && !obj.loadingTasks && editingObjId !== obj.idObjectives && (
                  <div className={styles.taskList}>
                    {totalCount > 0 && (
                      <div className={styles.taskListActions}>
                        <button className={styles.smallActionBtn} onClick={() => handleMarkAll(obj.idObjectives, true)} disabled={completedCount === totalCount}>✓ Completar todo</button>
                        <button className={styles.smallActionBtn} onClick={() => handleMarkAll(obj.idObjectives, false)} disabled={completedCount === 0}>✗ Descompletar todo</button>
                      </div>
                    )}
                    {totalCount === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '8px 0' }}>Sin tareas aún</p>}
                    {obj.tasks.map(task => (
                      <div key={task.idTask} className={styles.taskRow}>
                        <input type="checkbox" className={styles.taskCheckbox} checked={Boolean(task.completed)} onChange={() => handleToggleTask(obj.idObjectives, task)} />
                        <p className={`${styles.taskTitle} ${task.completed ? styles.done : ''}`}>{task.title}</p>
                        <button className={styles.taskDeleteBtn} onClick={() => handleDeleteTask(obj.idObjectives, task.idTask)}>✕</button>
                      </div>
                    ))}
                    <div className={styles.addTaskRow}>
                      <input
                        className={styles.taskInput}
                        placeholder="Añadir tarea..."
                        value={obj.taskInput}
                        maxLength={TASK_MAX}
                        onChange={e => setObjectives(prev => prev.map(o => o.idObjectives === obj.idObjectives ? { ...o, taskInput: e.target.value } : o))}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTask(obj.idObjectives); }}
                      />
                      {obj.taskInput.length > 0 && (
                        <span className={`${styles.charCounter} ${clCC(obj.taskInput.length, TASK_MAX)}`} style={{ whiteSpace: 'nowrap', alignSelf: 'center', marginLeft: 4 }}>
                          {obj.taskInput.length}/{TASK_MAX}
                        </span>
                      )}
                      <button className={styles.addTaskBtn} onClick={() => handleAddTask(obj.idObjectives)} disabled={!obj.taskInput.trim()}>Añadir</button>
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
   SESSIONS SECTION
───────────────────────────────────────── */
interface SessionsSectionProps {
  idLibrary: number;
  idGame: number | undefined;
  idUser: number | undefined;
  token: string;
  initialTotalHours: number;
  itemName: string;
  itemImg?: string;
}

interface Stats {
  sessionCount: number;
  avgHours: number;
  favoriteDay: string | null;
  last7Days: DayData[];
}

const pad = (n: number) => String(n).padStart(2, '0');

const SessionsSection = ({ idLibrary, idGame, idUser, token, initialTotalHours, itemName, itemImg }: SessionsSectionProps) => {
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(30);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [totalHours, setTotalHours] = useState(initialTotalHours);

  useEffect(() => { setTotalHours(initialTotalHours); }, [initialTotalHours]);

  /* ── Timer state (source of truth: localStorage) ── */
  const [timerHours, setTimerHours] = useState(0);
  const [timerMins, setTimerMins] = useState(25);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [remainingSecs, setRemainingSecs] = useState<number | null>(null);
  const [timerDurationSecs, setTimerDurationSecs] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Stats ── */
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const canShowStats = Boolean(idGame && idUser);
  const timerActive = timerRunning || timerPaused || remainingSecs !== null;

  /* ── Restore timer from localStorage on mount ── */
  useEffect(() => {
    const stored = timerStorage.get();
    if (!stored || stored.idLibrary !== idLibrary) return;

    const remaining = computeRemaining(stored);
    const isDone = stored.status === 'done' || (stored.status === 'running' && remaining <= 0);

    setTimerDurationSecs(stored.duration);

    if (isDone) {
      setRemainingSecs(0);
      setTimerDone(true);
      setTimerRunning(false);
      setTimerPaused(false);
      timerStorage.set({ ...stored, status: 'done', pausedRemaining: 0 });
    } else if (stored.status === 'paused') {
      setRemainingSecs(remaining);
      setTimerPaused(true);
      setTimerRunning(false);
    } else if (stored.status === 'running') {
      setRemainingSecs(remaining);
      setTimerRunning(true);
      setTimerPaused(false);
      intervalRef.current = setInterval(() => {
        setRemainingSecs(prev => {
          if (prev === null || prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setTimerRunning(false);
            setTimerDone(true);
            const s = timerStorage.get();
            if (s) timerStorage.set({ ...s, status: 'done', pausedRemaining: 0 });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  /* ── Stats loading with allSettled ── */
  const loadStats = useCallback(async () => {
    if (!canShowStats || !idGame || !idUser) return;
    setStatsLoading(true);
    setStatsError('');
    try {
      const [countRes, avgRes, favDayRes, last7Res] = await Promise.allSettled([
        sessionService.getSessionCount(token, Number(idUser), Number(idGame)),
        sessionService.getAverageHours(token, Number(idUser), Number(idGame)),
        sessionService.getFavoriteDay(token, Number(idUser), Number(idGame)),
        sessionService.getLast7Days(token, Number(idUser), Number(idGame)),
      ]);

      const anyFailed = [countRes, avgRes, favDayRes, last7Res].some(r => r.status === 'rejected');
      if (anyFailed) {
        const firstError = [countRes, avgRes, favDayRes, last7Res]
          .find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        console.error('Stats error:', firstError?.reason);
        setStatsError('No se pudieron cargar las estadísticas. Comprueba que el servidor está activo.');
      }

      setStats({
        sessionCount: countRes.status === 'fulfilled' ? countRes.value : 0,
        avgHours: avgRes.status === 'fulfilled' ? avgRes.value : 0,
        favoriteDay: favDayRes.status === 'fulfilled' ? (favDayRes.value?.dayName ?? null) : null,
        last7Days: last7Res.status === 'fulfilled' ? last7Res.value : [],
      });
    } catch (err) {
      console.error('loadStats unexpected error:', err);
      setStatsError('Error inesperado al cargar las estadísticas.');
    } finally {
      setStatsLoading(false);
    }
  }, [token, idUser, idGame, canShowStats]);

  useEffect(() => { loadStats(); }, [loadStats]);

  /* ── Save session helper ── */
  const saveSession = async (minutes: number) => {
    if (minutes <= 0) return;
    setSaving(true);
    try {
      const result = await sessionService.createSession(token, idLibrary, minutes);
      setTotalHours(Number(result.totalHours));
      setSaveMsg(`✓ Sesión de ${minutes} min guardada`);
      setTimeout(() => setSaveMsg(''), 3000);
      await loadStats();
    } catch {
      setSaveMsg('✗ Error al guardar la sesión');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally { setSaving(false); }
  };

  const handleManualSave = () => saveSession(manualHours * 60 + manualMinutes);

  /* ── Timer controls ── */
  const startTimer = () => {
    const secs = timerHours * 3600 + timerMins * 60;
    if (secs <= 0) return;
    timerStorage.set({
      endTime: Date.now() + secs * 1000,
      pausedRemaining: secs,
      duration: secs,
      status: 'running',
      idLibrary,
      itemName,
      itemImg,
      idGame,
      totalHours,
    });
    setTimerDurationSecs(secs);
    setRemainingSecs(secs);
    setTimerDone(false);
    setTimerRunning(true);
    setTimerPaused(false);
    intervalRef.current = setInterval(() => {
      setRemainingSecs(prev => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimerRunning(false);
          setTimerDone(true);
          const s = timerStorage.get();
          if (s) timerStorage.set({ ...s, status: 'done', pausedRemaining: 0 });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pauseTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimerPaused(true);
    setTimerRunning(false);
    const s = timerStorage.get();
    if (s) timerStorage.set({ ...s, status: 'paused', pausedRemaining: remainingSecs ?? 0 });
  };

  const resumeTimer = () => {
    const remaining = remainingSecs ?? 0;
    setTimerPaused(false);
    setTimerRunning(true);
    const s = timerStorage.get();
    if (s) timerStorage.set({ ...s, status: 'running', endTime: Date.now() + remaining * 1000 });
    intervalRef.current = setInterval(() => {
      setRemainingSecs(prev => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimerRunning(false);
          setTimerDone(true);
          const st = timerStorage.get();
          if (st) timerStorage.set({ ...st, status: 'done', pausedRemaining: 0 });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerStorage.clear();
    setTimerRunning(false);
    setTimerPaused(false);
    setRemainingSecs(null);
    setTimerDone(false);
  };

  const saveTimerSession = () => {
    const elapsed = timerDurationSecs - (remainingSecs ?? 0);
    const minutes = Math.max(1, Math.round(elapsed / 60));
    saveSession(minutes);
    stopTimer();
  };

  /* ── Derived display values ── */
  const displaySecs = remainingSecs ?? (timerHours * 3600 + timerMins * 60);
  const hh = Math.floor(displaySecs / 3600);
  const mm = Math.floor((displaySecs % 3600) / 60);
  const ss = displaySecs % 60;
  const progressPct = timerDurationSecs > 0 && remainingSecs !== null
    ? computeProgress({ endTime: 0, pausedRemaining: remainingSecs, duration: timerDurationSecs, status: 'paused', idLibrary, itemName })
    : 0;

  const maxLast7 = stats ? Math.max(...stats.last7Days.map(d => d.hours), 0.1) : 0;
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className={styles.sectionContent}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Sesiones</h2>
        <span className={styles.totalHoursBadge}>⏱ {totalHours.toFixed(1)} h totales</span>
      </div>

      <div className={styles.scrollList}>
        {/* Sessions row: Manual entry (left) + Countdown timer (right) */}
        <div className={styles.sessionsRow}>

          {/* ── Manual entry ── */}
          <div className={styles.sessionCard}>
            <p className={styles.sessionCardTitle}>Registrar sesión manual</p>
            <div className={styles.timeInputRow}>
              <div className={styles.timeInputGroup}>
                <label className={styles.timeLabel}>Horas</label>
                <input type="number" min={0} max={23} className={styles.timeInput} value={manualHours}
                  onChange={e => setManualHours(Math.max(0, parseInt(e.target.value) || 0))} />
              </div>
              <span className={styles.timeSep}>:</span>
              <div className={styles.timeInputGroup}>
                <label className={styles.timeLabel}>Minutos</label>
                <input type="number" min={0} max={59} className={styles.timeInput} value={manualMinutes}
                  onChange={e => setManualMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} />
              </div>
              <button className={styles.saveBtn} onClick={handleManualSave} disabled={saving || (manualHours === 0 && manualMinutes === 0)}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            {saveMsg && <p className={saveMsg.startsWith('✓') ? styles.successMsg : styles.errorText}>{saveMsg}</p>}
          </div>

          {/* ── Countdown timer ── */}
          <div className={styles.sessionCard}>
            <p className={styles.sessionCardTitle}>Cuenta atrás automática</p>
            {!timerActive && (
              <div className={styles.timerSetup}>
                <div className={styles.timeInputRow}>
                  <div className={styles.timeInputGroup}>
                    <label className={styles.timeLabel}>Horas</label>
                    <input type="number" min={0} max={23} className={styles.timeInput} value={timerHours}
                      onChange={e => setTimerHours(Math.max(0, parseInt(e.target.value) || 0))} />
                  </div>
                  <span className={styles.timeSep}>:</span>
                  <div className={styles.timeInputGroup}>
                    <label className={styles.timeLabel}>Minutos</label>
                    <input type="number" min={0} max={59} className={styles.timeInput} value={timerMins}
                      onChange={e => setTimerMins(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} />
                  </div>
                </div>
                <button className={styles.timerStartBtn} onClick={startTimer} disabled={timerHours === 0 && timerMins === 0}>
                  ▶ Iniciar cuenta atrás
                </button>
              </div>
            )}

            {timerActive && (
              <div className={styles.timerRunning}>
                <div className={styles.timerDisplay}>{pad(hh)}:{pad(mm)}:{pad(ss)}</div>
                <div className={styles.timerProgressBar}>
                  <div className={styles.timerProgressFill} style={{ width: `${progressPct}%` }} />
                </div>
                {timerDone ? (
                  <div className={styles.timerDoneMsg}>
                    <span>¡Sesión completada! 🎉</span>
                    <div className={styles.timerActions}>
                      <button className={styles.saveBtn} onClick={saveTimerSession} disabled={saving}>{saving ? 'Guardando...' : 'Guardar sesión'}</button>
                      <button className={styles.cancelBtn} onClick={stopTimer}>Descartar</button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.timerActions}>
                    {timerRunning
                      ? <button className={styles.timerPauseBtn} onClick={pauseTimer}>⏸ Pausar</button>
                      : <button className={styles.timerStartBtn} onClick={resumeTimer}>▶ Reanudar</button>
                    }
                    <button className={styles.timerStopBtn} onClick={saveTimerSession}>⏹ Parar y guardar</button>
                    <button className={styles.cancelBtn} onClick={stopTimer}>✕ Cancelar</button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Statistics */}
        <div className={styles.statsCard}>
          <p className={styles.sessionCardTitle}>Estadísticas</p>
          {!canShowStats ? (
            <p className={styles.statsNote}>Navega desde tu colección para ver las estadísticas detalladas.</p>
          ) : statsLoading ? (
            <div className={styles.statsLoading}>
              <div className={styles.statsSpinner} />
              <span>Cargando estadísticas...</span>
            </div>
          ) : (
            <>
              {statsError && (
                <div className={styles.statsErrorBanner}>
                  <span>⚠️ {statsError}</span>
                  <button className={styles.retryBtn} onClick={loadStats}>Reintentar</button>
                </div>
              )}
              {stats && (
                <>
                  <div className={styles.statsGrid}>
                    <div className={styles.statBox}>
                      <span className={styles.statIcon}>⏱️</span>
                      <span className={styles.statValue}>{totalHours.toFixed(1)}h</span>
                      <span className={styles.statLabel}>Horas totales</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statIcon}>🎮</span>
                      <span className={styles.statValue}>{stats.sessionCount}</span>
                      <span className={styles.statLabel}>Sesiones</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statIcon}>📊</span>
                      <span className={styles.statValue}>{stats.avgHours.toFixed(1)}h</span>
                      <span className={styles.statLabel}>Media / sesión</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statIcon}>📅</span>
                      <span className={styles.statValue}>{stats.favoriteDay ?? '—'}</span>
                      <span className={styles.statLabel}>Día más activo</span>
                    </div>
                  </div>
                  {stats.last7Days.length > 0 && (
                    <div className={styles.chartSection}>
                      <p className={styles.chartTitle}>Últimos 7 días</p>
                      <div className={styles.barChart}>
                        {stats.last7Days.map(d => {
                          const pct = maxLast7 > 0 ? (d.hours / maxLast7) * 100 : 0;
                          const date = new Date(d.date + 'T12:00:00');
                          const label = dayLabels[date.getDay()];
                          return (
                            <div key={d.date} className={styles.barCol}>
                              <span className={styles.barValue}>{d.hours > 0 ? d.hours.toFixed(1) : ''}</span>
                              <div className={styles.barArea}>
                                <div
                                  className={styles.bar}
                                  style={{ height: `${Math.max(pct, 2)}%` }}
                                  title={`${d.hours.toFixed(2)}h`}
                                />
                              </div>
                              <span className={styles.barLabel}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
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

  const state = (location.state as LocationState) ?? {};
  const itemName = state.itemName ?? 'Elemento';
  const itemImg = state.itemImg;

  const [activeTab, setActiveTab] = useState<Tab>(state.activeTab ?? 'notes');
  const [canvasFull, setCanvasFull] = useState(false);
  const [resolvedIdGame, setResolvedIdGame] = useState<number | undefined>(state.idGame);
  const [resolvedTotalHours, setResolvedTotalHours] = useState<number>(state.totalHours ?? 0);

  const token = localStorage.getItem('auth_token') ?? '';
  const libraryId = parseInt(idLibrary ?? '0', 10);

  const authUser = localStorage.getItem('auth_user');
  const idUser: number | undefined = authUser
    ? (JSON.parse(authUser) as { id: number }).id
    : undefined;

  useEffect(() => { if (!isAuthenticated) navigate('/login'); }, [isAuthenticated, navigate]);

  /* Always fetch fresh totalHours and idGame from backend so the badge and stats are accurate */
  useEffect(() => {
    if (!libraryId || !token) return;
    sessionService.getTotalHoursByLibrary(token, libraryId)
      .then(data => {
        setResolvedTotalHours(data.totalHours);
        if (data.idGame) setResolvedIdGame(data.idGame);
      })
      .catch(() => { /* silently keep navigation-state values */ });
  }, [libraryId, token]);

  if (!isAuthenticated || !libraryId) return null;

  return (
    <div className={styles.mainLayout}>
      <Sidebar />
      <div className={`${styles.mainContent} ${canvasFull ? styles.canvasFull : ''}`}>
        <div className={styles.itemHeader}>
          {itemImg
            ? <img src={itemImg} alt={itemName} className={styles.itemImage} />
            : <div className={styles.itemImagePlaceholder} />
          }
          <h1 className={styles.itemTitle}>{itemName}</h1>
        </div>

        <div className={styles.tabBar}>
          <button className={`${styles.tabBtn} ${activeTab === 'notes' ? styles.active : ''}`} onClick={() => setActiveTab('notes')}>Notas</button>
          <button className={`${styles.tabBtn} ${activeTab === 'checklist' ? styles.active : ''}`} onClick={() => setActiveTab('checklist')}>Checklist</button>
          <button className={`${styles.tabBtn} ${activeTab === 'canvas' ? styles.active : ''}`} onClick={() => setActiveTab('canvas')}>Canvas</button>
          <button className={`${styles.tabBtn} ${activeTab === 'sessions' ? styles.active : ''}`} onClick={() => setActiveTab('sessions')}>Sesiones</button>
        </div>

        {activeTab === 'notes' && <NotesSection idLibrary={libraryId} token={token} />}
        {activeTab === 'checklist' && <ChecklistSection idLibrary={libraryId} token={token} />}
        {activeTab === 'canvas' && (
          <div className={styles.canvasTabWrapper}>
            <CanvasSection idLibrary={libraryId} token={token} onFullscreenChange={setCanvasFull} />
          </div>
        )}

        {/* Always mounted to keep timer alive when switching tabs */}
        <div style={{ display: activeTab === 'sessions' ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
          <SessionsSection
            idLibrary={libraryId}
            idGame={resolvedIdGame}
            idUser={idUser}
            token={token}
            initialTotalHours={resolvedTotalHours}
            itemName={itemName}
            itemImg={itemImg}
          />
        </div>
      </div>
    </div>
  );
};
