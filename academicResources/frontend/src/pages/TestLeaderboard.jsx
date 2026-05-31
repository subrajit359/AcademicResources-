import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { API_URL } from '../config';
import {
  Trophy, Search, Loader2, AlertTriangle, ChevronLeft,
  ClipboardList, Timer, BookOpen, Users, Target, Medal,
  Crown, Star, CheckCircle, XCircle, Minus, Calendar,
  Hash, Link2, RefreshCw,
} from 'lucide-react';

const GRADE = (p) =>
  p >= 90 ? { label: 'A+', color: '#059669', bg: '#f0fdf4' } :
  p >= 80 ? { label: 'A',  color: '#10b981', bg: '#ecfdf5' } :
  p >= 70 ? { label: 'B+', color: '#2563eb', bg: '#eff6ff' } :
  p >= 60 ? { label: 'B',  color: '#6366f1', bg: '#eef2ff' } :
  p >= 50 ? { label: 'C',  color: '#d97706', bg: '#fffbeb' } :
            { label: 'F',  color: '#dc2626', bg: '#fef2f2' };

const RANK_META = [
  { bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', shadow: '0 4px 14px rgba(245,158,11,.45)', Icon: Crown,  iconColor: '#fff' },
  { bg: 'linear-gradient(135deg,#64748b,#94a3b8)', shadow: '0 4px 14px rgba(100,116,139,.35)', Icon: Medal,  iconColor: '#fff' },
  { bg: 'linear-gradient(135deg,#b45309,#d97706)', shadow: '0 4px 14px rgba(180,83,9,.35)',    Icon: Star,   iconColor: '#fff' },
];

function Avatar({ name, avatar, size = 36 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  if (avatar) {
    return <img src={avatar} alt={name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border)' }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
      color: '#fff', fontSize: size * 0.36, fontWeight: 800,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid var(--border)',
    }}>{initials}</div>
  );
}

function extractCode(raw) {
  raw = raw.trim();
  try {
    if (raw.startsWith('http') || raw.includes('://') || raw.includes('/#/')) {
      const url = raw.includes('/#/') ? new URL(raw.replace('/#/', '/')) : new URL(raw);
      const segs = url.pathname.split('/').filter(Boolean);
      return segs[segs.length - 1] || raw;
    }
  } catch {}
  return raw;
}

export default function TestLeaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [data,    setData]    = useState(null);

  const lookup = async () => {
    const code = extractCode(input);
    if (!code) { setError('Please enter a test code or link.'); return; }
    setLoading(true); setError(''); setData(null);
    try {
      const res = await fetch(`${API_URL}/api/testSubmission/leaderboard/${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!res.ok) { setError(json.message || 'Test not found.'); return; }
      setData(json);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const myId = user?.id;
  const myRow = data?.leaderboard.find(r => r.userId === myId);
  const myRank = myRow?.rank;

  const podium = data?.leaderboard.slice(0, 3) ?? [];
  const rest   = data?.leaderboard.slice(3) ?? [];

  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 48px' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={22} color="#f59e0b" /> Test Leaderboard
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Enter a test code or share link to view everyone's results
          </p>
        </div>
      </div>

      {/* ── Input card ── */}
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16,
        padding: '24px 24px 20px', marginBottom: 28,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Hash size={15} color="var(--primary)" /> Enter Test Code or Share Link
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Link2 size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="Paste a share link or type the test code (e.g. a1b2c3d4e5)"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '11px 14px 11px 34px',
                borderRadius: 10, fontSize: 14,
                border: `1.5px solid ${error ? '#fca5a5' : 'var(--border)'}`,
                background: 'var(--bg-soft,#f8f9fa)', color: 'var(--text)',
                outline: 'none',
                fontFamily: 'monospace',
              }}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '0 22px', fontSize: 14, height: 44 }}
            onClick={lookup}
            disabled={loading || !input.trim()}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
            {loading ? ' Looking up…' : ' View Results'}
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          You can paste a full share link (like <code style={{ background: 'var(--border)', padding: '1px 5px', borderRadius: 4 }}>https://…/#/take-test/a1b2c3d4e5</code>) or just the short code. Results are visible to everyone with the code.
        </p>
      </div>

      {/* ── Results ── */}
      {data && (
        <>
          {/* Test info banner */}
          <div style={{
            background: 'linear-gradient(135deg,#1e40af,#4f46e5)',
            borderRadius: 16, padding: '20px 24px', marginBottom: 24, color: '#fff',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, opacity: 0.75, marginBottom: 6, textTransform: 'uppercase' }}>
              Test Results
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 900 }}>{data.test.title}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {[
                { Icon: Users,    val: `${data.totalAttempts} attempt${data.totalAttempts !== 1 ? 's' : ''}` },
                { Icon: Timer,    val: `${data.test.duration} min` },
                data.test.subject  && { Icon: BookOpen, val: data.test.subject },
                data.test.category && { Icon: Target,   val: data.test.category },
              ].filter(Boolean).map(({ Icon, val }) => (
                <span key={val} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, opacity: 0.9, fontWeight: 600 }}>
                  <Icon size={13} /> {val}
                </span>
              ))}
            </div>
            {data.test.startTime && (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={11} />
                Held: {fmt(data.test.startTime)}
                {data.test.endTime && ` → ${fmt(data.test.endTime)}`}
              </div>
            )}
          </div>

          {/* My rank callout */}
          {myRow && (
            <div style={{
              background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)',
              border: '1.5px solid #86efac', borderRadius: 14,
              padding: '14px 20px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trophy size={22} color="#fff" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#15803d' }}>
                  Your Result — Rank #{myRank} of {data.totalAttempts}
                </div>
                <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>
                  {myRow.score}/{myRow.total} correct · {myRow.pct}% · Grade {GRADE(myRow.pct).label}
                </div>
              </div>
              <div style={{
                marginLeft: 'auto', fontSize: 28, fontWeight: 900,
                color: GRADE(myRow.pct).color,
                background: GRADE(myRow.pct).bg,
                padding: '6px 14px', borderRadius: 10,
              }}>
                {GRADE(myRow.pct).label}
              </div>
            </div>
          )}

          {data.totalAttempts === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <Users size={44} strokeWidth={1.3} style={{ opacity: 0.3, marginBottom: 14 }} />
              <h3 style={{ margin: '0 0 8px', fontWeight: 700 }}>No attempts yet</h3>
              <p style={{ margin: 0, fontSize: 13 }}>No one has submitted this test yet. Share the code to get started!</p>
            </div>
          ) : (
            <>
              {/* ── Podium (top 3) ── */}
              {podium.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Crown size={15} color="#f59e0b" /> Top Performers
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {podium.map((r) => {
                      const rm  = RANK_META[r.rank - 1];
                      const g   = GRADE(r.pct);
                      const isMe = r.userId === myId;
                      return (
                        <div key={r.rank} style={{
                          flex: '1 1 200px', minWidth: 180,
                          background: 'var(--bg)', border: isMe ? '2px solid #86efac' : '1px solid var(--border)',
                          borderRadius: 16, padding: '20px 16px', textAlign: 'center',
                          position: 'relative', overflow: 'hidden',
                          boxShadow: rm.shadow,
                        }}>
                          {isMe && (
                            <div style={{ position: 'absolute', top: 8, right: 8, background: '#059669', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 6, letterSpacing: 0.5 }}>
                              YOU
                            </div>
                          )}
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: rm.bg, boxShadow: rm.shadow,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 10px',
                          }}>
                            <rm.Icon size={22} color={rm.iconColor} />
                          </div>
                          <Avatar name={r.name} avatar={r.avatar} size={44} />
                          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', margin: '8px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: g.color }}>{r.pct}%</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.score}/{r.total} correct</div>
                          <div style={{
                            display: 'inline-block', marginTop: 8,
                            background: g.bg, color: g.color,
                            fontSize: 12, fontWeight: 800,
                            padding: '3px 10px', borderRadius: 6,
                          }}>{g.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Full table ── */}
              <div className="lb-table">
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ClipboardList size={15} color="var(--primary)" /> All Results ({data.totalAttempts})
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={lookup} title="Refresh">
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>

                <div className="lb-table-head">
                  <span>Rank</span>
                  <span>Student</span>
                  <span>Score</span>
                  <span style={{ textAlign: 'center' }}>Accuracy</span>
                  <span style={{ textAlign: 'center' }}>Grade</span>
                  <span style={{ textAlign: 'right' }}>Submitted</span>
                </div>

                {data.leaderboard.map((r) => {
                  const g    = GRADE(r.pct);
                  const isMe = r.userId === myId;
                  const rm   = RANK_META[r.rank - 1];
                  return (
                    <div
                      key={r.rank}
                      className="lb-table-row"
                      style={{ background: isMe ? 'rgba(134,239,172,0.12)' : 'transparent' }}
                      onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = 'var(--bg-soft,#f8f9fa)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isMe ? 'rgba(134,239,172,0.12)' : 'transparent'; }}
                    >
                      <div className="lb-col-rank" style={{ display: 'flex', alignItems: 'center' }}>
                        {rm ? (
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: rm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <rm.Icon size={13} color={rm.iconColor} />
                          </div>
                        ) : (
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-muted)', width: 28, textAlign: 'center' }}>
                            #{r.rank}
                          </span>
                        )}
                      </div>

                      <div className="lb-col-student" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Avatar name={r.name} avatar={r.avatar} size={30} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.name}
                            {isMe && <span style={{ marginLeft: 6, fontSize: 10, background: '#059669', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>YOU</span>}
                          </div>
                        </div>
                      </div>

                      <div className="lb-col-score">
                        {r.score}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{r.total}</span>
                        <span className="lb-score-pct" style={{ color: g.color }}>· {r.pct}%</span>
                      </div>

                      <div className="lb-col-accuracy">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: g.color, fontWeight: 700 }}>{r.pct}%</span>
                        </div>
                        <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${r.pct}%`, background: g.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>

                      <div className="lb-col-grade">
                        <span style={{ fontSize: 12, fontWeight: 800, background: g.bg, color: g.color, padding: '3px 8px', borderRadius: 6 }}>
                          {g.label}
                        </span>
                      </div>

                      <div className="lb-col-date">
                        <div>{fmt(r.submittedAt)}</div>
                        <div>{fmtTime(r.submittedAt)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
