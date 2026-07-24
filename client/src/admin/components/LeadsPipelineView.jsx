import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, Clock, Globe, Briefcase, CheckCircle2, Play, Square, AlertCircle, X, Check, XCircle } from 'lucide-react';

const COLUMNS = [
  { id: 'Received', title: 'Received', statuses: ['New'], color: 'border-blue-500/30 bg-blue-500/5', headerColor: 'text-blue-500' },
  { id: 'Calling', title: 'Calling', statuses: ['Contacted'], color: 'border-amber-500/30 bg-amber-500/5', headerColor: 'text-amber-500' },
  { id: 'Proposal', title: 'Proposal', statuses: ['Qualified', 'Proposal Sent'], color: 'border-purple-500/30 bg-purple-500/5', headerColor: 'text-purple-500' },
  { id: 'Negotiation', title: 'Negotiation', statuses: ['Negotiation'], color: 'border-pink-500/30 bg-pink-500/5', headerColor: 'text-pink-500' },
  { id: 'WonLost', title: 'Won / Lost', statuses: ['Won', 'Lost', 'Dropped'], color: 'border-emerald-500/30 bg-emerald-500/5', headerColor: 'text-emerald-500' }
];

export default function LeadsPipelineView({ 
  leads, 
  isSuperAdmin, 
  handleFieldChange, 
  startCall, 
  endCall, 
  setSelectedLead 
}) {
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  
  // Won/Lost Resolution Modal State
  const [resolutionModal, setResolutionModal] = useState({
    isOpen: false,
    lead: null
  });

  const handleDragStart = (e, leadId) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.setData('leadId', leadId);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a custom drag image to make it look nicer (optional)
    const el = e.target.cloneNode(true);
    el.style.opacity = '0.5';
    el.style.position = 'absolute';
    el.style.top = '-1000px';
    document.body.appendChild(el);
    e.dataTransfer.setDragImage(el, 20, 20);
    setTimeout(() => document.body.removeChild(el), 0);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('leadId');
    const column = COLUMNS.find(c => c.id === columnId);
    
    if (!leadId || !column) return;
    
    const lead = leads.find(l => l._id === leadId);
    if (!lead) return;

    // If dropped in the same column grouping it belongs to, do nothing
    if (column.statuses.includes(lead.status)) {
      setDraggedLeadId(null);
      return;
    }

    if (columnId === 'WonLost') {
      // Trigger the resolution modal instead of immediately changing status
      setResolutionModal({ isOpen: true, lead });
    } else {
      // Default to the first status in the column mapping
      const newStatus = column.statuses[0];
      handleFieldChange(leadId, 'status', newStatus);
    }
    
    setDraggedLeadId(null);
  };

  const handleResolutionSubmit = async (outcome, dealValue, notConvertedReason) => {
    const lead = resolutionModal.lead;
    if (!lead) return;

    // Wait for the status change to ensure sequential updates if necessary, 
    // but our handleFieldChange wraps standard api.put so it's asynchronous.
    if (outcome === 'Won') {
      await handleFieldChange(lead._id, 'status', 'Won');
      if (dealValue) {
         await handleFieldChange(lead._id, 'dealValue', Number(dealValue));
      }
    } else {
      await handleFieldChange(lead._id, 'status', 'Lost');
      if (notConvertedReason) {
         await handleFieldChange(lead._id, 'notConvertedReason', notConvertedReason);
      }
    }
    
    setResolutionModal({ isOpen: false, lead: null });
  };

  // Group leads by column
  const groupedLeads = COLUMNS.reduce((acc, col) => {
    acc[col.id] = leads.filter(l => col.statuses.includes(l.status));
    return acc;
  }, {});

  const getFollowUpColor = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-red-500 bg-red-500/10 border-red-500/20'; // Overdue
    if (diffDays === 0) return 'text-orange-500 bg-orange-500/10 border-orange-500/20'; // Today
    if (diffDays <= 2) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'; // Next 48h
    return 'text-green-500 bg-green-500/10 border-green-500/20'; // Future
  };

  const calculateTotalValue = (columnLeads) => {
    return columnLeads.reduce((sum, lead) => sum + (Number(lead.dealValue) || 0), 0);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 h-[calc(100vh-220px)] min-h-[600px] custom-scrollbar">
      {COLUMNS.map(col => {
        const columnLeads = groupedLeads[col.id] || [];
        const totalValue = calculateTotalValue(columnLeads);
        
        return (
          <div 
            key={col.id} 
            className={`flex-shrink-0 w-[320px] flex flex-col rounded-xl border ${col.color} overflow-hidden`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-app-border bg-app-card/50 backdrop-blur-sm sticky top-0 z-10 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <h3 className={`font-bold text-sm uppercase tracking-wider ${col.headerColor}`}>
                  {col.title}
                </h3>
                <span className="bg-app-bg px-2 py-0.5 rounded-full text-xs font-bold text-app-text-muted border border-app-border">
                  {columnLeads.length}
                </span>
              </div>
              {totalValue > 0 && (
                <div className="text-xs font-medium text-app-text-muted mt-1">
                  Total: ₹{totalValue.toLocaleString()}
                </div>
              )}
            </div>

            {/* Column Cards */}
            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
              {columnLeads.length === 0 ? (
                <div className="h-full flex items-center justify-center text-app-text-muted text-xs p-4 text-center border-2 border-dashed border-app-border rounded-lg">
                  Drop leads here
                </div>
              ) : (
                <AnimatePresence>
                  {columnLeads.map(lead => (
                    <motion.div
                      key={lead._id}
                      layoutId={lead._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead._id)}
                      className={`bg-app-card border rounded-xl p-4 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all ${
                        draggedLeadId === lead._id ? 'opacity-50 border-primary' : 'border-app-border hover:border-primary/50'
                      }`}
                    >
                      {/* Card Header: ID & Platform */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-primary font-bold">{lead.leadId || 'N/A'}</span>
                          <span className="text-[10px] text-app-text-muted">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            lead.platform === 'Facebook' ? 'bg-[#1877F2]/10 text-[#1877F2]' :
                            lead.platform === 'Google Ads' ? 'bg-[#0F9D58]/10 text-[#0F9D58]' :
                            lead.platform === 'Instagram' ? 'bg-[#E1306C]/10 text-[#E1306C]' :
                            'bg-primary/10 text-primary'
                          }`}>
                            {lead.platform || 'Website'}
                        </div>
                      </div>

                      {/* Name & Contact */}
                      <div className="mb-3">
                        <h4 
                          className="font-bold text-sm text-app-text cursor-pointer hover:text-primary transition-colors truncate"
                          onClick={() => setSelectedLead(lead)}
                        >
                          {lead.fullName}
                        </h4>
                        {lead.businessName && (
                          <div className="text-xs text-app-text-muted truncate mt-0.5 flex items-center gap-1">
                            <Briefcase size={12} /> {lead.businessName}
                          </div>
                        )}
                        <div className="text-xs text-app-text-muted truncate mt-1 flex items-center gap-1">
                           <Phone size={12} /> {lead.phone}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                         <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-app-bg border border-app-border text-app-text-muted">
                            {lead.service}
                         </span>
                         {lead.status === 'Won' && (
                           <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-500/10 border border-green-500/20 text-green-500">
                              Won
                           </span>
                         )}
                         {(lead.status === 'Lost' || lead.status === 'Dropped') && (
                           <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 border border-red-500/20 text-red-500">
                              {lead.status}
                           </span>
                         )}
                      </div>

                      {/* Next Follow Up (If present) */}
                      {lead.nextFollowUpDate && (
                        <div className={`mb-3 flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded border ${getFollowUpColor(lead.nextFollowUpDate)}`}>
                          <Clock size={10} />
                          Follow-up: {new Date(lead.nextFollowUpDate).toLocaleDateString()}
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-app-border">
                        <div className="flex items-center gap-2">
                           <button onClick={() => startCall(lead._id)} className="p-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded transition-colors" title="Start Call">
                             <Play size={12} />
                           </button>
                           {lead.callStartTime && (
                             <button onClick={() => endCall(lead)} className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors" title="End Call">
                               <Square size={12} />
                             </button>
                           )}
                        </div>
                        <div className="text-[10px] text-app-text-muted font-medium">
                           {lead.bd ? `BD: ${lead.bd}` : 'Unassigned'}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        );
      })}

      {/* Won/Lost Resolution Modal */}
      {resolutionModal.isOpen && (
        <ResolutionModal 
          lead={resolutionModal.lead} 
          onClose={() => setResolutionModal({ isOpen: false, lead: null })}
          onSubmit={handleResolutionSubmit}
        />
      )}
    </div>
  );
}

function ResolutionModal({ lead, onClose, onSubmit }) {
  const [outcome, setOutcome] = useState('Won'); // 'Won' or 'Lost'
  const [dealValue, setDealValue] = useState(lead?.dealValue || '');
  const [notConvertedReason, setNotConvertedReason] = useState(lead?.notConvertedReason || '');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
       <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-app-card border border-app-border rounded-xl shadow-xl w-full max-w-md overflow-hidden"
       >
          <div className="p-4 border-b border-app-border flex justify-between items-center bg-app-card">
            <h2 className="text-lg font-bold text-app-text flex items-center gap-2">
              Resolve Lead
            </h2>
            <button onClick={onClose} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-bg rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
          
          <div className="p-5 space-y-6">
             <div className="text-center">
                <p className="text-sm text-app-text-muted mb-4">How did it go with <strong className="text-app-text">{lead?.fullName}</strong>?</p>
                <div className="flex gap-3 justify-center">
                   <button 
                     onClick={() => setOutcome('Won')}
                     className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-bold transition-all ${
                       outcome === 'Won' 
                       ? 'bg-green-500/10 border-green-500 text-green-500' 
                       : 'bg-app-bg border-app-border text-app-text-muted hover:border-green-500/50 hover:text-green-500'
                     }`}
                   >
                     <CheckCircle2 size={18} /> Mark as Won 🎉
                   </button>
                   <button 
                     onClick={() => setOutcome('Lost')}
                     className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-bold transition-all ${
                       outcome === 'Lost' 
                       ? 'bg-red-500/10 border-red-500 text-red-500' 
                       : 'bg-app-bg border-app-border text-app-text-muted hover:border-red-500/50 hover:text-red-500'
                     }`}
                   >
                     <XCircle size={18} /> Mark as Lost
                   </button>
                </div>
             </div>

             <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {outcome === 'Won' ? (
                    <motion.div
                      key="won-form"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                       <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Final Deal Value (₹)</label>
                       <input 
                         type="number"
                         value={dealValue}
                         onChange={(e) => setDealValue(e.target.value)}
                         placeholder="e.g. 50000"
                         className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
                       />
                       <p className="text-[10px] text-emerald-500/80 mt-1">Awesome! Closing deals drives growth. 🚀</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="lost-form"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                       <label className="text-xs font-bold text-app-text-muted uppercase tracking-wider">Reason for Loss</label>
                       <select 
                          value={notConvertedReason}
                          onChange={(e) => setNotConvertedReason(e.target.value)}
                          className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors cursor-pointer appearance-none"
                       >
                          <option value="">-Select Reason-</option>
                          <option value="Too Expensive">Too Expensive</option>
                          <option value="Went with Competitor">Went with Competitor</option>
                          <option value="No Longer Needs Service">No Longer Needs Service</option>
                          <option value="Unresponsive">Unresponsive</option>
                          <option value="Not a Fit">Not a Fit</option>
                          <option value="Timing Not Right">Timing Not Right</option>
                          <option value="Other">Other</option>
                       </select>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>

          <div className="p-4 border-t border-app-border flex justify-end gap-3 bg-app-bg/50">
             <button 
               onClick={onClose}
               className="px-4 py-2 text-sm font-medium text-app-text hover:bg-surface-variant rounded-lg transition-colors"
             >
               Cancel
             </button>
             <button 
               onClick={() => onSubmit(outcome, dealValue, notConvertedReason)}
               className="px-6 py-2 text-sm font-bold text-black bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-lg shadow-primary/20"
             >
               Confirm
             </button>
          </div>
       </motion.div>
    </div>
  );
}
