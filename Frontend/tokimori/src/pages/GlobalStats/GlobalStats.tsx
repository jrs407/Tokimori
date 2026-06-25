import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../../components/Sidebar';
import { sessionService, type DayData } from '../../services/session.service';
import { itemCollectionService, type Item } from '../../services/game-library.service';
import styles from './GlobalStats.module.css';

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const fmt = (h: number) => {
  if (h === 0) return '0h';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h >= 100) return `${Math.round(h)}h`;
  return `${parseFloat(h.toFixed(1))}h`;
};

const getDayLabel = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return DAY_SHORT[d.getDay()];
};

const computeStreak = (last7: DayData[]) => {
  let streak = 0;
  for (let i = last7.length - 1; i >= 0; i--) {
    if (last7[i].hours > 0) streak++;
    else break;
  }
  return streak;
};

interface GlobalData {
  totalHours: number;
  sessionCount: number;
  avgHours: number;
  favoriteDay: { dayOfWeek: number; dayName: string } | null;
  last7Days: DayData[];
  mostPlayedGame: { idGame: number; gameName: string; totalHours: number } | null;
  dailyAverage: Array<{ dayOfWeek: number; avgHours: number }>;
  topGames: Item[];
  gamesCount: number;
}

const BADGES: Array<{
  key: string;
  icon: string;
  label: string;
  check: (d: GlobalData, streak: number) => boolean;
}> = [
  { key: 'h10',     icon: '🌱', label: '10h invertidas',   check: (d) => d.totalHours >= 10 },
  { key: 'h100',    icon: '🏆', label: '100h invertidas', check: (d) => d.totalHours >= 100 },
  { key: 'h500',    icon: '👑', label: '500h invertidas', check: (d) => d.totalHours >= 500 },
  { key: 's10',     icon: '✅', label: '10 sesiones',     check: (d) => d.sessionCount >= 10 },
  { key: 's50',     icon: '🎯', label: '50 sesiones',     check: (d) => d.sessionCount >= 50 },
  { key: 's100',    icon: '🚀', label: '100 sesiones',    check: (d) => d.sessionCount >= 100 },
  { key: 'g5',      icon: '📚', label: '5 elementos',      check: (d) => d.gamesCount >= 5 },
  { key: 'g10',     icon: '🗄️', label: '10 elementos',    check: (d) => d.gamesCount >= 10 },
  { key: 'streak3', icon: '🔥', label: 'Racha de 3 días', check: (_, s) => s >= 3 },
  { key: 'streak7', icon: '⚡', label: 'Semana completa', check: (_, s) => s >= 7 },
];

export const GlobalStats = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [data, setData] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  const loadData = async () => {
    if (!user) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const idUser = Number(user.id);

    setLoading(true);
    setError('');
    setAnimated(false);

    try {
      const [
        sessionCountRes,
        avgHoursRes,
        favoriteDayRes,
        last7Res,
        mostPlayedRes,
        dailyAvgRes,
        collectionRes,
      ] = await Promise.allSettled([
        sessionService.getGlobalSessionCount(token, idUser),
        sessionService.getGlobalAverageHours(token, idUser),
        sessionService.getGlobalFavoriteDay(token, idUser),
        sessionService.getGlobalLast7Days(token, idUser),
        sessionService.getMostPlayedGame(token, idUser),
        sessionService.getGlobalDailyAverage(token, idUser),
        itemCollectionService.getCollectionByHours(token, user.id.toString()),
      ]);

      const topGames = collectionRes.status === 'fulfilled' ? collectionRes.value : [];
      const totalHours = topGames.reduce((sum, g) => sum + (g.totalHours ?? 0), 0);

      setData({
        totalHours,
        sessionCount: sessionCountRes.status === 'fulfilled' ? sessionCountRes.value : 0,
        avgHours: avgHoursRes.status === 'fulfilled' ? avgHoursRes.value : 0,
        favoriteDay: favoriteDayRes.status === 'fulfilled' ? favoriteDayRes.value : null,
        last7Days: last7Res.status === 'fulfilled' ? last7Res.value : [],
        mostPlayedGame: mostPlayedRes.status === 'fulfilled' ? mostPlayedRes.value : null,
        dailyAverage: dailyAvgRes.status === 'fulfilled' ? dailyAvgRes.value : [],
        topGames: topGames.slice(0, 5),
        gamesCount: topGames.length,
      });
    } catch {
      setError('Error al cargar las estadísticas');
    } finally {
      setLoading(false);
      setTimeout(() => setAnimated(true), 80);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) { void loadData(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const streak = data ? computeStreak(data.last7Days) : 0;
  const thisWeekHours = data ? data.last7Days.reduce((s, d) => s + d.hours, 0) : 0;

  const weeklyBars = Array.from({ length: 7 }, (_, i) => {
    const dow = i + 1;
    const found = data?.dailyAverage.find(d => d.dayOfWeek === dow);
    return { dayOfWeek: dow, avgHours: found?.avgHours ?? 0 };
  });
  const maxWeekly = Math.max(...weeklyBars.map(d => d.avgHours), 0.01);
  const last7Max = Math.max(...(data?.last7Days ?? []).map(d => d.hours), 0.01);
  const topMax = Math.max(...(data?.topGames ?? []).map(g => g.totalHours ?? 0), 0.01);

  const earnedBadges = data ? BADGES.filter(b => b.check(data, streak)) : [];
  const lockedBadges = data ? BADGES.filter(b => !b.check(data, streak)).slice(0, Math.max(0, 4 - earnedBadges.length)) : [];

  if (!isAuthenticated) return null;

  return (
    <div className={styles.mainLayout}>
      <Sidebar />
      <main className={styles.mainContent}>
        <div className={styles.contentContainer}>

          {/* ── Header ── */}
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Estadísticas Globales</h1>
              <p className={styles.pageSubtitle}>Resumen de toda tu actividad</p>
            </div>
            <button
              className={styles.refreshBtn}
              onClick={() => { void loadData(); }}
              disabled={loading}
              title="Actualizar"
            >
              <span className={loading ? styles.spinning : ''}>↻</span>
            </button>
          </div>

          {/* ── Loading ── */}
          {loading && (
            <div className={styles.centeredState}>
              <div className={styles.spinner} />
              <p>Cargando estadísticas...</p>
            </div>
          )}

          {/* ── Error ── */}
          {!loading && error && (
            <div className={styles.centeredState}>
              <p className={styles.errorText}>{error}</p>
              <button className={styles.actionBtn} onClick={() => { void loadData(); }}>Reintentar</button>
            </div>
          )}

          {/* ── Empty collection ── */}
          {!loading && !error && data && data.gamesCount === 0 && (
            <div className={styles.centeredState}>
              <span className={styles.bigIcon}>📊</span>
              <p>Tu colección está vacía. ¡Añade elementos para ver tus estadísticas!</p>
              <button className={styles.actionBtn} onClick={() => navigate('/home')}>Ir a mi colección</button>
            </div>
          )}

          {/* ── Main content ── */}
          {!loading && !error && data && data.gamesCount > 0 && (
            <>
              {/* KPI Cards */}
              <div className={styles.kpiGrid}>
                <div className={`${styles.kpiCard} ${styles.kpiHighlight}`}>
                  <span className={styles.kpiIcon}>⏱️</span>
                  <span className={styles.kpiValue}>{fmt(data.totalHours)}</span>
                  <span className={styles.kpiLabel}>Horas totales</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiIcon}>🗓️</span>
                  <span className={styles.kpiValue}>{data.sessionCount}</span>
                  <span className={styles.kpiLabel}>Sesiones totales</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiIcon}>📈</span>
                  <span className={styles.kpiValue}>{fmt(data.avgHours)}</span>
                  <span className={styles.kpiLabel}>Prom. / sesión</span>
                </div>
                <div className={styles.kpiCard}>
                  <span className={styles.kpiIcon}>🗂️</span>
                  <span className={styles.kpiValue}>{data.gamesCount}</span>
                  <span className={styles.kpiLabel}>En colección</span>
                </div>
                <div className={`${styles.kpiCard} ${streak > 0 ? styles.kpiStreak : ''}`}>
                  <span className={styles.kpiIcon}>{streak > 0 ? '🔥' : '📅'}</span>
                  <span className={styles.kpiValue}>{streak}</span>
                  <span className={styles.kpiLabel}>{streak === 1 ? 'Día seguido' : 'Días seguidos'}</span>
                </div>
              </div>

              {/* Charts Row */}
              <div className={styles.chartsRow}>

                {/* Last 7 days */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h2 className={styles.chartTitle}>Últimos 7 días</h2>
                    <span className={styles.chartBadge}>{fmt(thisWeekHours)} esta semana</span>
                  </div>
                  <div className={styles.barChart}>
                    {(data.last7Days.length > 0
                      ? data.last7Days
                      : Array.from({ length: 7 }, (_, i) => ({ date: '', hours: 0 } as DayData))
                    ).map((d, i) => {
                      const pct = animated ? Math.max(3, (d.hours / last7Max) * 100) : 3;
                      return (
                        <div key={i} className={styles.barCol}>
                          <span className={styles.barValueLabel}>{d.hours > 0 ? fmt(d.hours) : ''}</span>
                          <div className={styles.barTrack}>
                            <div className={styles.bar} style={{ height: `${pct}%` }} />
                          </div>
                          <span className={styles.barDayLabel}>
                            {d.date ? getDayLabel(d.date) : DAY_SHORT[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weekly pattern */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h2 className={styles.chartTitle}>Patrón semanal</h2>
                    <span className={styles.chartBadge}>Promedio por día</span>
                  </div>
                  <div className={styles.barChart}>
                    {weeklyBars.map((d, i) => {
                      const pct = animated ? Math.max(3, (d.avgHours / maxWeekly) * 100) : 3;
                      const isFav = data.favoriteDay?.dayOfWeek === d.dayOfWeek;
                      return (
                        <div key={i} className={styles.barCol}>
                          <span className={styles.barValueLabel}>{d.avgHours > 0 ? fmt(d.avgHours) : ''}</span>
                          <div className={styles.barTrack}>
                            <div
                              className={`${styles.bar} ${isFav ? styles.barAccent : ''}`}
                              style={{ height: `${pct}%` }}
                            />
                          </div>
                          <span className={`${styles.barDayLabel} ${isFav ? styles.barDayFav : ''}`}>
                            {DAY_SHORT[i]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {data.favoriteDay && (
                    <p className={styles.chartNote}>
                      Día favorito: <strong>{data.favoriteDay.dayName}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Top games + side panel */}
              <div className={styles.bottomGrid}>

                {/* Top 5 games */}
                <div className={styles.topGamesCard}>
                  <h2 className={styles.cardTitle}>Top elementos por horas</h2>
                  <div className={styles.gamesList}>
                    {data.topGames.map((g, i) => {
                      const pct = animated ? Math.max(2, ((g.totalHours ?? 0) / topMax) * 100) : 2;
                      return (
                        <div
                          key={g.idLibrary ?? i}
                          className={styles.gameRow}
                          onClick={() =>
                            navigate(`/item/${g.idLibrary}`, {
                              state: {
                                itemName: g.name,
                                itemImg: g.img,
                                idGame: g.idGames,
                                totalHours: g.totalHours,
                              },
                            })
                          }
                        >
                          <span className={styles.gameRank}>#{i + 1}</span>
                          {g.img && (
                            <img
                              src={g.img}
                              alt={g.name}
                              className={styles.gameThumb}
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}
                          <div className={styles.gameInfo}>
                            <span className={styles.gameName}>{g.name}</span>
                            <div className={styles.gameBarTrack}>
                              <div className={styles.gameBarFill} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className={styles.gameHoursLabel}>{fmt(g.totalHours ?? 0)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Side panel */}
                <div className={styles.sidePanel}>

                  {data.mostPlayedGame && (
                    <div className={styles.featuredCard}>
                      <span className={styles.featuredTag}>Elemento más activo</span>
                      <span className={styles.featuredName}>{data.mostPlayedGame.gameName}</span>
                      <span className={styles.featuredValue}>{fmt(data.mostPlayedGame.totalHours)}</span>
                      <span className={styles.featuredSub}>de tiempo total</span>
                    </div>
                  )}

                  <div className={styles.insightCard}>
                    <h3 className={styles.insightTitle}>Curiosidades</h3>
                    <ul className={styles.insightList}>
                      <li className={styles.insightItem}>
                        <span>🕐</span>
                        <span>{Math.round(data.totalHours * 60).toLocaleString()} minutos en total</span>
                      </li>
                      {data.totalHours >= 24 && (
                        <li className={styles.insightItem}>
                          <span>📅</span>
                          <span>{(data.totalHours / 24).toFixed(1)} días completos invertidos</span>
                        </li>
                      )}
                      {data.gamesCount > 0 && (
                        <li className={styles.insightItem}>
                          <span>📊</span>
                          <span>{(data.totalHours / data.gamesCount).toFixed(1)}h de media por elemento</span>
                        </li>
                      )}
                      {data.favoriteDay && (
                        <li className={styles.insightItem}>
                          <span>⭐</span>
                          <span>Más activo los {data.favoriteDay.dayName}s</span>
                        </li>
                      )}
                      {streak > 0 && (
                        <li className={styles.insightItem}>
                          <span>🔥</span>
                          <span>Llevas {streak} {streak === 1 ? 'día' : 'días'} seguidos activo</span>
                        </li>
                      )}
                      {data.sessionCount > 0 && (
                        <li className={styles.insightItem}>
                          <span>🎯</span>
                          <span>{(data.totalHours / data.sessionCount).toFixed(1)}h de media por sesión</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Badges */}
              {(earnedBadges.length > 0 || lockedBadges.length > 0) && (
                <div className={styles.badgesSection}>
                  <h2 className={styles.badgesTitle}>
                    Logros
                    {earnedBadges.length > 0 && (
                      <span className={styles.badgesCount}>{earnedBadges.length} desbloqueados</span>
                    )}
                  </h2>
                  <div className={styles.badgesGrid}>
                    {earnedBadges.map(b => (
                      <div key={b.key} className={styles.badge}>
                        <span className={styles.badgeIcon}>{b.icon}</span>
                        <span className={styles.badgeLabel}>{b.label}</span>
                      </div>
                    ))}
                    {lockedBadges.map(b => (
                      <div key={b.key} className={`${styles.badge} ${styles.badgeLocked}`}>
                        <span className={styles.badgeIcon}>🔒</span>
                        <span className={styles.badgeLabel}>{b.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
