import { useState } from 'react';
import { Mail, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// A mailto: link opens the computer's default mail app, which is often not set
// up (and can't be pointed at Yahoo/Gmail in the browser). So "Email" offers
// the webmail compose pages people are already signed in to, plus the mail
// app and copying the address. The last choice is remembered per browser.
const PROVIDERS = [
  { value: 'yahoo', label: 'Yahoo Mail', url: (to) => `https://compose.mail.yahoo.com/?to=${to}` },
  { value: 'gmail', label: 'Gmail', url: (to) => `https://mail.google.com/mail/?view=cm&fs=1&to=${to}` },
  { value: 'outlook', label: 'Outlook.com', url: (to) => `https://outlook.live.com/mail/0/deeplink/compose?to=${to}` },
  { value: 'office', label: 'Outlook (work / Microsoft 365)', url: (to) => `https://outlook.office.com/mail/deeplink/compose?to=${to}` },
  { value: 'app', label: 'Mail app on this computer', url: (to) => `mailto:${to}` },
];
const STORAGE_KEY = 'vh_email_provider';

const readSaved = () => {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
};

/** Placeholder addresses the system creates for leads that came in without one. */
const isPlaceholderEmail = (email) =>
  !email || /^import_\d+_\d+@vedhunt\.in$/i.test(email) || /^fb_[^@]+@facebook\.com$/i.test(email);

/**
 * "Email" button with a small menu: Yahoo / Gmail / Outlook in the browser,
 * the mail app, or copy the address. `className` styles the button; `label`
 * defaults to "Email". `allowCopy={false}` drops "Copy address" (the BD
 * portal keeps lead contact details from being copied — NoCopyText).
 */
export default function EmailAction({ email, className = '', label = 'Email', allowCopy = true }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(readSaved);
  const [copied, setCopied] = useState(false);

  if (isPlaceholderEmail(email)) {
    return (
      <span className={`${className} opacity-50 cursor-not-allowed`} title="This lead has no email address">
        <Mail size={14} className="shrink-0" /> <span className="truncate">{label}</span>
      </span>
    );
  }

  const to = encodeURIComponent(email);
  const choose = (provider) => {
    try { localStorage.setItem(STORAGE_KEY, provider.value); } catch { /* private mode: just don't remember */ }
    setSaved(provider.value);
    setOpen(false);
    if (provider.value === 'app') window.location.assign(provider.url(to));
    else window.open(provider.url(to), '_blank', 'noopener,noreferrer');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast.success('Email address copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — select the address instead');
    }
    setOpen(false);
  };
  // The last-used option first
  const ordered = [...PROVIDERS].sort((a, b) => (b.value === saved) - (a.value === saved));

  return (
    <div className="relative min-w-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`${className} w-full cursor-pointer`} aria-haspopup="menu" aria-expanded={open}>
        <Mail size={14} className="shrink-0" /> <span className="truncate">{label}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute left-0 top-full mt-1 z-50 w-64 max-w-[calc(100vw-2rem)] bg-app-card border border-app-border rounded-xl shadow-2xl p-1.5">
            <p className="px-2.5 pt-1 pb-1.5 text-[11px] text-app-text-muted truncate" title={email}>Email {email} via</p>
            {ordered.map((p) => (
              <button key={p.value} type="button" role="menuitem" onClick={() => choose(p)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-left text-app-text hover:bg-form-input-bg cursor-pointer">
                <span>{p.label}</span>
                {p.value === saved && <span className="text-[10px] font-semibold text-primary">last used</span>}
              </button>
            ))}
            {allowCopy && (
              <>
                <div className="my-1 border-t border-app-border" />
                <button type="button" role="menuitem" onClick={copy}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left text-app-text hover:bg-form-input-bg cursor-pointer">
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} Copy address
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
