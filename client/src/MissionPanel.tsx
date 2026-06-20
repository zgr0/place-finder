import { useState } from 'react';
import { useLanguage } from './LanguageContext';
import { API_BASE } from './config';

interface Objective {
  text: string;
  done: boolean;
}

interface Mission {
  id: string;
  commander: string;
  venue: string;
  status: string;
  points: number;
  rawText: string;
  objectives: Objective[];
}

export default function MissionPanel() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const { t, lang } = useLanguage();

  async function generateMissions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/missions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setMissions(data.missions);
    } catch (e: any) {
      setError(e.message || 'Failed to generate missions');
    } finally {
      setLoading(false);
    }
  }

  function toggleObjective(missionId: string, objIdx: number) {
    setMissions(prev =>
      prev.map(m =>
        m.id !== missionId
          ? m
          : {
              ...m,
              objectives: m.objectives.map((o, i) =>
                i === objIdx ? { ...o, done: !o.done } : o
              ),
            }
      )
    );
  }

  function isMissionComplete(m: Mission) {
    return m.objectives.length > 0 && m.objectives.every(o => o.done);
  }

  const earnedPoints = missions.filter(isMissionComplete).reduce((sum, m) => sum + (m.points ?? 0), 0);
  const totalPoints = missions.reduce((sum, m) => sum + (m.points ?? 0), 0);

  const statusColor: Record<string, string> = {
    'Contested': '#f59e0b',
    'Under Attack': '#ef4444',
    'Controlled by Red Reapers': '#dc2626',
    'Controlled by Blue Sentinels': '#3b82f6',
    'Controlled by Green Guardians': '#22c55e',
    'Liberated': '#a78bfa',
  };

  return (
    <div className="mission-panel">
      <div className="mission-panel-header" onClick={() => setOpen(v => !v)}>
        <span className="mission-panel-icon">⚡</span>
        <span className="mission-panel-title">{t.missions}</span>
        {missions.length > 0 && (
          <span className="mission-panel-pts">
            {earnedPoints}/{totalPoints} XP
          </span>
        )}
        <span className="mission-panel-chevron">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="mission-panel-body">
          <button
            className="mission-generate-btn"
            onClick={generateMissions}
            disabled={loading}
          >
            {loading ? t.generatingMissions : t.generateMissions}
          </button>

          {error && (
            <div className="mission-error">
              {error.includes('Failed to fetch') || error.includes('NetworkError')
                ? t.inferenceOffline
                : error}
            </div>
          )}

          {missions.length > 0 && (
            <>
              {earnedPoints === totalPoints && totalPoints > 0 && (
                <div className="mission-all-complete">
                  {t.allMissionsComplete(totalPoints)}
                </div>
              )}
              <div className="mission-list">
                {missions.map(mission => {
                  const complete = isMissionComplete(mission);
                  return (
                    <div
                      key={mission.id}
                      className={`mission-card ${complete ? 'mission-card--complete' : ''}`}
                    >
                      <div className="mission-card-header">
                        <span className="mission-commander">[{mission.commander}]</span>
                        <span className={`mission-points ${complete ? 'mission-points--earned' : ''}`}>
                          {complete ? '+' : ''}{mission.points ?? 0} XP
                        </span>
                      </div>
                      <div className="mission-venue">{mission.venue}</div>
                      <div
                        className="mission-status"
                        style={{ color: statusColor[mission.status] || '#94a3b8' }}
                      >
                        {mission.status}
                      </div>
                      {complete && (
                        <div className="mission-complete-badge">{t.complete}</div>
                      )}
                      <div className="mission-objectives">
                        {mission.objectives.map((obj, i) => (
                          <label key={i} className="mission-objective">
                            <input
                              type="checkbox"
                              checked={obj.done}
                              onChange={() => toggleObjective(mission.id, i)}
                            />
                            <span className={obj.done ? 'mission-obj-done' : ''}>
                              {obj.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
