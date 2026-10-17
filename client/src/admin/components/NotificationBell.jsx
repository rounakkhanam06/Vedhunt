import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellPlus,
  BellOff,
  CheckCheck,
  AlertCircle,
  Clock,
  X,
  RefreshCw,
  Check,
  ArrowRight,
  ShieldAlert,
  CalendarClock,
  Sparkles,
  Inbox
} from 'lucide-react';
import api from '../../services/api';
import { isPushAvailable, enablePush } from '../../services/pushNotifications';

const POLL_INTERVAL_MS = 30000;

// Notification types that get priority visual treatment
const PRIORITY_TYPES = ['followup_due_priority', 'followup_breach', 'followup_eod_report'];

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours}h ago`;
  }
  if (diffSec < 172800) {
    return `Yesterday, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'breaches'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    isPushAvailable().then(setPushAvailable);
  }, []);

  const fetchNotifications = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const { data } = await api.get('/notifications?limit=60');
      if (data?.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // silent — bell keeps current state until next poll
    } finally {
      if (showIndicator) setTimeout(() => setIsRefreshing(false), 300);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on Escape key press
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleClickNotification = async (notification) => {
    setOpen(false);
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      api.put(`/notifications/${notification._id}/read`).catch(() => {});
    }
    if (notification.link) navigate(notification.link);
  };

  const handleMarkOneRead = async (e, id) => {
    e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      // silent
    }
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

  // Classify breach / priority
  const checkIsBreach = (n) => {
    return (
      PRIORITY_TYPES.includes(n.type) ||
      /breach/i.test(n.title || '') ||
      /breach/i.test(n.message || '')
    );
  };

  const breachCount = useMemo(() => {
    return notifications.filter(checkIsBreach).length;
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeFilter === 'unread' && n.read) return false;
      if (activeFilter === 'breaches' && !checkIsBreach(n)) return false;
      return true;
    });
  }, [notifications, activeFilter]);

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
          open
            ? 'bg-[#FF6B00]/15 text-[#FF6B00] ring-2 ring-[#FF6B00]/40'
            : 'text-app-text-muted hover:text-app-text hover:bg-app-border/30'
        }`}
        title="Open Notifications"
        aria-label="Open notifications"
      >
        <Bell size={20} className={unreadCount > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[19px] h-[19px] px-1 rounded-full bg-[#FF6B00] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-app-card shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Full Length Sidebar Drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 cursor-pointer"
              aria-hidden="true"
            />

            {/* Slide-out Sidebar Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 h-screen w-full sm:w-[460px] md:w-[500px] max-w-full bg-app-card border-l border-app-border shadow-2xl z-50 flex flex-col text-app-text overflow-hidden"
              role="dialog"
              aria-label="Notification sidebar"
            >
              {/* Top Header */}
              <div className="px-5 py-4 border-b border-app-border bg-app-card/95 backdrop-blur-md shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center shadow-xs">
                      <Bell size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-app-text leading-tight">Notifications</h2>
                        {unreadCount > 0 ? (
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#FF6B00] text-white shadow-xs">
                            {unreadCount} new
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-app-border/50 text-app-text-muted">
                            {notifications.length} total
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-app-text-muted mt-0.5">
                        Alerts, breaches & follow-up updates
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => fetchNotifications(true)}
                      className={`p-2 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-border/40 transition-colors cursor-pointer ${
                        isRefreshing ? 'animate-spin text-[#FF6B00]' : ''
                      }`}
                      title="Refresh notifications"
                    >
                      <RefreshCw size={16} />
                    </button>

                    {pushAvailable && (
                      <button
                        onClick={() => enablePush(api, '/notifications/register-device')}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                        title="Enable desktop/push notifications"
                      >
                        <BellPlus size={14} />
                        <span className="hidden sm:inline">Push</span>
                      </button>
                    )}

                    <button
                      onClick={() => setOpen(false)}
                      className="p-2 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-border/40 transition-colors cursor-pointer ml-1"
                      title="Close (Esc)"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Filter Tabs & Mark All Read */}
                <div className="mt-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 p-0.5 bg-app-bg/80 rounded-lg border border-app-border/60">
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                        activeFilter === 'all'
                          ? 'bg-app-card text-app-text shadow-xs font-semibold'
                          : 'text-app-text-muted hover:text-app-text'
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      onClick={() => setActiveFilter('unread')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                        activeFilter === 'unread'
                          ? 'bg-[#FF6B00] text-white shadow-xs font-semibold'
                          : 'text-app-text-muted hover:text-app-text'
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>
                    {breachCount > 0 && (
                      <button
                        onClick={() => setActiveFilter('breaches')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                          activeFilter === 'breaches'
                            ? 'bg-red-500 text-white shadow-xs font-semibold'
                            : 'text-red-500 hover:bg-red-500/10'
                        }`}
                      >
                        <ShieldAlert size={12} />
                        Breaches ({breachCount})
                      </button>
                    )}
                  </div>

                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#FF6B00] hover:text-[#FF6B00]/80 hover:underline transition-all cursor-pointer shrink-0"
                    >
                      <CheckCheck size={14} />
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List (Full Length Scroll Area) */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 divide-y-0">
                {filteredNotifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-app-border/30 text-app-text-muted flex items-center justify-center mb-3">
                      {activeFilter === 'unread' ? <Inbox size={28} /> : activeFilter === 'breaches' ? <ShieldAlert size={28} /> : <BellOff size={28} />}
                    </div>
                    <p className="text-sm font-bold text-app-text">
                      {activeFilter === 'unread'
                        ? 'No unread notifications'
                        : activeFilter === 'breaches'
                        ? 'No breaches recorded'
                        : 'No notifications yet'}
                    </p>
                    <p className="text-xs text-app-text-muted mt-1 max-w-[240px]">
                      {activeFilter === 'unread'
                        ? 'You have caught up with all your alerts!'
                        : activeFilter === 'breaches'
                        ? 'No missed follow-ups or breached alerts.'
                        : 'New updates, breach alerts and follow-ups will appear here.'}
                    </p>
                    {activeFilter !== 'all' && (
                      <button
                        onClick={() => setActiveFilter('all')}
                        className="mt-4 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-app-border/40 hover:bg-app-border/60 text-app-text transition-colors cursor-pointer"
                      >
                        View all notifications
                      </button>
                    )}
                  </div>
                ) : (
                  filteredNotifications.map((n) => {
                    const isBreach = checkIsBreach(n);
                    const isDuePriority = n.type === 'followup_due_priority';

                    return (
                      <div
                        key={n._id}
                        onClick={() => handleClickNotification(n)}
                        className={`group relative w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                          !n.read
                            ? isBreach
                              ? 'bg-red-500/[0.04] dark:bg-red-500/[0.08] border-red-500/30 hover:border-red-500/60 shadow-xs'
                              : 'bg-[#FF6B00]/[0.04] dark:bg-[#FF6B00]/[0.08] border-[#FF6B00]/30 hover:border-[#FF6B00]/60 shadow-xs'
                            : 'bg-app-card hover:bg-app-border/20 border-app-border/70 hover:border-app-border'
                        } ${
                          isBreach
                            ? 'border-l-4 border-l-red-500'
                            : isDuePriority
                            ? 'border-l-4 border-l-amber-500'
                            : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Left Icon */}
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-105 ${
                              isBreach
                                ? 'bg-red-500/15 text-red-500 ring-1 ring-red-500/20'
                                : isDuePriority
                                ? 'bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/20'
                                : !n.read
                                ? 'bg-[#FF6B00]/15 text-[#FF6B00] ring-1 ring-[#FF6B00]/20'
                                : 'bg-app-border/40 text-app-text-muted'
                            }`}
                          >
                            {isBreach ? (
                              <AlertCircle size={18} />
                            ) : isDuePriority ? (
                              <CalendarClock size={18} />
                            ) : (
                              <Bell size={18} />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3
                                  className={`text-xs sm:text-sm font-semibold leading-snug ${
                                    isBreach
                                      ? 'text-red-500 dark:text-red-400'
                                      : 'text-app-text'
                                  }`}
                                >
                                  {n.title}
                                </h3>
                                {isBreach && (
                                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-wider">
                                    Breach
                                  </span>
                                )}
                              </div>

                              {/* Unread indicator & Quick Mark as Read button */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!n.read && (
                                  <button
                                    onClick={(e) => handleMarkOneRead(e, n._id)}
                                    title="Mark as read"
                                    className="p-1 rounded-md text-app-text-muted hover:text-[#FF6B00] hover:bg-[#FF6B00]/10 opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
                                  >
                                    <Check size={14} />
                                  </button>
                                )}
                                {!n.read && (
                                  <span className="w-2 h-2 rounded-full bg-[#FF6B00] ring-2 ring-[#FF6B00]/20 animate-pulse" />
                                )}
                              </div>
                            </div>

                            {/* Message */}
                            {n.message && (
                              <p className="text-xs text-app-text-muted/90 mt-1 line-clamp-3 leading-relaxed">
                                {n.message}
                              </p>
                            )}

                            {/* Footer / Meta */}
                            <div className="mt-2.5 flex items-center justify-between text-[11px] text-app-text-muted pt-1 border-t border-app-border/30">
                              <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-app-text-muted/70" />
                                <span>{formatTimeAgo(n.createdAt)}</span>
                              </div>

                              {n.link && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FF6B00] opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span>View details</span>
                                  <ArrowRight size={12} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Drawer Footer */}
              <div className="px-5 py-3 border-t border-app-border bg-app-card/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 text-xs text-app-text-muted">
                <span>
                  Showing <strong className="text-app-text font-semibold">{filteredNotifications.length}</strong> of{' '}
                  <strong className="text-app-text font-semibold">{notifications.length}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-app-border/30 hover:bg-app-border/60 text-app-text transition-colors cursor-pointer"
                    >
                      Clear unread
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#FF6B00] text-white hover:bg-[#FF6B00]/90 transition-colors shadow-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
