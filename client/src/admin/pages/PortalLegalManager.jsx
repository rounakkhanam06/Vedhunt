import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Plus, Trash2, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import toast from 'react-hot-toast';
import { getPortalLegal, updatePortalLegal, PORTAL_LEGAL_DOCS } from '../../services/portalLegalService';
import LegalDocumentModal from '../../components/legal/LegalDocumentModal';

// Edits the Client Portal / Employee Portal Terms & Privacy documents
// (route: /admin/portal-legal/:doc). Same structure as the website Terms page.

const AUDIENCE_LABEL = { client: 'Client Portal', employee: 'Employee Portal' };

const quillModules = {
  toolbar: [
    [{ header: [3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

const withIds = (data) => ({
  hero: { heading: data?.hero?.heading || '', lastUpdated: data?.hero?.lastUpdated || '', introParagraphs: data?.hero?.introParagraphs || [] },
  policyData: (data?.policyData || []).map((s, i) => ({ ...s, id: s.id || `s-${i}-${Date.now()}` })),
});

const PortalLegalManager = () => {
  const { doc } = useParams();
  const navigate = useNavigate();
  const meta = PORTAL_LEGAL_DOCS[doc];

  const [data, setData] = useState(null);
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    if (!meta) return;
    setLoading(true);
    try {
      const d = withIds(await getPortalLegal(doc));
      setData(d);
      setSaved(JSON.stringify(d));
    } catch {
      toast.error('Failed to load the document');
    } finally {
      setLoading(false);
    }
  }, [doc, meta]);

  useEffect(() => { load(); }, [load]);

  const dirty = data && JSON.stringify(data) !== saved;

  // Warn before leaving with unsaved edits (tab close / reload)
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (!meta) {
    return <div className="p-8 text-app-text">Unknown document.</div>;
  }

  const switchDoc = (next) => {
    if (next === doc) return;
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    navigate(`/admin/portal-legal/${next}`);
  };

  const setHero = (field, value) => setData((p) => ({ ...p, hero: { ...p.hero, [field]: value } }));
  const setIntro = (i, value) => setData((p) => {
    const list = [...p.hero.introParagraphs];
    list[i] = value;
    return { ...p, hero: { ...p.hero, introParagraphs: list } };
  });
  const addIntro = () => setData((p) => ({ ...p, hero: { ...p.hero, introParagraphs: [...p.hero.introParagraphs, ''] } }));
  const removeIntro = (i) => setData((p) => ({ ...p, hero: { ...p.hero, introParagraphs: p.hero.introParagraphs.filter((_, j) => j !== i) } }));

  const setSection = (i, field, value) => setData((p) => {
    const list = [...p.policyData];
    list[i] = { ...list[i], [field]: value };
    return { ...p, policyData: list };
  });
  const addSection = () => setData((p) => ({ ...p, policyData: [...p.policyData, { id: `s-${Date.now()}`, title: `${p.policyData.length + 1}. New Section`, content: '' }] }));
  const removeSection = (i) => {
    if (!window.confirm('Remove this section?')) return;
    setData((p) => ({ ...p, policyData: p.policyData.filter((_, j) => j !== i) }));
  };
  const moveSection = (i, dir) => setData((p) => {
    const list = [...p.policyData];
    const j = i + dir;
    if (j < 0 || j >= list.length) return p;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...p, policyData: list };
  });

  const handleSave = async () => {
    if (!data.hero.heading.trim()) return toast.error('Please enter a heading');
    setSaving(true);
    try {
      const res = await updatePortalLegal(doc, data);
      const d = withIds(res.data.document);
      setData(d);
      setSaved(JSON.stringify(d));
      toast.success(`${meta.label} saved`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text placeholder-app-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all';
  const label = 'block text-[12px] font-medium text-app-text-muted mb-1.5 font-mono uppercase tracking-wider';
  const siblings = Object.entries(PORTAL_LEGAL_DOCS).filter(([, m]) => m.audience === meta.audience);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-24">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-app-text mb-1">{AUDIENCE_LABEL[meta.audience]} — Terms & Privacy</h2>
          <p className="text-app-text-muted text-sm">
            Shown on the {AUDIENCE_LABEL[meta.audience]} login page (checkbox links) and under the user&apos;s profile. Separate from the website policies.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview(true)} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-app-border text-app-text hover:bg-app-border/30 text-sm font-medium cursor-pointer" title="Shows the last saved version">
            <Eye size={16} /> View published
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || !dirty}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save size={18} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6" role="tablist" aria-label="Document">
        {siblings.map(([key, m]) => (
          <button
            key={key}
            role="tab"
            aria-selected={key === doc}
            onClick={() => switchDoc(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${key === doc ? 'bg-primary/10 text-primary border-primary/30' : 'border-app-border text-app-text-muted hover:text-app-text'}`}
          >
            {m.short}
          </button>
        ))}
        {dirty && <span className="self-center text-xs text-amber-500 ml-2">Unsaved changes</span>}
      </div>

      {loading || !data ? (
        <div className="p-8 text-app-text">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-app-card border border-app-border rounded-xl p-6 space-y-5">
            <div>
              <label className={label} htmlFor="pl-heading">Heading</label>
              <input id="pl-heading" className={input} value={data.hero.heading} onChange={(e) => setHero('heading', e.target.value)} maxLength={120} />
              {data.hero.lastUpdated && <p className="text-xs text-app-text-muted mt-1.5">{data.hero.lastUpdated} — updated automatically when you save.</p>}
            </div>
            <div>
              <label className={label}>Intro Paragraphs</label>
              <div className="space-y-3 mb-3">
                {data.hero.introParagraphs.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <textarea aria-label={`Intro paragraph ${i + 1}`} value={t} onChange={(e) => setIntro(i, e.target.value)} className={`${input} min-h-[72px]`} />
                    <button onClick={() => removeIntro(i)} aria-label={`Remove intro paragraph ${i + 1}`} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg shrink-0 cursor-pointer"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <button onClick={addIntro} className="flex items-center gap-2 text-sm text-primary font-medium cursor-pointer"><Plus size={16} /> Add Paragraph</button>
            </div>
          </div>

          <div className="bg-app-card border border-app-border rounded-xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-app-text">Sections</h3>
              <button onClick={addSection} className="flex items-center gap-2 bg-app-bg border border-app-border text-app-text px-4 py-2 rounded-lg text-sm cursor-pointer"><Plus size={16} /> Add Section</button>
            </div>
            {data.policyData.length === 0 && <p className="text-sm text-app-text-muted">No sections yet.</p>}
            <div className="space-y-5">
              {data.policyData.map((s, i) => (
                <div key={s.id} className="bg-app-bg border border-app-border rounded-xl p-5">
                  <div className="flex flex-wrap items-end gap-3 mb-4">
                    <div className="flex-1">
                      <label className={label} htmlFor={`pl-title-${s.id}`}>Section Title</label>
                      <input id={`pl-title-${s.id}`} className={input} value={s.title} onChange={(e) => setSection(i, 'title', e.target.value)} />
                    </div>
                    <button onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Move section up" className="p-2.5 rounded-lg border border-app-border text-app-text-muted disabled:opacity-30 cursor-pointer"><ChevronUp size={16} /></button>
                    <button onClick={() => moveSection(i, 1)} disabled={i === data.policyData.length - 1} aria-label="Move section down" className="p-2.5 rounded-lg border border-app-border text-app-text-muted disabled:opacity-30 cursor-pointer"><ChevronDown size={16} /></button>
                    <button onClick={() => removeSection(i)} aria-label={`Remove section ${s.title}`} className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg cursor-pointer"><Trash2 size={16} /></button>
                  </div>
                  <label className={label}>Content</label>
                  <div className="bg-white rounded-lg text-black overflow-hidden border border-app-border">
                    <ReactQuill
                      theme="snow"
                      value={s.content}
                      // Quill re-normalises the HTML when it mounts and fires onChange with
                      // source 'api' — only real typing should mark the document as edited
                      onChange={(v, _delta, source) => { if (source === 'user') setSection(i, 'content', v); }}
                      modules={quillModules}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {preview && <LegalDocumentModal doc={doc} onClose={() => setPreview(false)} />}
    </div>
  );
};

export default PortalLegalManager;
