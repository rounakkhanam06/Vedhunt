import React, { useState, useEffect } from 'react';
import clientApi from "../../services/clientApi";
import { toast } from 'react-hot-toast';
import { FileText, Download, CheckCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import AgreementTemplate from '../components/AgreementTemplate';
import { formatDateDDMMMYYYY } from '../../utils/formatDate';

const AgreementTab = () => {
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgreement();
  }, []);

  const fetchAgreement = async () => {
    try {
      setLoading(true);
      const { data } = await clientApi.get('/client/agreement');
      setAgreement(data);
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error('Failed to fetch agreement');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('agreement-content-pdf');
    if (!element) return;

    const opt = {
      margin:       1,
      filename:     'Service_Agreement.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" />
      </div>
    );
  }

  const accepted = agreement?.client?.acceptedAgreementVersion || 0;

  if (!agreement || !agreement.available || !accepted) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-bg-card border border-border-default rounded-xl">
        <FileText size={48} className="text-[#9CA3AF] mb-4" />
        <h3 className="text-xl font-bold text-white">No Agreement Found</h3>
        <p className="text-[#9CA3AF] mt-2 text-center">
          {agreement && !agreement.available
            ? 'Your service agreement is being prepared. You will be asked to review and accept it here once it is ready.'
            : 'There is currently no service agreement available.'}
        </p>
      </div>
    );
  }

  // Render the common template with exactly the details the client signed.
  // Acceptances recorded before snapshots existed fall back to current details.
  const signed = agreement.signed;
  const signedClient = {
    ...agreement.client,
    ...(signed && {
      businessName: signed.businessName ?? agreement.client.businessName,
      contactName: signed.contactName ?? agreement.client.contactName,
      phone: signed.phone ?? agreement.client.phone,
      agreementDetails: signed.details || agreement.client.agreementDetails,
      agreementAcceptedAt: signed.acceptedAt || agreement.client.agreementAcceptedAt,
    }),
  };

  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-6">
      <div className="flex flex-wrap gap-4 justify-between items-center mb-6 pb-6 border-b border-border-default">
        <div>
          <h2 className="text-xl font-bold text-white">Service Agreement</h2>
          <p className="text-[#9CA3AF] text-sm mt-1 flex items-center gap-1.5">
            <CheckCircle size={14} className="text-[#22C55E]" />
            Version {accepted} · Accepted
            {signedClient.agreementAcceptedAt && ` on ${formatDateDDMMMYYYY(signedClient.agreementAcceptedAt)}`}
          </p>
        </div>
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
        >
          <Download size={16} />
          <span>Download PDF</span>
        </button>
      </div>

      <div
        id="agreement-content-pdf"
        className="bg-white rounded-lg overflow-hidden"
      >
        <AgreementTemplate client={signedClient} />
      </div>
    </div>
  );
};

export default AgreementTab;
