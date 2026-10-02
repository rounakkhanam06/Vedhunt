import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, Clock, FileText, CreditCard, AlertCircle, LifeBuoy, FileSignature } from 'lucide-react';
import clientService from '../../services/clientService';

const POLL_INTERVAL_MS = 30000; // same cadence as the admin bell

const TYPE_STYLE = {
  invoice_created:   { icon: FileText,      cls: 'bg-primary/10 text-primary' },
  payment_approved:  { icon: CreditCard,    cls: 'bg-[#22C55E]/10 text-[#22C55E]' },
  payment_rejected:  { icon: AlertCircle,   cls: 'bg-[#EF4444]/10 text-[#EF4444]' },
  ticket_reply:      { icon: LifeBuoy,      cls: 'bg-primary/10 text-primary' },
  ticket_status:     { icon: LifeBuoy,      cls: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
  agreement_updated: { icon: FileSignature, cls: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
};

const ClientNotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await clientService.getNotifications();
      if (data?.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // silent — the bell keeps its last state until the next poll
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      if (!document.hidden) fetchNotifications(); // don't poll from background tabs
    }, POLL_INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) fetchNotifications(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleClick = (n) => {
    setOpen(false);
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      clientService.markNotificationRead(n._id).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAll = () => {
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnreadCount(0);
    clientService.markAllNotificationsRead().catch(() => {});
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-bg-surface/50 border border-border-default text-[#9CA3AF] hover:text-white transition-all cursor-pointer"
        title="Notifications"
        aria-label={unreadCount ? `Notifications (${unreadCount} unread)` : 'Notifications'}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-bg-card">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm max-h-[460px] flex flex-col bg-bg-card border border-border-default rounded-2xl shadow-2xl z-[60] overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-primary/15 text-primary">{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="flex items-center gap-1 text-[11px] font-medium text-[#9CA3AF] hover:text-white cursor-pointer">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-white/[0.05]">
            {notifications.length === 0 ? (
              <div className="px-6 py-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <BellOff size={22} />
                </div>
                <p className="text-sm font-semibold text-white">No notifications yet</p>
                <p className="text-xs text-[#9CA3AF] mt-1 max-w-[230px]">New invoices, payment updates and replies to your tickets will appear here.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const style = TYPE_STYLE[n.type] || { icon: Bell, cls: 'bg-primary/10 text-primary' };
                const Icon = style.icon;
                return (
                  <button
                    key={n._id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-bg-surface/40 transition-colors cursor-pointer ${!n.read ? 'bg-primary/[0.05]' : ''}`}
                  >
                    <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${style.cls}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${!n.read ? 'text-white font-semibold' : 'text-[#D1D5DB] font-medium'}`}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      {n.message && <p className="text-xs text-[#9CA3AF] mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>}
                      <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280] mt-1.5">
                        <Clock size={11} />
                        <span>{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientNotificationBell;
