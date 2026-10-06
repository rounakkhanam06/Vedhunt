import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { Spinner, EmptyCard, TabHeader } from '../components/PortalUI';
import { essGet, essPut, essPost, essKeys, apiError, useAccess } from '../lib/ess';
import { attachmentName } from '../../utils/attachments';

const STATUSES = ['Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed'];

export default function TicketsTab() {
  const { authEmployee } = useAccess();
  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: essKeys.tickets,
    queryFn: () => essGet('/tickets').then((d) => d.tickets || []),
  });
  const [ticketFilter, setTicketFilter] = useState('All');
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [updatingTicketId, setUpdatingTicketId] = useState(null);

  const handleUpdateTicketStatus = async (ticketId, status) => {
    try {
      setUpdatingTicketId(ticketId);
      const res = await essPut(`/tickets/${ticketId}/status`, { status });
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(apiError(err, 'Failed to update status'));
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleSendTicketMessage = async (e, ticketId) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      setUpdatingTicketId(ticketId);
      const res = await essPost(`/tickets/${ticketId}/messages`, { text: newMessage.trim() });
      toast.success(res.message);
      setNewMessage('');
      refetch();
    } catch (err) {
      toast.error(apiError(err, 'Failed to send message'));
    } finally {
      setUpdatingTicketId(null);
    }
  };

  return (
    <div className="space-y-6">
      <TabHeader title="Assigned Tickets" subtitle="Manage and resolve tickets assigned to you">
        <select
          value={ticketFilter}
          onChange={(e) => setTicketFilter(e.target.value)}
          className="bg-app-card border border-app-border rounded-lg px-3 py-1.5 text-sm text-app-text focus:outline-none focus:border-primary/50 cursor-pointer"
        >
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </TabHeader>

      {isLoading ? <Spinner /> : tickets.length === 0 ? (
        <EmptyCard>No tickets assigned to you currently.</EmptyCard>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tickets.filter((t) => ticketFilter === 'All' || t.status === ticketFilter).map((ticket) => {
            const isExpanded = expandedTicketId === ticket._id;
            return (
              <div key={ticket._id} className="bg-app-card border border-app-border rounded-xl p-6 hover:border-primary/20 transition-all overflow-hidden">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4 cursor-pointer" onClick={() => { setExpandedTicketId(isExpanded ? null : ticket._id); setNewMessage(''); }}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-primary">#{ticket.ticketId}</span>
                      <span className="text-app-text font-bold">{ticket.subject}</span>
                      {isExpanded ? <ChevronUp size={16} className="text-app-text-muted" /> : <ChevronDown size={16} className="text-app-text-muted" />}
                    </div>
                    <p className="text-xs text-app-text-muted mt-1">
                      Client: <span className="text-app-text-muted">{ticket.client_ref?.businessName || 'N/A'}</span> ({ticket.client_ref?.contactName || 'N/A'})
                    </p>
                  </div>
                  <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                    <span className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded border ${
                      ticket.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      ticket.priority === 'High' ? 'bg-primary/10 text-primary border-primary/20' :
                      ticket.priority === 'Medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-gray-500/10 text-app-text-muted border-gray-500/20'
                    }`}>
                      {ticket.priority}
                    </span>
                    <select
                      value={ticket.status}
                      onChange={(e) => handleUpdateTicketStatus(ticket._id, e.target.value)}
                      disabled={updatingTicketId === ticket._id}
                      className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded border cursor-pointer outline-none appearance-none ${
                        ticket.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        ticket.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        ticket.status === 'Closed' ? 'bg-gray-500/10 text-app-text-muted border-gray-500/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s} className="bg-app-card text-app-text">{s.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>

                <p className="text-sm text-app-text bg-form-input-bg p-4 rounded-lg whitespace-pre-wrap">{ticket.description}</p>
                {ticket.attachments?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ticket.attachments.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                        className="max-w-[240px] truncate px-2.5 py-1.5 rounded-lg bg-form-input-bg border border-app-border text-xs text-primary hover:underline">
                        📎 {attachmentName(url)}
                      </a>
                    ))}
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-app-border space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-app-text-muted">Conversation</h4>
                    {(ticket.messages || []).length === 0 ? (
                      <p className="text-xs text-app-text-muted">No messages yet. Reply below to update the client.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {[...ticket.messages]
                          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                          .map((msg, idx) => {
                            const fromClient = msg.senderModel === 'Client';
                            const mine = !fromClient && String(msg.senderId) === String(authEmployee?._id);
                            return (
                              <div key={msg._id || idx} className={`flex ${fromClient ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 border ${fromClient ? 'bg-form-input-bg border-app-border' : 'bg-primary/10 border-primary/20'}`}>
                                  <p className={`text-[11px] font-semibold mb-0.5 ${fromClient ? 'text-app-text' : 'text-primary'}`}>
                                    {fromClient ? `${msg.senderName || 'Client'} (Client)` : mine ? 'You' : `${msg.senderName || 'Vedhunt'} (${msg.senderModel === 'Admin' ? 'Admin' : 'Team'})`}
                                    {msg.createdAt && (
                                      <span className="text-app-text-muted font-normal ml-2">
                                        {new Date(msg.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-app-text whitespace-pre-wrap break-words">{msg.text}</p>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {ticket.status === 'Closed' ? (
                      <p className="text-xs text-app-text-muted">This ticket is closed. Change its status to reopen it before replying.</p>
                    ) : (
                      <form onSubmit={(e) => handleSendTicketMessage(e, ticket._id)} className="flex gap-2 items-end">
                        <textarea
                          rows={2}
                          maxLength={5000}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Reply to the client…"
                          aria-label={`Reply to ticket ${ticket.ticketId}`}
                          className="flex-1 bg-form-input-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary/50 resize-none"
                        />
                        <button
                          type="submit"
                          disabled={updatingTicketId === ticket._id || !newMessage.trim()}
                          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {updatingTicketId === ticket._id ? 'Sending…' : 'Send'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center text-xs text-app-text-muted mt-4 border-t border-app-border pt-4">
                  <span>Category: <span className="text-app-text-muted font-medium">{ticket.category}</span></span>
                  <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
