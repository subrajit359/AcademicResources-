import React, { useState } from 'react';
import CustomSelect from '../components/CustomSelect';
import { API_URL } from '../config';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Sparkles, ChevronLeft, Loader2, FileText,
  Hash, Info, Zap, RotateCcw, AlertTriangle,
  Smile, Flame,
} from 'lucide-react';
import { useToast } from '../components/Toast';

const DIFFICULTY_OPTS = [
  { value: 'easy',   label: 'Easy',   Icon: Smile, color: '#059669', bg: '#ecfdf5' },
  { value: 'medium', label: 'Medium', Icon: Zap,   color: '#d97706', bg: '#fffbeb' },
  { value: 'hard',   label: 'Hard',   Icon: Flame, color: '#dc2626', bg: '#fef2f2' },
];

const MIN_CHARS = 10;

function AIGenerator() {
  const [moduleText, setModuleText] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [count,      setCount]      = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading,    setLoading]    = useState(false);
  const [lastError,  setLastError]  = useState('');

  const { user } = useAuth();
  const navigate  = useNavigate();
  const toast     = useToast();

  const selectedCategory = localStorage.getItem('selectedCategory') || '';

  const diffMeta = DIFFICULTY_OPTS.find(d => d.value === difficulty);

  const generate = async () => {
    if (!user) return toast.error('Please log in to generate questions.');
    if (!moduleText.trim()) return toast.error('Please paste some study text first.');
    if (moduleText.trim().length < MIN_CHARS)
      return toast.error(`Text too short — paste at least ${MIN_CHARS} characters.`);

    setLoading(true);
    setLastError('');

    try {
      const token = localStorage.getItem('token');

      const genRes  = await fetch(`${API_URL}/api/ai-tests/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ moduleText, count, difficulty }),
      });
      const genData = await genRes.json();

      if (!genRes.ok) {
        const msg = genData.message || 'AI failed to generate questions.';
        setLastError(msg);
        toast.error(msg);
        return;
      }
      if (!Array.isArray(genData) || genData.length === 0) {
        const msg = 'AI returned no questions. Try with more detailed text.';
        setLastError(msg);
        toast.error(msg);
        return;
      }

      const saveRes  = await fetch(`${API_URL}/api/ai-tests/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          moduleName: moduleName.trim() || 'AI Generated Set',
          questions: genData,
          category: selectedCategory,
          difficulty,
        }),
      });
      const saved = await saveRes.json();

      if (!saveRes.ok) {
        const msg = saved.message || 'Failed to save generated set.';
        setLastError(msg);
        toast.error(msg);
        return;
      }

      const testId = saved._id || saved.id;
      navigate(`/ai-test/${testId}`);

    } catch {
      const msg = 'Connection error. Please try again.';
      setLastError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>AI MCQ Generator</h1>
        <p>Paste any study text and let AI create practice questions for you</p>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/test')}>
            <ChevronLeft size={14} /> Back to Tests
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="ai-generator-layout">

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={20} color="#7c3aed" strokeWidth={1.8} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Generate Questions</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  AI-powered MCQ from your text
                  {selectedCategory && <> · <strong style={{ color: '#6366f1' }}>{selectedCategory}</strong></>}
                </p>
              </div>
            </div>

            <div className="form-group">
              <label><FileText size={13} style={{ display: 'inline', marginRight: 5 }} />Module / Study Text</label>
              <textarea
                value={moduleText}
                onChange={e => setModuleText(e.target.value)}
                placeholder="Paste your notes, chapter text, or any study material here… The more detailed the text, the better the questions."
                rows={10}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
              <span className="form-hint" style={{ color: moduleText.length < MIN_CHARS && moduleText.length > 0 ? '#dc2626' : undefined }}>
                {moduleText.length} characters · Minimum {MIN_CHARS} characters · Max 12 000
              </span>
            </div>

            <div className="form-group">
              <label><Zap size={13} style={{ display: 'inline', marginRight: 5 }} />Difficulty Level</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DIFFICULTY_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDifficulty(opt.value)}
                    style={{
                      flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      background: difficulty === opt.value ? opt.bg : '#f8fafc',
                      color: difficulty === opt.value ? opt.color : '#64748b',
                      border: `2px solid ${difficulty === opt.value ? opt.color : '#e2e8f0'}`,
                    }}
                  >
                    <opt.Icon size={13} /> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label><Hash size={13} style={{ display: 'inline', marginRight: 5 }} />Number of Questions</label>
                <CustomSelect value={count} onChange={e => setCount(Number(e.target.value))}>
                  <option value="5">5 MCQs</option>
                  <option value="10">10 MCQs</option>
                  <option value="15">15 MCQs</option>
                  <option value="20">20 MCQs</option>
                  <option value="30">30 MCQs</option>
                </CustomSelect>
              </div>
              <div className="form-group">
                <label>Practice Set Name <span className="optional-label">(optional)</span></label>
                <input
                  type="text"
                  value={moduleName}
                  onChange={e => setModuleName(e.target.value)}
                  placeholder="e.g. Chapter 4 – Arrays"
                />
              </div>
            </div>

            {lastError && !loading && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 12,
              }}>
                <AlertTriangle size={15} color="#dc2626" style={{ flexShrink: 0 }}/>
                <span style={{ flex: 1, fontSize: 13, color: '#dc2626' }}>{lastError}</span>
                <button
                  className="btn btn-sm"
                  style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                  onClick={generate}
                  disabled={loading || !moduleText.trim()}
                >
                  <RotateCcw size={12}/> Retry
                </button>
              </div>
            )}

            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Info size={15} color="#059669" style={{ flexShrink: 0, marginTop: 1 }}/>
              <p style={{ margin: 0, fontSize: 13, color: '#166534', lineHeight: 1.5 }}>
                Questions will be generated and saved automatically. You'll be taken directly to the practice page.
              </p>
            </div>

            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={generate}
              disabled={loading || !moduleText.trim() || moduleText.trim().length < MIN_CHARS}
            >
              {loading
                ? <><Loader2 size={16} className="spin" /> Generating &amp; saving {count} {difficulty} questions…</>
                : <><Sparkles size={16} /> Generate {count} {diffMeta?.label} MCQs</>
              }
            </button>
          </div>

          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Brain size={28} color="#7c3aed" className="spin-slow" />
              </div>
              <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>AI is thinking…</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Generating <strong>{count}</strong> <strong>{difficulty}</strong> questions from your text, then opening the practice page…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIGenerator;
