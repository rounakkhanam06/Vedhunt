import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { useEssProfile, essPost, essPut, essKeys, apiError } from '../lib/ess';
import { WHATSAPP_APPS, buildWhatsAppUrl, openWhatsApp, whatsappNumber } from '../lib/whatsapp';

const defaultMessage = (lead, me) =>
  `Hi ${String(lead.fullName || '').split(' ')[0] || 'there'}, this is ${me?.firstName || 'the team'} from Vedhunt InfoTech regarding your enquiry${lead.service ? ` for ${lead.service}` : ''}.`;

/**
 * "Send via WhatsApp": pick WhatsApp Web / Desktop / Business (pre-selected
 * from the saved preference), edit the pre-filled message, open the chat with
 * the lead's number, and log "WhatsApp initiated" on the lead's timeline.
 */
export default function WhatsAppAction({ lead, className, label = 'WhatsApp', onLogged }) {
  const queryClient = useQueryClient();
  const { data: me } = useEssProfile();
  const [open, setOpen] = useState(false);
  const saved = me?.preferences?.whatsappApp;
  const [app, setApp] = useState('');
  const [text, setText] = useState('');
  const [remember, setRemember] = useState(false);

  if (!whatsappNumber(lead.phone)) return null;

  const start = () => {
    setApp(saved && saved !== 'ask' ? saved : 'web');
    setText(defaultMessage(lead, me));
    setRemember(false);
    setOpen(true);
  };

  const send = async () => {
    openWhatsApp(buildWhatsAppUrl(app, lead.phone, text));
    setOpen(false);
    essPost(`/leads/${lead._id}/whatsapp-log`, { app })
      .then(() => onLogged?.())
      .catch(() => {}); // the chat already opened; a missed log line shouldn't nag
    if (remember && app !== saved) {
      try {
        await essPut('/preferences', { whatsappApp: app });
        queryClient.setQueryData(essKeys.profile, (p) => (p ? { ...p, preferences: { ...p.preferences, whatsappApp: app } } : p));
        toast.success(`${WHATSAPP_APPS.find((a) => a.value === app)?.label} saved as your default`);
      } catch (err) {
        toast.error(apiError(err, 'Could not save your WhatsApp preference.'));
      }
    }
  };

  return (
    <>
      <button type="button" onClick={start} className={className}>
        <MessageCircle size={14} className="shrink-0" /> <span className="truncate">{label}</span>
      </button>
      {open && (
        <Modal title="Send via WhatsApp" subtitle={`To ${lead.fullName}`} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <div className="grid gap-2">
              {WHATSAPP_APPS.map((option) => (
                <label key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${app === option.value ? 'border-primary bg-primary/5' : 'border-app-border hover:border-primary/40'}`}>
                  <input type="radio" name="wa-app" className="mt-1" checked={app === option.value} onChange={() => setApp(option.value)} />
                  <span>
                    <span className="block text-sm font-semibold text-app-text">{option.label}{saved === option.value ? ' · your default' : ''}</span>
                    <span className="block text-xs text-app-text-muted">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs text-app-text-muted mb-1">Message</label>
              <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)}
                className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text resize-none focus:outline-none focus:border-primary" />
            </div>
            {app !== saved && (
              <label className="flex items-center gap-2 text-xs text-app-text cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Use this app by default (change it any time in My Profile)
              </label>
            )}
            <button type="button" onClick={send}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
              <Send size={15} /> Open WhatsApp
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
