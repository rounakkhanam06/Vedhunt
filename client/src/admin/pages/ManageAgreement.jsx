import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Edit3, CheckCircle, Clock, Save, X, Eye } from 'lucide-react';
import api from '../../services/api';
import AgreementTemplate from '../../client/components/AgreementTemplate';

export default function ManageAgreement() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editData, setEditData] = useState(null);
  const [viewMode, setViewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/clients?limit=100');
      if (data && data.data) {
        setClients(data.data);
      }
    } catch (error) {
      toast.error('Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (client) => {
    setSelectedClient(client);
    setEditData({
      domain: client.agreementDetails?.domain || '',
      agreementDate: client.agreementDetails?.agreementDate ? new Date(client.agreementDetails.agreementDate).toISOString().split('T')[0] : '',
      effectiveDate: client.agreementDetails?.effectiveDate ? new Date(client.agreementDetails.effectiveDate).toISOString().split('T')[0] : '',
      serviceName: client.agreementDetails?.serviceName || 'Performance Marketing management',
      platforms: client.agreementDetails?.platforms?.join('\n') || '',
      deliverables: client.agreementDetails?.deliverables?.join('\n') || '',
      exclusions: client.agreementDetails?.exclusions?.join('\n') || '',
      monthlyFee: client.agreementDetails?.monthlyFee || 0,
      gstAmount: client.agreementDetails?.gstAmount || 0,
      totalPayable: client.agreementDetails?.totalPayable || 0,
    });
    setViewMode(false);
  };

  const handleViewClick = (client) => {
    setSelectedClient(client);
    setViewMode(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        agreementDetails: {
          ...editData,
          platforms: editData.platforms.split('\n').filter(p => p.trim()),
          deliverables: editData.deliverables.split('\n').filter(p => p.trim()),
          exclusions: editData.exclusions.split('\n').filter(p => p.trim()),
        }
      };
      await api.put(`/admin/clients/${selectedClient._id}`, payload);
      toast.success('Agreement details updated successfully');
      fetchClients();
      setSelectedClient(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update agreement details');
    } finally {
      setSaving(false);
    }
  };

  if (selectedClient && viewMode) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Preview Agreement</h1>
            <p className="text-on-surface-variant text-sm mt-1">Viewing agreement for {selectedClient.businessName}</p>
          </div>
          <button
            onClick={() => setSelectedClient(null)}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg hover:bg-surface-hover"
          >
            <X size={18} /> Back to Clients
          </button>
        </div>
        <div className="bg-surface-container rounded-xl p-6 border border-outline-variant overflow-y-auto max-h-[80vh]">
          <AgreementTemplate client={selectedClient} />
        </div>
      </div>
    );
  }

  if (selectedClient && !viewMode) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Edit Agreement Details</h1>
            <p className="text-on-surface-variant text-sm mt-1">For {selectedClient.businessName}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedClient(null)}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-outline rounded-lg hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-secondary text-on-secondary rounded-lg font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Domain</label>
              <input
                type="text"
                value={editData.domain}
                onChange={(e) => setEditData({...editData, domain: e.target.value})}
                className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface"
                placeholder="e.g. Mudgarvale.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Service Name</label>
              <input
                type="text"
                value={editData.serviceName}
                onChange={(e) => setEditData({...editData, serviceName: e.target.value})}
                className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Agreement Date</label>
              <input
                type="date"
                value={editData.agreementDate}
                onChange={(e) => setEditData({...editData, agreementDate: e.target.value})}
                className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Effective Date</label>
              <input
                type="date"
                value={editData.effectiveDate}
                onChange={(e) => setEditData({...editData, effectiveDate: e.target.value})}
                className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Monthly Fee (Ex-GST)</label>
              <input
                type="number"
                value={editData.monthlyFee}
                onChange={(e) => setEditData({...editData, monthlyFee: Number(e.target.value)})}
                className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">GST Amount (18%)</label>
              <input
                type="number"
                value={editData.gstAmount}
                onChange={(e) => setEditData({...editData, gstAmount: Number(e.target.value)})}
                className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Total Payable</label>
              <input
                type="number"
                value={editData.totalPayable}
                onChange={(e) => setEditData({...editData, totalPayable: Number(e.target.value)})}
                className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Platforms (One per line)</label>
            <textarea
              value={editData.platforms}
              onChange={(e) => setEditData({...editData, platforms: e.target.value})}
              className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface h-32"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Deliverables (One per line)</label>
            <textarea
              value={editData.deliverables}
              onChange={(e) => setEditData({...editData, deliverables: e.target.value})}
              className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface h-32"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Exclusions (One per line)</label>
            <textarea
              value={editData.exclusions}
              onChange={(e) => setEditData({...editData, exclusions: e.target.value})}
              className="w-full bg-surface border border-outline rounded-lg px-4 py-2 text-on-surface h-32"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Client Service Agreements</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage static service agreements and variables for each client.</p>
        </div>
      </div>

      <div className="bg-surface-container rounded-xl overflow-hidden border border-outline-variant">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">No clients found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-outline">
                  <th className="py-4 px-6 font-semibold text-sm text-on-surface-variant">Client Name</th>
                  <th className="py-4 px-6 font-semibold text-sm text-on-surface-variant">Contact</th>
                  <th className="py-4 px-6 font-semibold text-sm text-on-surface-variant">Agreement Status</th>
                  <th className="py-4 px-6 font-semibold text-sm text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline">
                {clients.map((client) => {
                  const hasDetails = !!client.agreementDetails?.domain;
                  return (
                    <tr key={client._id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-4 px-6 text-on-surface font-medium">{client.businessName}</td>
                      <td className="py-4 px-6 text-on-surface-variant">{client.email}</td>
                      <td className="py-4 px-6">
                        {client.acceptedAgreementVersion ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                            <CheckCircle size={14} /> Accepted
                          </span>
                        ) : hasDetails ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">
                            <Clock size={14} /> Pending Acceptance
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                            <Edit3 size={14} /> Needs Details
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 flex justify-end gap-2">
                        <button
                          onClick={() => handleViewClick(client)}
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Preview Agreement"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleEditClick(client)}
                          className="p-2 text-on-surface-variant hover:text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                          title="Edit Agreement Details"
                        >
                          <Edit3 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
