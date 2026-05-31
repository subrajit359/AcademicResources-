import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API_URL } from '../config';
import { motion } from 'framer-motion';
import {
  Trophy, Medal, ArrowLeft, Users, BookOpen,
  Clock, Hash, CheckCircle, Loader2, AlertCircle,
  Star, Crown, ChevronRight,
} from 'lucide-react';

function getGrade(pct) {
  if (pct >= 90) return { label: 'A+', color: '#059669' };
  if (pct >= 80) return { label: 'A',  color: '#10b981' };
  if (pct >= 70) return { label: 'B+', color: '#3b82f6' };
  if (pct >= 60) return { label: 'B',  color: '#6366f1' };
  if (pct >= 50) return { label: 'C',  color: '#f59e0b' };
  return { label: 'F', color: '#ef4444' };
}

const RANK_META = {
  1: { bg: '#fef9c3', border: '#fbbf24', icon: '🥇', label: '1st' },
  2: { bg: '#f1f5f9', border: '#94a3b8', icon: '🥈', label: '2nd' },
  3: { bg: '#fff7ed', border: '#fb923c', icon: '🥉', label: '3rd' },
};

export default function Leaderboard() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!shareCode) return;
    setLoading(true);
    fetch(`${API_URL}/api/testSubmission/leaderboard/${shareCode.trim().toUpperCase()}`)
      .then(r => r.json())
      .then(d => {
        if (d.message && !d.leaderboard) { setError(d.message); }
        else { setData(d); }
        setLoading(false);
      })
      .catch(() => { setError('Could not load results. Please check the code and try again.'); setLoading(false); });
  }, [shareCode]);

  const myEntry = data?.leaderboard?.find(r => r.userId === user?.id);

  return (
    <div className="lb-page">
      <div className="lb-container">

        {/* Back */}
        <button className="lb-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>

        {loading && (
          <div className="lb-center">
            <Loader2 size={36} className="spin" color="#6366f1" />
            <p>Loading results…</p>
          </div>
        )}

        {error && !loading && (
          <div className="lb-error-wrap">
            <AlertCircle size={40} color="#dc2626" />
            <h3>Test not found</h3>
            <p>{error}</p>
            <Link to="/" className="lb-home-btn">Go to Home</Link>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Test info header */}
            <motion.div className="lb-header" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="lb-header-icon">
                <Trophy size={28} color="#f59e0b" />
              </div>
              <div className="lb-header-info">
                <h1 className="lb-title">{data.test.title}</h1>
                <div className="lb-meta-chips">
                  {data.test.subject && (
                    <span className="lb-chip"><BookOpen size={11} /> {data.test.subject}</span>
                  )}
                  {data.test.category && (
                    <span className="lb-chip"><Hash size={11} /> {data.test.category}</span>
                  )}
                  <span className="lb-chip"><Users size={11} /> {data.totalAttempts} attempt{data.totalAttempts !== 1 ? 's' : ''}</span>
                  {data.test.shareCode && (
                    <span className="lb-chip lb-chip-code">
                      <Star size={11} /> Code: {data.test.shareCode}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* My result highlight */}
            {myEntry && (
              <motion.div
                className="lb-my-result"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
              >
                <div className="lb-my-result-left">
                  <Crown size={18} color="#6366f1" />
                  <div>
                    <div className="lb-my-result-label">Your Result</div>
                    <div className="lb-my-result-rank">Rank #{myEntry.rank} of {data.totalAttempts}</div>
                  </div>
                </div>
                <div className="lb-my-score-wrap">
                  <span className="lb-my-score" style={{ color: getGrade(myEntry.pct).color }}>
                    {myEntry.score}/{myEntry.total}
                  </span>
                  <span className="lb-my-pct" style={{ color: getGrade(myEntry.pct).color }}>
                    {myEntry.pct}% · {getGrade(myEntry.pct).label}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Podium — top 3 */}
            {data.leaderboard.length >= 3 && (
              <motion.div className="lb-podium" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {[1, 0, 2].map(idx => {
                  const entry = data.leaderboard[idx];
                  if (!entry) return null;
                  const meta = RANK_META[entry.rank] || {};
                  const isMe = entry.userId === user?.id;
                  return (
                    <motion.div
                      key={entry.rank}
                      className={`lb-podium-col lb-podium-${entry.rank} ${isMe ? 'lb-is-me' : ''}`}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.22 + idx * 0.08, duration: 0.42 }}
                    >
                      <div className="lb-podium-icon">{meta.icon}</div>
                      {entry.avatar
                        ? <img src={entry.avatar} alt={entry.name} className="lb-podium-avatar" />
                        : <div className="lb-podium-avatar lb-podium-init">{entry.name?.[0]?.toUpperCase()}</div>
                      }
                      <div className="lb-podium-name">{entry.name}{isMe && <span className="lb-you-tag">You</span>}</div>
                      <div className="lb-podium-score" style={{ color: getGrade(entry.pct).color }}>{entry.pct}%</div>
                      <div className="lb-podium-bar" style={{ background: meta.border, height: entry.rank === 1 ? 72 : entry.rank === 2 ? 52 : 36 }} />
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Full leaderboard table */}
            <motion.div className="lb-table-wrap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.44 }}>
              <div className="lb-table-hdr">
                <span>Rank</span>
                <span>Student</span>
                <span>Score</span>
                <span>Grade</span>
              </div>
              {data.leaderboard.map((entry, i) => {
                const grade  = getGrade(entry.pct);
                const meta   = RANK_META[entry.rank];
                const isMe   = entry.userId === user?.id;
                return (
                  <motion.div
                    key={entry.rank}
                    className={`lb-table-row ${isMe ? 'lb-row-me' : ''} ${meta ? 'lb-row-top' : ''}`}
                    style={meta ? { background: meta.bg, borderLeft: `3px solid ${meta.border}` } : {}}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.32 + i * 0.04, duration: 0.35 }}
                  >
                    <div className="lb-rank-cell">
                      {meta ? (
                        <span className="lb-rank-emoji">{meta.icon}</span>
                      ) : (
                        <span className="lb-rank-num">#{entry.rank}</span>
                      )}
                    </div>
                    <div className="lb-student-cell">
                      {entry.avatar
                        ? <img src={entry.avatar} alt={entry.name} className="lb-avatar" />
                        : <div className="lb-avatar lb-avatar-init">{entry.name?.[0]?.toUpperCase()}</div>
                      }
                      <span className="lb-student-name">
                        {entry.name}
                        {isMe && <span className="lb-you-tag">You</span>}
                      </span>
                    </div>
                    <div className="lb-score-cell">
                      <span className="lb-score-frac">{entry.score}/{entry.total}</span>
                      <div className="lb-score-bar-track">
                        <motion.div
                          className="lb-score-bar-fill"
                          style={{ background: grade.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${entry.pct}%` }}
                          transition={{ delay: 0.4 + i * 0.04, duration: 0.5 }}
                        />
                      </div>
                    </div>
                    <div className="lb-grade-cell">
                      <span className="lb-grade-pill" style={{ color: grade.color, background: grade.color + '18' }}>
                        {grade.label}
                      </span>
                      <span className="lb-pct" style={{ color: grade.color }}>{entry.pct}%</span>
                    </div>
                  </motion.div>
                );
              })}

              {data.leaderboard.length === 0 && (
                <div className="lb-empty">
                  <Users size={36} color="#cbd5e1" />
                  <p>No submissions yet for this test.</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
