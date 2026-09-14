import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const LeaveRequestsManager = ({ embedded = false }) => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionModal, setActionModal] = useState({ isOpen: false, reqId: null, status: null });
  const [adminComment, setAdminComment] = useState('');

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/employees/admin/leave-requests');
      if (res.data.success) {
        setRequests(res.data.leaveRequests);
      }
    } catch (error) {
      toast.error('Failed to load leave requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openActionModal = (id, status) => {
    setActionModal({ isOpen: true, reqId: id, status });
    setAdminComment('');
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    const { reqId, status } = actionModal;
    
    try {
      const res = await api.put(`/employees/admin/leave-requests/${reqId}/status`, {
        status,
        adminComment
      });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update leave request status.');
    } finally {
      setActionModal({ isOpen: false, reqId: null, status: null });
      setAdminComment('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-app-text">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className={`${embedded ? '' : 'p-6'} text-app-text space-y-6`}>
      {!embedded && (
        <div className="flex justify-between items-center border-b border-app-border pb-4">
          <div>
            <h1 className="text-2xl font-bold text-app-text">Leave Requests</h1>
            <p className="text-sm text-app-text-muted mt-1">Manage employee time off and leave balances</p>
          </div>
        </div>
      )}

      <div className="bg-app-card p-6 rounded-xl border border-app-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4">End Date</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4 text-center">Leave Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-sm">
              {requests.map((req) => (
                <tr key={req._id} className="hover:bg-app-bg/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-app-text">{req.employeeId?.firstName} {req.employeeId?.lastName}</div>
                    <div className="text-xs text-app-text-muted">{req.employeeId?.employeeId}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-app-text">{new Date(req.startDate).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-mono text-app-text">{new Date(req.endDate).toLocaleDateString()}</td>
                  <td className="py-3 px-4 max-w-[200px] truncate text-app-text" title={req.reason}>{req.reason}</td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="text-[11px] text-app-text-muted">Total: {req.employeeId?.leaveBalance || 0} | Used: {req.employeeId?.leavesUsed || 0}</div>
                    <div className="text-sm font-bold text-primary">
                      Remaining: {(req.employeeId?.leaveBalance || 0) - (req.employeeId?.leavesUsed || 0)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      req.status === 'Rejected' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                      'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {req.status === 'Pending' ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openActionModal(req._id, 'Approved')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openActionModal(req._id, 'Rejected')}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-app-text-muted italic">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-app-text-muted">No leave requests found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-app-border flex justify-between items-center bg-app-bg/50">
              <h2 className="text-lg font-bold text-app-text">
                Mark as {actionModal.status}
              </h2>
              <button 
                onClick={() => setActionModal({ isOpen: false, reqId: null, status: null })}
                className="text-app-text-muted hover:text-app-text cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleModalSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-app-text-muted mb-1">
                  Optional Comment for marking as {actionModal.status}
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter comment here..."
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  className="w-full text-sm rounded-lg border border-app-border bg-app-bg px-4 py-2 text-app-text placeholder:text-app-text-muted/60 resize-none outline-none focus:border-primary"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: false, reqId: null, status: null })}
                  className="px-4 py-2 bg-app-bg hover:bg-app-border/40 text-app-text border border-app-border rounded-lg text-sm font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg text-sm font-bold transition-all cursor-pointer ${
                    actionModal.status === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Confirm {actionModal.status}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveRequestsManager;
