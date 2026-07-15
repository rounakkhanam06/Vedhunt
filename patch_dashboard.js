const fs = require('fs');
const file = 'client/src/employee/pages/EmployeeDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state variables
content = content.replace(
  "  const [isTicketsLoading, setIsTicketsLoading] = useState(false);",
  "  const [isTicketsLoading, setIsTicketsLoading] = useState(false);\n  const [expandedTicketId, setExpandedTicketId] = useState(null);\n  const [newMessage, setNewMessage] = useState('');\n  const [updatingTicketId, setUpdatingTicketId] = useState(null);"
);

// 2. Add handler functions after fetchTickets
const fetchTicketsStr = `  const fetchTickets = async () => {
    try {
      setIsTicketsLoading(true);
      const res = await employeeApi.get('/employee-portal/ess/tickets');
      if (res.data.success) {
        setTickets(res.data.tickets || []);
      }
    } catch (err) {
      toast.error('Failed to load your assigned tickets');
    } finally {
      setIsTicketsLoading(false);
    }
  };`;

const newHandlers = `
  const handleUpdateTicketStatus = async (ticketId, status) => {
    try {
      setUpdatingTicketId(ticketId);
      const res = await employeeApi.put(\`/employee-portal/ess/tickets/\${ticketId}/status\`, { status });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchTickets();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleSendTicketMessage = async (e, ticketId) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      setUpdatingTicketId(ticketId);
      const res = await employeeApi.post(\`/employee-portal/ess/tickets/\${ticketId}/messages\`, { text: newMessage });
      if (res.data.success) {
        toast.success(res.data.message);
        setNewMessage('');
        fetchTickets();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message');
    } finally {
      setUpdatingTicketId(null);
    }
  };
`;
content = content.replace(fetchTicketsStr, fetchTicketsStr + newHandlers);

// 3. Replace the tickets mapping block in UI
const oldTicketsBlock = `{tickets.map(ticket => (
                  <div key={ticket._id} className="bg-[#141416] border border-white/5 rounded-xl p-6 hover:border-orange-500/20 transition-all">
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-orange-500">#{ticket.ticketId}</span>
                          <span className="text-white font-bold">{ticket.subject}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Client: <span className="text-gray-400">{ticket.client_ref?.businessName || 'N/A'}</span> ({ticket.client_ref?.contactName || 'N/A'})
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span className={\`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded border \${
                          ticket.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          ticket.priority === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          ticket.priority === 'Medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }\`}>
                          {ticket.priority}
                        </span>
                        <span className={\`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded border \${
                          ticket.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          ticket.status === 'in-progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          ticket.status === 'closed' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                          'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }\`}>
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 bg-black/20 p-4 rounded-lg whitespace-pre-wrap">{ticket.description}</p>
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-4 border-t border-white/5 pt-4">
                      <span>Category: <span className="text-gray-400 font-medium">{ticket.category}</span></span>
                      <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}`;

const newTicketsBlock = `{tickets.map(ticket => {
                  const isExpanded = expandedTicketId === ticket._id;
                  return (
                  <div key={ticket._id} className="bg-[#141416] border border-white/5 rounded-xl p-6 hover:border-orange-500/20 transition-all overflow-hidden">
                    <div className="flex flex-wrap justify-between items-start gap-4 mb-4 cursor-pointer" onClick={() => setExpandedTicketId(isExpanded ? null : ticket._id)}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-orange-500">#{ticket.ticketId}</span>
                          <span className="text-white font-bold">{ticket.subject}</span>
                          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Client: <span className="text-gray-400">{ticket.client_ref?.businessName || 'N/A'}</span> ({ticket.client_ref?.contactName || 'N/A'})
                        </p>
                      </div>
                      <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                        <span className={\`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded border \${
                          ticket.priority === 'Critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                          ticket.priority === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          ticket.priority === 'Medium' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }\`}>
                          {ticket.priority}
                        </span>
                        
                        <select 
                          value={ticket.status}
                          onChange={(e) => handleUpdateTicketStatus(ticket._id, e.target.value)}
                          disabled={updatingTicketId === ticket._id}
                          className={\`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded border cursor-pointer outline-none appearance-none \${
                            ticket.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            ticket.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            ticket.status === 'Closed' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }\`}
                        >
                          <option value="Open" className="bg-black text-white">OPEN</option>
                          <option value="In Progress" className="bg-black text-white">IN PROGRESS</option>
                          <option value="Pending Client" className="bg-black text-white">PENDING CLIENT</option>
                          <option value="Resolved" className="bg-black text-white">RESOLVED</option>
                          <option value="Closed" className="bg-black text-white">CLOSED</option>
                        </select>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-300 bg-black/20 p-4 rounded-lg whitespace-pre-wrap">{ticket.description}</p>
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                          {ticket.messages && ticket.messages.length > 0 ? (
                            ticket.messages.map((msg, idx) => (
                              <div key={idx} className={\`p-3 rounded-lg text-sm \${msg.senderModel === 'Employee' ? 'bg-orange-500/10 border border-orange-500/20 ml-8' : 'bg-white/5 border border-white/10 mr-8'}\`}>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="font-bold text-xs \${msg.senderModel === 'Employee' ? 'text-orange-400' : 'text-gray-300'}\">{msg.senderName} ({msg.senderModel})</span>
                                  <span className="text-[10px] text-gray-500">{new Date(msg.createdAt).toLocaleString()}</span>
                                </div>
                                <p className="text-gray-200 whitespace-pre-wrap">{msg.text}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-xs text-gray-500 py-2">No messages yet.</p>
                          )}
                        </div>
                        
                        <form onSubmit={(e) => handleSendTicketMessage(e, ticket._id)} className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                            disabled={updatingTicketId === ticket._id}
                          />
                          <button
                            type="submit"
                            disabled={updatingTicketId === ticket._id || !newMessage.trim()}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                          >
                            Send
                          </button>
                        </form>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-4 border-t border-white/5 pt-4">
                      <span>Category: <span className="text-gray-400 font-medium">{ticket.category}</span></span>
                      <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
                })}`;

content = content.replace(oldTicketsBlock, newTicketsBlock);

fs.writeFileSync(file, content);
console.log('EmployeeDashboard patched for ticket messaging');
