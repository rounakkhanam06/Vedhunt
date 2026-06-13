import React, { useState, useEffect } from 'react';
import { Download, Search, CheckCircle2, XCircle, Mail, Send, Loader2 } from 'lucide-react';
import api from '../../services/api';

const SubscriberManager = () => {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1 });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  // Broadcast Modal State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [targetEmail, setTargetEmail] = useState(null);
  const [broadcastData, setBroadcastData] = useState({ subject: '', htmlContent: '' });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState(null);

  const fetchSubscribers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get(`/subscribe/admin/list?page=${page}&limit=${pagination.limit}&search=${search}&status=${statusFilter}`);
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
      link.setAttribute('download', `subscribers_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Failed to export CSV:', error);
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
        }, 3000);
      }
    } catch (error) {
      console.error('Broadcast failed:', error);
      setBroadcastMessage({ type: 'error', text: error.response?.data?.message || 'Failed to queue broadcast' });
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Newsletter Subscribers</h1>
          <p className="text-gray-400 text-sm">Manage your community subscriptions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setTargetEmail(null); setShowBroadcastModal(true); }}
            className="bg-secondary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-secondary-hover transition-colors cursor-pointer"
          >
            <Send size={18} />
            Broadcast
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-primary text-black px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Mail size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Subscribers</p>
              <h3 className="text-2xl font-bold text-white">{stats.total}</h3>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Active</p>
              <h3 className="text-2xl font-bold text-white">{stats.active}</h3>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
              <XCircle size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Unsubscribed</p>
              <h3 className="text-2xl font-bold text-white">{stats.inactive}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#242424] border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-primary transition-colors"
          />
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#242424] border border-white/10 text-white rounded-lg py-2 px-4 focus:outline-none focus:border-primary cursor-pointer"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Unsubscribed Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#242424] text-gray-400 text-sm uppercase tracking-wider">
                <th className="py-4 px-6 font-medium">Email</th>
                <th className="py-4 px-6 font-medium">Status</th>
                <th className="py-4 px-6 font-medium">Subscribed Date</th>
                <th className="py-4 px-6 font-medium">Unsubscribed Date</th>
                <th className="py-4 px-6 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-gray-400">Loading subscribers...</td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-gray-400">No subscribers found.</td>
                </tr>
              ) : (
                subscribers.map((sub) => (
                  <tr key={sub._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 font-medium text-white">{sub.email}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sub.active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {sub.active ? 'Active' : 'Unsubscribed'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-400">
                      {new Date(sub.subscribedAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-gray-400">
                      {sub.unsubscribedAt ? new Date(sub.unsubscribedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      {sub.active && (
                        <button 
                          onClick={() => { setTargetEmail(sub.email); setShowBroadcastModal(true); }}
                          className="text-gray-400 hover:text-secondary cursor-pointer" 
                          title={`Send email to ${sub.email}`}
                        >
                          <Mail size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-[#242424] px-6 py-4 flex items-center justify-between border-t border-white/5">
            <span className="text-sm text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchSubscribers(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-50 hover:bg-white/5 transition-colors border border-white/10 cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchSubscribers(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 rounded bg-[#1a1a1a] text-white disabled:opacity-50 hover:bg-white/5 transition-colors border border-white/10 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#2D2D33] flex justify-between items-center bg-[#242424]">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Send size={20} className="text-secondary" />
                {targetEmail ? `Send Email to ${targetEmail}` : 'Broadcast Newsletter'}
              </h3>
              <button 
                onClick={() => {
                  if (!broadcasting) {
                    setShowBroadcastModal(false);
                    setTargetEmail(null);
                  }
                }}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleBroadcastSubmit} className="p-6 overflow-y-auto flex-1">
              {broadcastMessage && (
                <div className={`p-4 mb-6 rounded-lg text-sm font-medium ${broadcastMessage.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                  {broadcastMessage.text}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email Subject</label>
                  <input
                    type="text"
                    required
                    value={broadcastData.subject}
                    onChange={(e) => setBroadcastData({...broadcastData, subject: e.target.value})}
                    placeholder="Enter an engaging subject line..."
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-secondary transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1 flex justify-between">
                    <span>Email Content</span>
                    <span className="text-xs text-gray-500">Unsubscribe link will be added automatically</span>
                  </label>
                  <textarea
                    required
                    rows={10}
                    value={broadcastData.htmlContent}
                    onChange={(e) => setBroadcastData({...broadcastData, htmlContent: e.target.value})}
                    placeholder="Hello community,&#10;&#10;Write your newsletter here..."
                    className="w-full bg-[#242424] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-secondary transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3 justify-end">
                <button 
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  disabled={broadcasting}
                  className="px-6 py-2.5 rounded-lg border border-[#2D2D33] text-gray-300 hover:bg-[#2D2D33] hover:text-white transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={broadcasting || !broadcastData.subject || !broadcastData.htmlContent}
                  className="px-6 py-2.5 rounded-lg bg-secondary hover:bg-secondary-hover text-white font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {broadcasting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Queueing...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      {targetEmail ? 'Send to Subscriber' : `Send to ${stats.active} Subscribers`}
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
