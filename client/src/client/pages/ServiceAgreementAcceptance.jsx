import React, { useState } from 'react';
import clientApi from '../../services/clientApi';
import { toast } from 'react-hot-toast';
import { FileText, CheckCircle2 } from 'lucide-react';
import { useClientStore } from '../../store/useClientStore';
import AgreementTemplate from '../components/AgreementTemplate';

const ServiceAgreementAcceptance = ({ agreement, onAccept }) => {
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { checkAuth } = useClientStore();

  // Common template + this client's current details, shown unsigned (a
  // re-sign must not display the previous "Digitally Accepted" stamp).
  const draftClient = {
    ...agreement.client,
    acceptedAgreementVersion: 0,
    agreementAcceptedAt: null,
  };

  const handleAccept = async () => {
    if (!accepted) return;
    try {
      setSubmitting(true);
      await clientApi.post('/client/accept-agreement', { version: agreement.version });
      toast.success('Agreement accepted successfully');
      await checkAuth(); // refresh client data
      if (onAccept) onAccept();
    } catch (error) {
      if (error.response?.status === 409) {
        // Details changed while the client was reading — show the latest
        toast.error(error.response.data?.message || 'The agreement was updated. Please review it again.');
        setAccepted(false);
        setSubmitting(false);
        if (onAccept) onAccept();
        return;
      }
      toast.error(error.response?.data?.message || 'Failed to accept agreement');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg-primary flex items-center justify-center sm:p-4">
      <div className="bg-bg-card sm:border border-border-default sm:rounded-xl w-full max-w-4xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 sm:p-6 border-b border-border-default flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Service Agreement</h1>
            <p className="text-[#9CA3AF] text-xs sm:text-sm mt-1">
              {(agreement.client?.acceptedAgreementVersion || 0) > 0
                ? 'Your service agreement has been updated. Please review and accept it to continue.'
                : 'Please review and accept the service agreement to continue.'}
            </p>
          </div>
        </div>

        <div className="p-0 overflow-y-auto overscroll-contain flex-1 min-h-0 bg-[#1A1F2B]">
          <div className="bg-white max-w-4xl mx-auto shadow-sm">
            <AgreementTemplate client={draftClient} />
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-border-default shrink-0 bg-bg-card sm:rounded-b-xl space-y-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`
              w-6 h-6 rounded border flex items-center justify-center transition-colors
              ${accepted ? 'bg-primary border-primary text-white' : 'border-[#4B5563] bg-transparent group-hover:border-[#9CA3AF]'}
            `}>
              {accepted && <CheckCircle2 size={16} />}
            </div>
            <input
              type="checkbox"
              className="hidden"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span className="text-[#E5E2E1] text-sm md:text-base select-none">
              I have read and agree to the terms and conditions outlined in this Service Agreement.
            </span>
          </label>

          <div className="flex sm:justify-end">
            <button
              onClick={handleAccept}
              disabled={!accepted || submitting}
              className="w-full sm:w-auto justify-center px-8 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? 'Accepting...' : 'I Accept & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceAgreementAcceptance;
