import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { AddItem } from './pages/AddGame'
import { ItemDetail } from './pages/ItemDetail'
import { GlobalStats } from './pages/GlobalStats'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'
import { timerStorage, computeRemaining, type StoredTimer } from './services/timer.storage'
import { settingsStorage, applyAccentColor, applyReduceAnimations, applyTheme } from './services/settings.storage'
import './App.css'

// Apply persisted visual settings on startup
const _initSettings = settingsStorage.get()
applyAccentColor(_initSettings.accentColor, _initSettings.accentHover)
applyReduceAnimations(_initSettings.reduceAnimations)
applyTheme(_initSettings.theme)

const pad = (n: number) => String(n).padStart(2, '0')

/* ─── Floating global timer indicator ─── */
const GlobalTimerIndicator = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [timer, setTimer] = useState<StoredTimer | null>(() => timerStorage.get())
  const [remSecs, setRemSecs] = useState<number>(() => {
    const t = timerStorage.get()
    return t ? computeRemaining(t) : 0
  })
  const prevStatus = useRef<string | null>(timerStorage.get()?.status ?? null)

  useEffect(() => {
    /* Sync state from localStorage (called on event AND on each tick) */
    const sync = () => {
      const t = timerStorage.get()
      if (!t) {
        prevStatus.current = null
        setTimer(null)
        setRemSecs(0)
        return
      }
      if (t.status === 'running') {
        const rem = computeRemaining(t)
        if (rem <= 0) {
          /* Timer just expired – mark done. set() dispatches the event which re-calls sync,
             on the next call status === 'done' so we fall through to the else branch. */
          timerStorage.set({ ...t, status: 'done', pausedRemaining: 0 })
          return
        }
        prevStatus.current = 'running'
        setTimer(t)
        setRemSecs(rem)
      } else {
        /* paused or done – keep timer object fresh, remSecs stays as pausedRemaining */
        if (t.status === 'done' && prevStatus.current === 'running') {
          /* Transition running → done: fire browser notification if enabled */
          const { timerNotifications } = settingsStorage.get()
          if (timerNotifications && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('¡Temporizador terminado!', {
              body: t.itemName ? `Sesión de "${t.itemName}" completada.` : 'Tu sesión ha terminado.',
              icon: t.itemImg ?? undefined,
            })
          }
        }
        prevStatus.current = t.status
        setTimer(t)
        setRemSecs(t.pausedRemaining)
      }
    }

    window.addEventListener('tokimori_timer_change', sync)
    const id = setInterval(sync, 1000)
    sync() // immediate initial sync

    return () => {
      clearInterval(id)
      window.removeEventListener('tokimori_timer_change', sync)
    }
  }, [])

  /* ── Drag state ── */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const didDrag = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    didDrag.current = false
    const rect = e.currentTarget.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    didDrag.current = true
    const el = e.currentTarget
    const nx = Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - el.offsetWidth))
    const ny = Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - el.offsetHeight))
    setPos({ x: nx, y: ny })
  }

  const onPointerUp = () => { dragging.current = false }

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'
  if (!timer || isAuthPage) return null

  const isDone = timer.status === 'done'
  const isPaused = timer.status === 'paused'

  const h = Math.floor(remSecs / 3600)
  const m = Math.floor((remSecs % 3600) / 60)
  const s = remSecs % 60
  const display = `${pad(h)}:${pad(m)}:${pad(s)}`

  const progress = timer.duration > 0
    ? Math.min(100, Math.round(((timer.duration - remSecs) / timer.duration) * 100))
    : 0

  const accentColor = isDone ? '#2ecc71' : isPaused ? '#ffc107' : '#667eea'
  const shadowColor = isDone
    ? 'rgba(46,204,113,0.35)'
    : isPaused
    ? 'rgba(255,193,7,0.3)'
    : 'rgba(102,126,234,0.35)'

  const goToSessions = () =>
    navigate(`/item/${timer.idLibrary}`, {
      state: {
        itemName: timer.itemName,
        itemImg: timer.itemImg,
        activeTab: 'sessions',
        idGame: timer.idGame,
        totalHours: timer.totalHours,
      },
    })

  const posStyle: React.CSSProperties = pos
    ? { top: pos.y, left: pos.x }
    : { bottom: 28, right: 28 }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={() => { if (!didDrag.current) goToSessions() }}
      style={{
        position: 'fixed',
        ...posStyle,
        zIndex: 9999,
        background: 'var(--timer-bg)',
        border: `2px solid ${accentColor}`,
        borderRadius: 14,
        padding: '12px 16px',
        cursor: 'grab',
        minWidth: 190,
        boxShadow: `0 8px 32px ${shadowColor}, 0 2px 8px rgba(0,0,0,0.4)`,
        userSelect: 'none',
        touchAction: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: pos ? 'box-shadow 0.2s, border-color 0.2s' : 'box-shadow 0.2s, border-color 0.2s',
      }}
      title="Arrastra para mover · Clic para ir a la sesión"
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: isDone
              ? 'rgba(46,204,113,0.15)'
              : isPaused
              ? 'rgba(255,193,7,0.15)'
              : 'rgba(102,126,234,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {isDone ? '✓' : isPaused ? '⏸' : '▶'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}
          >
            {isDone ? '¡Completado!' : isPaused ? 'En pausa' : 'En curso'}
          </span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.02em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.1,
            }}
          >
            {display}
          </span>
        </div>

        {/* Dismiss button – only when done */}
        {isDone && (
          <button
            onClick={e => { e.stopPropagation(); timerStorage.clear() }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: '0 0 0 4px',
              flexShrink: 0,
            }}
            title="Descartar"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress bar */}
      {!isDone && (
        <div
          style={{
            width: '100%',
            height: 4,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: isPaused
                ? 'linear-gradient(90deg,#f0a500,#ffc107)'
                : 'linear-gradient(90deg,#667eea,#764ba2)',
              borderRadius: 2,
              transition: 'width 0.8s linear',
            }}
          />
        </div>
      )}

      {/* Item name */}
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 158,
        }}
      >
        {timer.itemName}
      </span>
    </div>
  )
}

function App() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const { theme } = settingsStorage.get()
      if (theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/create" element={<AddItem />} />
        <Route path="/item/:idLibrary" element={<ItemDetail />} />
        <Route path="/stats" element={<GlobalStats />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
      <GlobalTimerIndicator />
    </BrowserRouter>
  )
}

export default App
