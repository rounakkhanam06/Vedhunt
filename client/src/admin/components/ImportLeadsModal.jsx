import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * Bulk lead import (Excel/CSV) — the manual-spreadsheet counterpart to the
 * Facebook webhook/sync ingestion. Posts straight to POST /leads/import
 * (server/services/leadImport.js), which reuses the same dedup logic as
 * every other lead-creation path, then shows the resulting summary.
 */
export default function ImportLeadsModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setSummary(res.data.data);
        if (res.data.data.imported > 0) {
          toast.success(`Imported ${res.data.data.imported} lead(s)`);
          onImported?.();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to import leads');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-app-card border border-app-border rounded-xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 border-b border-app-border flex justify-between items-center">
          <h2 className="text-lg font-bold text-app-text">Import Leads</h2>
          <button onClick={onClose} className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-bg rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-app-text-muted">
            Upload an .xlsx or .csv file with columns for name and phone (email, city, country, service, etc. are picked up automatically if present). Leads already in the system (by phone or email) are skipped.
          </p>

          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setSummary(null); }}
            className="w-full text-sm text-app-text file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-black file:font-semibold file:cursor-pointer bg-app-bg border border-app-border rounded-lg p-1.5"
          />

          {summary && (
            <div className="bg-app-bg border border-app-border rounded-lg p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                <CheckCircle2 size={16} /> {summary.imported} imported
              </div>
              <div className="text-app-text-muted">{summary.duplicates} already existed — skipped</div>
              {summary.invalid.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-amber-500 font-semibold">
                    <AlertTriangle size={16} /> {summary.invalid.length} row(s) skipped
                  </div>
                  <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-app-text-muted space-y-0.5">
                    {summary.invalid.slice(0, 20).map((item) => (
                      <li key={item.row}>Row {item.row}: {item.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-app-border flex justify-end gap-3 bg-app-bg/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-app-text hover:bg-surface-variant rounded-lg transition-colors">
            {summary ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-black bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? 'Uploading...' : 'Upload & Import'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
