import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Home } from './pages/Home'
import { AddItem } from './pages/AddGame'
import { ItemDetail } from './pages/ItemDetail'
import { timerStorage, computeRemaining, type StoredTimer } from './services/timer.storage'
import './App.css'

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

  useEffect(() => {
    /* Sync state from localStorage (called on event AND on each tick) */
    const sync = () => {
      const t = timerStorage.get()
      if (!t) {
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
        setTimer(t)
        setRemSecs(rem)
      } else {
        /* paused or done – keep timer object fresh, remSecs stays as pausedRemaining */
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

  return (
    <div
      onClick={goToSessions}
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 9999,
        background: '#1e1e35',
        border: `2px solid ${accentColor}`,
        borderRadius: 14,
        padding: '12px 16px',
        cursor: 'pointer',
        minWidth: 190,
        boxShadow: `0 8px 32px ${shadowColor}, 0 2px 8px rgba(0,0,0,0.4)`,
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
      title="Ir a la sesión activa"
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
              color: '#b0b0c0',
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
              color: '#ffffff',
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
              color: '#b0b0c0',
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
          color: '#b0b0c0',
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/create" element={<AddItem />} />
        <Route path="/item/:idLibrary" element={<ItemDetail />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
      <GlobalTimerIndicator />
    </BrowserRouter>
  )
}

export default App
