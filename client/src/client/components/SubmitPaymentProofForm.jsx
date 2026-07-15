import { useState } from 'react';
import { UploadCloud, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import clientService from '../../services/clientService';

const SubmitPaymentProofForm = ({ invoice, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    amountPaid: Math.max(0, (invoice.totalAmount || 0) - (invoice.paidAmount || 0)),
    utrNumber: '',
    paymentDate: new Date().toISOString().split('T')[0],
  });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return toast.error('Image size must be less than 5MB');
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amountPaid || !formData.utrNumber || !imageFile) {
      return toast.error('Please fill all fields and upload a screenshot');
    }

    const utrRegex = /^[a-zA-Z0-9]{12,22}$/;
    if (!utrRegex.test(formData.utrNumber)) {
      return toast.error('Please enter a valid UTR/Transaction Id');
    }

    try {
      setLoading(true);
      // Upload image first
      const uploadData = new FormData();
      uploadData.append('image', imageFile);
      const uploadRes = await clientService.uploadPublicImage(uploadData);

      if (!uploadRes.success) {
        throw new Error('Image upload failed');
      }

      // Submit payment proof
      await clientService.submitPaymentProof({
        invoice_ref: invoice._id,
        amountPaid: Number(formData.amountPaid),
        utrNumber: formData.utrNumber,
        paymentDate: formData.paymentDate,
        screenshotUrl: uploadRes.url
      });

      toast.success('Payment proof submitted successfully! It is pending verification.');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit payment proof');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full bg-bg-surface border border-border-default rounded-lg px-4 py-2 text-white placeholder-[#9CA3AF] focus:outline-none focus:border-primary transition-all text-sm";
  const labelClasses = "block text-xs font-medium text-[#9CA3AF] mb-1.5 uppercase tracking-wider";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
        <h4 className="text-primary font-semibold text-sm mb-1">Submit Payment Proof</h4>
        <p className="text-[#9CA3AF] text-xs">Upload your transaction details for verification.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClasses}>Amount Paid (₹)</label>
          <input
            type="number"
            min="1"
            max={Math.max(0, (invoice.totalAmount || 0) - (invoice.paidAmount || 0))}
            value={formData.amountPaid}
            onChange={e => setFormData(p => ({ ...p, amountPaid: e.target.value }))}
            className={inputClasses}
            required
          />
        </div>
        <div>
          <label className={labelClasses}>Payment Date</label>
          <input
            type="date"
            value={formData.paymentDate}
            onChange={e => setFormData(p => ({ ...p, paymentDate: e.target.value }))}
            className={inputClasses}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>UTR / Transaction ID</label>
          <input
            type="text"
            placeholder="e.g. 123456789012"
            value={formData.utrNumber}
            onChange={e => setFormData(p => ({ ...p, utrNumber: e.target.value }))}
            className={inputClasses}
            required
          />
        </div>
      </div>

      <div>
        <label className={labelClasses}>Screenshot / Receipt</label>
        <div className="border-2 border-dashed border-border-default rounded-xl p-6 text-center hover:border-primary transition-colors relative bg-bg-surface/30">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            required
          />
          {previewUrl ? (
            <div className="flex flex-col items-center">
              <img src={previewUrl} alt="Preview" className="h-32 object-contain rounded-lg mb-2" />
              <p className="text-primary text-xs font-medium">Click or drag to replace image</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-[#9CA3AF]">
              <UploadCloud className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm font-medium">Click to upload screenshot</p>
              <p className="text-xs mt-1">PNG, JPG up to 5MB</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-border-default">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-2.5 rounded-lg border border-border-default text-[#D1D5DB] hover:text-white hover:bg-bg-surface transition-colors text-sm font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-[2] px-4 py-2.5 rounded-lg bg-primary hover:bg-[#FF6B00] text-white transition-colors text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          {loading ? 'Submitting...' : 'Submit Proof'}
        </button>
      </div>
    </form>
  );
};

export default SubmitPaymentProofForm;
