import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Lock, ChevronRight } from 'lucide-react';
import { essGet, essKeys } from '../lib/ess';

/**
 * Global lead search — Lead ID, Meta Lead ID, name, phone, email, business
 * name or website. Your own leads open the workspace; other BDs' leads (only
 * returned for roles allowed to search everything) are shown read-only, so a
 * duplicate is spotted before anyone works it twice.
 */
export default function LeadSearch() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setTerm(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);

  useEffect(() => {
    const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const { data: results = [], isFetching } = useQuery({
    queryKey: essKeys.leadSearch(term),
    queryFn: () => essGet('/leads/search', { params: { q: term } }).then((d) => d.results || []),
    enabled: term.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div ref={boxRef} className="relative w-full sm:max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted" />
      <input
        type="search"
        value={input}
        onChange={(e) => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search Lead ID, Meta ID, name, phone, email, business…"
        className="w-full bg-app-card border border-app-border rounded-lg pl-9 pr-3 py-2 text-sm text-app-text placeholder-app-text-muted focus:outline-none focus:border-primary/50"
        aria-label="Search leads"
      />
      {open && term.length >= 2 && (
        <div className="absolute z-30 mt-1 w-full bg-app-card border border-app-border rounded-xl shadow-2xl max-h-96 overflow-y-auto">
          {isFetching && results.length === 0 ? (
            <p className="p-4 text-xs text-app-text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-xs text-app-text-muted">No lead matches “{term}”.</p>
          ) : (
            results.map((lead) => (
              <button
                key={lead._id}
                type="button"
                disabled={!lead.isMine}
                onClick={() => { setOpen(false); navigate(`/employee/leads/${lead._id}`); }}
                className="w-full text-left px-4 py-3 border-b border-app-border last:border-0 hover:bg-app-border/20 disabled:cursor-default disabled:hover:bg-transparent flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-primary">{lead.leadId}</span>
                    <span className="text-sm font-semibold text-app-text truncate">{lead.fullName}</span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-app-border/30 text-app-text-muted">{lead.status}</span>
                  </div>
                  <div className="text-xs text-app-text-muted truncate mt-0.5">
                    {[lead.phone, lead.email, lead.businessName].filter(Boolean).join(' · ')}
                    {lead.fbLeadId && ` · Meta ${lead.fbLeadId}`}
                  </div>
                  {!lead.isMine && (
                    <div className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                      <Lock size={11} /> Existing lead — owned by {lead.ownerName}. View only.
                    </div>
                  )}
                </div>
                {lead.isMine && <ChevronRight size={16} className="text-app-text-muted shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
