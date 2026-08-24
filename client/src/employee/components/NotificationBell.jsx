import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import employeeApi from '../../services/employeeApi';

const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wrapperRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await employeeApi.get('/employee-portal/ess/notifications');
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
      employeeApi.put(`/employee-portal/ess/notifications/${notification._id}/read`).catch(() => {});
    }
    if (notification.link) navigate(notification.link);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative text-white/80 hover:text-white transition-colors p-2"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-80 max-h-96 overflow-y-auto bg-[#141416] border border-white/10 rounded-xl shadow-lg z-50">
          <div className="px-4 py-3 border-b border-white/5 text-sm font-bold text-white">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">Nothing yet</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => handleClickNotification(n)}
                className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors ${!n.read ? 'bg-orange-500/5' : ''}`}
              >
                <p className="text-sm font-medium text-white">{n.title}</p>
                {n.message && <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>}
                <p className="text-[10px] text-gray-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
