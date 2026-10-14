import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Phone, PhoneCall, Clock, AlertTriangle, Trophy, Target, Search } from 'lucide-react';
import { fmtDateTime, fmtDate, fmtMinutes, fmtINR, toDateInput } from '../../employee/lib/datetime';
import RemarkCell from './RemarkCell';

/**
 * My Team Performance — per-BDE calls, leads and follow-ups for a period, with
 * a drill-down into one BDE's call log and working leads. Shared by the
 * Employee Portal tab (manager → direct reports) and the admin page (Super
 * Admin → every BDE); the server decides who is visible
 * (server/services/teamPerformance.js).
 *
 * @param {(path: string, params: object) => Promise<object>} fetchData  GET relative to the team-performance endpoint
 * @param {(leadRef: string) => string} [leadHref]  link to open a lead, when the viewer can open it
 * @param {boolean} [showBackButton=true]  in-page "Back to team" — off where the layout already has a Back
 *   button; the open BDE lives in the URL (?bde=) so browser/layout Back returns to the team either way
 */

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const VIEWS = [
  { key: 'members', label: 'By BDE' },
  { key: 'calls', label: 'Team call log' },
];

const STAGE_ORDER = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Hold'];

const card = 'bg-app-card border border-app-border rounded-xl';
const th = 'py-3 px-3 font-semibold';
const td = 'py-3 px-3';

const errorOf = (err, fallback) => err?.response?.data?.message || fallback;

function Tile({ icon: Icon, label, value, sub, tone = 'text-primary bg-primary/10' }) {
  return (
    <div className={`${card} p-4 min-w-0`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tone}`}><Icon size={15} /></div>
      <div className="text-xl font-extrabold text-app-text truncate">{value}</div>
      <div className="text-xs text-app-text-muted">{label}</div>
      {sub && <div className="text-[11px] text-app-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}

function Empty({ children }) {
  return <div className={`${card} p-8 text-center text-sm text-app-text-muted`}>{children}</div>;
}

function Totals({ totals }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Tile icon={Phone} label="Calls made" value={totals.calls} sub={`${totals.leadsWorked} leads called`} />
      <Tile icon={PhoneCall} label="Connected" value={totals.connected} sub={`${totals.connectRate}% connect rate`} tone="text-emerald-400 bg-emerald-500/10" />
      <Tile icon={Clock} label="Talk time" value={fmtMinutes(totals.talkMinutes)} tone="text-sky-400 bg-sky-500/10" />
      <Tile icon={Target} label="Active leads" value={totals.activeLeads} sub={`${totals.followUpsDueToday} follow-ups due today`} />
      <Tile icon={AlertTriangle} label="Overdue follow-ups" value={totals.followUpsOverdue} tone="text-red-400 bg-red-500/10" />
      <Tile icon={Trophy} label="Won" value={totals.won} sub={fmtINR(totals.wonValue)} tone="text-amber-500 bg-amber-500/10" />
    </div>
  );
}

function MemberTable({ members, onOpen }) {
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-left min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
            <th className={th}>BDE</th>
            <th className={`${th} text-right`}>Calls</th>
            <th className={`${th} text-right`}>Connected</th>
            <th className={`${th} text-right`}>Not conn.</th>
            <th className={`${th} text-right`}>Rate</th>
            <th className={`${th} text-right`}>Talk time</th>
            <th className={`${th} text-right`}>Leads called</th>
            <th className={`${th} text-right`}>Active leads</th>
            <th className={`${th} text-right`}>Due today</th>
            <th className={`${th} text-right`}>Overdue</th>
            <th className={`${th} text-right`}>Won</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {members.map((m) => (
            <tr key={m.adminId} onClick={() => onOpen(m)} className="cursor-pointer hover:bg-primary/5 transition-colors">
              <td className={td}>
                <div className="font-semibold text-app-text">{m.name}</div>
                <div className="text-xs text-app-text-muted">{[m.employeeId, m.designation].filter(Boolean).join(' · ')}</div>
                <div className="text-[11px] font-semibold text-primary mt-0.5">View calls &amp; leads →</div>
              </td>
              <td className={`${td} text-right font-bold text-app-text`}>{m.calls}</td>
              <td className={`${td} text-right text-emerald-400`}>{m.connected}</td>
              <td className={`${td} text-right text-red-400`}>{m.notConnected}</td>
              <td className={`${td} text-right`}>{m.calls ? `${m.connectRate}%` : '—'}</td>
              <td className={`${td} text-right`}>{fmtMinutes(m.talkMinutes)}</td>
              <td className={`${td} text-right`}>{m.leadsWorked}</td>
              <td className={`${td} text-right`}>{m.activeLeads}</td>
              <td className={`${td} text-right`}>{m.followUpsDueToday}</td>
              <td className={`${td} text-right ${m.followUpsOverdue ? 'text-red-400 font-bold' : ''}`}>{m.followUpsOverdue}</td>
              <td className={`${td} text-right`}>
                {m.won}
                {m.won > 0 && <div className="text-[11px] text-app-text-muted">{fmtINR(m.wonValue)}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadName({ leadRef, name, leadId, leadHref }) {
  const label = <><div className="font-semibold text-app-text">{name || '—'}</div><div className="text-xs text-app-text-muted">{leadId}</div></>;
  return leadHref ? <Link to={leadHref(leadRef)} className="block hover:opacity-80">{label}</Link> : label;
}

/** Call rows for one BDE's log or the whole team's (`showCaller` adds the BDE column). */
function CallTable({ calls, leadHref, showCaller }) {
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className={`w-full text-left text-sm ${showCaller ? 'min-w-[900px]' : 'min-w-[760px]'}`}>
        <thead>
          <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
            <th className={th}>When</th>
            {showCaller && <th className={th}>Called by</th>}
            <th className={th}>Lead</th><th className={th}>Result</th>
            <th className={th}>Type</th><th className={th}>Stage after</th><th className={`${th} text-right`}>Duration</th><th className={th}>Remark</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {calls.map((c, i) => (
            <tr key={`${c.leadRef}-${c.touchNumber}-${i}`} className="align-top">
              <td className={`${td} whitespace-nowrap`}>{fmtDateTime(c.at)}<div className="text-[11px] text-app-text-muted">Touch #{c.touchNumber}</div></td>
              {showCaller && <td className={`${td} font-semibold text-app-text`}>{c.calledByName}</td>}
              <td className={td}><LeadName leadRef={c.leadRef} name={c.fullName} leadId={c.leadId} leadHref={leadHref} /></td>
              <td className={td}>
                {c.connected === 'Yes'
                  ? <span className="text-emerald-400 font-semibold">Connected</span>
                  : <span className="text-red-400 font-semibold">Not connected</span>}
                <div className="text-xs text-app-text-muted">{c.connected === 'Yes' ? c.interestLevel : c.notConnectedReason}</div>
              </td>
              <td className={td}>{c.callType || '—'}</td>
              <td className={td}>{c.leadStage || '—'}</td>
              <td className={`${td} text-right`}>{c.duration ? `${c.duration} min` : '—'}</td>
              <td className={`${td} w-[280px] min-w-[220px] max-w-[280px]`}><RemarkCell text={c.remark} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const selectClass = 'text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-1.5 text-app-text';
const pageBtn = 'px-3 py-1.5 rounded-lg border border-app-border text-app-text disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed';

/** `value`, settled for `delay` ms — so a search box doesn't query on every keystroke. */
function useDebounced(value, delay = 350) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return settled;
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
      <input
        type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-xs rounded-lg border border-app-border bg-form-input-bg pl-8 pr-2 py-1.5 text-app-text"
      />
    </div>
  );
}

function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={pageBtn}>Previous</button>
      <span className="text-app-text-muted">Page {page} of {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={pageBtn}>Next</button>
    </div>
  );
}

const SEARCH_HINT = 'Search lead name, ID or phone…';

/**
 * Calls newest first, 25 per page — search by lead, filter by result, and by
 * BDE for the whole team. With `member`, only that BDE's calls (their drill-down log).
 */
function TeamCallLog({ scope, fetchData, params, members, leadHref, member }) {
  const [by, setBy] = useState('All');
  const [result, setResult] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  // back to page 1 when the period or search changes, so a smaller result never lands past its last page
  const resetKey = JSON.stringify([params, q]);
  const [pageFor, setPageFor] = useState(resetKey);
  if (pageFor !== resetKey) {
    setPageFor(resetKey);
    setPage(1);
  }
  const query = { ...params, by: member ? member.adminId : by, result, q, page };
  const { data, isLoading, error } = useQuery({
    queryKey: [scope, 'team-performance', 'calls', query],
    queryFn: () => fetchData('/calls', query),
    placeholderData: keepPreviousData,
  });
  const pick = (setter) => (e) => { setter(e.target.value); setPage(1); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder={SEARCH_HINT} />
        {!member && (
          <select value={by} onChange={pick(setBy)} className={selectClass}>
            <option value="All">All BDEs</option>
            {members.map((m) => <option key={m.adminId} value={m.adminId}>{m.name}</option>)}
          </select>
        )}
        <select value={result} onChange={pick(setResult)} className={selectClass}>
          <option value="All">All results</option>
          <option value="Connected">Connected</option>
          <option value="Not Connected">Not connected</option>
        </select>
        {data && <span className="text-xs text-app-text-muted">{data.total} call{data.total === 1 ? '' : 's'}</span>}
      </div>
      {error && <div className="text-sm text-red-400">{errorOf(error, 'Could not load the team call log.')}</div>}
      {isLoading ? <Loader /> : !data?.calls.length ? (
        <Empty>{q ? `No calls on leads matching "${q}" in this period.` : 'No calls logged in this period.'}</Empty>
      ) : (
        <>
          <CallTable calls={data.calls} leadHref={leadHref} showCaller={!member} />
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

/** One BDE's active leads, 25 per page, searchable. Not tied to the period — it's their book as of now. */
function MemberLeads({ scope, fetchData, member, leadHref }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const [pageFor, setPageFor] = useState(q);
  if (pageFor !== q) {
    setPageFor(q);
    setPage(1);
  }
  const query = { q, page };
  const { data, isLoading, error } = useQuery({
    queryKey: [scope, 'team-performance', 'leads', String(member.adminId), query],
    queryFn: () => fetchData(`/${member.adminId}`, query),
    placeholderData: keepPreviousData,
  });

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-app-text">
          Leads they are working on{data ? ` (${data.total}${q ? ' matching' : ''})` : ''}
        </h4>
        <SearchBox value={search} onChange={setSearch} placeholder={SEARCH_HINT} />
      </div>
      {error && <div className="text-sm text-red-400">{errorOf(error, 'Could not load this team member.')}</div>}
      {isLoading ? <Loader /> : !data?.leads.length ? (
        <Empty>{q ? `No active leads matching "${q}".` : 'No active leads assigned.'}</Empty>
      ) : (
        <>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-left min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                  <th className={th}>Lead</th><th className={th}>Stage</th><th className={th}>Interest</th>
                  <th className={th}>Next follow-up</th><th className={th}>Last call</th><th className={`${th} text-right`}>Touches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {data.leads.map((l) => {
                  const overdue = l.nextFollowUpDate && new Date(l.nextFollowUpDate) < new Date(data.asOf) && l.status !== 'Hold';
                  return (
                    <tr key={l._id} className="align-top">
                      <td className={td}><LeadName leadRef={l._id} name={l.fullName} leadId={l.leadId} leadHref={leadHref} /></td>
                      <td className={td}>{l.status}</td>
                      <td className={td}>{l.interestLevel || '—'}</td>
                      <td className={`${td} ${overdue ? 'text-red-400 font-semibold' : ''}`}>
                        {l.nextFollowUpDate ? fmtDateTime(l.nextFollowUpDate) : '—'}
                        {l.nextActionType && <div className="text-[11px] text-app-text-muted">{l.nextActionType}{overdue ? ' · overdue' : ''}</div>}
                      </td>
                      <td className={td}>{l.lastCallAt ? fmtDateTime(l.lastCallAt) : 'Never called'}</td>
                      <td className={`${td} text-right`}>{l.touchNumber || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function MemberDetail({ member, leadHref, onBack, scope, fetchData, params, showBackButton }) {
  const summary = member;
  return (
    <div className="space-y-5">
      {showBackButton && (
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-app-text-muted hover:text-primary cursor-pointer">
          <ArrowLeft size={15} /> Back to team
        </button>
      )}
      <div>
        <h3 className="text-lg font-bold text-app-text">{summary.name}</h3>
        <p className="text-xs text-app-text-muted">{[summary.employeeId, summary.designation].filter(Boolean).join(' · ')}</p>
      </div>
      <Totals totals={summary} />

      <div className="flex flex-wrap gap-2">
        {STAGE_ORDER.filter((s) => summary.stages?.[s]).map((s) => (
          <span key={s} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-app-bg border border-app-border text-app-text">
            {s}: {summary.stages[s]}
          </span>
        ))}
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-bold text-app-text">Call log</h4>
        <TeamCallLog scope={scope} fetchData={fetchData} params={params} leadHref={leadHref} member={member} />
      </section>

      <MemberLeads scope={scope} fetchData={fetchData} member={member} leadHref={leadHref} />
    </div>
  );
}

export default function TeamPerformance({ scope, fetchData, leadHref, title = 'My Team Performance', subtitle, showBackButton = true }) {
  const [period, setPeriod] = useState('today');
  const [from, setFrom] = useState(toDateInput());
  const [to, setTo] = useState(toDateInput());
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('bde');
  // opening a BDE pushes a history entry, so Back (browser or layout) returns to the team
  const setSelected = (adminId) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (adminId) next.set('bde', adminId); else next.delete('bde');
    return next;
  });
  const [view, setView] = useState('members'); // members | calls

  const params = period === 'custom' ? { period, from, to } : { period };

  const summaryQuery = useQuery({
    queryKey: [scope, 'team-performance', params],
    queryFn: () => fetchData('', params),
    placeholderData: keepPreviousData,
  });

  const summary = summaryQuery.data;
  const error = summaryQuery.error ? errorOf(summaryQuery.error, 'Could not load team performance.') : '';
  const members = summary?.members || [];
  const selectedMember = members.find((m) => String(m.adminId) === String(selected));
  const range = summary?.range;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-app-text">{title}</h2>
          <p className="text-xs text-app-text-muted mt-1">
            {subtitle || `${members.length} BDE${members.length === 1 ? '' : 's'}`}
            {range && ` · ${fmtDate(range.start)} – ${fmtDate(range.end)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${period === p.key ? 'bg-primary text-black border-primary' : 'border-app-border text-app-text hover:border-primary'}`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
                className="text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-1.5 text-app-text" />
              <span className="text-xs text-app-text-muted">to</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
                className="text-xs rounded-lg border border-app-border bg-form-input-bg px-2 py-1.5 text-app-text" />
            </div>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

      {summaryQuery.isLoading ? <Loader /> : selectedMember ? (
        <MemberDetail
          member={selectedMember} leadHref={leadHref}
          onBack={() => setSelected(null)} showBackButton={showBackButton} scope={scope} fetchData={fetchData} params={params}
        />
      ) : members.length === 0 ? (
        <Empty>No BDEs report to you yet.</Empty>
      ) : (
        <>
          <Totals totals={summary.totals} />
          <div className="flex gap-1 border-b border-app-border">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" onClick={() => setView(v.key)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${view === v.key ? 'border-primary text-primary' : 'border-transparent text-app-text-muted hover:text-app-text'}`}>
                {v.label}
              </button>
            ))}
          </div>
          {view === 'calls' ? (
            <TeamCallLog scope={scope} fetchData={fetchData} params={params} members={members} leadHref={leadHref} />
          ) : (
            <>
              <MemberTable members={members} onOpen={(m) => setSelected(String(m.adminId))} />
              <p className="text-[11px] text-app-text-muted">
                Calls count every outcome a BDE logged in the period. Active leads, follow-ups and stages are as of now. Click a BDE to see their call log and leads.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
