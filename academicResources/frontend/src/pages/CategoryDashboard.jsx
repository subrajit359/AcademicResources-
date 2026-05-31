import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { BookOpen, UploadCloud, ClipboardList, Brain, ChevronLeft, ArrowRight, Hash, ArrowRightCircle } from 'lucide-react';

const CARDS = (cat) => [
  { title: 'Resources',       desc: `Browse ${cat} notes, PDFs and materials`,       Icon: BookOpen,      path: '/resources',     color: '#2563eb', bg: '#eff6ff' },
  { title: 'Upload Resource', desc: `Share your ${cat} files with the community`,     Icon: UploadCloud,   path: '/upload',        color: '#059669', bg: '#f0fdf4' },
  { title: 'Practice Tests',  desc: `Attempt ${cat} mock tests`,                     Icon: ClipboardList, path: '/test',          color: '#7c3aed', bg: '#f5f3ff' },
  { title: 'AI Generator',    desc: `Generate AI-powered tests for ${cat}`,           Icon: Brain,         path: '/ai-generator',  color: '#d97706', bg: '#fffbeb' },
];

function CategoryDashboard() {
  const navigate = useNavigate();
  const selectedCategory = localStorage.getItem('selectedCategory');
  const [codeInput, setCodeInput] = useState('');
  const [codeErr, setCodeErr]     = useState('');

  if (!selectedCategory) {
    return <Navigate to="/choose-category" replace />;
  }

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    const val = codeInput.trim();
    if (!val) { setCodeErr('Please enter a test code or paste a link'); return; }
    setCodeErr('');
    // Support full share-link URLs as well as bare codes
    const match = val.match(/take-test\/([^/?#]+)/);
    const code  = match ? match[1] : val;
    navigate(`/take-test/${code}`);
  };

  return (
    <div>
      <div className="page-header">
        <h1>{selectedCategory} Dashboard</h1>
        <p>Everything you need to study and prepare for {selectedCategory}</p>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/choose-category')}>
            <ChevronLeft size={14} /> Change Category
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="action-grid">
          {CARDS(selectedCategory).map(({ title, desc, Icon, path, color, bg }) => (
            <div
              key={title}
              className="action-card"
              onClick={() => navigate(path)}
            >
              <div className="action-icon-wrap" style={{ background: bg }}>
                <Icon size={26} color={color} strokeWidth={1.8} />
              </div>
              <div className="action-title">{title}</div>
              <div className="action-desc">{desc}</div>
              <div className="action-arrow">
                <ArrowRight size={16} color={color} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Enter test code / link ── */}
        <div className="cd-code-banner">
          <div className="cd-code-banner-icon">
            <Hash size={22} color="#fff" />
          </div>
          <div className="cd-code-banner-body">
            <div className="cd-code-banner-title">Enter Test Code or Link</div>
            <div className="cd-code-banner-desc">Have a code or share-link from your teacher? Paste it here.</div>
            <form className="cd-code-form" onSubmit={handleCodeSubmit}>
              <input
                className="cd-code-input"
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value); setCodeErr(''); }}
                placeholder="e.g. MATH-2024-XYZ or paste a link"
              />
              <button type="submit" className="cd-code-btn">
                Go <ArrowRightCircle size={16} />
              </button>
            </form>
            {codeErr && <p className="cd-code-err">{codeErr}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryDashboard;
