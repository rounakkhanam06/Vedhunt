import React, { useState, useEffect } from 'react';
import { Download, Search, CheckCircle2, XCircle, Mail, Send, Loader2, Plus, Trash2, RefreshCw, AlertCircle, User, Globe } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const SubscriberManager = () => {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  // Add Subscriber Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubscriber, setNewSubscriber] = useState({ email: '', name: '', source: 'Manual / Admin' });
  const [addingSubscriber, setAddingSubscriber] = useState(false);

  // Broadcast Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [targetEmail, setTargetEmail] = useState(null);
  const [broadcastData, setBroadcastData] = useState({ subject: '', htmlContent: '' });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState(null);

  // Delete Confirmation State
  const [subscriberToDelete, setSubscriberToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Status Updating State (id of subscriber being updated)
  const [updatingId, setUpdatingId] = useState(null);

  const fetchSubscribers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get(`/subscribe/admin/list?page=${page}&limit=${pagination.limit}&search=${encodeURIComponent(search)}&status=${statusFilter}`);
      if (res.data.success) {
        setSubscribers(res.data.data);
        setPagination(res.data.pagination);
        setStats({
          total: res.data.total,
          active: res.data.totalActive,
          inactive: res.data.totalInactive
        });
      }
    } catch (error) {
      console.error('Failed to fetch subscribers:', error);
      toast.error('Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers(1);
  }, [search, statusFilter]);

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/subscribe/admin/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `newsletter_subscribers_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('Subscriber list exported successfully');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  const handleAddSubscriber = async (e) => {
    e.preventDefault();
    if (!newSubscriber.email) {
      toast.error('Email is required');
      return;
    }

    try {
      setAddingSubscriber(true);
      const res = await api.post('/subscribe/admin/subscribers', newSubscriber);
      if (res.data.success) {
        toast.success(res.data.message || 'Subscriber added successfully');
        setShowAddModal(false);
        setNewSubscriber({ email: '', name: '', source: 'Manual / Admin' });
        fetchSubscribers(1);
      }
    } catch (error) {
      console.error('Failed to add subscriber:', error);
      toast.error(error.response?.data?.message || 'Failed to add subscriber');
    } finally {
      setAddingSubscriber(false);
    }
  };

  const handleToggleStatus = async (sub) => {
    try {
      setUpdatingId(sub._id);
      const res = await api.patch(`/subscribe/admin/subscribers/${sub._id}/status`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchSubscribers(pagination.page);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteSubscriber = async () => {
    if (!subscriberToDelete) return;
    try {
      setDeleting(true);
      const res = await api.delete(`/subscribe/admin/subscribers/${subscriberToDelete._id}`);
      if (res.data.success) {
        toast.success('Subscriber deleted successfully');
        setSubscriberToDelete(null);
        fetchSubscribers(pagination.page);
      }
    } catch (error) {
      console.error('Failed to delete subscriber:', error);
      toast.error(error.response?.data?.message || 'Failed to delete subscriber');
    } finally {
      setDeleting(false);
    }
  };

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (!broadcastData.subject || !broadcastData.htmlContent) return;

    try {
      setBroadcasting(true);
      setBroadcastMessage(null);

      // Convert plain text to simple HTML (line breaks to <br>)
      const formattedHtml = broadcastData.htmlContent.replace(/\n/g, '<br>');

      const res = await api.post('/subscribe/admin/broadcast', {
        subject: broadcastData.subject,
        htmlContent: formattedHtml,
        targetEmail: targetEmail
      });
      if (res.data.success) {
        setBroadcastMessage({ type: 'success', text: res.data.message });
        setTimeout(() => {
          setShowBroadcastModal(false);
          setBroadcastData({ subject: '', htmlContent: '' });
          setBroadcastMessage(null);
          setTargetEmail(null);
        }, 2500);
      }
    } catch (error) {
      console.error('Broadcast failed:', error);
      setBroadcastMessage({ type: 'error', text: error.response?.data?.message || 'Failed to queue broadcast' });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-app-text font-heading">Newsletter Subscribers</h1>
              <p className="text-sm text-app-text-muted mt-0.5">
                Manage newsletter subscriptions and audience broadcasts independently from sales leads.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-start">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-lg font-semibold text-sm shadow-xs transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subscriber</span>
          </button>
          <button
            onClick={() => { setTargetEmail(null); setShowBroadcastModal(true); }}
            className="inline-flex items-center gap-2 bg-app-card border border-app-border hover:border-primary/50 hover:bg-surface-variant/40 text-app-text px-3.5 py-2 rounded-lg font-semibold text-sm shadow-xs transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Send className="w-4 h-4 text-app-text-muted" />
            <span>Broadcast</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 bg-app-card border border-app-border hover:border-primary/50 hover:bg-surface-variant/40 text-app-text px-3.5 py-2 rounded-lg font-semibold text-sm shadow-xs transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-app-text-muted" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-app-card border border-app-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-app-text-muted text-xs uppercase font-semibold tracking-wider">Total Subscribers</p>
              <h3 className="text-2xl font-bold text-app-text mt-0.5">{stats.total}</h3>
            </div>
          </div>
        </div>

        <div className="bg-app-card border border-app-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-app-text-muted text-xs uppercase font-semibold tracking-wider">Subscribed (Active)</p>
              <h3 className="text-2xl font-bold text-app-text mt-0.5">{stats.active}</h3>
            </div>
          </div>
        </div>

        <div className="bg-app-card border border-app-border rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-400 shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-app-text-muted text-xs uppercase font-semibold tracking-wider">Unsubscribed</p>
              <h3 className="text-2xl font-bold text-app-text mt-0.5">{stats.inactive}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-app-card border border-app-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 justify-between items-center shadow-xs">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search email, name or source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-app-bg border border-app-border rounded-lg py-2 pl-9 pr-4 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-app-text-muted whitespace-nowrap font-medium">Subscription Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-app-bg border border-app-border text-app-text rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary cursor-pointer w-full sm:w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="active">Subscribed Only</option>
            <option value="inactive">Unsubscribed Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-app-card border border-app-border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-app-bg/60 border-b border-app-border text-app-text-muted text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Subscriber</th>
                <th className="py-3 px-4 font-semibold">Subscription Status</th>
                <th className="py-3 px-4 font-semibold">Source</th>
                <th className="py-3 px-4 font-semibold">Subscribed Date</th>
                <th className="py-3 px-4 font-semibold">Unsubscribed</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-app-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading newsletter subscribers...</span>
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-app-text-muted">
                    <Mail className="w-10 h-10 mx-auto mb-2 opacity-30 text-app-text-muted" />
                    <p className="font-medium text-app-text">No newsletter subscribers found</p>
                    <p className="text-xs text-app-text-muted mt-1">
                      {search || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Add subscribers manually or collect them through your website footer and newsletter forms'}
                    </p>
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => {
                  const isSubscribed = sub.status === 'Subscribed' || sub.active;
                  return (
                    <tr key={sub._id} className="hover:bg-surface-variant/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-app-text">
                        <div className="flex flex-col">
                          <span className="font-semibold text-app-text">{sub.email}</span>
                          {sub.name && (
                            <span className="text-xs text-app-text-muted flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3" />
                              {sub.name}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isSubscribed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSubscribed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {isSubscribed ? 'Subscribed' : 'Unsubscribed'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-app-text-muted text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-app-bg px-2 py-0.5 rounded border border-app-border">
                          <Globe className="w-3 h-3 text-app-text-muted" />
                          {sub.source === 'Website Footer' ? 'Website' : (sub.source || 'Website')}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-app-text-muted text-xs whitespace-nowrap">
                        {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : '-'}
                      </td>

                      <td className="py-3 px-4 text-app-text-muted text-xs whitespace-nowrap">
                        {sub.unsubscribedAt ? (
                          <div>
                            <span>{new Date(sub.unsubscribedAt).toLocaleDateString()}</span>
                            {sub.unsubscribeReason && (
                              <span className="block text-[11px] text-app-text-muted/70 truncate max-w-[150px]" title={sub.unsubscribeReason}>
                                {sub.unsubscribeReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-app-text-muted/40">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isSubscribed && (
                            <button
                              onClick={() => { setTargetEmail(sub.email); setShowBroadcastModal(true); }}
                              className="p-1.5 text-app-text-muted hover:text-primary hover:bg-app-bg rounded-md transition-colors cursor-pointer"
                              title={`Send email to ${sub.email}`}
                            >
                              <Mail size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => handleToggleStatus(sub)}
                            disabled={updatingId === sub._id}
                            className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-bg rounded-md transition-colors cursor-pointer disabled:opacity-50"
                            title={isSubscribed ? 'Mark as Unsubscribed' : 'Reactivate Subscription'}
                          >
                            <RefreshCw size={16} className={updatingId === sub._id ? 'animate-spin' : ''} />
                          </button>

                          <button
                            onClick={() => setSubscriberToDelete(sub)}
                            className="p-1.5 text-app-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                            title="Delete subscriber record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-app-bg/50 px-6 py-3 flex flex-wrap gap-2 items-center justify-between border-t border-app-border text-xs">
            <span className="text-app-text-muted">
              Page {pagination.page} of {pagination.totalPages} ({stats.total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchSubscribers(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 rounded-lg bg-app-card text-app-text disabled:opacity-50 hover:bg-surface-variant transition-colors border border-app-border cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchSubscribers(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 rounded-lg bg-app-card text-app-text disabled:opacity-50 hover:bg-surface-variant transition-colors border border-app-border cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Subscriber Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-app-border flex justify-between items-center bg-app-bg/50">
              <h3 className="text-lg font-bold text-app-text flex items-center gap-2">
                <Plus size={18} className="text-primary" />
                Add Newsletter Subscriber
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-app-text-muted hover:text-app-text cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubscriber} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-1.5">
                  Email Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="subscriber@example.com"
                  value={newSubscriber.email}
                  onChange={(e) => setNewSubscriber({ ...newSubscriber, email: e.target.value })}
                  className="w-full bg-app-bg border border-app-border rounded-lg px-3.5 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={newSubscriber.name}
                  onChange={(e) => setNewSubscriber({ ...newSubscriber, name: e.target.value })}
                  className="w-full bg-app-bg border border-app-border rounded-lg px-3.5 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-1.5">
                  Source
                </label>
                <select
                  value={newSubscriber.source}
                  onChange={(e) => setNewSubscriber({ ...newSubscriber, source: e.target.value })}
                  className="w-full bg-app-bg border border-app-border rounded-lg px-3.5 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option value="Manual / Admin">Manual / Admin Entry</option>
                  <option value="Website">Website</option>
                  <option value="Blog">Blog Subscription</option>
                  <option value="Newsletter Popup">Newsletter Popup</option>
                  <option value="Event / Campaign">Event / Campaign</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={addingSubscriber}
                  className="px-4 py-2 text-sm rounded-lg border border-app-border text-app-text hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSubscriber || !newSubscriber.email}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {addingSubscriber ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Subscriber'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {subscriberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-sm overflow-hidden shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertCircle size={22} />
              <h3 className="text-base font-bold text-app-text">Delete Subscriber Record</h3>
            </div>
            <p className="text-sm text-app-text-muted mb-4">
              Are you sure you want to remove <strong className="text-app-text">{subscriberToDelete.email}</strong> from your newsletter subscriber list?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSubscriberToDelete(null)}
                disabled={deleting}
                className="px-3.5 py-1.5 text-sm rounded-lg border border-app-border text-app-text hover:bg-surface-variant transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubscriber}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-app-border flex justify-between items-center bg-app-bg/50">
              <h3 className="text-lg font-bold text-app-text flex items-center gap-2">
                <Send size={18} className="text-primary" />
                {targetEmail ? `Send Direct Newsletter to ${targetEmail}` : 'Broadcast Newsletter to Active Subscribers'}
              </h3>
              <button
                onClick={() => {
                  if (!broadcasting) {
                    setShowBroadcastModal(false);
                    setTargetEmail(null);
                  }
                }}
                className="text-app-text-muted hover:text-app-text cursor-pointer"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleBroadcastSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
              {broadcastMessage && (
                <div className={`p-3.5 rounded-lg text-sm font-medium ${broadcastMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                  {broadcastMessage.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-1.5">
                  Subject Line <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={broadcastData.subject}
                  onChange={(e) => setBroadcastData({ ...broadcastData, subject: e.target.value })}
                  placeholder="e.g., Weekly Insights & Product Highlights"
                  className="w-full bg-app-bg border border-app-border rounded-lg px-3.5 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-1.5 flex justify-between">
                  <span>Newsletter Message Content <span className="text-rose-400">*</span></span>
                  <span className="text-[11px] text-app-text-muted normal-case font-normal">One-click unsubscribe footer added automatically</span>
                </label>
                <textarea
                  required
                  rows={9}
                  value={broadcastData.htmlContent}
                  onChange={(e) => setBroadcastData({ ...broadcastData, htmlContent: e.target.value })}
                  placeholder="Hello community,&#10;&#10;Here are the top updates this week..."
                  className="w-full bg-app-bg border border-app-border rounded-lg px-3.5 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors font-sans"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5 border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  disabled={broadcasting}
                  className="px-4 py-2 text-sm rounded-lg border border-app-border text-app-text hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={broadcasting || !broadcastData.subject || !broadcastData.htmlContent}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {broadcasting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Queueing Broadcast...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      {targetEmail ? 'Send Email' : `Broadcast to ${stats.active} Subscribers`}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriberManager;
