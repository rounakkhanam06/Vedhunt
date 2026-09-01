import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, Clock, Globe, Briefcase, CheckCircle2, Play, Square, XCircle } from 'lucide-react';
import StageDataModal from './StageDataModal';

const COLUMNS = [
  { id: 'Received', title: 'Received', statuses: ['New'], color: 'border-blue-500/30 bg-blue-500/5', headerColor: 'text-blue-500' },
  { id: 'Calling', title: 'Calling', statuses: ['Contacted'], color: 'border-amber-500/30 bg-amber-500/5', headerColor: 'text-amber-500' },
  { id: 'Proposal', title: 'Proposal', statuses: ['Qualified', 'Proposal Sent'], color: 'border-purple-500/30 bg-purple-500/5', headerColor: 'text-purple-500' },
  { id: 'Negotiation', title: 'Negotiation', statuses: ['Negotiation'], color: 'border-pink-500/30 bg-pink-500/5', headerColor: 'text-pink-500' },
  { id: 'Hold', title: 'Hold', statuses: ['Hold'], color: 'border-slate-500/30 bg-slate-500/5', headerColor: 'text-slate-400' },
  { id: 'WonLost', title: 'Won / Lost', statuses: ['Won', 'Lost', 'Dropped'], color: 'border-emerald-500/30 bg-emerald-500/5', headerColor: 'text-emerald-500' }
];

export default function LeadsPipelineView({
  leads,
  isSuperAdmin,
  handleFieldChange,
  handleFieldsChange,
  startCall,
  endCall,
  onOpenLead,
  handleAssign,
  bds,
  canAssign
}) {
  const [draggedLeadId, setDraggedLeadId] = useState(null);

  // Two-step Won/Lost flow: pick which outcome first, then StageDataModal
  // below collects that outcome's mandatory fields.
  const [wonLostChoice, setWonLostChoice] = useState(null); // { lead } | null
  const [stageModal, setStageModal] = useState(null); // { lead, targetStatus } | null

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

    // Stages that need mandatory companion data (proposal value, deal value,
    // a reason, a hold reason) open StageDataModal so it all travels in one
    // combined update — server/utils/leadStateMachine.js rejects a bare
    // status change into any of these. Stages with no extra data requirement
    // (New/Contacted/Qualified) apply directly.
    if (columnId === 'WonLost') {
      setWonLostChoice({ lead });
    } else if (columnId === 'Hold') {
      setStageModal({ lead, targetStatus: 'Hold' });
    } else if (columnId === 'Proposal' && lead.status === 'Qualified') {
      setStageModal({ lead, targetStatus: 'Proposal Sent' });
    } else {
      // Default to the first status in the column mapping
      const newStatus = column.statuses[0];
      handleFieldChange(leadId, 'status', newStatus);
    }

    setDraggedLeadId(null);
  };

  const handleStageModalSubmit = async (fields) => {
    const lead = stageModal?.lead;
    if (!lead) return;
    await handleFieldsChange(lead._id, fields);
    setStageModal(null);
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
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-primary font-bold">{lead.leadId || 'N/A'}</span>
                            {!lead.assignedTo && lead.unassignedSlaDeadline && new Date(lead.unassignedSlaDeadline) < new Date() && (
                              <span title="SLA Breached (Unassigned)" className="text-red-500 text-[10px]">⚠️</span>
                            )}
                            {lead.lockedBy && (
                              <span title="Locked for active handling" className="text-amber-500 text-[10px]">🔒</span>
                            )}
                          </div>
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
                          onClick={() => onOpenLead(lead)}
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
                         {lead.source && (
                           <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-app-bg border border-app-border text-app-text-muted">
                              {lead.source}
                           </span>
                         )}
                         {lead.interestLevel && (
                           <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-500">
                              {lead.interestLevel}
                           </span>
                         )}
                         {lead.dealValue > 0 && (
                           <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                              ₹{lead.dealValue.toLocaleString()}
                           </span>
                         )}
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
                        <div className="text-[10px] text-app-text-muted font-medium flex items-center">
                           {canAssign && !lead.lockedBy && !['Won', 'Lost', 'Dropped'].includes(lead.status) ? (
                             <select
                               value={lead.assignedTo?._id || lead.assignedTo || ''}
                               onClick={(e) => e.stopPropagation()}
                               onChange={(e) => handleAssign(lead._id, e.target.value)}
                               className="bg-app-bg border border-app-border rounded px-1.5 py-1 text-app-text focus:outline-none focus:border-primary cursor-pointer w-[100px] truncate"
                             >
                               <option value="">Unassigned</option>
                               {bds?.map(bd => (
                                 <option key={bd._id} value={bd._id}>{bd.firstName} {bd.lastName}</option>
                               ))}
                             </select>
                           ) : (
                             <span>{lead.bd ? `BD: ${lead.bd}` : 'Unassigned'}</span>
                           )}
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

      {/* Won/Lost: pick the outcome first, then StageDataModal below collects
          that outcome's mandatory fields (deal value, or a reason). */}
      {wonLostChoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-app-card border border-app-border rounded-xl shadow-xl w-full max-w-md overflow-hidden p-5"
          >
            <p className="text-sm text-app-text-muted mb-4 text-center">
              How did it go with <strong className="text-app-text">{wonLostChoice.lead.fullName}</strong>?
            </p>
            <div className="flex gap-3 justify-center mb-2">
              <button
                onClick={() => { setStageModal({ lead: wonLostChoice.lead, targetStatus: 'Won' }); setWonLostChoice(null); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-bold transition-all bg-app-bg border-app-border text-app-text-muted hover:border-green-500/50 hover:text-green-500"
              >
                <CheckCircle2 size={18} /> Mark as Won 🎉
              </button>
              <button
                onClick={() => { setStageModal({ lead: wonLostChoice.lead, targetStatus: 'Lost' }); setWonLostChoice(null); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-bold transition-all bg-app-bg border-app-border text-app-text-muted hover:border-red-500/50 hover:text-red-500"
              >
                <XCircle size={18} /> Mark as Lost
              </button>
            </div>
            <button onClick={() => setWonLostChoice(null)} className="w-full mt-2 px-4 py-2 text-sm font-medium text-app-text-muted hover:text-app-text transition-colors">
              Cancel
            </button>
          </motion.div>
        </div>
      )}

      {stageModal && (
        <StageDataModal
          lead={stageModal.lead}
          targetStatus={stageModal.targetStatus}
          onClose={() => setStageModal(null)}
          onSubmit={handleStageModalSubmit}
        />
      )}
    </div>
  );
}
