import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellPlus, BellOff, CheckCheck, AlertCircle, Clock } from 'lucide-react';
import api from '../../services/api';
import { isPushAvailable, enablePush } from '../../services/pushNotifications';

const POLL_INTERVAL_MS = 30000;

// Notification types that get priority visual treatment (spec: "priority
// notification" for a follow-up due right now, plus breaches/EOD reports).
const PRIORITY_TYPES = ['followup_due_priority', 'followup_breach', 'followup_eod_report'];

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushAvailable, setPushAvailable] = useState(false);
  const wrapperRef = useRef(null);

  // Hidden entirely until Firebase is actually configured server-side (see
  // GET /api/config/firebase-public) — no point offering a button that can't work yet.
  useEffect(() => { isPushAvailable().then(setPushAvailable); }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      if (data?.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // silent — the bell just stays as-is until the next poll
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleClickNotification = async (notification) => {
    setOpen(false);
    if (!notification.read) {
      setNotifications((prev) => prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      api.put(`/notifications/${notification._id}/read`).catch(() => {});
    }
    if (notification.link) navigate(notification.link);
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      await api.put('/notifications/read-all');
    } catch {
      // silent
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full text-app-text-muted hover:text-app-text hover:bg-app-border/30 transition-colors"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-app-card shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[460px] flex flex-col bg-app-card border border-app-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-app-border bg-app-card/90 backdrop-blur-sm flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-app-text">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-primary/10 text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-app-text-muted hover:text-app-text transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} /> Mark read
                </button>
              )}
              {pushAvailable && (
                <button
                  onClick={() => enablePush(api, '/notifications/register-device')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-secondary hover:opacity-80 transition-opacity"
                  title="Get notified even when this tab isn't open"
                >
                  <BellPlus size={13} /> Push
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 divide-y divide-app-border">
            {notifications.length === 0 ? (
              <div className="px-6 py-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <BellOff size={22} />
                </div>
                <p className="text-sm font-semibold text-app-text">No notifications yet</p>
                <p className="text-xs text-app-text-muted mt-1 max-w-[220px]">
                  You will receive updates and alerts here as they arrive.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isPriority = PRIORITY_TYPES.includes(n.type);
                return (
                  <button
                    key={n._id}
                    onClick={() => handleClickNotification(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-app-border/20 transition-colors ${
                      !n.read ? 'bg-primary/[0.04] dark:bg-primary/[0.08]' : ''
                    } ${isPriority ? 'border-l-4 border-l-red-500 pl-3' : ''}`}
                  >
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isPriority
                          ? 'bg-red-500/10 text-red-500'
                          : !n.read
                          ? 'bg-primary/10 text-primary'
                          : 'bg-app-border/40 text-app-text-muted'
                      }`}
                    >
                      {isPriority ? <AlertCircle size={15} /> : <Bell size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-xs sm:text-sm font-medium truncate ${
                            isPriority ? 'text-red-500 font-semibold' : 'text-app-text'
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-xs text-app-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-app-text-muted/80 mt-1.5">
                        <Clock size={11} />
                        <span>{new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
}
