import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock } from 'lucide-react';
import LeadCard from '../components/LeadCard';
import LeadSearch from '../components/LeadSearch';
import { Spinner, EmptyCard, TabHeader } from '../components/PortalUI';
import { useEssLeads, essKeys } from '../lib/ess';
import { fmtDateTime, toDateInput } from '../lib/datetime';
import { followUpBucket, isCallPending, needsNextAction, isPaymentPending, isWonThisMonth, mergeLead } from '../lib/leads';
import { INTEREST_LEVELS } from '../../shared/leadConstants';

const WORKING_STATUSES = ['Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Hold', 'Won', 'Lost', 'Dropped'];
const selectClass = 'bg-app-card border border-app-border rounded-lg px-3 py-1.5 text-sm text-app-text focus:outline-none focus:border-primary/50 cursor-pointer';

const VIEWS = {
  raw: { title: 'Raw Leads', subtitle: 'Assigned to you, not yet worked — open one to log your first call' },
  working: { title: 'Working Leads', subtitle: "Leads you've started calling or moved forward — ownership changes only happen from Admin" },
  followups: { title: 'Follow-ups', subtitle: 'Every scheduled next action on your leads, with its type and exact due time' },
};

// Which lead date the From/To range applies to, and the list orderings.
const DATE_FIELDS = { createdAt: 'Received', assignedAt: 'Assigned', lastCallAt: 'Last call' };
const SORTS = {
  received: { label: 'Newest received', field: 'createdAt' },
  assigned: { label: 'Recently assigned', field: 'assignedAt' },
  called: { label: 'Recently called', field: 'lastCallAt' },
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

function FilterNotice({ children, onClear }) {
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs font-medium text-amber-500 flex items-center justify-between gap-3">
      <span>{children}</span>
      <button onClick={onClear} className="underline hover:opacity-80 shrink-0 cursor-pointer">Show all</button>
    </div>
  );
}

function DueList({ leads, tone, onOpen }) {
  const overdue = tone === 'overdue';
  return (
    <div className={`${overdue ? 'bg-red-500/5 border-red-500/20' : 'bg-primary/5 border-primary/20'} border rounded-xl p-4`}>
      <h3 className={`text-sm font-bold flex items-center gap-2 mb-3 ${overdue ? 'text-red-400' : 'text-primary'}`}>
        {overdue ? <AlertTriangle size={16} /> : <Clock size={16} />} {overdue ? 'Overdue Follow-ups' : 'Follow-ups Today'} ({leads.length})
      </h3>
      <div className="space-y-2">
        {leads.map((lead) => (
          <button key={lead._id} onClick={() => onOpen(lead)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors bg-form-input-bg ${overdue ? 'border-red-500/10 hover:border-red-500/30' : 'border-primary/10 hover:border-primary/30'}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-app-text truncate">{lead.fullName}</p>
              <p className="text-xs text-app-text-muted truncate">{lead.nextActionType || 'Follow-up'} · {lead.service}</p>
            </div>
            <span className={`text-xs font-mono shrink-0 ${overdue ? 'text-red-400' : 'text-primary'}`}>{fmtDateTime(lead.nextFollowUpDate)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Raw Leads, Working Leads and Follow-ups — three views over the same assigned-leads list. */
export default function LeadListsTab({ view }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data: leads = [], isLoading } = useEssLeads();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'All');
  const [interestFilter, setInterestFilter] = useState(() => searchParams.get('interest') || 'All');
  const [bucket, setBucket] = useState(() => searchParams.get('bucket') || 'All');
  const [dateField, setDateField] = useState('lastCallAt');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [connected, setConnected] = useState('All');
  // '' keeps each view's own default order (e.g. follow-ups by due time).
  const [sort, setSort] = useState('');
  const dateFilters = { dateField, dateFrom, dateTo, connected, sort };
  const datesActive = Boolean(dateFrom || dateTo || connected !== 'All' || sort);
  const setPreset = (days) => {
    setDateFrom(toDateInput(new Date(Date.now() - days * 86400000)));
    setDateTo(toDateInput());
  };
  const clearDates = () => { setDateFrom(''); setDateTo(''); setConnected('All'); setSort(''); };

  const updateLead = (updated) => {
    queryClient.setQueryData(essKeys.leads, (list = []) => list.map((l) => (l._id === updated._id ? mergeLead(l, updated) : l)));
    queryClient.invalidateQueries({ queryKey: essKeys.today });
  };
  const clearTo = (tab) => navigate(`/employee/dashboard?tab=${tab}`);
  const openLead = (lead) => navigate(`/employee/leads/${lead._id}`);
  const cards = (list) => (
    <div className="grid grid-cols-1 gap-4">
      {list.map((lead) => <LeadCard key={lead._id} lead={lead} navigate={navigate} onUpdated={updateLead} />)}
    </div>
  );

  let body;
  if (isLoading) {
    body = <Spinner />;
  } else if (view === 'raw') {
    const urgentOnly = searchParams.get('urgent') === '1';
    let list = applyDateFilters(leads.filter((l) => l.status === 'New'), dateFilters);
    if (urgentOnly) list = list.filter(isCallPending).sort((a, b) => new Date(a.assignedAt) - new Date(b.assignedAt));
    body = (
      <>
        {urgentOnly && <FilterNotice onClear={() => clearTo('raw-leads')}>Showing leads overdue for a first call, oldest first</FilterNotice>}
        {list.length ? cards(list) : <EmptyCard>{urgentOnly ? 'Nothing overdue for a first call right now.' : 'No raw leads right now — everything assigned to you has already been worked.'}</EmptyCard>}
      </>
    );
  } else if (view === 'working') {
    const scopeAll = searchParams.get('scope') === 'all';
    const noNext = searchParams.get('noNext') === '1';
    const payment = searchParams.get('payment');
    const thisMonth = searchParams.get('period') === 'thisMonth';
    const list = applyDateFilters(leads, dateFilters).filter((l) =>
      (scopeAll || l.status !== 'New') &&
      (statusFilter === 'All' || l.status === statusFilter) &&
      (interestFilter === 'All' || l.interestLevel === interestFilter) &&
      (!noNext || needsNextAction(l)) &&
      (payment !== 'pending' || isPaymentPending(l)) &&
      (payment !== 'cleared' || !isPaymentPending(l)) &&
      (!thisMonth || isWonThisMonth(l)));
    const overdue = list.filter((l) => followUpBucket(l) === 'overdue').sort((a, b) => new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate));
    const today = list.filter((l) => followUpBucket(l) === 'today').sort((a, b) => new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate));
    const notice = noNext ? 'Showing active leads with no next action scheduled'
      : payment === 'pending' ? 'Showing won deals with payment pending'
      : scopeAll ? 'Showing every lead assigned to you, including raw leads'
      : thisMonth ? 'Showing deals won this month' : null;
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
    const withFollowUp = leads.filter((l) => followUpBucket(l) !== null);
    let list = (bucket === 'All' ? withFollowUp : withFollowUp.filter((l) => followUpBucket(l) === bucket.toLowerCase()))
      .sort((a, b) => new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate));
    list = applyDateFilters(list, dateFilters);
    body = list.length ? cards(list) : <EmptyCard>No {bucket !== 'All' ? `${bucket.toLowerCase()} ` : ''}follow-ups right now.</EmptyCard>;
  }

  return (
    <div className="space-y-6">
      <TabHeader title={VIEWS[view].title} subtitle={VIEWS[view].subtitle}>
        {view === 'working' && (
          <>
            <select value={interestFilter} onChange={(e) => setInterestFilter(e.target.value)} className={selectClass} aria-label="Interest level">
              <option value="All">All Interest Levels</option>
              {INTEREST_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass} aria-label="Status">
              <option value="All">All Statuses</option>
              {WORKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}
        {view === 'followups' && (
          <div className="flex bg-app-card border border-app-border p-1 rounded-lg">
            {['All', 'Overdue', 'Today', 'Upcoming'].map((tab) => (
              <button key={tab} onClick={() => setBucket(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${bucket === tab ? 'bg-primary text-white' : 'text-app-text-muted hover:text-app-text'}`}>
                {tab}
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
        {datesActive && <button onClick={clearDates} className="text-xs text-app-text-muted underline hover:text-primary cursor-pointer">Clear</button>}
      </div>
      {body}
    </div>
  );
}
