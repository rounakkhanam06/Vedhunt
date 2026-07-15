const fs = require('fs');
const file = 'client/src/client/tabs/SupportTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add states
content = content.replace(
  "const [expandedId, setExpandedId] = useState(null);",
  "const [expandedId, setExpandedId] = useState(null);\n  const [newMessage, setNewMessage] = useState('');\n  const [sendingMsg, setSendingMsg] = useState(false);"
);

// 2. Add message handler
const handlerStr = `
  const handleSendMessage = async (e, ticketId) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSendingMsg(true);
    try {
      const res = await clientService.addTicketMessage(ticketId, newMessage);
      if (res.success) {
        setNewMessage('');
        toast.success('Message sent');
        fetchTickets(pagination.page); // Refresh list
      }
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };
`;
content = content.replace(
  "useEffect(() => { fetchTickets(1); }, [fetchTickets]);",
  "useEffect(() => { fetchTickets(1); }, [fetchTickets]);\n" + handlerStr
);

// 3. Replace the `isOpen &&` block
const oldBlock = `{isOpen && (
                      <div className="px-5 pb-5 border-t border-border-default/40 pt-4 bg-white/[0.01]">
                        <p className="text-[#D1D5DB] text-xs font-medium uppercase tracking-wider mb-2">Description</p>
                        <p className="text-[#E5E7EB] text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                        {ticket.resolvedAt && (
                          <p className="text-[#22C55E] text-xs mt-3">
                            ✓ Resolved on {new Date(ticket.resolvedAt).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>
                    )}`;

const newBlock = `{isOpen && (
                      <div className="px-5 pb-5 border-t border-border-default/40 pt-4 bg-white/[0.01]">
                        <p className="text-[#D1D5DB] text-xs font-medium uppercase tracking-wider mb-2">Description</p>
                        <p className="text-[#E5E7EB] text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
                        {ticket.resolvedAt && (
                          <p className="text-[#22C55E] text-xs mt-3">
                            ✓ Resolved on {new Date(ticket.resolvedAt).toLocaleDateString('en-IN')}
                          </p>
                        )}
                        
                        <div className="mt-6 border-t border-white/5 pt-4">
                          <p className="text-[#D1D5DB] text-xs font-medium uppercase tracking-wider mb-3">Messages</p>
                          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-4">
                            {ticket.messages && ticket.messages.length > 0 ? (
                              ticket.messages.map((msg, idx) => (
                                <div key={idx} className={\`p-3 rounded-xl text-sm \${
                                  msg.senderModel === 'Client' ? 'bg-primary/10 border border-primary/20 ml-8' : 
                                  'bg-white/5 border border-white/10 mr-8'
                                }\`}>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className={\`font-bold text-xs \${msg.senderModel === 'Client' ? 'text-primary' : 'text-[#E5E7EB]'}\`}>
                                      {msg.senderName} {msg.senderModel !== 'Client' && \`(\${msg.senderModel})\`}
                                    </span>
                                    <span className="text-[10px] text-[#9CA3AF]">{new Date(msg.createdAt).toLocaleString()}</span>
                                  </div>
                                  <p className="text-[#D1D5DB] whitespace-pre-wrap">{msg.text}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-center text-xs text-[#9CA3AF] py-2">No messages yet.</p>
                            )}
                          </div>
                          
                          <form onSubmit={(e) => handleSendMessage(e, ticket._id)} className="flex gap-2">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              placeholder="Reply to this ticket..."
                              className="flex-1 bg-bg-surface/50 border border-border-default rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF5A1F]/60 transition-all"
                              disabled={sendingMsg}
                            />
                            <button
                              type="submit"
                              disabled={sendingMsg || !newMessage.trim()}
                              className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              <Send size={14} /> Send
                            </button>
                          </form>
                        </div>
                      </div>
                    )}`;

content = content.replace(oldBlock, newBlock);

fs.writeFileSync(file, content);
console.log('SupportTab patched for ticket messaging');
