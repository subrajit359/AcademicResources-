import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../App';
import { API_URL } from '../config';
import { motion } from 'framer-motion';
import {
  Clock, BookOpen, RotateCcw, Loader2,
  ClipboardList, Calendar, History, Globe, Lock, Link2,
} from 'lucide-react';

const GRADE_MAP = [
  { min: 90, label: 'A+', color: '#059669', bg: '#f0fdf4' },
  { min: 80, label: 'A',  color: '#10b981', bg: '#ecfdf5' },
  { min: 70, label: 'B',  color: '#2563eb', bg: '#eff6ff' },
  { min: 60, label: 'C',  color: '#7c3aed', bg: '#f5f3ff' },
  { min: 50, label: 'D',  color: '#d97706', bg: '#fffbeb' },
  { min: 0,  label: 'F',  color: '#dc2626', bg: '#fef2f2' },
];
const getGrade = (pct) => GRADE_MAP.find(g => pct >= g.min) || GRADE_MAP[GRADE_MAP.length - 1];

const CAT_COLORS = {
  'CSE':      { bg: '#eef2ff', color: '#6366f1' },
  'SSC GD':   { bg: '#fef3c7', color: '#d97706' },
  'Agniveer': { bg: '#fce7f3', color: '#db2777' },
  'Nursing':  { bg: '#ecfdf5', color: '#059669' },
  'WBP':      { bg: '#eff6ff', color: '#2563eb' },
  'Railway':  { bg: '#fff7ed', color: '#ea580c' },
};
const catFallback = { bg: '#f1f5f9', color: '#6366f1' };

const fmt     = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

export default function TestHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/testSubmission/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setHistory(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="page-wrap">
      <div className="page-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={26} color="var(--primary)" /> Test History
        </h1>
        <p>Your last 10 attempted tests — private &amp; public</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '80px 0', color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="spin" color="var(--primary)" /> Loading your history…
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
          <ClipboardList size={52} strokeWidth={1.3} style={{ marginBottom: 14, opacity: 0.3 }} />
          <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: 'var(--text)' }}>No tests attempted yet</h3>
          <p style={{ fontSize: 13, margin: '0 0 20px' }}>
            Start a test using a code from your teacher or try an AI-generated practice test.
          </p>
          <button
            onClick={() => navigate('/ai-generator')}
            style={{ padding: '10px 22px', borderRadius: 9, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            Try AI Practice Test
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {history.map((r, i) => {
            const pct  = r.total ? Math.round((r.score / r.total) * 100) : 0;
            const g    = getGrade(pct);
            const test = r.testId || {};
            const { bg: catBg, color: catColor } = CAT_COLORS[test.category] || catFallback;

            return (
              <motion.div
                key={r._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  background: 'var(--bg-white)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 14, padding: '16px 20px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: catBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={20} color={catColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {test.title || 'Untitled Test'}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', alignItems: 'center' }}>
                      {/* Test type badge */}
                      {test.publishStatus === 'approved' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#ecfdf5', color: '#059669', padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 10, border: '1px solid #bbf7d0' }}>
                          <Globe size={9} /> Platform
                        </span>
                      ) : test.isPublic === false ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f1f5f9', color: '#64748b', padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 10, border: '1px solid #e2e8f0' }}>
                          <Lock size={9} /> Private
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#eff6ff', color: '#2563eb', padding: '2px 7px', borderRadius: 4, fontWeight: 700, fontSize: 10, border: '1px solid #bfdbfe' }}>
                          <Link2 size={9} /> Teacher Code
                        </span>
                      )}
                      {test.category && (
                        <span style={{ background: catBg, color: catColor, padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11 }}>{test.category}</span>
                      )}
                      {test.subject && <span>· {test.subject}</span>}
                      {test.duration && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={11} /> {test.duration} min
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 900, background: g.bg, color: g.color, padding: '4px 10px', borderRadius: 8, flexShrink: 0 }}>
                    {g.label}
                  </span>
                </div>

                {/* Accuracy bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.score}/{r.total} correct</span>
                    <span style={{ fontWeight: 700, color: g.color }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                  </div>
                </div>

                {/* Bottom: date + retake */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={11} /> {fmt(r.submittedAt)} · {fmtTime(r.submittedAt)}
                  </span>
                  {test.shareCode && (
                    <button
                      onClick={() => navigate(`/take-test/${test.shareCode}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                    >
                      <RotateCcw size={12} /> Retake
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
