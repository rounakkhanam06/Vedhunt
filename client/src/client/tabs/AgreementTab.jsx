import React, { useState, useEffect } from 'react';
import clientApi from '../../../services/clientApi';
import { toast } from 'react-hot-toast';
import { FileText, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import AgreementHeader from '../components/AgreementHeader';

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

  if (!agreement) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-bg-card border border-border-default rounded-xl">
        <FileText size={48} className="text-[#9CA3AF] mb-4" />
        <h3 className="text-xl font-bold text-white">No Agreement Found</h3>
        <p className="text-[#9CA3AF] mt-2">There is currently no service agreement available.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-6">
      <div className="flex justify-between items-center mb-6 pb-6 border-b border-border-default">
        <div>
          <h2 className="text-xl font-bold text-white">Service Agreement</h2>
          <p className="text-[#9CA3AF] text-sm mt-1">Version: {agreement.version}</p>
        </div>
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-colors"
        >
          <Download size={16} />
          <span>Download PDF</span>
        </button>
      </div>

      <div 
        id="agreement-content-pdf" 
        className="bg-white rounded-lg overflow-hidden"
      >
        <AgreementHeader />
        <div 
          className="prose max-w-none text-black p-8 pt-0"
          dangerouslySetInnerHTML={{ __html: agreement.content }}
        />
      </div>
    </div>
  );
};

export default AgreementTab;
