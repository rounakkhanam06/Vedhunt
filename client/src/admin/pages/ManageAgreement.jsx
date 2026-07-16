import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { Save } from 'lucide-react';
import AgreementHeader from '../../client/components/AgreementHeader';

export default function ManageAgreement() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchAgreement();
  }, []);

  const fetchAgreement = async () => {
    try {
      setFetching(true);
      const { data } = await api.get('/admin/agreement');
      if (data && data.content) {
        setContent(data.content);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error('Failed to fetch agreement');
      }
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.put('/admin/agreement', { content });
      toast.success('Service Agreement updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update agreement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Service Agreement</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage the compulsory service agreement for clients.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading || fetching}
          className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-on-secondary rounded-lg font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          <Save size={18} />
          {loading ? 'Saving...' : 'Save Agreement'}
        </button>
      </div>

      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant">
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
          <AgreementHeader />
          <div className="text-black bg-white">
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              className="h-[500px] mb-12 px-4 pb-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
