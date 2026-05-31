import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Flag, Users, ShieldOff, BarChart2, RefreshCw,
  Search, Trash2, CheckCircle, XCircle,
  AlertTriangle, Activity, Hash, Lock, ArrowLeft,
  MessageCircle, Clock, Send,
} from 'lucide-react';
import { API_URL } from '../../config';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

const api = async (path, opts = {}) => {
  const r = await fetch(`${API_URL}/api/classroom${path}`, { headers: authH(), ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
  return r.json();
};

const ROLE_COLOR = { admin: '#dc2626', teacher: '#d97706', student: '#2563eb' };
const STATUS_META = {
  pending:   { label: 'Pending',   color: '#f59e0b', bg: '#fffbeb' },
  reviewed:  { label: 'Reviewed',  color: '#10b981', bg: '#f0fdf4' },
  dismissed: { label: 'Dismissed', color: '#6b7280', bg: '#f3f4f6' },
};

/* ── Styled Confirm Modal ── */
function ConfirmModal({ message, confirmLabel = 'Delete', confirmColor = '#ef4444', onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', maxWidth: 400,
        width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1f36', marginBottom: 10 }}>Confirm Action</div>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 22 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
              background: confirmColor, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── responsive hook ── */
function useIsMobile(breakpoint = 680) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [breakpoint]);
  return isMobile;
}

/* ── Avatar ── */
function Avatar({ user, size = 32 }) {
  if (user?.avatar) return (
    <img src={user.avatar} alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6'];
  const bg = colors[(user?.name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 700,
      color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

/* ── StatCard ── */
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
      style={{ background: '#fff', borderRadius: 14, padding: '16px 18px',
        border: '1px solid #e8edf3', transition: 'box-shadow 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} color={color} />
        </div>
        <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1f36', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════════════════════════════ */
function OverviewTab({ stats, onRefresh }) {
  const isMobile = useIsMobile();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: '#1a1f36', margin: 0 }}>
            Classroom Overview
          </h2>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '2px 0 0' }}>
            Live stats for the classroom system
          </p>
        </div>
        <button onClick={onRefresh}
          style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '7px 14px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#374151', alignSelf: isMobile ? 'flex-start' : 'auto' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 12, marginBottom: 24 }}>
        <StatCard icon={MessageSquare} label="Total Conversations" value={stats?.totalConvs}  color="#6366f1" />
        <StatCard icon={Hash}         label="Group Chats"          value={stats?.totalGroups} color="#8b5cf6" />
        <StatCard icon={Lock}         label="Direct Messages"      value={stats?.totalDMs}    color="#3b82f6" />
        <StatCard icon={Send}         label="Messages Sent"        value={stats?.totalMessages}
          sub={`${stats?.messagesToday ?? 0} today`} color="#10b981" />
        <StatCard icon={Flag}         label="Pending Reports"      value={stats?.pendingReports}
          sub={`${stats?.totalReports ?? 0} total`} color="#f59e0b" />
        <StatCard icon={ShieldOff}    label="Active Blocks"        value={stats?.totalBlocks}  color="#ef4444" />
      </div>

      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border: '1px solid #e8edf3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Activity size={15} color="#6366f1" />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36' }}>Quick Actions</span>
        </div>
        <div style={{ display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { label: 'Review Reports',    desc: 'Investigate user reports', color: '#f59e0b', icon: Flag },
            { label: 'All Conversations', desc: 'Browse groups & DMs',      color: '#6366f1', icon: MessageSquare },
            { label: 'Block List',        desc: 'Manage user blocks',       color: '#ef4444', icon: ShieldOff },
          ].map(({ label, desc, color, icon: Icon }) => (
            <div key={label} style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px',
              border: '1px solid #e8edf3', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1f36' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   REPORTS TAB
══════════════════════════════════════════════════════════════ */
function ReportsTab() {
  const isMobile = useIsMobile();
  const [reports, setReports]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [detail, setDetail]         = useState(null);
  const [note, setNote]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [confirmDlg, setConfirmDlg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setReports(await api(`/admin/reports?status=${statusFilter}`)); } catch {}
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = (r) => { setDetail(r); setNote(r.adminNote || ''); };
  const closeDetail = () => setDetail(null);

  const updateStatus = async (id, status) => {
    setSaving(true);
    try {
      const updated = await api(`/admin/reports/${id}`, {
        method: 'PUT', body: JSON.stringify({ status, adminNote: note }),
      });
      setReports(prev => prev.map(r => r._id === id ? updated : r));
      setDetail(updated);
    } catch {}
    setSaving(false);
  };

  const deleteReport = (id) => {
    setConfirmDlg({
      message: 'Delete this report permanently?',
      onConfirm: async () => {
        try {
          await api(`/admin/reports/${id}`, { method: 'DELETE' });
          setReports(prev => prev.filter(r => r._id !== id));
          setDetail(null);
        } catch {}
        setConfirmDlg(null);
      },
    });
  };

  const filtered = reports.filter(r => {
    const q = search.toLowerCase();
    return !q ||
      r.reporter?.name?.toLowerCase().includes(q) ||
      r.reported?.name?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q);
  });

  const pgReports = usePagination(filtered, 10);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB',
    { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  /* detail panel — shared between mobile overlay and desktop sidebar */
  const DetailPanel = () => !detail ? null : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14,
      background: '#fff',
      ...(isMobile ? {
        position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto',
        padding: 20, borderRadius: 0,
      } : {
        width: 320, flexShrink: 0, border: '1px solid #e8edf3',
        borderRadius: 14, padding: 20, alignSelf: 'flex-start',
        position: 'sticky', top: 0, maxHeight: '90vh', overflowY: 'auto',
      })
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isMobile
          ? <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, padding: 0 }}>
              <ArrowLeft size={16} /> Back to Reports
            </button>
          : <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1f36' }}>Report Detail</span>
        }
        {!isMobile && (
          <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: 18, lineHeight: 1 }}>×</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Reported User
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fef2f2', borderRadius: 8, padding: '10px 12px' }}>
          <Avatar user={detail.reported} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1f36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detail.reported?.name}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detail.reported?.email}
            </div>
            <div style={{ fontSize: 11, color: ROLE_COLOR[detail.reported?.role], textTransform: 'capitalize', marginTop: 1 }}>
              {detail.reported?.role}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Reported By
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
          <Avatar user={detail.reporter} size={30} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1f36' }}>{detail.reporter?.name}</div>
            <div style={{ fontSize: 11, color: ROLE_COLOR[detail.reporter?.role], textTransform: 'capitalize' }}>
              {detail.reporter?.role}
            </div>
          </div>
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Reason
          </div>
          <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{detail.reason}</div>
          {detail.details && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{detail.details}</div>}
        </div>

        {detail.messageContent && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <MessageCircle size={12} color="#d97706" />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Reported Message
              </span>
              <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>
                preserved — stays even if deleted
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5,
              background: '#fff', borderRadius: 6, padding: '8px 10px',
              border: '1px solid #fde68a', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
              {detail.messageContent}
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, color: '#9ca3af' }}>{fmtDate(detail.createdAt)}</div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
          Admin Note
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add investigation notes…"
          style={{ width: '100%', minHeight: 70, borderRadius: 8, border: '1px solid #e2e8f0',
            padding: '8px 10px', fontSize: 13, resize: 'vertical', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <button onClick={() => updateStatus(detail._id, 'reviewed')}
          disabled={saving || detail.status === 'reviewed'}
          style={{ padding: '10px 0', borderRadius: 8, border: 'none',
            background: detail.status === 'reviewed' ? '#d1fae5' : '#10b981',
            color: detail.status === 'reviewed' ? '#059669' : '#fff',
            fontWeight: 600, fontSize: 13,
            cursor: detail.status === 'reviewed' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <CheckCircle size={14} /> {detail.status === 'reviewed' ? 'Already Reviewed' : 'Mark as Reviewed'}
        </button>
        <button onClick={() => updateStatus(detail._id, 'dismissed')}
          disabled={saving || detail.status === 'dismissed'}
          style={{ padding: '10px 0', borderRadius: 8, border: '1px solid #e2e8f0',
            background: detail.status === 'dismissed' ? '#f3f4f6' : '#fff', color: '#6b7280',
            fontWeight: 600, fontSize: 13,
            cursor: detail.status === 'dismissed' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <XCircle size={14} /> {detail.status === 'dismissed' ? 'Already Dismissed' : 'Dismiss Report'}
        </button>
        <button onClick={() => updateStatus(detail._id, 'pending')}
          disabled={saving || detail.status === 'pending'}
          style={{ padding: '10px 0', borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#fff', color: '#f59e0b', fontWeight: 600, fontSize: 13,
            cursor: detail.status === 'pending' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Clock size={14} /> Reset to Pending
        </button>
        <button onClick={() => deleteReport(detail._id)}
          style={{ padding: '10px 0', borderRadius: 8, border: '1px solid #fee2e2',
            background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Trash2 size={14} /> Delete Report
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 16,
      flexDirection: isMobile ? 'column' : 'row', height: '100%' }}>

      {/* List panel — always visible on desktop; hidden on mobile when detail open */}
      {(!isMobile || !detail) && (
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search reports…"
                style={{ width: '100%', paddingLeft: 30, paddingRight: 10, height: 36,
                  border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none',
                  boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['all', 'pending', 'reviewed', 'dismissed'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ padding: '0 10px', height: 36, borderRadius: 8, border: '1px solid',
                    borderColor: statusFilter === s ? '#6366f1' : '#e2e8f0',
                    background: statusFilter === s ? '#6366f1' : '#fff',
                    color: statusFilter === s ? '#fff' : '#374151',
                    fontWeight: 500, fontSize: 12, cursor: 'pointer' }}>
                  {s === 'all' ? 'All' : STATUS_META[s].label}
                </button>
              ))}
              <button onClick={load}
                style={{ padding: '0 10px', height: 36, borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  gap: 5, fontSize: 12, color: '#374151' }}>
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading reports…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              <Flag size={32} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.3 }} />
              <div>No reports found</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pgReports.slice.map(r => {
                const sm = STATUS_META[r.status] || STATUS_META.pending;
                const isActive = detail?._id === r._id;
                return (
                  <motion.div key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    onClick={() => openDetail(r)}
                    style={{ background: isActive ? '#f0f0ff' : '#fff',
                      border: `1px solid ${isActive ? '#6366f1' : '#e8edf3'}`,
                      borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={r.reported} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.reported?.name || 'Unknown'}
                          <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>
                            reported
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ color: ROLE_COLOR[r.reporter?.role] }}>{r.reporter?.name}</span>
                          {' · '}{r.reason}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: sm.color, background: sm.bg,
                          border: `1px solid ${sm.color}30`, borderRadius: 6, padding: '1px 7px' }}>
                          {sm.label}
                        </span>
                        {r.messageContent && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: '#fffbeb',
                            border: '1px solid #fde68a', borderRadius: 6, padding: '1px 7px',
                            display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MessageCircle size={9} /> Message
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          {!loading && filtered.length > 0 && <Pagination {...pgReports} />}
        </div>
      )}

      {confirmDlg && (
        <ConfirmModal
          message={confirmDlg.message}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}

      {/* Desktop: sidebar detail */}
      {!isMobile && (
        <AnimatePresence>
          {detail && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <DetailPanel />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Mobile: full-screen detail overlay */}
      {isMobile && (
        <AnimatePresence>
          {detail && (
            <motion.div
              key="mobile-detail"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
              style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#fff', overflowY: 'auto' }}>
              <DetailPanel />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CONVERSATIONS TAB
══════════════════════════════════════════════════════════════ */
function ConversationsTab() {
  const isMobile = useIsMobile();
  const [convs, setConvs]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [viewConv, setViewConv]     = useState(null);
  const [messages, setMessages]     = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const msgBottomRef = useRef(null);
  const [confirmDlg, setConfirmDlg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setConvs(await api(`/admin/conversations?type=${typeFilter}`)); } catch {}
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const loadMessages = async (conv) => {
    setViewConv(conv);
    setMessages([]);
    setLoadingMsgs(true);
    try { setMessages(await api(`/admin/conversations/${conv._id}/messages`)); } catch {}
    setLoadingMsgs(false);
    setTimeout(() => msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const deleteConv = (id) => {
    setConfirmDlg({
      message: 'Delete this conversation and all its messages permanently?',
      onConfirm: async () => {
        try {
          await api(`/admin/conversations/${id}`, { method: 'DELETE' });
          setConvs(prev => prev.filter(c => c._id !== id));
          if (viewConv?._id === id) setViewConv(null);
        } catch {}
        setConfirmDlg(null);
      },
    });
  };

  const filtered = convs.filter(c => {
    const q = search.toLowerCase();
    return !q ||
      c.name?.toLowerCase().includes(q) ||
      c.participants?.some(p => p.name?.toLowerCase().includes(q));
  });

  const convLabel = (c) => {
    if (c.type === 'group') return c.name || 'Unnamed Group';
    return c.participants?.map(p => p.name).filter(Boolean).join(' & ') || 'Direct Message';
  };

  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';

  const pgConvs = usePagination(filtered, 15);

  const listPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10,
      flex: isMobile ? 1 : '0 0 310px', minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%',
            transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            style={{ width: '100%', paddingLeft: 28, height: 34, border: '1px solid #e2e8f0',
              borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all','group','direct'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              style={{ padding: '0 10px', height: 34, borderRadius: 8, border: '1px solid',
                borderColor: typeFilter === t ? '#6366f1' : '#e2e8f0',
                background: typeFilter === t ? '#6366f1' : '#fff',
                color: typeFilter === t ? '#fff' : '#374151',
                fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              {t === 'all' ? 'All' : t === 'group' ? 'Groups' : 'DMs'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#9ca3af' }}>
        {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af', fontSize: 13 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af', fontSize: 13 }}>
          No conversations found
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
          {pgConvs.slice.map(c => {
            const isActive = viewConv?._id === c._id;
            return (
              <div key={c._id} onClick={() => loadMessages(c)}
                style={{ background: isActive ? '#f0f0ff' : '#fff',
                  border: `1px solid ${isActive ? '#6366f1' : '#e8edf3'}`,
                  borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%',
                  background: c.type === 'group' ? '#8b5cf618' : '#6366f118',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {c.type === 'group' ? <Hash size={16} color="#8b5cf6" /> : <Lock size={16} color="#6366f1" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {convLabel(c)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {c.participants?.length} member{c.participants?.length !== 1 ? 's' : ''} · {fmtDate(c.lastActivity)}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteConv(c._id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ef4444', padding: 4, borderRadius: 6,
                    display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!loading && filtered.length > 0 && <Pagination {...pgConvs} />}
    </div>
  );

  const viewerPanel = (
    <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e8edf3',
      borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      minHeight: isMobile ? 'calc(100dvh - 120px)' : 420 }}>
      {!viewConv ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: 10 }}>
          <MessageCircle size={36} strokeWidth={1.5} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: 13 }}>Select a conversation to view messages</span>
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8edf3',
            display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb', flexShrink: 0 }}>
            <button onClick={() => setViewConv(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: '#6b7280', padding: 2, display: 'flex', flexShrink: 0 }}>
              <ArrowLeft size={16} />
            </button>
            <div style={{ width: 30, height: 30, borderRadius: '50%',
              background: viewConv.type === 'group' ? '#8b5cf618' : '#6366f118',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {viewConv.type === 'group'
                ? <Hash size={14} color="#8b5cf6" />
                : <Lock size={14} color="#6366f1" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {convLabel(viewConv)}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {viewConv.participants?.map(p => p.name).filter(Boolean).join(', ')}
              </div>
            </div>
            <button onClick={() => deleteConv(viewConv._id)}
              style={{ flexShrink: 0, background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 7, padding: isMobile ? '6px 8px' : '5px 12px',
                color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4 }}>
              <Trash2 size={12} />
              {!isMobile && 'Delete'}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingMsgs ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>
                Loading messages…
              </div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>
                No messages yet
              </div>
            ) : (
              messages.map(m => (
                <div key={m._id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Avatar user={m.sender} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ROLE_COLOR[m.sender?.role] || '#374151' }}>
                        {m.sender?.name || 'Unknown'}
                      </span>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{fmtTime(m.createdAt)}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'capitalize',
                        background: '#f3f4f6', borderRadius: 4, padding: '0 5px' }}>
                        {m.sender?.role}
                      </span>
                    </div>
                    <div style={{ fontSize: 13,
                      color: m.deletedForEveryone ? '#9ca3af' : '#374151',
                      fontStyle: m.deletedForEveryone ? 'italic' : 'normal',
                      background: '#f9fafb', borderRadius: 8, padding: '6px 10px',
                      display: 'inline-block', maxWidth: '100%', wordBreak: 'break-word' }}>
                      {m.deletedForEveryone
                        ? 'This message was deleted'
                        : m.text || (m.attachments?.length ? `[${m.attachments.length} attachment(s)]` : '')}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={msgBottomRef} />
          </div>
        </>
      )}
    </div>
  );

  /* Mobile: show list OR viewer, not both */
  if (isMobile) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!viewConv ? listPanel : viewerPanel}
        </div>
        {confirmDlg && (
          <ConfirmModal
            message={confirmDlg.message}
            onConfirm={confirmDlg.onConfirm}
            onCancel={() => setConfirmDlg(null)}
          />
        )}
      </>
    );
  }

  /* Desktop: side-by-side */
  return (
    <>
      <div style={{ display: 'flex', gap: 16, height: '100%' }}>
        {listPanel}
        {viewerPanel}
      </div>
      {confirmDlg && (
        <ConfirmModal
          message={confirmDlg.message}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   BLOCKS TAB
══════════════════════════════════════════════════════════════ */
function BlocksTab() {
  const isMobile = useIsMobile();
  const [blocks, setBlocks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [confirmDlg, setConfirmDlg] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setBlocks(await api('/admin/blocks')); } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const removeBlock = (id) => {
    setConfirmDlg({
      message: 'Remove this block? Both users will be able to message each other again.',
      confirmLabel: 'Remove Block',
      onConfirm: async () => {
        try {
          await api(`/admin/blocks/${id}`, { method: 'DELETE' });
          setBlocks(prev => prev.filter(b => b._id !== id));
        } catch {}
        setConfirmDlg(null);
      },
    });
  };

  const filtered = blocks.filter(b => {
    const q = search.toLowerCase();
    return !q ||
      b.blocker?.name?.toLowerCase().includes(q) ||
      b.blocked?.name?.toLowerCase().includes(q);
  });

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const pgBlocks = usePagination(filtered, 12);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            style={{ width: '100%', paddingLeft: 30, height: 36, border: '1px solid #e2e8f0',
              borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <button onClick={load}
          style={{ padding: '0 14px', height: 36, borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: 5, fontSize: 13, color: '#374151', flexShrink: 0 }}>
          <RefreshCw size={13} />
          {!isMobile && ' Refresh'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>
        {filtered.length} block{filtered.length !== 1 ? 's' : ''}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <ShieldOff size={32} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.3 }} />
          <div>No blocks found</div>
        </div>
      ) : (
        <div style={{ display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 10 }}>
          {pgBlocks.slice.map(b => (
            <motion.div key={b._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ background: '#fff', border: '1px solid #e8edf3', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                {/* Blocker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 100 }}>
                  <Avatar user={b.blocker} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.blocker?.name}
                    </div>
                    <div style={{ fontSize: 11, color: ROLE_COLOR[b.blocker?.role] || '#9ca3af', textTransform: 'capitalize' }}>
                      {b.blocker?.role}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444',
                  background: '#fef2f2', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
                  blocked
                </div>

                {/* Blocked */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 100 }}>
                  <Avatar user={b.blocked} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f36',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.blocked?.name}
                    </div>
                    <div style={{ fontSize: 11, color: ROLE_COLOR[b.blocked?.role] || '#9ca3af', textTransform: 'capitalize' }}>
                      {b.blocked?.role}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(b.createdAt)}</span>
                <button onClick={() => removeBlock(b._id)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #e2e8f0',
                    background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <ShieldOff size={12} /> Remove Block
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {!loading && filtered.length > 0 && <Pagination {...pgBlocks} />}
      {confirmDlg && (
        <ConfirmModal
          message={confirmDlg.message}
          confirmLabel={confirmDlg.confirmLabel}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
const TABS = [
  { id: 'overview',      label: 'Overview',       Icon: BarChart2 },
  { id: 'reports',       label: 'Reports',        Icon: Flag },
  { id: 'conversations', label: 'Conversations',  Icon: MessageSquare },
  { id: 'blocks',        label: 'Blocks',         Icon: ShieldOff },
];

export default function AdminClassroom() {
  const isMobile = useIsMobile();
  const [tab, setTab]       = useState('overview');
  const [stats, setStats]   = useState(null);

  const loadStats = useCallback(async () => {
    try { setStats(await api('/admin/stats')); } catch {}
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="adm-page">
      {/* Header */}
      <div className="adm-page-hdr"
        style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="adm-page-title"
            style={{ display: 'flex', alignItems: 'center', gap: 8,
              fontSize: isMobile ? 18 : undefined }}>
            <MessageSquare size={isMobile ? 18 : 22} color="#6366f1" />
            Classroom Management
          </h1>
          <p className="adm-page-sub"
            style={{ fontSize: isMobile ? 12 : undefined }}>
            Oversee all classroom activity — conversations, reports, and blocks
          </p>
        </div>
        {stats?.pendingReports > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 10, padding: '7px 12px', flexShrink: 0 }}>
            <AlertTriangle size={14} color="#f59e0b" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
              {stats.pendingReports} pending report{stats.pendingReports !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Tab bar — horizontally scrollable on mobile */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        marginBottom: 20, paddingBottom: 2 }}>
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6',
          borderRadius: 10, padding: 4, width: 'fit-content', minWidth: '100%' }}>
          {TABS.map(({ id, label, Icon }) => {
            const isActive = tab === id;
            const badge = id === 'reports' && stats?.pendingReports > 0 ? stats.pendingReports : null;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 7,
                  padding: isMobile ? '7px 12px' : '7px 16px',
                  borderRadius: 8, border: 'none',
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? '#6366f1' : '#6b7280',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: isMobile ? 12 : 13,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s', position: 'relative' }}>
                <Icon size={13} />
                {label}
                {badge && (
                  <span style={{ position: 'absolute', top: 3, right: 3,
                    background: '#f59e0b', color: '#fff', fontSize: 9, fontWeight: 800,
                    borderRadius: '50%', width: 15, height: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {tab === 'overview'      && <OverviewTab stats={stats} onRefresh={loadStats} />}
          {tab === 'reports'       && <ReportsTab />}
          {tab === 'conversations' && <ConversationsTab />}
          {tab === 'blocks'        && <BlocksTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
