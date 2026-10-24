import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import LeadCard from '../components/LeadCard';
import LeadSearch from '../components/LeadSearch';
import Pagination from '../components/Pagination';
import { PAGE_SIZES } from '../lib/pagination';
import { Spinner, EmptyCard, TabHeader } from '../components/PortalUI';
import { useEssLeads, essKeys } from '../lib/ess';
import { fmtDateTime, toDateInput } from '../lib/datetime';
import { followUpBucket, isCallPending, needsNextAction, isPaymentPending, isWonThisMonth, mergeLead, leadListCounts, isWorkingLead, isDroppedHoldLead, hasFollowUp, CLOSED_OR_HOLD, DROPPED_OR_HOLD } from '../lib/leads';
import { FOLLOW_UP_TYPES, INTEREST_LEVELS } from '../../shared/leadConstants';
import { SERVICES_REQUIRED_OPTIONS, LEAD_PRIORITY_LEVELS } from '../../shared/serviceQualification';

// Statuses a Working lead can have; closed/hold ones are only reached through a dashboard drill-down
const WORKING_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation'];
// Same option lists as the admin Raw/Working Leads filters (admin/pages/LeadsManager.jsx).
const PLATFORMS = ['Website', 'Facebook', 'Google Ads', 'Instagram', 'Manual'];
const SOURCES = ['Google', 'Facebook', 'Instagram', 'LinkedIn', 'YouTube', 'Referral', 'Direct'];
const NO_ATTR_FILTERS = { platform: 'All', source: 'All', form: 'All', service: 'All', priority: 'All', leadType: 'All', breached: false };
const selectClass = 'bg-app-card border border-app-border rounded-lg px-3 py-1.5 text-sm text-app-text focus:outline-none focus:border-primary/50 cursor-pointer';

// Lists are paged in the browser (the portal loads a BD's leads in one request); the size is remembered per device
const PAGE_SIZE_KEY = 'employeeLeadPageSize';
const DEFAULT_PAGE_SIZE = 20;
const readPageSize = () => {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return PAGE_SIZES.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
};
const writePageSize = (size) => {
  try { localStorage.setItem(PAGE_SIZE_KEY, String(size)); } catch { /* storage unavailable — the choice just isn't remembered */ }
};

const VIEWS = {
  raw: { title: 'Raw Leads', subtitle: 'Assigned to you, no action taken yet — log a call, message or note to move it to Working' },
  working: { title: 'Working Leads', subtitle: "Leads you've acted on and are still working — Won, Lost, Dropped and Hold leads leave this list" },
  'dropped-hold': { title: 'Dropped & Hold', subtitle: 'Dropped and on-hold leads with their history — change the status to bring one back' },
  followups: { title: 'Follow-ups', subtitle: 'Every scheduled next action on your leads, with its type and exact due time' },
};

// Which lead date the From/To range applies to, and the list orderings.
const DATE_FIELDS = { createdAt: 'Received', assignedAt: 'Assigned', lastCallAt: 'Last call', lastActivityAt: 'Last activity', nextFollowUpDate: 'Follow-up due' };
const SORTS = {
  received: { label: 'Newest received', field: 'createdAt' },
  assigned: { label: 'Recently assigned', field: 'assignedAt' },
  called: { label: 'Recently called', field: 'lastCallAt' },
  activity: { label: 'Latest activity', field: 'lastActivityAt' },
};

/** Lead date filtering + ordering shared by all three views — all client-side over the cached list. */
function applyDateFilters(list, { dateField, dateFrom, dateTo, connected, sort }) {
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
  const out = list.filter((l) => {
    if (connected !== 'All' && l.connected !== connected) return false;
    if (!from && !to) return true;
    const value = l[dateField] ? new Date(l[dateField]) : null;
    return value && (!from || value >= from) && (!to || value <= to);
  });
  if (!sort) return out;
  const field = SORTS[sort].field;
  // Leads without that date (e.g. never called) go last.
  return [...out].sort((a, b) => (b[field] ? new Date(b[field]) : 0) - (a[field] ? new Date(a[field]) : 0));
}

/** Lead attribute filters for Raw/Working — mirrors the admin lead list's dropdowns. */
function applyAttrFilters(list, f) {
  return list.filter((l) =>
    (f.platform === 'All' || l.platform === f.platform) &&
    (f.source === 'All' || l.userSource === f.source) &&
    (f.form === 'All' || l.fbFormId === f.form) &&
    (f.service === 'All' || l.service === f.service) &&
    (f.priority === 'All' || l.leadPriority === f.priority) &&
    (f.leadType === 'All' || (l.leadType || 'Sales') === f.leadType) &&
    (!f.breached || l.followUpBreached));
}

/** "12" for the whole list, "5 of 12" once filters narrow it. */
function CountChip({ shown, base }) {
  const narrowed = base != null && shown !== base;
  return (
    <span
      className="ml-2 align-middle inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold"
      title={narrowed ? `${shown} shown of ${base} in this list` : `${shown} in this list`}
    >
      {narrowed ? `${shown} of ${base}` : shown}
    </span>
  );
}

function FilterNotice({ children, onClear }) {
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs font-medium text-amber-500 flex items-center justify-between gap-3">
      <span>{children}</span>
      <button onClick={onClear} className="underline hover:opacity-80 shrink-0 cursor-pointer">Show all</button>
    </div>
  );
}

// Rows shown before "Show all" — keeps a long overdue list from pushing the lead cards off screen
const DUE_PREVIEW = 4;

function DueList({ leads, tone, onOpen }) {
  const overdue = tone === 'overdue';
  const [expanded, setExpanded] = useState(false);
  const collapsible = leads.length > DUE_PREVIEW;
  const visible = collapsible && !expanded ? leads.slice(0, DUE_PREVIEW) : leads;
  return (
    <div className={`${overdue ? 'bg-red-500/5 border-red-500/20' : 'bg-primary/5 border-primary/20'} border rounded-xl p-4`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className={`text-sm font-bold flex items-center gap-2 ${overdue ? 'text-red-400' : 'text-primary'}`}>
          {overdue ? <AlertTriangle size={16} /> : <Clock size={16} />} {overdue ? 'Overdue Follow-ups' : 'Follow-ups Today'} ({leads.length})
        </h3>
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className={`text-xs font-semibold flex items-center gap-1 hover:underline cursor-pointer ${overdue ? 'text-red-400' : 'text-primary'}`}
          >
            {expanded ? <>Show less <ChevronUp size={14} /></> : <>Show all {leads.length} <ChevronDown size={14} /></>}
          </button>
        )}
      </div>
      <div className={`space-y-2 ${expanded ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
        {visible.map((lead) => (
          <button key={lead._id} onClick={() => onOpen(lead)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors bg-form-input-bg ${overdue ? 'border-red-500/10 hover:border-red-500/30' : 'border-primary/10 hover:border-primary/30'}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-app-text truncate">{lead.fullName}</p>
              <p className="text-xs text-app-text-muted truncate">{lead.followUpType || lead.nextActionType || 'Follow-up'} · {lead.service}</p>
            </div>
            <span className={`text-xs font-mono shrink-0 ${overdue ? 'text-red-400' : 'text-primary'}`}>{fmtDateTime(lead.nextFollowUpDate)}</span>
          </button>
        ))}
      </div>
      {collapsible && !expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-2 w-full text-center text-xs text-app-text-muted hover:text-app-text cursor-pointer">
          + {leads.length - DUE_PREVIEW} more, oldest first
        </button>
      )}
    </div>
  );
}

/** Raw Leads, Working Leads and Follow-ups — three views over the same assigned-leads list. */
export default function LeadListsTab({ view }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data: leads = [], isLoading } = useEssLeads();
  const counts = leadListCounts(leads);
  const countOf = (list, match) => list.filter(match).length;
  const workingLeads = leads.filter(isWorkingLead);
  const followUpLeads = leads.filter(hasFollowUp);
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'All');
  const [interestFilter, setInterestFilter] = useState(() => searchParams.get('interest') || 'All');
  const [bucket, setBucket] = useState(() => searchParams.get('bucket') || 'All');
  const [followUpTypeFilter, setFollowUpTypeFilter] = useState('All');
  const [dateField, setDateField] = useState('lastCallAt');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [connected, setConnected] = useState('All');
  // '' keeps each view's own default order (e.g. follow-ups by due time).
  const [sort, setSort] = useState('');
  const [attrs, setAttrs] = useState(NO_ATTR_FILTERS);
  const setAttr = (key) => (e) => setAttrs((a) => ({ ...a, [key]: e.target.value }));

  // Back to page 1 whenever the tab, a filter or the search changes (state adjusted while rendering,
  // React's pattern for resetting state from props — an effect would paint the stale page first).
  const sig = JSON.stringify([view, statusFilter, interestFilter, bucket, followUpTypeFilter, dateField, dateFrom, dateTo, connected, sort, attrs, searchParams.toString()]);
  const [pager, setPager] = useState(() => ({ sig, page: 1, size: readPageSize() }));
  if (pager.sig !== sig) setPager((p) => ({ ...p, sig, page: 1 }));
  const page = pager.sig === sig ? pager.page : 1;
  const pageSize = pager.size;
  const goToPage = (next) => {
    setPager((p) => ({ ...p, sig, page: next }));
    document.getElementById('lead-list-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const changePageSize = (size) => {
    writePageSize(size);
    setPager({ sig, page: 1, size });
  };
  const pageOf = (list) => {
    const last = Math.max(1, Math.ceil(list.length / pageSize));
    const current = Math.min(page, last);
    return list.slice((current - 1) * pageSize, current * pageSize);
  };
  const dateFilters = { dateField, dateFrom, dateTo, connected, sort };
  const attrsActive = Object.keys(NO_ATTR_FILTERS).some((k) => attrs[k] !== NO_ATTR_FILTERS[k]);
  const datesActive = Boolean(dateFrom || dateTo || connected !== 'All' || sort) || attrsActive;
  // Forms come from the BD's own leads — no admin-only forms endpoint needed.
  const forms = [...new Map(leads.filter((l) => l.fbFormId).map((l) => [l.fbFormId, l.fbFormName || l.fbFormId])).entries()];
  const setPreset = (days) => {
    setDateFrom(toDateInput(new Date(Date.now() - days * 86400000)));
    setDateTo(toDateInput());
  };
  const clearDates = () => { setDateFrom(''); setDateTo(''); setConnected('All'); setSort(''); setAttrs(NO_ATTR_FILTERS); };

  const updateLead = (updated) => {
    queryClient.setQueryData(essKeys.leads, (list = []) => list.map((l) => (l._id === updated._id ? mergeLead(l, updated) : l)));
    queryClient.invalidateQueries({ queryKey: essKeys.today });
  };
  const clearTo = (tab) => navigate(`/employee/dashboard?tab=${tab}`);
  const openLead = (lead) => navigate(`/employee/leads/${lead._id}`);
  const cards = (list) => (
    <div className="grid grid-cols-1 gap-4">
      {pageOf(list).map((lead) => <LeadCard key={lead._id} lead={lead} navigate={navigate} onUpdated={updateLead} />)}
    </div>
  );

  // `shown` = rows in the list below; `base` = the whole list before filters (null when a drill-down looks past it)
  let shown = null;
  let base = null;
  let body;
  if (isLoading) {
    body = <Spinner />;
  } else if (view === 'raw') {
    const urgentOnly = searchParams.get('urgent') === '1';
    let list = applyAttrFilters(applyDateFilters(leads.filter((l) => l.isRaw), dateFilters), attrs);
    if (urgentOnly) list = list.filter(isCallPending).sort((a, b) => new Date(a.assignedAt) - new Date(b.assignedAt));
    shown = list.length;
    base = counts.raw;
    body = (
      <>
        {urgentOnly && <FilterNotice onClear={() => clearTo('raw-leads')}>Showing leads overdue for a first call, oldest first</FilterNotice>}
        {list.length ? cards(list) : <EmptyCard>{urgentOnly ? 'Nothing overdue for a first call right now.' : 'No raw leads right now — everything assigned to you has already been worked.'}</EmptyCard>}
      </>
    );
  } else if (view === 'dropped-hold') {
    const list = applyAttrFilters(applyDateFilters(leads, dateFilters), attrs)
      .filter((l) => isDroppedHoldLead(l) && (statusFilter === 'All' || l.status === statusFilter));
    shown = list.length;
    base = counts.droppedHold;
    body = list.length ? cards(list) : <EmptyCard>No dropped or on-hold leads.</EmptyCard>;
  } else if (view === 'working') {
    const scopeAll = searchParams.get('scope') === 'all';
    const noNext = searchParams.get('noNext') === '1';
    const payment = searchParams.get('payment');
    const thisMonth = searchParams.get('period') === 'thisMonth';
    // Dashboard drill-downs (Won this month, payment pending, a closed status)
    // look past the Working rule on purpose, and say so in the notice below
    const closedDrill = CLOSED_OR_HOLD.includes(statusFilter) || Boolean(payment) || thisMonth;
    const list = applyAttrFilters(applyDateFilters(leads, dateFilters), attrs).filter((l) =>
      (scopeAll || closedDrill || isWorkingLead(l)) &&
      (statusFilter === 'All' || l.status === statusFilter) &&
      (interestFilter === 'All' || l.interestLevel === interestFilter) &&
      (!noNext || needsNextAction(l)) &&
      (payment !== 'pending' || isPaymentPending(l)) &&
      (payment !== 'cleared' || !isPaymentPending(l)) &&
      (!thisMonth || isWonThisMonth(l)));
    shown = list.length;
    base = scopeAll || closedDrill ? null : counts.working;
    const overdue = list.filter((l) => followUpBucket(l) === 'overdue').sort((a, b) => new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate));
    const today = list.filter((l) => followUpBucket(l) === 'today').sort((a, b) => new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate));
    const notice = noNext ? 'Showing active leads with no next action scheduled'
      : payment === 'pending' ? 'Showing won deals with payment pending'
      : scopeAll ? 'Showing every lead assigned to you, including raw leads'
      : thisMonth ? 'Showing deals won this month'
      : closedDrill ? `Showing ${statusFilter} leads (not part of Working Leads)` : null;
    body = (
      <>
        {notice && <FilterNotice onClear={() => clearTo('working-leads')}>{notice}</FilterNotice>}
        {(overdue.length > 0 || today.length > 0) && (
          <div className="space-y-4">
            {overdue.length > 0 && <DueList leads={overdue} tone="overdue" onOpen={openLead} />}
            {today.length > 0 && <DueList leads={today} tone="today" onOpen={openLead} />}
          </div>
        )}
        {list.length ? cards(list) : <EmptyCard>Nothing here yet — start from Raw Leads.</EmptyCard>}
      </>
    );
  } else {
    const withFollowUp = followUpLeads;
    // Earliest due first (overdue on top); same due time → most recently updated first
    let list = (bucket === 'All' ? withFollowUp : withFollowUp.filter((l) => followUpBucket(l) === bucket.toLowerCase()))
      .filter((l) => followUpTypeFilter === 'All' || (followUpTypeFilter === 'Not set' ? !l.followUpType : l.followUpType === followUpTypeFilter))
      .sort((a, b) => (new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate)) || (new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));
    list = applyDateFilters(list, dateFilters);
    shown = list.length;
    base = counts.followups;
    body = list.length ? cards(list) : <EmptyCard>No {bucket !== 'All' ? `${bucket.toLowerCase()} ` : ''}follow-ups right now.</EmptyCard>;
  }

  return (
    <div className="space-y-6" id="lead-list-top">
      <TabHeader
        title={<>{VIEWS[view].title}{shown != null && <CountChip shown={shown} base={base} />}</>}
        subtitle={VIEWS[view].subtitle}
      >
        {view === 'working' && (
          <>
            <select value={interestFilter} onChange={(e) => setInterestFilter(e.target.value)} className={selectClass} aria-label="Interest level">
              <option value="All">All Interest Levels ({counts.working})</option>
              {INTEREST_LEVELS.map((l) => <option key={l} value={l}>{l} ({countOf(workingLeads, (x) => x.interestLevel === l)})</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass} aria-label="Status">
              <option value="All">All Statuses ({counts.working})</option>
              {[...WORKING_STATUSES, ...(WORKING_STATUSES.includes(statusFilter) || statusFilter === 'All' ? [] : [statusFilter])].map((s) => (
                <option key={s} value={s}>{WORKING_STATUSES.includes(s) ? `${s} (${countOf(workingLeads, (x) => x.status === s)})` : s}</option>
              ))}
            </select>
          </>
        )}
        {view === 'dropped-hold' && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass} aria-label="Status">
            <option value="All">Dropped &amp; Hold ({counts.droppedHold})</option>
            {DROPPED_OR_HOLD.map((s) => <option key={s} value={s}>{s} ({countOf(leads, (x) => x.status === s)})</option>)}
          </select>
        )}
        {view === 'followups' && (
          <select value={followUpTypeFilter} onChange={(e) => setFollowUpTypeFilter(e.target.value)} className={selectClass} aria-label="Follow-up type">
            <option value="All">All follow-up types ({counts.followups})</option>
            {FOLLOW_UP_TYPES.map((t) => <option key={t} value={t}>{t} ({countOf(followUpLeads, (x) => x.followUpType === t)})</option>)}
            <option value="Not set">Type not set ({countOf(followUpLeads, (x) => !x.followUpType)})</option>
          </select>
        )}
        {view === 'followups' && (
          <div className="flex bg-app-card border border-app-border p-1 rounded-lg">
            {[['All', counts.followups], ['Overdue', counts.overdue], ['Today', counts.today], ['Upcoming', counts.upcoming]].map(([tab, n]) => (
              <button key={tab} onClick={() => setBucket(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${bucket === tab ? 'bg-primary text-white' : 'text-app-text-muted hover:text-app-text'}`}>
                {tab} ({n})
              </button>
            ))}
          </div>
        )}
      </TabHeader>
      {view !== 'followups' && <LeadSearch />}
      <div className="bg-app-card border border-app-border rounded-xl p-3 flex flex-wrap items-center gap-2">
        <select value={dateField} onChange={(e) => setDateField(e.target.value)} className={selectClass} aria-label="Date type">
          {Object.entries(DATE_FIELDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectClass} style={{ colorScheme: 'dark' }} aria-label="From date" />
        <span className="text-xs text-app-text-muted">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectClass} style={{ colorScheme: 'dark' }} aria-label="To date" />
        <button onClick={() => setPreset(0)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-app-border text-app-text-muted hover:text-app-text hover:border-primary/50 cursor-pointer">Today</button>
        <button onClick={() => setPreset(6)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-app-border text-app-text-muted hover:text-app-text hover:border-primary/50 cursor-pointer">Last 7 days</button>
        <select value={connected} onChange={(e) => setConnected(e.target.value)} className={selectClass} aria-label="Call result">
          <option value="All">Any call result</option>
          <option value="Yes">Connected</option>
          <option value="No">Not connected</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass} aria-label="Sort">
          <option value="">Default order</option>
          {Object.entries(SORTS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {view !== 'followups' && (
          <>
            <select value={attrs.platform} onChange={setAttr('platform')} className={selectClass} aria-label="Platform">
              <option value="All">All Platforms</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={attrs.source} onChange={setAttr('source')} className={selectClass} aria-label="Source">
              <option value="All">All Sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {forms.length > 0 && (
              <select value={attrs.form} onChange={setAttr('form')} className={selectClass} aria-label="Form">
                <option value="All">All Forms</option>
                {forms.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            )}
            <select value={attrs.service} onChange={setAttr('service')} className={selectClass} aria-label="Service">
              <option value="All">All Services</option>
              {SERVICES_REQUIRED_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={attrs.priority} onChange={setAttr('priority')} className={selectClass} aria-label="Priority">
              <option value="All">All Priorities</option>
              {LEAD_PRIORITY_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={attrs.leadType} onChange={setAttr('leadType')} className={selectClass} aria-label="Lead type">
              <option value="All">All Lead Types</option>
              <option value="Sales">Sales</option>
              <option value="Hiring">Hiring</option>
            </select>
            <button onClick={() => setAttrs((a) => ({ ...a, breached: !a.breached }))}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${attrs.breached ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'border-app-border text-app-text-muted hover:border-red-500/30'}`}>
              Breached only
            </button>
          </>
        )}
        {datesActive && <button onClick={clearDates} className="text-xs text-app-text-muted underline hover:text-primary cursor-pointer">Clear</button>}
      </div>
      {body}
      {shown != null && (
        <Pagination total={shown} page={page} pageSize={pageSize} onPage={goToPage} onPageSize={changePageSize}
          label={view === 'followups' ? 'follow-ups' : 'leads'} />
      )}
    </div>
  );
}
