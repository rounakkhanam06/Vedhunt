import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Phone, PhoneCall, PhoneOff, Clock, AlertTriangle, Trophy, Target, Search, CalendarCheck, Users, X } from 'lucide-react';
import { fmtDateTime, fmtMinutes, fmtINR, toDateInput } from '../../employee/lib/datetime';
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
 * Also exports MyCallLog — a BDE's own calls, same period picker and call table.
 *
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
  { key: 'daily', label: 'Daily calls' },
  { key: 'status', label: 'Lead status' },
  { key: 'pending', label: 'Pending calls' },
  { key: 'calls', label: 'Team call log' },
];

const MY_VIEWS = [
  { key: 'calls', label: 'My calls' },
  { key: 'daily', label: 'Daily calls' },
  { key: 'status', label: 'Lead status' },
  { key: 'pending', label: 'Pending calls' },
];

/** The open tab, kept in the URL (?view=) so refresh and Back keep it. */
function useViewParam(views) {
  const [searchParams, setSearchParams] = useSearchParams();
  const fromUrl = searchParams.get('view');
  const view = views.some((v) => v.key === fromUrl) ? fromUrl : views[0].key;
  const setView = (key) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (key === views[0].key) next.delete('view'); else next.set('view', key);
    return next;
  }, { replace: true });
  return [view, setView];
}

function Tabs({ views, view, setView }) {
  return (
    <div className="flex gap-1 border-b border-app-border overflow-x-auto">
      {views.map((v) => (
        <button key={v.key} type="button" onClick={() => setView(v.key)}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${view === v.key ? 'border-primary text-primary' : 'border-transparent text-app-text-muted hover:text-app-text'}`}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

/** Client-side paging over an already-loaded list; back to page 1 when the list changes. */
function usePaged(list, size) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(list.length / size));
  useEffect(() => { setPage(1); }, [list.length, size]);
  const current = Math.min(page, pages);
  return { items: list.slice((current - 1) * size, current * size), page: current, pages, setPage, from: list.length ? (current - 1) * size + 1 : 0, to: Math.min(current * size, list.length), total: list.length };
}

/** "Showing 11–20 of 34 BDEs" + Previous / Next */
function PageFooter({ paged, noun }) {
  if (paged.pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-app-text-muted">Showing {paged.from}–{paged.to} of {paged.total} {noun}</span>
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} />
    </div>
  );
}

const STAGE_ORDER = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Hold'];

const card = 'bg-app-card border border-app-border rounded-xl';
const th = 'py-3 px-3 font-semibold';
const td = 'py-3 px-3';

const errorOf = (err, fallback) => err?.response?.data?.message || fallback;

// The reporting period exactly as the server counted it — in its timezone
// (IST for Vedhunt), whatever the viewer's browser is set to.
function PeriodLabel({ period, range }) {
  if (!range) return null;
  const timeZone = range.timeZone || 'Asia/Kolkata';
  const fmt = (d) => new Date(d).toLocaleString('en-IN', { timeZone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const zone = timeZone === 'Asia/Kolkata' ? 'IST' : timeZone;
  const name = PERIODS.find((p) => p.key === period)?.label || 'Period';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
      {name}: {fmt(range.start)} – {fmt(range.end)} {zone}
      <span className="font-normal opacity-80">· weeks start Monday · custom ranges include both dates</span>
    </span>
  );
}

const fmtAvg = (m) => (m == null ? '—' : `${m} min`);

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

/** The calling metrics for a period — organisation totals or one BDE's own. */
function CallingTiles({ t }) {
  return (
    <>
      <Tile icon={Phone} label="Total calls" value={t.calls} />
      <Tile icon={PhoneCall} label="Connected" value={t.connected} sub={`${t.connectRate}% connect rate`} tone="text-emerald-400 bg-emerald-500/10" />
      <Tile icon={PhoneOff} label="Not connected" value={t.notConnected} tone="text-red-400 bg-red-500/10" />
      <Tile icon={Users} label="Unique leads called" value={t.leadsWorked} />
      <Tile icon={Clock} label="Avg call duration" value={fmtAvg(t.avgCallMinutes)} sub={`${t.timedCalls} timed · ${fmtMinutes(t.talkMinutes)} total`} tone="text-sky-400 bg-sky-500/10" />
      <Tile icon={CalendarCheck} label="Follow-ups due" value={t.followUpsDue} sub={`${t.followUpsDueCompleted} of them completed`} />
      <Tile icon={CalendarCheck} label="Follow-ups completed" value={t.followUpsCompleted} sub="in this period" tone="text-emerald-400 bg-emerald-500/10" />
    </>
  );
}

function Totals({ totals }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <CallingTiles t={totals} />
      <Tile icon={Target} label="Active leads" value={totals.activeLeads} sub={`${totals.followUpsDueToday} due today · ${totals.followUpsOverdue} overdue (now)`} />
      <Tile icon={AlertTriangle} label="Overdue follow-ups" value={totals.followUpsOverdue} sub="as of now" tone="text-red-400 bg-red-500/10" />
      <Tile icon={Trophy} label="Won" value={totals.won} sub={fmtINR(totals.wonValue)} tone="text-amber-500 bg-amber-500/10" />
    </div>
  );
}

function MemberTable({ members: all, onOpen }) {
  const paged = usePaged(all, 10);
  const members = paged.items;
  return (
    <div className="space-y-2">
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-left min-w-[1150px] text-sm">
          <thead>
            <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
              <th className={th}>BDE</th>
              <th className={`${th} text-right`}>Calls</th>
              <th className={`${th} text-right`}>Connected</th>
              <th className={`${th} text-right`}>Not conn.</th>
              <th className={`${th} text-right`}>Rate</th>
              <th className={`${th} text-right`}>Avg dur.</th>
              <th className={`${th} text-right`}>Talk time</th>
              <th className={`${th} text-right`}>Unique leads</th>
              <th className={`${th} text-right`}>FU due</th>
              <th className={`${th} text-right`}>FU done</th>
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
                <td className={`${td} text-right`}>{fmtAvg(m.avgCallMinutes)}</td>
                <td className={`${td} text-right`}>{fmtMinutes(m.talkMinutes)}</td>
                <td className={`${td} text-right`}>{m.leadsWorked}</td>
                <td className={`${td} text-right`}>{m.followUpsDue}</td>
                <td className={`${td} text-right`}>{m.followUpsCompleted}</td>
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
      <PageFooter paged={paged} noun="BDEs" />
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
 * BDE for the whole team. With `member`, only that BDE's calls (their
 * drill-down log); with `self`, the signed-in BDE's own calls.
 */
function TeamCallLog({ scope, fetchData, params, members = [], leadHref, member, self }) {
  const oneCaller = Boolean(member || self);
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
  const query = { ...params, ...(self ? {} : { by: member ? member.adminId : by }), result, q, page };
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
        {!oneCaller && (
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
          <CallTable calls={data.calls} leadHref={leadHref} showCaller={!oneCaller} />
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

// Rows of the daily table, top to bottom, for each BDE
const DAILY_METRICS = [
  { key: 'connected', label: 'Connected Calls', tone: 'text-emerald-400' },
  { key: 'notConnected', label: 'Not Connected Calls', tone: 'text-red-400' },
  { key: 'calls', label: 'Total Calls', tone: 'text-app-text font-bold' },
  { key: 'connectRate', label: 'Connect %', fmt: (v) => (v == null ? '—' : `${v.toFixed(2)}%`) },
  { key: 'uniqueLeads', label: 'Unique Leads Called', tone: 'text-app-text-muted' },
  { key: 'collaboratorCalls', label: '…of calls, on shared leads', tone: 'text-purple-400' },
];

const fmtDay = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtWeekday = (day) => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });

function DailyGroup({ title, sub, row, days, highlight }) {
  return DAILY_METRICS.map((metric, i) => (
    <tr key={`${title}-${metric.key}`} className={`${i === 0 ? 'border-t-2 border-app-border' : ''} ${highlight ? 'bg-primary/5' : ''}`}>
      {i === 0 && (
        <td rowSpan={DAILY_METRICS.length} className={`${td} align-top sticky left-0 z-10 ${highlight ? 'bg-app-bg' : 'bg-app-card'} border-r border-app-border min-w-[160px]`}>
          <div className="font-semibold text-app-text">{title}</div>
          {sub && <div className="text-xs text-app-text-muted">{sub}</div>}
        </td>
      )}
      <td className={`${td} whitespace-nowrap text-xs text-app-text-muted`}>{metric.label}</td>
      {days.map((day) => {
        const v = row.days[day][metric.key];
        return <td key={day} className={`${td} text-right tabular-nums ${metric.tone || ''}`}>{metric.fmt ? metric.fmt(v) : v}</td>;
      })}
      <td className={`${td} text-right tabular-nums font-bold border-l border-app-border ${metric.tone || ''}`}>
        {metric.fmt ? metric.fmt(row.total[metric.key]) : row.total[metric.key]}
      </td>
    </tr>
  ));
}

/**
 * BD-wise Daily Call Performance — dates as columns, metrics as rows, one
 * group per BDE (plus organisation totals for a team). Same period as the
 * dashboard above; days are IST calendar days. Every call attempt counts;
 * each call belongs to the BDE who made it.
 */
function DailyCallPerformance({ scope, fetchData, params, showTotals }) {
  const { data, error, isLoading } = useQuery({
    queryKey: [scope, 'daily-calls', params],
    queryFn: () => fetchData('/daily', params),
    placeholderData: keepPreviousData,
  });
  const days = data?.days || [];
  const paged = usePaged(data?.members || [], 5);
  const members = paged.items;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold text-app-text">BD-wise Daily Call Performance</h3>
        <p className="text-xs text-app-text-muted">
          Every call attempt counts, including repeat calls to the same lead (unique leads shown separately). A call counts for the BDE who made it; calls on leads someone else owns (collaborator activity) are also shown on their own row. Connect % = connected ÷ total calls × 100 (— when there are no calls). Days are IST.
        </p>
      </div>
      {error && <div className="text-sm text-red-400">{errorOf(error, 'Could not load the daily call performance.')}</div>}
      {isLoading ? <Loader /> : data && (
        members.length === 0 ? <Empty>No BDEs to show.</Empty> : (
          <div className={`${card} overflow-x-auto`}>
            <table className="text-sm min-w-full">
              <thead>
                <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                  <th className={`${th} text-left sticky left-0 z-10 bg-app-card border-r border-app-border`}>BDE</th>
                  <th className={`${th} text-left`}>Metric</th>
                  {days.map((day) => (
                    <th key={day} className={`${th} text-right whitespace-nowrap`}>
                      <div>{fmtDay(day)}</div>
                      <div className="text-[10px] font-normal normal-case">{fmtWeekday(day)}</div>
                    </th>
                  ))}
                  <th className={`${th} text-right border-l border-app-border`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <DailyGroup key={m.adminId} title={m.name} sub={m.employeeId} row={m} days={days} />
                ))}
                {showTotals && paged.total > 1 && (
                  <DailyGroup title="All BDEs" sub="Organisation total (every page)" row={data.totals} days={days} highlight />
                )}
              </tbody>
            </table>
          </div>
        )
      )}
      <PageFooter paged={paged} noun="BDEs" />
    </div>
  );
}

const fmtCount = (n) => (n ? n.toLocaleString('en-IN') : '0');

/** The leads behind a count, in a dialog — same scope as the table it came from. */
function DrillDown({ query, title, scope, fetchData, leadHref, onClose }) {
  const { data, error, isLoading } = useQuery({
    queryKey: [scope, 'board-leads', query],
    queryFn: () => fetchData('/board-leads', query),
  });
  const leads = data?.leads || [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={`${card} w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden`} onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-app-border">
          <h3 className="font-semibold text-app-text">{title} <span className="text-app-text-muted font-normal">· {leads.length}{leads.length === 500 ? '+' : ''} lead{leads.length === 1 ? '' : 's'}</span></h3>
          <button type="button" onClick={onClose} className="p-1.5 text-app-text-muted hover:text-app-text cursor-pointer" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
          {error && <div className="p-4 text-sm text-red-400">{errorOf(error, 'Could not load these leads.')}</div>}
          {isLoading ? <Loader /> : (
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-app-card">
                <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                  <th className={th}>Lead</th><th className={th}>Owner</th><th className={th}>Status</th><th className={th}>Assigned</th><th className={th}>Last call</th><th className={`${th} text-right`}>Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {leads.map((l) => (
                  <tr key={l._id}>
                    <td className={td}><LeadName leadRef={l._id} name={l.fullName} leadId={l.leadId} leadHref={leadHref} /></td>
                    <td className={`${td} text-app-text-muted`}>{l.owner || 'Unassigned'}</td>
                    <td className={td}>{l.status}{l.interestLevel ? <div className="text-[11px] text-app-text-muted">{l.interestLevel}</div> : null}</td>
                    <td className={`${td} text-app-text-muted whitespace-nowrap`}>{fmtDateTime(l.assignedAt || l.createdAt)}</td>
                    <td className={`${td} text-app-text-muted whitespace-nowrap`}>{l.lastCallAt ? fmtDateTime(l.lastCallAt) : '—'}</td>
                    <td className={`${td} text-right`}>{fmtINR(l.dealCloseValue || l.proposalValue || l.dealValue || 0)}</td>
                  </tr>
                ))}
                {!leads.length && <tr><td colSpan={6} className="p-6 text-center text-app-text-muted">No leads.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_COLUMNS = [
  { key: 'open', label: 'Open', hint: 'Every non-terminal status, Hold included' },
  { key: 'hold', label: 'of which Hold' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'total', label: 'Total' },
];

/**
 * BDE-wise Lead Status (as of now). Counted by primary owner, so a lead
 * shared between BDs is one lead in every total; the leads someone
 * collaborates on are a separate column that never adds into totals.
 */
function LeadStatusTable({ scope, fetchData, leadHref }) {
  const [drill, setDrill] = useState(null);
  const { data, error, isLoading } = useQuery({ queryKey: [scope, 'lead-status'], queryFn: () => fetchData('/lead-status', {}) });
  const allRows = data?.rows || [];
  const team = allRows.some((r) => 'collaborating' in r);
  const paged = usePaged(allRows, 15);
  const rows = paged.items;
  const open = (row, key, label) => setDrill({ query: { owner: row.owner, bucket: key }, title: `${row.name} — ${label}` });
  const Count = ({ row, k, label, className = '' }) => (
    <td className={`${td} text-right tabular-nums ${className}`}>
      {row[k] ? <button type="button" onClick={() => open(row, k, label)} className="hover:text-primary hover:underline cursor-pointer">{fmtCount(row[k])}</button> : <span className="text-app-text-muted">0</span>}
    </td>
  );
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold text-app-text">BDE-wise Lead Status</h3>
        <p className="text-xs text-app-text-muted">
          All Sales leads as of now, by primary owner. Open = every status except Won, Lost and Dropped (Hold is included, and also shown on its own). A shared lead counts once, for its owner{team ? '; "Collaborating" lists leads shared with a BDE and is not added into totals' : ''}. Click a number to see the leads.
        </p>
      </div>
      {error && <div className="text-sm text-red-400">{errorOf(error, 'Could not load the lead status table.')}</div>}
      {isLoading ? <Loader /> : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-left text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                <th className={th}>Lead owner</th>
                {STATUS_COLUMNS.map((c) => <th key={c.key} className={`${th} text-right`} title={c.hint}>{c.label}</th>)}
                <th className={`${th} text-right`}>Open pipeline</th>
                {team && <th className={`${th} text-right`}>Collaborating</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {rows.map((r) => (
                <tr key={r.owner} className={r.collaborator ? 'bg-purple-500/5' : ''}>
                  <td className={td}>
                    <div className={`font-semibold ${r.unassigned ? 'text-amber-400' : 'text-app-text'}`}>{r.name}</div>
                    {r.other && <div className="text-[11px] text-app-text-muted">Not a BDE</div>}
                    {r.collaborator && <div className="text-[11px] text-purple-400">Not included in your totals</div>}
                  </td>
                  {STATUS_COLUMNS.map((c) => <Count key={c.key} row={r} k={c.key} label={c.label} className={c.key === 'total' ? 'font-bold' : ''} />)}
                  <td className={`${td} text-right`}>{fmtINR(r.openValue)}</td>
                  {team && <Count row={r} k="collaborating" label="leads shared with them" className="text-purple-400" />}
                </tr>
              ))}
              {data?.totals && (
                <tr className="border-t-2 border-app-border bg-primary/5 font-bold">
                  <td className={td}>{team ? 'Total (distinct leads)' : 'My total (owned)'}</td>
                  {STATUS_COLUMNS.map((c) => <td key={c.key} className={`${td} text-right tabular-nums`}>{fmtCount(data.totals[c.key])}</td>)}
                  <td className={`${td} text-right`}>{fmtINR(data.totals.openValue)}</td>
                  {team && <td className={td} />}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <PageFooter paged={paged} noun="owners" />
      {drill && <DrillDown {...drill} scope={scope} fetchData={fetchData} leadHref={leadHref} onClose={() => setDrill(null)} />}
    </div>
  );
}

/** Pending Call — assigned, no action taken yet (same leads as Raw Leads); owner × IST assignment date. */
function PendingCallsTable({ scope, fetchData, leadHref }) {
  const [drill, setDrill] = useState(null);
  const { data, error, isLoading } = useQuery({ queryKey: [scope, 'pending-calls'], queryFn: () => fetchData('/pending-calls', {}) });
  const days = data?.days || [];
  const allOwners = (data?.owners || []).filter((o) => o.total > 0 || !o.collaborator);
  const paged = usePaged(allOwners, 15);
  const owners = paged.items;
  const open = (o, day) => setDrill({
    query: { owner: o.owner, bucket: 'pending', ...(day && { day }) },
    title: `${o.name} — not yet called${day ? `, assigned ${fmtDay(day)}` : ''}`,
  });
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold text-app-text">Pending Calls</h3>
        <p className="text-xs text-app-text-muted">Leads assigned with no action taken yet — the same leads as the Raw Leads tab (open leads only), by owner and assignment date (IST), as of now. Click a number to see the leads.</p>
      </div>
      {error && <div className="text-sm text-red-400">{errorOf(error, 'Could not load pending calls.')}</div>}
      {isLoading ? <Loader /> : !data?.total && !allOwners.some((o) => o.total) ? <Empty>Nothing pending — every assigned lead has been called.</Empty> : (
        <div className={`${card} overflow-x-auto`}>
          <table className="text-sm min-w-full">
            <thead>
              <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                <th className={`${th} text-left sticky left-0 z-10 bg-app-card border-r border-app-border`}>Lead owner</th>
                {days.map((d) => <th key={d} className={`${th} text-right whitespace-nowrap`}>{fmtDay(d)}<div className="text-[10px] font-normal normal-case">{fmtWeekday(d)}</div></th>)}
                <th className={`${th} text-right border-l border-app-border`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {owners.map((o) => (
                <tr key={o.owner} className={o.collaborator ? 'bg-purple-500/5' : ''}>
                  <td className={`${td} sticky left-0 z-10 bg-app-card border-r border-app-border whitespace-nowrap font-semibold text-app-text`}>{o.name}</td>
                  {days.map((d) => (
                    <td key={d} className={`${td} text-right tabular-nums`}>
                      {o.days[d] ? <button type="button" onClick={() => open(o, d)} className="hover:text-primary hover:underline cursor-pointer">{o.days[d]}</button> : <span className="text-app-text-muted">·</span>}
                    </td>
                  ))}
                  <td className={`${td} text-right font-bold border-l border-app-border`}>
                    {o.total ? <button type="button" onClick={() => open(o)} className="hover:text-primary hover:underline cursor-pointer">{o.total}</button> : 0}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-app-border bg-primary/5 font-bold">
                <td className={`${td} sticky left-0 z-10 bg-app-bg border-r border-app-border`}>Total</td>
                {days.map((d) => <td key={d} className={`${td} text-right`}>{data.totals[d] || 0}</td>)}
                <td className={`${td} text-right border-l border-app-border`}>{data.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <PageFooter paged={paged} noun="owners" />
      {drill && <DrillDown {...drill} scope={scope} fetchData={fetchData} leadHref={leadHref} onClose={() => setDrill(null)} />}
    </div>
  );
}

function usePeriod() {
  const [period, setPeriod] = useState('today');
  const [from, setFrom] = useState(toDateInput());
  const [to, setTo] = useState(toDateInput());
  const params = period === 'custom' ? { period, from, to } : { period };
  return { period, setPeriod, from, setFrom, to, setTo, params };
}

function PeriodPicker({ period, setPeriod, from, setFrom, to, setTo }) {
  return (
    <div className="flex flex-wrap items-center gap-2" title="Weeks start on Monday. Custom ranges include both the start and end dates. All days are IST.">
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
  );
}

/**
 * A BDE's own call log: totals for the period, then every call they made —
 * searchable, filterable by result, 25 per page. `fetchData('')` returns the
 * totals and `fetchData('/calls')` a page of calls, both scoped server-side
 * to the signed-in user.
 */
export function MyCallLog({ scope, fetchData, leadHref, title = 'My Calling Performance' }) {
  const periodState = usePeriod();
  const [view, setView] = useViewParam(MY_VIEWS);
  const { params } = periodState;
  const { data: summary, error } = useQuery({
    queryKey: [scope, 'my-calls', params],
    queryFn: () => fetchData('', params),
    placeholderData: keepPreviousData,
  });
  const range = summary?.range;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-app-text">{title}</h2>
          <p className="text-xs text-app-text-muted mt-1 mb-1.5">Your calls and follow-ups for the period, then every call you logged.</p>
          <PeriodLabel period={periodState.period} range={range} />
        </div>
        <PeriodPicker {...periodState} />
      </div>

      {error && <div className="text-sm text-red-400">{errorOf(error, 'Could not load your calls.')}</div>}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <CallingTiles t={summary} />
        </div>
      )}

      <Tabs views={MY_VIEWS} view={view} setView={setView} />
      {view === 'daily' && <DailyCallPerformance scope={scope} fetchData={fetchData} params={params} />}
      {view === 'status' && <LeadStatusTable scope={scope} fetchData={fetchData} leadHref={leadHref} />}
      {view === 'pending' && <PendingCallsTable scope={scope} fetchData={fetchData} leadHref={leadHref} />}
      {view === 'calls' && <TeamCallLog scope={scope} fetchData={fetchData} params={params} leadHref={leadHref} self />}
    </div>
  );
}

export default function TeamPerformance({ scope, fetchData, leadHref, title = 'My Team Performance', subtitle, showBackButton = true }) {
  const periodState = usePeriod();
  const { params } = periodState;
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('bde');
  // opening a BDE pushes a history entry, so Back (browser or layout) returns to the team
  const setSelected = (adminId) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev);
    if (adminId) next.set('bde', adminId); else next.delete('bde');
    return next;
  });
  const [view, setView] = useViewParam(VIEWS);

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
          </p>
          <div className="mt-1.5"><PeriodLabel period={periodState.period} range={range} /></div>
        </div>
        <PeriodPicker {...periodState} />
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
          <Tabs views={VIEWS} view={view} setView={setView} />
          {view === 'members' && (
            <>
              <MemberTable members={members} onOpen={(m) => setSelected(String(m.adminId))} />
              <p className="text-[11px] text-app-text-muted">
                Calls count every outcome a BDE logged in the period; average duration covers timed calls only. FU due / done are follow-ups due in, and completed in, the period. Active leads, due today and overdue are as of now. Click a BDE to see their call log and leads.
              </p>
            </>
          )}
          {view === 'daily' && <DailyCallPerformance scope={scope} fetchData={fetchData} params={params} showTotals />}
          {view === 'status' && <LeadStatusTable scope={scope} fetchData={fetchData} leadHref={leadHref} />}
          {view === 'pending' && <PendingCallsTable scope={scope} fetchData={fetchData} leadHref={leadHref} />}
          {view === 'calls' && <TeamCallLog scope={scope} fetchData={fetchData} params={params} members={members} leadHref={leadHref} />}
        </>
      )}
    </div>
  );
}
