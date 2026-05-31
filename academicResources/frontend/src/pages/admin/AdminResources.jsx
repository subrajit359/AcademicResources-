import React, { useState, useMemo, useRef } from 'react';
import { useAdmin } from './AdminContext';
import { EditResourceModal, FilePreviewModal } from '../AdminModals';
import {
  Search, BookOpen, Eye, Pencil, Trash2, CheckCircle, XCircle,
  UploadCloud, Paperclip, X, ChevronUp, Loader2, FolderPlus, Download,
} from 'lucide-react';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import CustomSelect from '../../components/CustomSelect';
import { API_URL } from '../../config';
import { getCategories } from '../../utils/categoryStore';

const STATUS_OPTS = [
  { v: 'all',      l: 'All',      dot: '#94a3b8' },
  { v: 'approved', l: 'Approved', dot: '#10b981' },
  { v: 'pending',  l: 'Pending',  dot: '#f59e0b' },
  { v: 'rejected', l: 'Rejected', dot: '#ef4444' },
];

const statusPill = {
  approved: { bg: '#dcfce7', c: '#15803d' },
  pending:  { bg: '#fef3c7', c: '#b45309' },
  rejected: { bg: '#fee2e2', c: '#dc2626' },
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export default function AdminResources() {
  const {
    allResources, folders, handleApprove, handleReject,
    handleDeleteResource, handleEditResourceSave,
    fetchAll, authHeader, toast,
  } = useAdmin();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editRes,      setEditRes]      = useState(null);
  const [previewRes,   setPreviewRes]   = useState(null);

  /* ── Upload panel state ── */
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [upFile,      setUpFile]      = useState(null);
  const [upTitle,     setUpTitle]     = useState('');
  const [upDesc,      setUpDesc]      = useState('');
  const [upCategory,  setUpCategory]  = useState('');
  const [upFolder,    setUpFolder]    = useState('');
  const [upNewFolder, setUpNewFolder] = useState('');
  const [dragOver,    setDragOver]    = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const fileInputRef = useRef(null);

  const CATS = getCategories();

  const resetUpload = () => {
    setUpFile(null); setUpTitle(''); setUpDesc('');
    setUpCategory(''); setUpFolder(''); setUpNewFolder('');
  };

  const handleFilePick = (file) => { if (file) setUpFile(file); };
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFilePick(e.dataTransfer.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!upTitle.trim())    { toast.error('Title is required');    return; }
    if (!upCategory.trim()) { toast.error('Category is required'); return; }
    if (!upFile)            { toast.error('Please select a file'); return; }
    if (upFolder === '__new__' && !upNewFolder.trim()) {
      toast.error('Enter a name for the new folder'); return;
    }

    setUploading(true);
    try {
      let resolvedFolder = upFolder;

      if (upFolder === '__new__' && upNewFolder.trim()) {
        const fr = await fetch(`${API_URL}/api/folders`, {
          method: 'POST',
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: upNewFolder.trim(), category: upCategory, isPublic: true }),
        });
        if (!fr.ok) { toast.error('Could not create folder'); setUploading(false); return; }
        resolvedFolder = (await fr.json())._id;
      }

      const fd = new FormData();
      fd.append('title',       upTitle.trim());
      fd.append('description', upDesc.trim());
      fd.append('category',    upCategory.trim());
      if (resolvedFolder && resolvedFolder !== '__new__') fd.append('folder', resolvedFolder);
      fd.append('file', upFile);

      const res = await fetch(`${API_URL}/api/resources`, {
        method: 'POST',
        headers: authHeader(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Upload failed'); return; }

      toast.success(`"${data.title}" uploaded & published!`);
      resetUpload();
      setPanelOpen(false);
      fetchAll();
    } catch { toast.error('Connection error. Please try again.'); }
    finally { setUploading(false); }
  };

  /* ── Filter ── */
  const filtered = useMemo(() => allResources.filter(r => {
    const byStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.toLowerCase();
    const bySearch = !q || r.title?.toLowerCase().includes(q) || r.uploadedBy?.email?.toLowerCase().includes(q);
    return byStatus && bySearch;
  }), [allResources, search, statusFilter]);
  const pgRes = usePagination(filtered, 12);

  return (
    <div className="adm-page">
      {editRes    && <EditResourceModal resource={editRes} folders={folders} onSave={async (id, d) => { await handleEditResourceSave(id, d); setEditRes(null); }} onClose={() => setEditRes(null)} />}
      {previewRes && <FilePreviewModal resource={previewRes} onClose={() => setPreviewRes(null)} />}

      {/* ── Page header ── */}
      <div className="adm-page-hdr">
        <div>
          <h1 className="adm-page-title"><BookOpen size={22} color="#10b981" /> All Resources</h1>
          <p className="adm-page-sub">{filtered.length} of {allResources.length} resources</p>
        </div>
        <button
          className={`adm-btn ${panelOpen ? 'adm-btn-ghost' : 'adm-btn-success'}`}
          onClick={() => { setPanelOpen(v => !v); if (!panelOpen) resetUpload(); }}
        >
          {panelOpen ? <><ChevronUp size={14} /> Cancel</> : <><UploadCloud size={14} /> Upload Resource</>}
        </button>
      </div>

      {/* ── Upload panel ── */}
      {panelOpen && (
        <div className="ar-upload-panel">
          <div className="ar-upload-panel-title">
            <UploadCloud size={16} color="#10b981" /> Upload New Resource
            <span className="ar-upload-badge">Auto-published</span>
          </div>
          <form onSubmit={handleUpload}>
            {/* Drop zone */}
            <div
              className={`ar-drop-zone ${dragOver ? 'ar-drop-over' : ''} ${upFile ? 'ar-drop-has-file' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !upFile && fileInputRef.current?.click()}
            >
              {upFile ? (
                <div className="ar-file-row">
                  <Paperclip size={18} color="#10b981" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ar-file-name">{upFile.name}</div>
                    <div className="ar-file-size">{formatSize(upFile.size)}</div>
                  </div>
                  <button type="button" className="adm-btn adm-btn-ghost" style={{ padding: '4px 8px' }}
                    onClick={e => { e.stopPropagation(); setUpFile(null); }}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} color="#10b981" strokeWidth={1.5} />
                  <div className="ar-drop-text">Drag &amp; drop or <span>browse</span></div>
                  <div className="ar-drop-hint">PDF, DOC, PPT, XLS, ZIP, images · Max 100 MB</div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.jpg,.jpeg,.png"
                onChange={e => handleFilePick(e.target.files[0])}
              />
            </div>

            {/* Fields */}
            <div className="ar-upload-fields">
              <div className="ar-upload-field-row">
                <div className="ar-upload-field">
                  <label>Title *</label>
                  <input value={upTitle} onChange={e => setUpTitle(e.target.value)} placeholder="e.g. Physics Chapter 5 Notes" />
                </div>
                <div className="ar-upload-field">
                  <label>Category *</label>
                  <CustomSelect value={upCategory} onChange={e => setUpCategory(e.target.value)}>
                    <option value="">Select category…</option>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </CustomSelect>
                </div>
              </div>

              <div className="ar-upload-field-row">
                <div className="ar-upload-field">
                  <label>Folder <span style={{ fontWeight:400, color:'#94a3b8' }}>(optional)</span></label>
                  <CustomSelect value={upFolder} onChange={e => { setUpFolder(e.target.value); if (e.target.value !== '__new__') setUpNewFolder(''); }}>
                    <option value="">No folder</option>
                    {folders.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                    <option value="__new__">+ Create new folder…</option>
                  </CustomSelect>
                  {upFolder === '__new__' && (
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
                      <FolderPlus size={14} color="#10b981" style={{ flexShrink:0 }} />
                      <input
                        value={upNewFolder}
                        onChange={e => setUpNewFolder(e.target.value)}
                        placeholder="New folder name…"
                        autoFocus
                        style={{ flex:1, padding:'7px 10px', border:'1.5px solid #10b981', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }}
                      />
                    </div>
                  )}
                </div>
                <div className="ar-upload-field">
                  <label>Description <span style={{ fontWeight:400, color:'#94a3b8' }}>(optional)</span></label>
                  <textarea
                    value={upDesc}
                    onChange={e => setUpDesc(e.target.value)}
                    placeholder="Brief description…"
                    rows={2}
                    style={{ resize:'vertical' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="submit" className="adm-btn adm-btn-success" disabled={uploading}>
                {uploading
                  ? <><Loader2 size={13} className="spin" /> Uploading…</>
                  : <><UploadCloud size={13} /> Upload & Publish</>}
              </button>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={resetUpload}>
                Clear
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="adm-filter-bar">
        <div className="adm-search-wrap">
          <Search size={14} />
          <input placeholder="Search by title or uploader…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="adm-chip-group">
          {STATUS_OPTS.map(o => (
            <button
              key={o.v}
              className={`adm-chip2 ${statusFilter === o.v ? 'adm-chip2-active' : ''}`}
              style={statusFilter === o.v ? { '--dot': o.dot } : {}}
              onClick={() => setStatusFilter(o.v)}
            >
              <span className="adm-chip2-dot" style={{ background: o.dot }} />
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Resource list ── */}
      {filtered.length > 0 ? (
        <div className="adm-list">
          {pgRes.slice.map(r => (
            <div key={r._id} className="adm-list-row">
              <div className="adm-list-icon" style={{ background: '#f0fdf4' }}><BookOpen size={15} color="#10b981" /></div>
              <div className="adm-list-info">
                <div className="adm-list-title" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  {r.title}
                  <span className="adm-pill" style={statusPill[r.status] || statusPill.pending}>{r.status}</span>
                </div>
                <div className="adm-list-sub">
                  {r.category || '—'} · {r.folder?.name || 'Uncategorized'} · {r.uploadedBy?.email || 'unknown'}
                  <span className="adm-res-stats">
                    <Eye size={11} /> {r.views ?? 0}
                    <Download size={11} /> {r.downloads ?? 0}
                  </span>
                </div>
              </div>
              <div className="adm-list-actions">
                {r.fileUrl && <button className="adm-btn adm-btn-ghost" onClick={() => setPreviewRes(r)}><Eye size={13} /> Preview</button>}
                <button className="adm-btn adm-btn-ghost" onClick={() => setEditRes(r)}><Pencil size={13} /></button>
                {r.status !== 'approved' && <button className="adm-btn adm-btn-success" onClick={() => handleApprove(r._id)}><CheckCircle size={12} /> Approve</button>}
                {r.status !== 'rejected' && <button className="adm-btn adm-btn-ghost"   onClick={() => handleReject(r._id)}><XCircle size={12} /> Reject</button>}
                <button className="adm-btn adm-btn-danger" onClick={() => handleDeleteResource(r._id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
          <Pagination {...pgRes} />
        </div>
      ) : (
        <div className="adm-empty"><BookOpen size={48} strokeWidth={1.2} color="#d1d5db" /><p>No resources found</p></div>
      )}
    </div>
  );
}
