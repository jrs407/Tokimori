import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { notesService, type Note } from '../../services/notes.service';
import { objectivesService, type Objective } from '../../services/objectives.service';
import { canvasService } from '../../services/canvas.service';
import styles from './CanvasSection.module.css';

/* ══════════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════════════ */
interface Point { x: number; y: number }
interface DrawPath { id: string; points: Point[]; color: string; width: number; drawAbove?: boolean }

interface CanvasElement {
  id: string;
  type: 'note' | 'checklist' | 'image';
  x: number; y: number; width: number; height: number; zIndex: number;
  noteId?: number; noteTitle?: string; noteText?: string;
  objId?: number; objTitle?: string;
  tasks?: { id: number; title: string; completed: boolean }[];
  imageSrc?: string;
}
interface CanvasBoard { id: string; name: string; paths: DrawPath[]; elements: CanvasElement[] }

type Tool = 'select' | 'draw' | 'erase';
type ResizeHandle = 'tl' | 't' | 'tr' | 'r' | 'br' | 'b' | 'bl' | 'l';

interface CtxMenu {
  sx: number; sy: number;
  cx: number; cy: number;
  elemId: string | null;
  elemType: CanvasElement['type'] | null;
  pathId: string | null;
}

interface NoteFormState { title: string; text: string; cx: number; cy: number }
interface ChecklistFormState { title: string; desc: string; cx: number; cy: number }

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════ */

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hitTestPaths(cx: number, cy: number, paths: DrawPath[], zoom: number): string | null {
  const screenThreshold = 10;
  for (const path of [...paths].reverse()) {
    const canvasThreshold = Math.max(screenThreshold / zoom, path.width / 2 + 2);
    if (path.points.length === 1) {
      if (Math.hypot(cx - path.points[0].x, cy - path.points[0].y) < canvasThreshold) return path.id;
    } else {
      for (let i = 1; i < path.points.length; i++) {
        if (distToSegment({ x: cx, y: cy }, path.points[i - 1], path.points[i]) < canvasThreshold) return path.id;
      }
    }
  }
  return null;
}

function applyResize(
  snap: { sx: number; sy: number; x: number; y: number; w: number; h: number },
  handle: ResizeHandle,
  clientX: number,
  clientY: number,
  zoom: number,
): { x: number; y: number; width: number; height: number } {
  const MIN_W = 80, MIN_H = 60;
  const dx = (clientX - snap.sx) / zoom;
  const dy = (clientY - snap.sy) / zoom;
  let x = snap.x, y = snap.y, width = snap.w, height = snap.h;

  if (handle.includes('l')) { x += dx; width -= dx; }
  if (handle.includes('r')) { width += dx; }
  if (handle.includes('t')) { y += dy; height -= dy; }
  if (handle.includes('b')) { height += dy; }

  if (width < MIN_W) { if (handle.includes('l')) x = snap.x + snap.w - MIN_W; width = MIN_W; }
  if (height < MIN_H) { if (handle.includes('t')) y = snap.y + snap.h - MIN_H; height = MIN_H; }

  return { x, y, width, height };
}

/* ══════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════ */
const DRAW_COLORS = ['#ffffff', '#667eea', '#764ba2', '#2ecc71', '#e74c3c', '#ffc107', '#00bcd4', '#ff6b9d', '#b0b0c0'];
const BRUSH_SIZES = [2, 5, 10, 18, 28];
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 5;
const ZOOM_STEP = 1.25;

/* ══════════════════════════════════════════════════════════════════
   CANVAS SECTION (outer – sidebar + board)
══════════════════════════════════════════════════════════════════════ */
interface CanvasSectionProps {
  idLibrary: number;
  token: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export const CanvasSection = ({ idLibrary, token, onFullscreenChange }: CanvasSectionProps) => {
  const [boards, setBoards]         = useState<CanvasBoard[]>([]);
  const [activeBoardId, setActive]  = useState<string | null>(null);
  const [newName, setNewName]       = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState('');
  const [sidebarHidden, setSidebar] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /* ── Load boards from DB on mount, migrate localStorage if needed ── */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const dbBoards = await canvasService.getByLibrary(token, idLibrary);
        if (cancelled) return;

        if (dbBoards.length === 0) {
          const stored = localStorage.getItem(`tokimori_canvas_${idLibrary}`);
          if (stored) {
            const localBoards: CanvasBoard[] = JSON.parse(stored);
            const migrated: CanvasBoard[] = [];
            for (const board of localBoards) {
              try {
                const id = await canvasService.create(token, idLibrary, board.name);
                await canvasService.update(token, id, {
                  contenido: JSON.stringify({ paths: board.paths, elements: board.elements }),
                });
                migrated.push({ id: id.toString(), name: board.name, paths: board.paths, elements: board.elements });
              } catch {}
            }
            if (!cancelled) {
              setBoards(migrated);
              setActive(migrated[0]?.id ?? null);
            }
            localStorage.removeItem(`tokimori_canvas_${idLibrary}`);
          }
        } else {
          const loaded = dbBoards.map(row => {
            let paths: DrawPath[] = [];
            let elements: CanvasElement[] = [];
            try {
              if (row.contenido) {
                const parsed = JSON.parse(row.contenido) as { paths?: DrawPath[]; elements?: CanvasElement[] };
                paths = parsed.paths ?? [];
                elements = parsed.elements ?? [];
              }
            } catch {}
            return { id: row.idcanvas.toString(), name: row.title, paths, elements };
          });
          if (!cancelled) {
            setBoards(loaded);
            setActive(loaded[0]?.id ?? null);
            localStorage.removeItem(`tokimori_canvas_${idLibrary}`);
          }
        }
      } catch (e) {
        console.error('Error loading canvas:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [token, idLibrary]);

  /* ── Flush pending saves on unmount ── */
  useEffect(() => {
    return () => {
      saveTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const activeBoard = boards.find(b => b.id === activeBoardId) ?? null;

  /* ── Debounced save of board content to DB ── */
  const scheduleSave = useCallback((boardId: string, board: CanvasBoard) => {
    const existing = saveTimers.current.get(boardId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      const idCanvas = parseInt(boardId);
      if (isNaN(idCanvas)) return;
      try {
        await canvasService.update(token, idCanvas, {
          contenido: JSON.stringify({ paths: board.paths, elements: board.elements }),
        });
      } catch (e) {
        console.error('Error saving canvas to DB:', e);
      }
      saveTimers.current.delete(boardId);
    }, 800);
    saveTimers.current.set(boardId, timer);
  }, [token]);

  const updateBoard = useCallback((id: string, fn: (b: CanvasBoard) => CanvasBoard) => {
    setBoards(prev => prev.map(b => {
      if (b.id !== id) return b;
      const updated = fn(b);
      scheduleSave(id, updated);
      return updated;
    }));
  }, [scheduleSave]);

  const createBoard = async () => {
    const name = newName.trim() || `Canvas ${boards.length + 1}`;
    setCreating(true);
    try {
      const id = await canvasService.create(token, idLibrary, name);
      const board: CanvasBoard = { id: id.toString(), name, paths: [], elements: [] };
      setBoards(prev => [...prev, board]);
      setActive(board.id);
      setNewName('');
    } catch (e) {
      console.error('Error creating canvas:', e);
    } finally {
      setCreating(false);
    }
  };

  const deleteBoard = async (id: string) => {
    if (!window.confirm('¿Eliminar este canvas?')) return;
    const idCanvas = parseInt(id);
    try {
      if (!isNaN(idCanvas)) await canvasService.delete(token, idCanvas);
      const next = boards.filter(b => b.id !== id);
      setBoards(next);
      if (activeBoardId === id) setActive(next[0]?.id ?? null);
    } catch (e) {
      console.error('Error deleting canvas:', e);
    }
  };

  const commitRename = async (id: string) => {
    if (!renameVal.trim()) { setRenamingId(null); return; }
    const idCanvas = parseInt(id);
    try {
      if (!isNaN(idCanvas)) await canvasService.update(token, idCanvas, { title: renameVal.trim() });
      setBoards(prev => prev.map(b => b.id === id ? { ...b, name: renameVal.trim() } : b));
    } catch (e) {
      console.error('Error renaming canvas:', e);
    }
    setRenamingId(null);
  };

  const handleToggleSidebar = () => {
    const newHidden = !sidebarHidden;
    setSidebar(newHidden);
    onFullscreenChange?.(newHidden);
  };

  return (
    <div className={styles.canvasLayout}>
      {/* ── Sidebar ── */}
      {!sidebarHidden && (
        <aside className={styles.sidebar}>
          <p className={styles.sidebarTitle}>Mis Canvas</p>
          <div className={styles.newBoardRow}>
            <input className={styles.newBoardInput} placeholder="Nombre del canvas..." value={newName}
              onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createBoard()} disabled={creating} />
            <button className={styles.newBoardBtn} onClick={createBoard} title="Crear canvas" disabled={creating}>{creating ? '...' : '+'}</button>
          </div>
          <div className={styles.boardList}>
            {loading && <p className={styles.emptyBoards}>Cargando...</p>}
            {!loading && boards.length === 0 && <p className={styles.emptyBoards}>Sin canvas todavía</p>}
            {boards.map(b => (
              <div key={b.id}
                className={`${styles.boardItem} ${b.id === activeBoardId ? styles.boardItemActive : ''}`}
                onClick={() => setActive(b.id)}
              >
                {renamingId === b.id ? (
                  <input className={styles.renameInput} value={renameVal} autoFocus
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => commitRename(b.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(b.id); if (e.key === 'Escape') setRenamingId(null); }}
                    onClick={e => e.stopPropagation()} />
                ) : (
                  <>
                    <span className={styles.boardName}><span className={styles.boardIcon}>🖼</span>{b.name}</span>
                    <span className={styles.boardMeta}>{b.paths.length + b.elements.length} obj.</span>
                    <div className={styles.boardBtns}>
                      <button className={styles.boardBtn} title="Renombrar"
                        onClick={e => { e.stopPropagation(); setRenamingId(b.id); setRenameVal(b.name); }}>✏️</button>
                      <button className={styles.boardBtn} title="Eliminar"
                        onClick={e => { e.stopPropagation(); deleteBoard(b.id); }}>🗑️</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* ── Board area ── */}
      <div className={styles.boardArea}>
        {!activeBoard
          ? (
            <div className={styles.noBoardState}>
              <span className={styles.noBoardIcon}>🖼</span>
              <span className={styles.noBoardText}>Crea o selecciona un canvas</span>
              <span className={styles.noBoardSub}>Usa el panel izquierdo para empezar</span>
            </div>
          ) : (
            <CanvasBoardView
              key={activeBoard.id}
              board={activeBoard}
              token={token}
              idLibrary={idLibrary}
              sidebarHidden={sidebarHidden}
              onToggleSidebar={handleToggleSidebar}
              onUpdate={updated => updateBoard(activeBoard.id, () => updated)}
            />
          )
        }
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   CANVAS BOARD VIEW
══════════════════════════════════════════════════════════════════════ */
interface CanvasBoardViewProps {
  board: CanvasBoard; token: string; idLibrary: number;
  sidebarHidden: boolean;
  onToggleSidebar: () => void;
  onUpdate: (b: CanvasBoard) => void;
}

const CanvasBoardView = ({ board, token, idLibrary, sidebarHidden, onToggleSidebar, onUpdate }: CanvasBoardViewProps) => {
  /* ── Canvas refs ─────────────────────────────────────────────── */
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const canvasAboveRef = useRef<HTMLCanvasElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /* ── Viewport state (dual state+ref for stable closures) ─────── */
  const [pan, setPanState]   = useState({ x: 0, y: 0 });
  const [zoom, setZoomState] = useState(1);
  const panRef  = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const boardRef = useRef(board);
  useEffect(() => { boardRef.current = board; }, [board]);
  const setPan = useCallback((p: { x: number; y: number }) => { panRef.current = p; setPanState(p); }, []);
  const setZoom = useCallback((z: number) => { zoomRef.current = z; setZoomState(z); }, []);

  /* ── Tool state ──────────────────────────────────────────────── */
  const [tool, setTool]             = useState<Tool>('select');
  const [drawColor, setDrawColor]   = useState('#ffffff');
  const [brushSize, setBrushSize]   = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [dragLivePos, setDragLivePos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resizeLive, setResizeLive]   = useState<{ id: string; x: number; y: number; width: number; height: number } | null>(null);
  const [history, setHistory]         = useState<CanvasBoard[]>([]);
  const [redoStack, setRedoStack]     = useState<CanvasBoard[]>([]);

  /* ── Context menu / modals ───────────────────────────────────── */
  const [ctxMenu, setCtxMenu]               = useState<CtxMenu | null>(null);
  const [noteForm, setNoteForm]             = useState<NoteFormState | null>(null);
  const [checklistForm, setChecklistForm]   = useState<ChecklistFormState | null>(null);
  const [notePicker, setNotePicker]         = useState<{ cx: number; cy: number } | null>(null);
  const [clPicker, setClPicker]             = useState<{ cx: number; cy: number } | null>(null);
  const [notesList, setNotesList]           = useState<Note[]>([]);
  const [objList, setObjList]               = useState<Objective[]>([]);
  const [pickerLoading, setPickerLoading]   = useState(false);
  const [formSaving, setFormSaving]         = useState(false);

  /* ── Draw layer / task inputs / edit modal ───────────────────── */
  const drawAboveKey = `tokimori_canvas_drawAbove_${idLibrary}`;
  const [drawAbove, setDrawAboveState] = useState(() => {
    try { return localStorage.getItem(`tokimori_canvas_drawAbove_${idLibrary}`) === 'true'; } catch { return false; }
  });
  const setDrawAbove = useCallback((v: boolean) => {
    setDrawAboveState(v);
    try { localStorage.setItem(drawAboveKey, String(v)); } catch {}
  }, [drawAboveKey]);
  const drawAboveRef = useRef(drawAbove);
  useEffect(() => { drawAboveRef.current = drawAbove; }, [drawAbove]);
  const [taskInputs, setTaskInputs]         = useState<Record<string, string>>({});
  const [editingElem, setEditingElem]       = useState<CanvasElement | null>(null);
  const [editNoteTitle, setEditNoteTitle]   = useState('');
  const [editNoteText, setEditNoteText]     = useState('');
  const [editClTitle, setEditClTitle]       = useState('');
  const [editSaving, setEditSaving]         = useState(false);

  /* ── Multi-select state ──────────────────────────────────────── */
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const selectedIdsRef                      = useRef<Set<string>>(new Set());
  const [selectedPathIds, setSelectedPathIds] = useState<Set<string>>(new Set());
  const selectedPathIdsRef                  = useRef<Set<string>>(new Set());
  useEffect(() => { selectedPathIdsRef.current = selectedPathIds; renderCanvasRef.current(); }, [selectedPathIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rubberRect, setRubberRect]     = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [multiDelta, setMultiDelta]     = useState<{ dx: number; dy: number } | null>(null);
  const isRubberBanding                 = useRef(false);
  const rubberStartScreen               = useRef<{ sx: number; sy: number } | null>(null);
  const rubberEndScreen                 = useRef<{ ex: number; ey: number } | null>(null);
  const elemsStartPositions             = useRef<Record<string, { x: number; y: number }>>({});
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  /* ── Tool ref (always current) ───────────────────────────────── */
  const toolRef     = useRef<Tool>('select');
  useEffect(() => { toolRef.current = tool; }, [tool]);

  /* ── Draw refs ───────────────────────────────────────────────── */
  const isDrawing    = useRef(false);
  const isErasing    = useRef(false);
  const livePoints   = useRef<Point[]>([]);
  const drawColorRef = useRef(drawColor);
  const brushSizeRef = useRef(brushSize);
  useEffect(() => { drawColorRef.current = drawColor; }, [drawColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);

  /* ── Pan refs ────────────────────────────────────────────────── */
  const isPanning = useRef(false);
  const panStart  = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const spaceDown = useRef(false);

  /* ── Element drag refs ───────────────────────────────────────── */
  const isDragging     = useRef(false);
  const dragStart      = useRef<{ sx: number; sy: number } | null>(null);
  const elemStart      = useRef<{ x: number; y: number } | null>(null);
  const draggingId     = useRef<string | null>(null);
  const dragCurrentPos = useRef<{ x: number; y: number } | null>(null);

  /* ── Resize refs ─────────────────────────────────────────────── */
  const isResizing        = useRef(false);
  const resizingId        = useRef<string | null>(null);
  const resizeHandleType  = useRef<ResizeHandle | null>(null);
  const resizeStartSnap   = useRef<{ sx: number; sy: number; x: number; y: number; w: number; h: number } | null>(null);
  const resizeLiveCurrent = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  /* ── Path drag refs ──────────────────────────────────────────── */
  const isDraggingPath  = useRef(false);
  const draggingPathId  = useRef<string | null>(null);
  const pathDragStart   = useRef<{ sx: number; sy: number } | null>(null);
  const pathLiveDelta   = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const selectedPathRef = useRef<string | null>(null);
  useEffect(() => { selectedPathRef.current = selectedPathId; renderCanvasRef.current(); }, [selectedPathId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── History ─────────────────────────────────────────────────── */
  const push = useCallback(() => {
    setRedoStack([]);
    setHistory(h => [...h.slice(-19), boardRef.current]);
  }, []);

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      setRedoStack(r => [...r.slice(-19), boardRef.current]);
      onUpdate(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }, [onUpdate]);

  const redo = useCallback(() => {
    setRedoStack(r => {
      if (r.length === 0) return r;
      setHistory(h => [...h.slice(-19), boardRef.current]);
      onUpdate(r[r.length - 1]);
      return r.slice(0, -1);
    });
  }, [onUpdate]);

  /* ── Helpers ─────────────────────────────────────────────────── */
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const r = containerRef.current!.getBoundingClientRect();
    return {
      x: (clientX - r.left - panRef.current.x) / zoomRef.current,
      y: (clientY - r.top  - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const visibleCenter = useCallback(() => {
    const ct = containerRef.current;
    if (!ct) return { x: 200, y: 200 };
    return {
      x: (ct.clientWidth / 2 - panRef.current.x) / zoomRef.current,
      y: (ct.clientHeight / 2 - panRef.current.y) / zoomRef.current,
    };
  }, []);

  /* ══════════════════════════════════════════════════════════════
     CANVAS RENDERING (ref pattern – always current, no deps)
  ══════════════════════════════════════════════════════════════════ */
  const renderCanvasRef = useRef<(livePath?: Point[], eraserPos?: Point) => void>(() => {});
  renderCanvasRef.current = (livePath?: Point[], eraserPos?: Point) => {
    const renderSubset = (cv: HTMLCanvasElement | null, pathSubset: DrawPath[], activeLive: Point[] | undefined) => {
      if (!cv) return;
      const ctx = cv.getContext('2d'); if (!ctx) return;
      const { x: px, y: py } = panRef.current;
      const z = zoomRef.current;

      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(z, z);

      const drawPth = (pts: Point[], color: string, w: number) => {
        if (pts.length === 0) return;
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = w;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (pts.length === 1) { ctx.arc(pts[0].x, pts[0].y, w / 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); return; }
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      };

      pathSubset.forEach(p => {
        let points = p.points;
        const pathNeedsDelta = isDraggingPath.current
          ? (p.id === draggingPathId.current || selectedPathIdsRef.current.has(p.id))
          : (isDragging.current && selectedPathIdsRef.current.has(p.id));
        if (pathNeedsDelta) {
          const { dx, dy } = pathLiveDelta.current;
          points = points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
        }
        if (selectedPathRef.current === p.id || selectedPathIdsRef.current.has(p.id)) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(102,126,234,0.5)';
          ctx.lineWidth = p.width + 8;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          if (points.length === 1) {
            ctx.arc(points[0].x, points[0].y, (p.width + 8) / 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(102,126,234,0.5)'; ctx.fill();
          } else {
            ctx.moveTo(points[0].x, points[0].y);
            points.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
          }
        }
        drawPth(points, p.color, p.width);
      });

      if (activeLive && activeLive.length > 0) drawPth(activeLive, drawColorRef.current, brushSizeRef.current);

      if (eraserPos) {
        const r = (brushSizeRef.current * 3) / z;
        ctx.beginPath();
        ctx.arc(eraserPos.x, eraserPos.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5 / z;
        ctx.stroke();
      }

      ctx.restore();
    };

    const allPaths = boardRef.current.paths;
    const below = allPaths.filter(p => !p.drawAbove);
    const above = allPaths.filter(p => p.drawAbove);
    renderSubset(canvasRef.current,      below, drawAboveRef.current ? undefined : livePath);
    renderSubset(canvasAboveRef.current, above, drawAboveRef.current ? livePath  : undefined);
  };

  // Stable wrapper for useEffect deps
  const renderCanvas = useCallback((livePath?: Point[], eraserPos?: Point) => {
    renderCanvasRef.current(livePath, eraserPos);
  }, []);

  useEffect(() => { renderCanvas(); }, [board.paths, pan, zoom, renderCanvas]);

  /* ── Resize observer ─────────────────────────────────────────── */
  useEffect(() => {
    const cv = canvasRef.current; const ct = containerRef.current;
    if (!cv || !ct) return;
    const obs = new ResizeObserver(() => {
      cv.width = ct.clientWidth; cv.height = ct.clientHeight;
      const ca = canvasAboveRef.current; if (ca) { ca.width = ct.clientWidth; ca.height = ct.clientHeight; }
      renderCanvasRef.current();
    });
    obs.observe(ct);
    return () => obs.disconnect();
  }, []);

  /* ── Wheel: zoom (ctrl) / pan ────────────────────────────────── */
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRef.current * factor));
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        const newPan = {
          x: cx - (cx - panRef.current.x) * (newZoom / zoomRef.current),
          y: cy - (cy - panRef.current.y) * (newZoom / zoomRef.current),
        };
        setPan(newPan); setZoom(newZoom);
      } else {
        setPan({ x: panRef.current.x - e.deltaX, y: panRef.current.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setPan, setZoom]);

  /* ══════════════════════════════════════════════════════════════
     GLOBAL MOUSEMOVE + MOUSEUP (single effect, ref pattern)
  ══════════════════════════════════════════════════════════════════ */
  const globalMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  const globalUpRef   = useRef<(e: MouseEvent) => void>(() => {});

  globalMoveRef.current = (e: MouseEvent) => {
    if (isPanning.current && panStart.current) {
      const newPan = {
        x: panStart.current.px + (e.clientX - panStart.current.mx),
        y: panStart.current.py + (e.clientY - panStart.current.my),
      };
      panRef.current = newPan;
      setPanState(newPan);
      return;
    }
    if (isRubberBanding.current && rubberStartScreen.current) {
      rubberEndScreen.current = { ex: e.clientX, ey: e.clientY };
      const left   = Math.min(rubberStartScreen.current.sx, e.clientX);
      const top    = Math.min(rubberStartScreen.current.sy, e.clientY);
      const width  = Math.abs(e.clientX - rubberStartScreen.current.sx);
      const height = Math.abs(e.clientY - rubberStartScreen.current.sy);
      setRubberRect({ left, top, width, height });
      return;
    }
    if (isDraggingPath.current && draggingPathId.current && pathDragStart.current) {
      const pdx = (e.clientX - pathDragStart.current.sx) / zoomRef.current;
      const pdy = (e.clientY - pathDragStart.current.sy) / zoomRef.current;
      pathLiveDelta.current = { dx: pdx, dy: pdy };
      renderCanvasRef.current();
      // Unified group: also move selected elements visually
      if (selectedIdsRef.current.size > 0) setMultiDelta({ dx: pdx, dy: pdy });
      return;
    }
    if (isDragging.current && draggingId.current && dragStart.current && elemStart.current) {
      const dx = (e.clientX - dragStart.current.sx) / zoomRef.current;
      const dy = (e.clientY - dragStart.current.sy) / zoomRef.current;
      const pos = { x: elemStart.current.x + dx, y: elemStart.current.y + dy };
      dragCurrentPos.current = pos;
      setDragLivePos({ id: draggingId.current, ...pos });
      if (selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(draggingId.current!)) {
        setMultiDelta({ dx, dy });
      }
      // Unified group: also move selected paths visually
      if (selectedPathIdsRef.current.size > 0) { pathLiveDelta.current = { dx, dy }; renderCanvasRef.current(); }
      return;
    }
    if (isResizing.current && resizingId.current && resizeStartSnap.current && resizeHandleType.current) {
      const result = applyResize(resizeStartSnap.current, resizeHandleType.current, e.clientX, e.clientY, zoomRef.current);
      resizeLiveCurrent.current = result;
      setResizeLive({ id: resizingId.current, ...result });
    }
  };

  globalUpRef.current = (e: MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false; panStart.current = null;
    }
    if (isRubberBanding.current) {
      isRubberBanding.current = false;
      const start = rubberStartScreen.current!;
      const end   = rubberEndScreen.current ?? { ex: start.sx, ey: start.sy };
      rubberStartScreen.current = null;
      rubberEndScreen.current   = null;
      setRubberRect(null);

      const screenLeft   = Math.min(start.sx, end.ex);
      const screenTop    = Math.min(start.sy, end.ey);
      const screenRight  = Math.max(start.sx, end.ex);
      const screenBottom = Math.max(start.sy, end.ey);

      if (Math.max(screenRight - screenLeft, screenBottom - screenTop) > 5) {
        const cr = containerRef.current?.getBoundingClientRect();
        const ox = cr?.left ?? 0;
        const oy = cr?.top  ?? 0;
        const cLeft   = (screenLeft   - ox - panRef.current.x) / zoomRef.current;
        const cTop    = (screenTop    - oy - panRef.current.y) / zoomRef.current;
        const cRight  = (screenRight  - ox - panRef.current.x) / zoomRef.current;
        const cBottom = (screenBottom - oy - panRef.current.y) / zoomRef.current;

        const selected = boardRef.current.elements.filter(el =>
          el.x >= cLeft && el.y >= cTop &&
          (el.x + el.width) <= cRight && (el.y + el.height) <= cBottom
        );
        const selPaths = boardRef.current.paths.filter(p => {
          if (p.points.length === 0) return false;
          const xs = p.points.map(pt => pt.x);
          const ys = p.points.map(pt => pt.y);
          return Math.min(...xs) >= cLeft && Math.min(...ys) >= cTop &&
                 Math.max(...xs) <= cRight && Math.max(...ys) <= cBottom;
        });

        const ids = new Set(selected.map(el => el.id));
        selectedIdsRef.current = ids;
        setSelectedIds(ids);
        setSelectedId(selected.length === 1 && selPaths.length === 0 ? selected[0].id : null);

        const pIds = new Set(selPaths.map(p => p.id));
        selectedPathIdsRef.current = pIds;
        setSelectedPathIds(pIds);
        if (selPaths.length > 0) setSelectedPathId(null);
      }
      return;
    }
    if (isDraggingPath.current) {
      isDraggingPath.current = false;
      const pathId = draggingPathId.current;
      const { dx, dy } = pathLiveDelta.current;
      if (pathId && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
        push();
        const isMultiPath = selectedPathIdsRef.current.size > 1 && selectedPathIdsRef.current.has(pathId);
        const hasElemGroup = selectedIdsRef.current.size > 0;
        const updatedPaths = boardRef.current.paths.map(p => {
          if (isMultiPath ? selectedPathIdsRef.current.has(p.id) : p.id === pathId)
            return { ...p, points: p.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) };
          return p;
        });
        const updatedElems = hasElemGroup
          ? boardRef.current.elements.map(el => {
              if (selectedIdsRef.current.has(el.id)) {
                const s = elemsStartPositions.current[el.id];
                return s ? { ...el, x: s.x + dx, y: s.y + dy } : el;
              }
              return el;
            })
          : boardRef.current.elements;
        onUpdate({ ...boardRef.current, paths: updatedPaths, elements: updatedElems });
      }
      draggingPathId.current = null;
      pathLiveDelta.current = { dx: 0, dy: 0 };
      setMultiDelta(null);
      elemsStartPositions.current = {};
      renderCanvasRef.current();
      return;
    }
    if (isDragging.current) {
      isDragging.current = false;
      const pos = dragCurrentPos.current;
      if (pos && draggingId.current) {
        push();
        const isMulti = selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(draggingId.current!);
        const dx = pos.x - (elemsStartPositions.current[draggingId.current!]?.x ?? pos.x);
        const dy = pos.y - (elemsStartPositions.current[draggingId.current!]?.y ?? pos.y);
        const hasPathGroup = selectedPathIdsRef.current.size > 0;
        const updatedElems = boardRef.current.elements.map(el => {
          if (el.id === draggingId.current) return { ...el, x: pos.x, y: pos.y };
          if (isMulti && selectedIdsRef.current.has(el.id)) {
            const s = elemsStartPositions.current[el.id];
            return s ? { ...el, x: s.x + dx, y: s.y + dy } : el;
          }
          return el;
        });
        const updatedPaths = hasPathGroup
          ? boardRef.current.paths.map(p =>
              selectedPathIdsRef.current.has(p.id)
                ? { ...p, points: p.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }
                : p)
          : boardRef.current.paths;
        onUpdate({ ...boardRef.current, elements: updatedElems, paths: updatedPaths });
      }
      setDragLivePos(null);
      setMultiDelta(null);
      pathLiveDelta.current = { dx: 0, dy: 0 };
      elemsStartPositions.current = {};
      draggingId.current = null; dragStart.current = null; elemStart.current = null; dragCurrentPos.current = null;
      renderCanvasRef.current();
      return;
    }
    if (isResizing.current) {
      isResizing.current = false;
      const elemId = resizingId.current;
      const live = resizeLiveCurrent.current;
      if (elemId && live) {
        push();
        onUpdate({ ...boardRef.current, elements: boardRef.current.elements.map(el =>
          el.id === elemId ? { ...el, x: live.x, y: live.y, width: live.width, height: live.height } : el
        )});
      }
      resizingId.current = null; resizeHandleType.current = null;
      resizeStartSnap.current = null; resizeLiveCurrent.current = null;
      setResizeLive(null);
      return;
    }
    if (isErasing.current) {
      isErasing.current = false;
      renderCanvasRef.current();
      return;
    }
    if (isDrawing.current) {
      isDrawing.current = false;
      if (livePoints.current.length >= 1) {
        push();
        onUpdate({ ...boardRef.current, paths: [...boardRef.current.paths, {
          id: crypto.randomUUID(),
          points: livePoints.current,
          color: drawColorRef.current,
          width: brushSizeRef.current,
          drawAbove: drawAboveRef.current,
        }]});
      }
      livePoints.current = [];
      renderCanvasRef.current();
    }
    void e;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => globalMoveRef.current(e);
    const onUp   = (e: MouseEvent) => globalUpRef.current(e);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  /* ── Keyboard ────────────────────────────────────────────────── */
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); spaceDown.current = true; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const hasElems = selectedIdsRef.current.size > 0;
        const hasPaths = selectedPathIdsRef.current.size > 0;
        if (hasElems || hasPaths) {
          push();
          const eIds = selectedIdsRef.current;
          const pIds = selectedPathIdsRef.current;
          onUpdate({
            ...boardRef.current,
            elements: hasElems ? boardRef.current.elements.filter(el => !eIds.has(el.id)) : boardRef.current.elements,
            paths: hasPaths ? boardRef.current.paths.filter(p => !pIds.has(p.id)) : boardRef.current.paths,
          });
          if (hasElems) { setSelectedId(null); const e2 = new Set<string>(); setSelectedIds(e2); selectedIdsRef.current = e2; }
          if (hasPaths) { const p2 = new Set<string>(); setSelectedPathIds(p2); selectedPathIdsRef.current = p2; }
        } else if (selectedPathId) {
          push();
          onUpdate({ ...boardRef.current, paths: boardRef.current.paths.filter(p => p.id !== selectedPathId) });
          setSelectedPathId(null);
        }
      }
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [selectedPathId, push, undo, onUpdate]);

  /* ── Context menu close ──────────────────────────────────────── */
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if ((e.target as Element).closest('[data-ctx-menu]')) return;
      setCtxMenu(null);
    };
    const t = setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('contextmenu', close);
    }, 30);
    return () => { clearTimeout(t); window.removeEventListener('mousedown', close); window.removeEventListener('contextmenu', close); };
  }, [ctxMenu]);

  /* ── Container events ────────────────────────────────────────── */
  const onContainerDown = (e: React.MouseEvent) => {
    setCtxMenu(null);

    if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
      return;
    }
    if (e.button !== 0) return;

    if (toolRef.current === 'draw') {
      isDrawing.current = true;
      livePoints.current = [screenToCanvas(e.clientX, e.clientY)];
      return;
    }
    if (toolRef.current === 'erase') {
      isErasing.current = true;
      return;
    }
    if (toolRef.current === 'select') {
      const cp = screenToCanvas(e.clientX, e.clientY);
      const hitPath = hitTestPaths(cp.x, cp.y, boardRef.current.paths, zoomRef.current);
      if (hitPath) {
        const inPathGroup    = selectedPathIdsRef.current.has(hitPath);
        const inUnifiedGroup = inPathGroup && selectedIdsRef.current.size > 0;
        if (!inPathGroup) {
          // Fresh single-path selection
          setSelectedPathId(hitPath);
          const ep = new Set<string>(); setSelectedPathIds(ep); selectedPathIdsRef.current = ep;
          setSelectedId(null);
          const ei = new Set<string>(); setSelectedIds(ei); selectedIdsRef.current = ei;
        }
        // If inUnifiedGroup: keep both selectedPathIds and selectedIds so all move together
        // Record element start positions for unified group drag
        if (inUnifiedGroup) {
          const positions: Record<string, { x: number; y: number }> = {};
          boardRef.current.elements.forEach(el => {
            if (selectedIdsRef.current.has(el.id)) positions[el.id] = { x: el.x, y: el.y };
          });
          elemsStartPositions.current = positions;
        }
        isDraggingPath.current = true;
        draggingPathId.current = hitPath;
        pathDragStart.current = { sx: e.clientX, sy: e.clientY };
        pathLiveDelta.current = { dx: 0, dy: 0 };
        return;
      }
      setSelectedId(null);
      setSelectedPathId(null);
      const newIds = new Set<string>();
      setSelectedIds(newIds);
      selectedIdsRef.current = newIds;
      const emptyPathIds = new Set<string>();
      setSelectedPathIds(emptyPathIds);
      selectedPathIdsRef.current = emptyPathIds;
      // Start rubber band
      isRubberBanding.current = true;
      rubberStartScreen.current = { sx: e.clientX, sy: e.clientY };
      rubberEndScreen.current = null;
    }
  };

  const onContainerMove = (e: React.MouseEvent) => {
    if (isErasing.current) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const canvasR = (brushSizeRef.current * 3) / zoomRef.current;
      const b = boardRef.current;
      const filtered = b.paths.filter(p => !p.points.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < canvasR));
      if (filtered.length !== b.paths.length) onUpdate({ ...b, paths: filtered });
      renderCanvasRef.current(undefined, pos);
      return;
    }
    if (!isDrawing.current) return;
    const pos = screenToCanvas(e.clientX, e.clientY);
    livePoints.current = [...livePoints.current, pos];
    renderCanvasRef.current(livePoints.current);
  };

  const onContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const cp = screenToCanvas(e.clientX, e.clientY);
    const hitPath = hitTestPaths(cp.x, cp.y, boardRef.current.paths, zoomRef.current);
    if (hitPath) {
      setSelectedPathId(hitPath);
      setSelectedId(null);
      setCtxMenu({ sx: e.clientX, sy: e.clientY, cx: cp.x, cy: cp.y, elemId: null, elemType: null, pathId: hitPath });
    } else {
      setCtxMenu({ sx: e.clientX, sy: e.clientY, cx: cp.x, cy: cp.y, elemId: null, elemType: null, pathId: null });
    }
  };

  /* ── Element interaction ─────────────────────────────────────── */
  const onElemDown = (e: React.MouseEvent, id: string) => {
    if (toolRef.current !== 'select') return;
    e.stopPropagation();

    // If an above-layer path is at this click position it should take priority over the element
    const cp = screenToCanvas(e.clientX, e.clientY);
    const abovePaths = boardRef.current.paths.filter(p => p.drawAbove);
    const hitAbove = hitTestPaths(cp.x, cp.y, abovePaths, zoomRef.current);
    if (hitAbove) {
      const isInPathGroup = selectedPathIdsRef.current.size > 1 && selectedPathIdsRef.current.has(hitAbove);
      if (!isInPathGroup) {
        setSelectedPathId(hitAbove);
        const ep2 = new Set<string>(); setSelectedPathIds(ep2); selectedPathIdsRef.current = ep2;
      }
      setSelectedId(null);
      const ei = new Set<string>(); setSelectedIds(ei); selectedIdsRef.current = ei;
      isDraggingPath.current = true;
      draggingPathId.current = hitAbove;
      pathDragStart.current = { sx: e.clientX, sy: e.clientY };
      pathLiveDelta.current = { dx: 0, dy: 0 };
      return;
    }

    // "in group" = either multiple elements selected, or part of a unified elem+path group
    const isInElemGroup    = selectedIdsRef.current.size > 1 && selectedIdsRef.current.has(id);
    const isInUnifiedGroup = selectedIdsRef.current.has(id) && selectedPathIdsRef.current.size > 0;
    const isInGroup        = isInElemGroup || isInUnifiedGroup;
    if (!isInGroup) {
      const newIds = new Set([id]);
      setSelectedIds(newIds);
      selectedIdsRef.current = newIds;
      setSelectedId(id);
      setSelectedPathId(null);
      const epIds = new Set<string>(); setSelectedPathIds(epIds); selectedPathIdsRef.current = epIds;
    }
    // If isInGroup (including unified): keep selectedPathIds so paths move with elements

    isDragging.current = true;
    dragStart.current = { sx: e.clientX, sy: e.clientY };
    const el = boardRef.current.elements.find(el => el.id === id);
    if (el) { elemStart.current = { x: el.x, y: el.y }; dragCurrentPos.current = { x: el.x, y: el.y }; }
    draggingId.current = id;

    // Record start positions for multi-drag and unified group drags
    if (selectedIdsRef.current.size > 1 || selectedPathIdsRef.current.size > 0) {
      const positions: Record<string, { x: number; y: number }> = {};
      boardRef.current.elements.forEach(elem => {
        if (selectedIdsRef.current.has(elem.id)) positions[elem.id] = { x: elem.x, y: elem.y };
      });
      elemsStartPositions.current = positions;
    } else {
      elemsStartPositions.current = {};
    }
  };

  const onElemContextMenu = (e: React.MouseEvent, id: string, type: CanvasElement['type']) => {
    e.preventDefault(); e.stopPropagation();
    const cp = screenToCanvas(e.clientX, e.clientY);
    setSelectedId(id);
    setCtxMenu({ sx: e.clientX, sy: e.clientY, cx: cp.x, cy: cp.y, elemId: id, elemType: type, pathId: null });
  };

  const onElemDoubleClick = (e: React.MouseEvent, id: string) => {
    if (toolRef.current !== 'select') return;
    e.stopPropagation();
    const elem = boardRef.current.elements.find(el => el.id === id);
    if (elem && (elem.type === 'note' || elem.type === 'checklist')) openEditElem(elem);
  };

  const startResize = (e: React.MouseEvent, elemId: string, handle: ResizeHandle, x: number, y: number, w: number, h: number) => {
    e.stopPropagation(); e.preventDefault();
    isResizing.current = true;
    resizingId.current = elemId;
    resizeHandleType.current = handle;
    resizeStartSnap.current = { sx: e.clientX, sy: e.clientY, x, y, w, h };
  };

  /* ── Zoom controls ───────────────────────────────────────────── */
  const doZoom = (factor: number) => {
    const ct = containerRef.current; if (!ct) return;
    const cx = ct.clientWidth / 2, cy = ct.clientHeight / 2;
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRef.current * factor));
    setPan({ x: cx - (cx - panRef.current.x) * (newZoom / zoomRef.current), y: cy - (cy - panRef.current.y) * (newZoom / zoomRef.current) });
    setZoom(newZoom);
  };
  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  /* ── Board operations ────────────────────────────────────────── */
  const bringFront = (id: string) => {
    const maxZ = Math.max(0, ...board.elements.map(e => e.zIndex));
    onUpdate({ ...board, elements: board.elements.map(e => e.id === id ? { ...e, zIndex: maxZ + 1 } : e) });
  };
  const sendBack = (id: string) => {
    onUpdate({ ...board, elements: board.elements.map(e => e.id === id ? { ...e, zIndex: 0 } : e) });
  };
  const bringPathFront = (pathId: string) => {
    const path = board.paths.find(p => p.id === pathId); if (!path) return;
    push(); onUpdate({ ...board, paths: [...board.paths.filter(p => p.id !== pathId), path] });
  };
  const deleteElem = (id: string) => {
    push();
    onUpdate({ ...board, elements: board.elements.filter(e => e.id !== id) });
    setSelectedId(null);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); selectedIdsRef.current = s; return s; });
  };
  const deletePath = (pathId: string) => {
    push(); onUpdate({ ...board, paths: board.paths.filter(p => p.id !== pathId) }); setSelectedPathId(null);
  };
  const clearBoard = () => {
    if (!window.confirm('¿Borrar todo el contenido de este canvas?')) return;
    push(); onUpdate({ ...board, paths: [], elements: [] }); setSelectedId(null); setSelectedPathId(null);
  };

  /* ── Task management ─────────────────────────────────────────── */
  const handleTaskToggle = async (elemId: string, taskId: number, completed: boolean) => {
    onUpdate({ ...board, elements: board.elements.map(e => e.id === elemId ? { ...e, tasks: e.tasks?.map(t => t.id === taskId ? { ...t, completed } : t) } : e) });
    try { await objectivesService.updateTask(token, taskId, { completed }); } catch {}
  };

  const handleMarkAll = async (elemId: string, completed: boolean) => {
    const el = board.elements.find(e => e.id === elemId); if (!el?.objId) return;
    onUpdate({ ...board, elements: board.elements.map(e => e.id === elemId ? { ...e, tasks: e.tasks?.map(t => ({ ...t, completed })) } : e) });
    try { if (completed) await objectivesService.markAllTasksCompleted(token, el.objId); else await objectivesService.markAllTasksIncomplete(token, el.objId); } catch {}
  };

  const handleDeleteTask = useCallback(async (elemId: string, taskId: number) => {
    onUpdate({ ...boardRef.current, elements: boardRef.current.elements.map(e =>
      e.id === elemId ? { ...e, tasks: e.tasks?.filter(t => t.id !== taskId) } : e
    )});
    try { await objectivesService.deleteTask(token, taskId); } catch {}
  }, [token, onUpdate]);

  /* ── Image upload ────────────────────────────────────────────── */
  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      const center = visibleCenter();
      const el: CanvasElement = { id: crypto.randomUUID(), type: 'image', x: center.x - 140, y: center.y - 100, width: 280, height: 200, zIndex: board.elements.length + 1, imageSrc: src };
      push(); onUpdate({ ...board, elements: [...board.elements, el] });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* ── Note operations ─────────────────────────────────────────── */
  const openNotePicker = async (cx: number, cy: number) => {
    setPickerLoading(true); setNotePicker({ cx, cy });
    try { setNotesList(await notesService.getNotesByLibrary(token, idLibrary)); } catch { setNotesList([]); } finally { setPickerLoading(false); }
  };

  const insertExistingNote = (note: Note, cx: number, cy: number) => {
    const el: CanvasElement = { id: crypto.randomUUID(), type: 'note', x: cx - 130, y: cy - 85, width: 260, height: 170, zIndex: board.elements.length + 1, noteId: note.idNotes, noteTitle: note.title, noteText: note.text };
    push(); onUpdate({ ...board, elements: [...board.elements, el] });
    setNotePicker(null);
  };

  const createAndInsertNote = async () => {
    if (!noteForm || !noteForm.title.trim() || !noteForm.text.trim()) return;
    setFormSaving(true);
    try {
      const id = await notesService.createNote(token, idLibrary, noteForm.title.trim(), noteForm.text.trim());
      const el: CanvasElement = { id: crypto.randomUUID(), type: 'note', x: noteForm.cx - 130, y: noteForm.cy - 85, width: 260, height: 170, zIndex: board.elements.length + 1, noteId: id, noteTitle: noteForm.title.trim(), noteText: noteForm.text.trim() };
      push(); onUpdate({ ...board, elements: [...board.elements, el] });
      setNoteForm(null);
    } catch {} finally { setFormSaving(false); }
  };

  /* ── Checklist operations ────────────────────────────────────── */
  const openClPicker = async (cx: number, cy: number) => {
    setPickerLoading(true); setClPicker({ cx, cy });
    try { setObjList(await objectivesService.getObjectivesByLibrary(token, idLibrary)); } catch { setObjList([]); } finally { setPickerLoading(false); }
  };

  const insertExistingCl = async (obj: Objective, cx: number, cy: number) => {
    let tasks: { id: number; title: string; completed: boolean }[] = [];
    try { const raw = await objectivesService.getTasksByObjective(token, obj.idObjectives); tasks = raw.map(t => ({ id: t.idTask, title: t.title, completed: Boolean(t.completed) })); } catch {}
    const el: CanvasElement = { id: crypto.randomUUID(), type: 'checklist', x: cx - 135, y: cy - 105, width: 270, height: 210, zIndex: board.elements.length + 1, objId: obj.idObjectives, objTitle: obj.title, tasks };
    push(); onUpdate({ ...board, elements: [...board.elements, el] });
    setClPicker(null);
  };

  const createAndInsertCl = async () => {
    if (!checklistForm || !checklistForm.title.trim()) return;
    setFormSaving(true);
    try {
      const id = await objectivesService.createObjective(token, idLibrary, checklistForm.title.trim(), checklistForm.desc.trim() || undefined);
      const el: CanvasElement = { id: crypto.randomUUID(), type: 'checklist', x: checklistForm.cx - 135, y: checklistForm.cy - 105, width: 270, height: 210, zIndex: board.elements.length + 1, objId: id, objTitle: checklistForm.title.trim(), tasks: [] };
      push(); onUpdate({ ...board, elements: [...board.elements, el] });
      setChecklistForm(null);
    } catch {} finally { setFormSaving(false); }
  };

  /* ── Refresh notes + checklist tasks when canvas tab is opened ── */
  useEffect(() => {
    const noteElems      = board.elements.filter(e => e.type === 'checklist' && e.objId === undefined ? false : e.type === 'note' && e.noteId !== undefined);
    const checklistElems = board.elements.filter(e => e.type === 'checklist' && e.objId !== undefined);

    const notePromises = board.elements
      .filter(e => e.type === 'note' && e.noteId !== undefined)
      .map(async el => {
        try {
          const all = await notesService.getNotesByLibrary(token, idLibrary);
          const fresh = all.find(n => n.idNotes === el.noteId);
          return fresh ? { id: el.id, noteTitle: fresh.title, noteText: fresh.text } : null;
        } catch { return null; }
      });

    const clPromises = checklistElems.map(async el => {
      try {
        const raw = await objectivesService.getTasksByObjective(token, el.objId!);
        return { id: el.id, tasks: raw.map(t => ({ id: t.idTask, title: t.title, completed: Boolean(t.completed) })) };
      } catch { return null; }
    });

    Promise.all([...notePromises, ...clPromises]).then(results => {
      const noteUpdates   = results.filter(r => r && 'noteTitle' in r) as { id: string; noteTitle: string; noteText: string }[];
      const clUpdates     = results.filter(r => r && 'tasks' in r)     as { id: string; tasks: { id: number; title: string; completed: boolean }[] }[];
      if (noteUpdates.length === 0 && clUpdates.length === 0) return;
      onUpdate({ ...boardRef.current, elements: boardRef.current.elements.map(el => {
        const nu = noteUpdates.find(x => x.id === el.id);
        if (nu) return { ...el, noteTitle: nu.noteTitle, noteText: nu.noteText };
        const cu = clUpdates.find(x => x.id === el.id);
        if (cu) return { ...el, tasks: cu.tasks };
        return el;
      }) });
    });
    void noteElems;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Add task to canvas checklist ───────────────────────────────── */
  const handleAddTask = useCallback(async (elemId: string, title: string) => {
    const el = boardRef.current.elements.find(e => e.id === elemId);
    if (!el?.objId || !title.trim()) return;
    try {
      const taskId = await objectivesService.createTask(token, el.objId, title.trim());
      const newTask = { id: taskId, title: title.trim(), completed: false };
      onUpdate({ ...boardRef.current, elements: boardRef.current.elements.map(e =>
        e.id === elemId ? { ...e, tasks: [...(e.tasks ?? []), newTask] } : e
      )});
      setTaskInputs(prev => ({ ...prev, [elemId]: '' }));
    } catch {}
  }, [token, onUpdate]);

  /* ── Edit element (note / checklist) ───────────────────────────── */
  const openEditElem = useCallback((elem: CanvasElement) => {
    setEditingElem(elem);
    if (elem.type === 'note') {
      setEditNoteTitle(elem.noteTitle ?? '');
      setEditNoteText(elem.noteText ?? '');
    } else if (elem.type === 'checklist') {
      setEditClTitle(elem.objTitle ?? '');
    }
  }, []);

  const saveNoteEdit = async () => {
    if (!editingElem?.noteId || !editNoteTitle.trim() || !editNoteText.trim()) return;
    setEditSaving(true);
    try {
      await notesService.updateNote(token, editingElem.noteId, { title: editNoteTitle.trim(), text: editNoteText.trim() });
      onUpdate({ ...boardRef.current, elements: boardRef.current.elements.map(e =>
        e.id === editingElem.id ? { ...e, noteTitle: editNoteTitle.trim(), noteText: editNoteText.trim() } : e
      )});
      setEditingElem(null);
    } catch {} finally { setEditSaving(false); }
  };

  const saveClEdit = async () => {
    if (!editingElem?.objId || !editClTitle.trim()) return;
    setEditSaving(true);
    try {
      await objectivesService.updateObjective(token, editingElem.objId, { title: editClTitle.trim() });
      onUpdate({ ...boardRef.current, elements: boardRef.current.elements.map(e =>
        e.id === editingElem.id ? { ...e, objTitle: editClTitle.trim() } : e
      )});
      setEditingElem(null);
    } catch {} finally { setEditSaving(false); }
  };

  /* ── Cursor ──────────────────────────────────────────────────── */
  const activeCursor = isPanning.current ? 'grabbing' : spaceDown.current ? 'grab'
    : tool === 'draw' ? 'crosshair' : tool === 'erase' ? 'cell' : 'default';

  const ctxAction = (fn: () => void) => { fn(); setCtxMenu(null); };

  /* ── Selection overlay (resize handles) ─────────────────────── */
  const renderSelectionOverlay = () => {
    if (!selectedId || dragLivePos || selectedIds.size > 1) return null;
    const el = board.elements.find(e => e.id === selectedId);
    if (!el) return null;
    const lx = resizeLive?.id === el.id ? resizeLive.x : el.x;
    const ly = resizeLive?.id === el.id ? resizeLive.y : el.y;
    const lw = resizeLive?.id === el.id ? resizeLive.width : el.width;
    const lh = resizeLive?.id === el.id ? resizeLive.height : el.height;
    const sx = lx * zoom + pan.x;
    const sy = ly * zoom + pan.y;
    const sw = lw * zoom;
    const sh = lh * zoom;
    const H = 9;
    const handles: Array<{ type: ResizeHandle; cx: number; cy: number; cursor: string }> = [
      { type: 'tl', cx: sx,          cy: sy,          cursor: 'nw-resize' },
      { type: 't',  cx: sx + sw / 2, cy: sy,          cursor: 'n-resize'  },
      { type: 'tr', cx: sx + sw,     cy: sy,          cursor: 'ne-resize' },
      { type: 'r',  cx: sx + sw,     cy: sy + sh / 2, cursor: 'e-resize'  },
      { type: 'br', cx: sx + sw,     cy: sy + sh,     cursor: 'se-resize' },
      { type: 'b',  cx: sx + sw / 2, cy: sy + sh,     cursor: 's-resize'  },
      { type: 'bl', cx: sx,          cy: sy + sh,     cursor: 'sw-resize' },
      { type: 'l',  cx: sx,          cy: sy + sh / 2, cursor: 'w-resize'  },
    ];
    return (
      <>
        <div style={{ position: 'absolute', left: sx, top: sy, width: sw, height: sh, border: '2px solid #667eea', pointerEvents: 'none', zIndex: 9999, boxSizing: 'border-box', borderRadius: 4 }} />
        {handles.map(h => (
          <div key={h.type}
            style={{ position: 'absolute', left: h.cx - H / 2, top: h.cy - H / 2, width: H, height: H, background: '#fff', border: '2px solid #667eea', borderRadius: 2, cursor: h.cursor, zIndex: 10000, pointerEvents: 'all', boxSizing: 'border-box' }}
            onMouseDown={e => startResize(e, selectedId, h.type, lx, ly, lw, lh)}
          />
        ))}
      </>
    );
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className={styles.boardWrapper}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolGroup}>
          <button className={`${styles.toolBtn} ${tool === 'select' ? styles.toolActive : ''}`} onClick={() => setTool('select')} title="Seleccionar / Mover">
            <span className={styles.toolIcon}>↖</span><span className={styles.toolLabel}>Mover</span>
          </button>
          <button className={`${styles.toolBtn} ${tool === 'draw' ? styles.toolActive : ''}`} onClick={() => setTool('draw')} title="Dibujar">
            <span className={styles.toolIcon}>✏️</span><span className={styles.toolLabel}>Dibujar</span>
          </button>
          <button className={`${styles.toolBtn} ${tool === 'erase' ? styles.toolActive : ''}`} onClick={() => setTool('erase')} title="Borrador">
            <span className={styles.toolIcon}>⬜</span><span className={styles.toolLabel}>Borrar</span>
          </button>
        </div>

        <div className={styles.toolDivider} />

        {tool === 'draw' && (
          <div className={styles.toolGroup}>
            {DRAW_COLORS.map(c => (
              <button key={c} className={`${styles.colorDot} ${drawColor === c ? styles.colorDotActive : ''}`}
                style={{ background: c }} onClick={() => setDrawColor(c)} title={c} />
            ))}
            <div className={styles.toolDivider} />
          </div>
        )}

        {(tool === 'draw' || tool === 'erase') && (
          <div className={styles.toolGroup}>
            {BRUSH_SIZES.map(s => (
              <button key={s} className={`${styles.sizeBtn} ${brushSize === s ? styles.toolActive : ''}`}
                onClick={() => setBrushSize(s)} title={`${s}px`}>
                <div className={styles.sizeDot} style={{ width: Math.min(s, 18) + 'px', height: Math.min(s, 18) + 'px', background: tool === 'erase' ? '#b0b0c0' : '#fff' }} />
              </button>
            ))}
            <div className={styles.toolDivider} />
          </div>
        )}

        {tool === 'draw' && (
          <div className={styles.toolGroup}>
            <button className={`${styles.toolBtn} ${drawAbove ? styles.toolActive : ''}`}
              onClick={() => setDrawAbove(v => !v)}
              title={drawAbove ? 'Dibujo encima de elementos — click para poner debajo' : 'Dibujo debajo de elementos — click para poner encima'}>
              <span className={styles.toolIcon}>{drawAbove ? '⬆' : '⬇'}</span>
              <span className={styles.toolLabel}>{drawAbove ? 'Encima' : 'Debajo'}</span>
            </button>
            <div className={styles.toolDivider} />
          </div>
        )}

        {/* Insert: new + existing */}
        <div className={styles.toolGroup}>
          <button className={styles.toolBtn} onClick={() => { const c = visibleCenter(); setNoteForm({ title: '', text: '', cx: c.x, cy: c.y }); }} title="Nueva Nota">
            <span className={styles.toolIcon}>🗒️</span><span className={styles.toolLabel}>Nota</span>
          </button>
          <button className={styles.toolBtn} onClick={() => { const c = visibleCenter(); openNotePicker(c.x, c.y); }} title="Nota existente">
            <span className={styles.toolIcon}>📋</span><span className={styles.toolLabel}>Nota ↗</span>
          </button>
          <div className={styles.toolDivider} />
          <button className={styles.toolBtn} onClick={() => { const c = visibleCenter(); setChecklistForm({ title: '', desc: '', cx: c.x, cy: c.y }); }} title="Nueva Checklist">
            <span className={styles.toolIcon}>✅</span><span className={styles.toolLabel}>Lista</span>
          </button>
          <button className={styles.toolBtn} onClick={() => { const c = visibleCenter(); openClPicker(c.x, c.y); }} title="Checklist existente">
            <span className={styles.toolIcon}>📁</span><span className={styles.toolLabel}>Lista ↗</span>
          </button>
          <div className={styles.toolDivider} />
          <button className={styles.toolBtn} onClick={() => imageInputRef.current?.click()} title="Insertar imagen">
            <span className={styles.toolIcon}>🖼️</span><span className={styles.toolLabel}>Imagen</span>
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageFile} />
        </div>

        <div className={styles.toolDivider} />

        <div className={styles.toolGroup}>
          <button className={styles.toolBtn} onClick={undo} disabled={history.length === 0} title="Deshacer (Ctrl+Z)">
            <span className={styles.toolIcon}>↩</span><span className={styles.toolLabel}>Deshacer</span>
          </button>
          <button className={styles.toolBtn} onClick={redo} disabled={redoStack.length === 0} title="Rehacer (Ctrl+Y)">
            <span className={styles.toolIcon}>↪</span><span className={styles.toolLabel}>Rehacer</span>
          </button>
          {(selectedIds.size > 0 || selectedPathIds.size > 0 || selectedPathId) && (
            <button className={`${styles.toolBtn} ${styles.toolDanger}`}
              onClick={() => {
                const hasElems = selectedIds.size > 0;
                const hasPaths = selectedPathIds.size > 0;
                if (hasElems || hasPaths) {
                  push();
                  const eIds = selectedIdsRef.current;
                  const pIds = selectedPathIdsRef.current;
                  onUpdate({
                    ...boardRef.current,
                    elements: hasElems ? boardRef.current.elements.filter(e => !eIds.has(e.id)) : boardRef.current.elements,
                    paths: hasPaths ? boardRef.current.paths.filter(p => !pIds.has(p.id)) : boardRef.current.paths,
                  });
                  if (hasElems) { setSelectedId(null); const e2 = new Set<string>(); setSelectedIds(e2); selectedIdsRef.current = e2; }
                  if (hasPaths) { const p2 = new Set<string>(); setSelectedPathIds(p2); selectedPathIdsRef.current = p2; }
                } else if (selectedPathId) {
                  deletePath(selectedPathId);
                }
              }}
              title={`Eliminar (${selectedIds.size + (selectedPathIds.size || (selectedPathId ? 1 : 0))}) (Supr)`}>
              <span className={styles.toolIcon}>🗑️</span>
              <span className={styles.toolLabel}>
                {(selectedIds.size + selectedPathIds.size) > 1
                  ? `Elim. (${selectedIds.size + selectedPathIds.size})`
                  : 'Eliminar'}
              </span>
            </button>
          )}
          <button className={`${styles.toolBtn} ${styles.toolClear}`} onClick={clearBoard} title="Limpiar canvas">
            <span className={styles.toolIcon}>✕</span><span className={styles.toolLabel}>Limpiar</span>
          </button>
        </div>

        <div className={styles.toolHint}>
          <span>Pan: Rueda | Espacio+Drag · Zoom: Ctrl+Rueda · Multi-sel: arrastrar vacío</span>
        </div>
      </div>

      {/* ── Canvas container ── */}
      <div
        ref={containerRef}
        className={styles.canvasContainer}
        style={{ cursor: activeCursor }}
        onMouseDown={onContainerDown}
        onMouseMove={onContainerMove}
        onContextMenu={onContainerContextMenu}
      >
        <canvas ref={canvasRef}      className={styles.drawCanvas} style={{ zIndex: 1 }} />
        <canvas ref={canvasAboveRef} className={styles.drawCanvas} style={{ zIndex: 9990, pointerEvents: 'none' }} />

        {board.elements.map(el => {
          const isMultiDragged = multiDelta !== null && selectedIds.has(el.id) && el.id !== draggingId.current;
          const lx = resizeLive?.id === el.id ? resizeLive.x
                   : dragLivePos?.id === el.id ? dragLivePos.x
                   : isMultiDragged ? el.x + multiDelta!.dx : el.x;
          const ly = resizeLive?.id === el.id ? resizeLive.y
                   : dragLivePos?.id === el.id ? dragLivePos.y
                   : isMultiDragged ? el.y + multiDelta!.dy : el.y;
          const lw = resizeLive?.id === el.id ? resizeLive.width : el.width;
          const lh = resizeLive?.id === el.id ? resizeLive.height : el.height;
          return (
            <ElementView
              key={el.id}
              element={el}
              liveX={lx} liveY={ly}
              liveWidth={lw} liveHeight={lh}
              pan={pan} zoom={zoom}
              isSelected={selectedIds.has(el.id)}
              canInteract={tool === 'select'}
              onMouseDown={onElemDown}
              onDoubleClick={onElemDoubleClick}
              onContextMenu={onElemContextMenu}
              onTaskToggle={handleTaskToggle}
              onMarkAll={handleMarkAll}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
              taskInput={taskInputs[el.id] ?? ''}
              onSetTaskInput={v => setTaskInputs(prev => ({ ...prev, [el.id]: v }))}
            />
          );
        })}

        {/* Rubber band selection rect */}
        {rubberRect && (() => {
          const cr = containerRef.current?.getBoundingClientRect();
          return (
            <div style={{
              position: 'absolute',
              left:   rubberRect.left   - (cr?.left ?? 0),
              top:    rubberRect.top    - (cr?.top  ?? 0),
              width:  rubberRect.width,
              height: rubberRect.height,
              border: '1.5px dashed rgba(102,126,234,0.85)',
              background: 'rgba(102,126,234,0.08)',
              pointerEvents: 'none',
              zIndex: 20000,
              boxSizing: 'border-box',
              borderRadius: 2,
            }} />
          );
        })()}

        {/* Selection overlay with resize handles */}
        {renderSelectionOverlay()}

        {/* ── Zoom widget ── */}
        <div className={styles.zoomWidget}>
          <button className={styles.zoomBtn} onClick={() => doZoom(1 / ZOOM_STEP)} title="Alejar">−</button>
          <button className={styles.zoomPct} onClick={resetZoom} title="Restablecer zoom">{Math.round(zoom * 100)}%</button>
          <button className={styles.zoomBtn} onClick={() => doZoom(ZOOM_STEP)} title="Acercar">+</button>
          <div className={styles.zoomDivider} />
          <button className={styles.zoomBtn} onClick={onToggleSidebar} title={sidebarHidden ? 'Mostrar lista' : 'Modo pantalla completa'}>
            {sidebarHidden ? '⊞' : '⛶'}
          </button>
        </div>
      </div>

      {/* ══════════════ CONTEXT MENU ══════════════ */}
      {ctxMenu && (
        <div data-ctx-menu className={styles.ctxMenu} style={{ left: ctxMenu.sx, top: ctxMenu.sy }}>
          {ctxMenu.pathId ? (
            <>
              <p className={styles.ctxLabel}>Trazo</p>
              <button className={styles.ctxItem} onClick={() => ctxAction(() => {
                bringPathFront(ctxMenu.pathId!);
                onUpdate({ ...boardRef.current, paths: boardRef.current.paths.map(p => p.id === ctxMenu.pathId ? { ...p, drawAbove: true } : p) });
              })}>↑ Encima de elementos</button>
              <button className={styles.ctxItem} onClick={() => ctxAction(() => {
                onUpdate({ ...boardRef.current, paths: boardRef.current.paths.map(p => p.id === ctxMenu.pathId ? { ...p, drawAbove: false } : p) });
              })}>↓ Debajo de elementos</button>
              <div className={styles.ctxSep} />
              <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => ctxAction(() => deletePath(ctxMenu.pathId!))}>🗑️ Eliminar trazo</button>
            </>
          ) : ctxMenu.elemId ? (
            <>
              {(ctxMenu.elemType === 'note' || ctxMenu.elemType === 'checklist') && (
                <>
                  <button className={styles.ctxItem} onClick={() => ctxAction(() => {
                    const elem = boardRef.current.elements.find(e => e.id === ctxMenu.elemId);
                    if (elem) openEditElem(elem);
                  })}>✏️ Editar</button>
                  <div className={styles.ctxSep} />
                </>
              )}
              <button className={styles.ctxItem} onClick={() => ctxAction(() => bringFront(ctxMenu.elemId!))}>↑ Traer al frente</button>
              <button className={styles.ctxItem} onClick={() => ctxAction(() => sendBack(ctxMenu.elemId!))}>↓ Enviar al fondo</button>
              {ctxMenu.elemType === 'checklist' && (
                <>
                  <div className={styles.ctxSep} />
                  <button className={styles.ctxItem} onClick={() => ctxAction(() => handleMarkAll(ctxMenu.elemId!, true))}>✓ Marcar todo</button>
                  <button className={styles.ctxItem} onClick={() => ctxAction(() => handleMarkAll(ctxMenu.elemId!, false))}>✗ Desmarcar todo</button>
                </>
              )}
              <div className={styles.ctxSep} />
              <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => ctxAction(() => deleteElem(ctxMenu.elemId!))}>🗑️ Eliminar</button>
            </>
          ) : (
            <>
              <p className={styles.ctxLabel}>Insertar</p>
              <button className={styles.ctxItem} onClick={() => ctxAction(() => setNoteForm({ title: '', text: '', cx: ctxMenu.cx, cy: ctxMenu.cy }))}>🗒️ Nueva Nota</button>
              <button className={styles.ctxItem} onClick={() => ctxAction(() => openNotePicker(ctxMenu.cx, ctxMenu.cy))}>📋 Nota existente</button>
              <div className={styles.ctxSep} />
              <button className={styles.ctxItem} onClick={() => ctxAction(() => setChecklistForm({ title: '', desc: '', cx: ctxMenu.cx, cy: ctxMenu.cy }))}>✅ Nueva Checklist</button>
              <button className={styles.ctxItem} onClick={() => ctxAction(() => openClPicker(ctxMenu.cx, ctxMenu.cy))}>📁 Checklist existente</button>
              <button className={styles.ctxItem} onClick={() => ctxAction(() => imageInputRef.current?.click())}>🖼️ Insertar imagen</button>
              <div className={styles.ctxSep} />
              <button className={`${styles.ctxItem} ${styles.ctxDanger}`} onClick={() => ctxAction(clearBoard)}>🗑️ Limpiar canvas</button>
            </>
          )}
        </div>
      )}

      {/* ══════════════ NOTE CREATOR MODAL ══════════════ */}
      {noteForm && (
        <div className={styles.overlay} onClick={() => setNoteForm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <p className={styles.modalTitle}>🗒️ Nueva Nota</p>
              <button className={styles.modalClose} onClick={() => setNoteForm(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <input className={styles.modalInput} placeholder="Título *" value={noteForm.title} autoFocus
                onChange={e => setNoteForm(f => f ? { ...f, title: e.target.value } : f)} />
              <textarea className={styles.modalTextarea} placeholder="Contenido *" rows={4} value={noteForm.text}
                onChange={e => setNoteForm(f => f ? { ...f, text: e.target.value } : f)} />
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setNoteForm(null)}>Cancelar</button>
                <button className={styles.saveBtn} onClick={createAndInsertNote}
                  disabled={formSaving || !noteForm.title.trim() || !noteForm.text.trim()}>
                  {formSaving ? 'Guardando...' : 'Crear y colocar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ CHECKLIST CREATOR MODAL ══════════════ */}
      {checklistForm && (
        <div className={styles.overlay} onClick={() => setChecklistForm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <p className={styles.modalTitle}>✅ Nueva Checklist</p>
              <button className={styles.modalClose} onClick={() => setChecklistForm(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <input className={styles.modalInput} placeholder="Título *" value={checklistForm.title} autoFocus
                onChange={e => setChecklistForm(f => f ? { ...f, title: e.target.value } : f)} />
              <input className={styles.modalInput} placeholder="Descripción (opcional)" value={checklistForm.desc}
                onChange={e => setChecklistForm(f => f ? { ...f, desc: e.target.value } : f)} />
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setChecklistForm(null)}>Cancelar</button>
                <button className={styles.saveBtn} onClick={createAndInsertCl}
                  disabled={formSaving || !checklistForm.title.trim()}>
                  {formSaving ? 'Creando...' : 'Crear y colocar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ NOTE PICKER MODAL ══════════════ */}
      {notePicker && (
        <div className={styles.overlay} onClick={() => setNotePicker(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <p className={styles.modalTitle}>Seleccionar nota existente</p>
              <button className={styles.modalClose} onClick={() => setNotePicker(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {pickerLoading && <p className={styles.pickerEmpty}>Cargando...</p>}
              {!pickerLoading && notesList.length === 0 && <p className={styles.pickerEmpty}>No hay notas disponibles</p>}
              {notesList.map(note => (
                <div key={note.idNotes} className={styles.pickerItem} onClick={() => insertExistingNote(note, notePicker.cx, notePicker.cy)}>
                  <p className={styles.pickerItemTitle}>{note.title}</p>
                  <p className={styles.pickerItemSub}>{note.text.slice(0, 90)}{note.text.length > 90 ? '...' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ CHECKLIST PICKER MODAL ══════════════ */}
      {clPicker && (
        <div className={styles.overlay} onClick={() => setClPicker(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <p className={styles.modalTitle}>Seleccionar checklist existente</p>
              <button className={styles.modalClose} onClick={() => setClPicker(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {pickerLoading && <p className={styles.pickerEmpty}>Cargando...</p>}
              {!pickerLoading && objList.length === 0 && <p className={styles.pickerEmpty}>No hay checklists disponibles</p>}
              {objList.map(obj => (
                <div key={obj.idObjectives} className={styles.pickerItem} onClick={() => insertExistingCl(obj, clPicker.cx, clPicker.cy)}>
                  <p className={styles.pickerItemTitle}>{obj.title}</p>
                  {obj.description && <p className={styles.pickerItemSub}>{obj.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ EDIT NOTE MODAL ══════════════ */}
      {editingElem?.type === 'note' && (
        <div className={styles.overlay} onClick={() => setEditingElem(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <p className={styles.modalTitle}>✏️ Editar Nota</p>
              <button className={styles.modalClose} onClick={() => setEditingElem(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <input className={styles.modalInput} placeholder="Título *" value={editNoteTitle} autoFocus
                onChange={e => setEditNoteTitle(e.target.value)} />
              <textarea className={styles.modalTextarea} placeholder="Contenido *" rows={6} value={editNoteText}
                onChange={e => setEditNoteText(e.target.value)} />
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setEditingElem(null)}>Cancelar</button>
                <button className={styles.saveBtn} onClick={saveNoteEdit}
                  disabled={editSaving || !editNoteTitle.trim() || !editNoteText.trim()}>
                  {editSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ EDIT CHECKLIST MODAL ══════════════ */}
      {editingElem?.type === 'checklist' && (
        <div className={styles.overlay} onClick={() => setEditingElem(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <p className={styles.modalTitle}>✏️ Editar Checklist</p>
              <button className={styles.modalClose} onClick={() => setEditingElem(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <input className={styles.modalInput} placeholder="Título *" value={editClTitle} autoFocus
                onChange={e => setEditClTitle(e.target.value)} />
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setEditingElem(null)}>Cancelar</button>
                <button className={styles.saveBtn} onClick={saveClEdit}
                  disabled={editSaving || !editClTitle.trim()}>
                  {editSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   ELEMENT VIEW
══════════════════════════════════════════════════════════════════════ */
interface ElementViewProps {
  element: CanvasElement;
  liveX: number; liveY: number;
  liveWidth: number; liveHeight: number;
  pan: { x: number; y: number };
  zoom: number;
  isSelected: boolean;
  canInteract: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onDoubleClick: (e: React.MouseEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, type: CanvasElement['type']) => void;
  onTaskToggle: (elemId: string, taskId: number, completed: boolean) => void;
  onMarkAll: (elemId: string, completed: boolean) => void;
  onAddTask: (elemId: string, title: string) => void;
  onDeleteTask: (elemId: string, taskId: number) => void;
  taskInput: string;
  onSetTaskInput: (v: string) => void;
}

const ElementView = memo(({ element, liveX, liveY, liveWidth, liveHeight, pan, zoom, isSelected, canInteract, onMouseDown, onDoubleClick, onContextMenu, onTaskToggle, onMarkAll, onAddTask, onDeleteTask, taskInput, onSetTaskInput }: ElementViewProps) => {
  const { id, type, zIndex } = element;

  const base: React.CSSProperties = {
    position: 'absolute',
    left: liveX * zoom + pan.x,
    top:  liveY * zoom + pan.y,
    width: liveWidth,
    height: liveHeight,
    transform: `scale(${zoom})`,
    transformOrigin: 'top left',
    zIndex: isSelected ? 9998 : zIndex,
    cursor: canInteract ? 'move' : 'default',
    pointerEvents: canInteract ? 'all' : 'none',
    userSelect: 'none',
    boxSizing: 'border-box',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  /* ── Note ── */
  if (type === 'note') return (
    <div style={{ ...base, background: '#2a2a3e', border: `2px solid ${isSelected ? '#667eea' : '#444'}` }}
      onMouseDown={e => onMouseDown(e, id)}
      onDoubleClick={e => onDoubleClick(e, id)}
      onContextMenu={e => onContextMenu(e, id, type)}
    >
      <div style={{ padding: '6px 10px', background: 'rgba(102,126,234,0.18)', borderBottom: '1px solid rgba(102,126,234,0.25)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#667eea', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>🗒 Nota</span>
        {canInteract && <span style={{ fontSize: 9, color: 'rgba(102,126,234,0.6)', letterSpacing: '0.04em' }}>doble clic para editar</span>}
      </div>
      <div style={{ flex: 1, padding: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{element.noteTitle}</p>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }} onWheel={e => e.stopPropagation()}>
          <p style={{ margin: 0, fontSize: 12, color: '#b0b0c0', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{element.noteText}</p>
        </div>
      </div>
    </div>
  );

  /* ── Checklist ── */
  if (type === 'checklist') {
    const tasks = element.tasks ?? [];
    const done = tasks.filter(t => t.completed).length;
    const allDone = tasks.length > 0 && done === tasks.length;
    return (
      <div style={{ ...base, background: '#2a2a3e', border: `2px solid ${isSelected ? '#667eea' : '#444'}` }}
        onMouseDown={e => onMouseDown(e, id)}
        onDoubleClick={e => onDoubleClick(e, id)}
        onContextMenu={e => onContextMenu(e, id, type)}
      >
        {/* Header */}
        <div style={{ padding: '6px 8px', background: 'rgba(46,204,113,0.12)', borderBottom: '1px solid rgba(46,204,113,0.25)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✅ {element.objTitle}</span>
          <span style={{ fontSize: 11, color: allDone ? '#2ecc71' : '#b0b0c0', fontWeight: 600, flexShrink: 0 }}>{done}/{tasks.length}</span>
          {canInteract && tasks.length > 0 && (
            <>
              <button title="Marcar todo"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onMarkAll(id, true); }}
                style={{ fontSize: 10, padding: '2px 5px', background: 'rgba(46,204,113,0.2)', border: '1px solid rgba(46,204,113,0.4)', borderRadius: 4, color: '#2ecc71', cursor: 'pointer', flexShrink: 0 }}>✓</button>
              <button title="Desmarcar todo"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onMarkAll(id, false); }}
                style={{ fontSize: 10, padding: '2px 5px', background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 4, color: '#e74c3c', cursor: 'pointer', flexShrink: 0 }}>✗</button>
            </>
          )}
        </div>

        {/* Task list — scrollable */}
        <div style={{ flex: 1, padding: '4px 6px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}
          onWheel={e => e.stopPropagation()}>
          {tasks.length === 0 && <p style={{ margin: 0, fontSize: 12, color: '#b0b0c0', fontStyle: 'italic', padding: '4px 2px' }}>Sin tareas aún</p>}
          {tasks.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 2px', borderRadius: 3 }}
              className="taskRow">
              <input type="checkbox" checked={t.completed}
                style={{ width: 13, height: 13, accentColor: '#667eea', cursor: 'pointer', flexShrink: 0 }}
                onMouseDown={e => e.stopPropagation()}
                onChange={e => { e.stopPropagation(); onTaskToggle(id, t.id, !t.completed); }}
              />
              <span style={{ fontSize: 12, color: t.completed ? '#b0b0c0' : '#fff', textDecoration: t.completed ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.title}</span>
              {canInteract && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onDeleteTask(id, t.id); }}
                  title="Eliminar tarea"
                  style={{ width: 16, height: 16, background: 'transparent', border: 'none', color: 'rgba(231,76,60,0.6)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, borderRadius: 2 }}>✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Add-task input (only in select mode) */}
        {canInteract && (
          <div style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 4, flexShrink: 0 }}
            onMouseDown={e => e.stopPropagation()}>
            <input
              value={taskInput}
              placeholder="Nueva tarea..."
              onChange={e => onSetTaskInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddTask(id, taskInput); } }}
              style={{ flex: 1, minWidth: 0, padding: '4px 7px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#fff', fontSize: 11, outline: 'none' }}
            />
            <button
              onClick={e => { e.stopPropagation(); onAddTask(id, taskInput); }}
              disabled={!taskInput.trim()}
              style={{ padding: '4px 8px', background: 'rgba(46,204,113,0.2)', border: '1px solid rgba(46,204,113,0.4)', borderRadius: 4, color: '#2ecc71', fontSize: 11, cursor: 'pointer', flexShrink: 0, opacity: taskInput.trim() ? 1 : 0.4 }}>+</button>
          </div>
        )}
      </div>
    );
  }

  /* ── Image ── */
  if (type === 'image') return (
    <div style={{ ...base, borderRadius: 8, border: isSelected ? '2px solid #667eea' : 'none' }}
      onMouseDown={e => onMouseDown(e, id)}
      onContextMenu={e => onContextMenu(e, id, type)}
    >
      <img src={element.imageSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} draggable={false} />
    </div>
  );

  return null;
});
ElementView.displayName = 'ElementView';
