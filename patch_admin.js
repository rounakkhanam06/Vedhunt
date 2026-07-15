const fs = require('fs');
const file = 'client/src/admin/pages/SupportDeskManager.jsx';
let content = fs.readFileSync(file, 'utf8');

// Add state for messaging
content = content.replace(
  "const [saving, setSaving] = useState(false);",
  "const [saving, setSaving] = useState(false);\n  const [newMessage, setNewMessage] = useState('');\n  const [sendingMsg, setSendingMsg] = useState(false);"
);

// Add message handler
const msgHandler = `
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !editTarget) return;
    setSendingMsg(true);
    try {
      const res = await api.post(\`/admin/tickets/\${editTarget._id}/messages\`, { text: newMessage });
      if (res.data.success) {
        setNewMessage('');
        toast.success('Message sent');
        setEditTarget(res.data.data);
        fetchTickets(); // Refresh list to get updated messages
      }
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };
`;

content = content.replace("const handleSubmit = async (e) => {", msgHandler + "\n  const handleSubmit = async (e) => {");

// Add message UI inside modal (before the submit button block)
const messagesUI = `
              {editTarget && (
                <div className="md:col-span-2 border border-outline-variant rounded-xl overflow-hidden mt-4">
                  <div className="bg-admin-bg px-4 py-2 border-b border-outline-variant">
                    <h4 className="text-sm font-semibold text-on-surface">Message Thread</h4>
                  </div>
                  <div className="p-4 space-y-4 bg-surface max-h-[300px] overflow-y-auto custom-scrollbar">
                    {editTarget.messages && editTarget.messages.length > 0 ? (
                      editTarget.messages.map((msg, idx) => (
                        <div key={idx} className={\`p-3 rounded-lg text-sm \${
                          msg.senderModel === 'Admin' ? 'bg-secondary/10 border border-secondary/20 ml-8' : 
                          msg.senderModel === 'Client' ? 'bg-primary/10 border border-primary/20 mr-8' : 
                          'bg-orange-500/10 border border-orange-500/20 mr-8'
                        }\`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className={\`font-bold text-xs \${
                              msg.senderModel === 'Admin' ? 'text-secondary' : 
                              msg.senderModel === 'Client' ? 'text-primary' : 
                              'text-orange-500'
                            }\`}>{msg.senderName} ({msg.senderModel})</span>
                            <span className="text-[10px] text-on-surface-variant">{new Date(msg.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-on-surface whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-xs text-on-surface-variant py-2">No messages yet.</p>
                    )}
                  </div>
                  <div className="p-3 bg-admin-bg border-t border-outline-variant flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a reply to the client/employee..."
                      className="flex-1 px-3 py-2 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-secondary text-on-surface"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={sendingMsg || !newMessage.trim()}
                      className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
`;

content = content.replace(
  `<div className="flex gap-3 pt-4 border-t border-outline-variant">`,
  messagesUI + `\n              <div className="flex gap-3 pt-4 border-t border-outline-variant">`
);

fs.writeFileSync(file, content);
console.log('SupportDeskManager patched for ticket messaging');
