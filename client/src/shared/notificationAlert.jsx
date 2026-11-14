import toast from 'react-hot-toast';

// Short two-tone chime for new notifications. Browsers may block audio until
// the user has interacted with the page; failures are ignored.
export function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.15;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
    setTimeout(() => ctx.close().catch(() => {}), 800);
  } catch {
    // ignore
  }
}

/**
 * Tracks which notifications have been seen and pops a toast + chime for the
 * ones that arrive after the page loaded. Call `check(list)` after each fetch;
 * the first call only records what is already there.
 *   seenRef  — a useRef(null) owned by the bell
 *   onOpen   — called with the notification when its toast is clicked
 */
export function alertNewNotifications(seenRef, list, onOpen) {
  if (seenRef.current === null) {
    seenRef.current = new Set(list.map((n) => n._id));
    return;
  }
  const fresh = list.filter((n) => !n.read && !seenRef.current.has(n._id));
  list.forEach((n) => seenRef.current.add(n._id));
  if (!fresh.length) return;

  playChime();
  fresh.slice(0, 3).forEach((n) => {
    toast(
      (t) => (
        <div
          className="cursor-pointer"
          onClick={() => {
            toast.dismiss(t.id);
            onOpen(n);
          }}
        >
          <div className="font-semibold text-sm">{n.title}</div>
          {n.message && <div className="text-xs opacity-80 mt-0.5">{n.message}</div>}
        </div>
      ),
      { icon: '🔔', duration: 8000, id: `notif-${n._id}` }
    );
  });
  if (fresh.length > 3) toast(`+${fresh.length - 3} more notifications`, { icon: '🔔' });
}
