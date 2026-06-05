import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Edit2, Trash2, Plus, Briefcase, Eye, EyeOff } from 'lucide-react';

export default function JobManager() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialFormState = {
    title: '',
    department: '',
    type: 'Full Time',
    location: '',
    experience: '',
    description: '',
    status: 'Published'
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/jobs');
      setJobs(res.data || []);
    } catch (error) {
      alert('Failed to load jobs');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteJob = async (id) => {
    if (!window.confirm('Are you sure you want to delete this job completely?')) return;
    try {
      await api.delete(`/jobs/${id}`);
      fetchJobs();
    } catch (error) {
      alert('Failed to delete job');
      console.error(error);
    }
  };

  const toggleStatus = async (job) => {
    try {
      const newStatus = job.status === 'Published' ? 'Unpublished' : 'Published';
      await api.put(`/jobs/${job._id}`, { status: newStatus });
      fetchJobs();
    } catch (error) {
      alert('Failed to update status');
      console.error(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/jobs/${editingId}`, formData);
        alert('Job updated successfully!');
      } else {
        await api.post('/jobs', formData);
        alert('Job added successfully!');
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingId(null);
      fetchJobs();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save job');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (job) => {
    setEditingId(job._id);
    setFormData({
      title: job.title,
      department: job.department,
      type: job.type,
      location: job.location,
      experience: job.experience,
      description: job.description,
      status: job.status
    });
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Manager</h1>
          <p className="text-gray-400 text-sm mt-1">Manage open positions on the career page.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Job
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-[#1a1a1a] rounded-xl border border-white/5">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No jobs found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <div key={job._id} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 relative flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider bg-primary/20 text-primary">
                    {job.department}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-2">{job.title}</h3>
                </div>
              </div>
              
              <div className="space-y-1 mb-4 text-sm text-gray-400">
                <p><strong>Type:</strong> {job.type}</p>
                <p><strong>Location:</strong> {job.location}</p>
                <p><strong>Experience:</strong> {job.experience}</p>
              </div>

              <div className="bg-black/30 p-3 rounded-lg text-sm text-gray-300 italic mb-6 flex-1 line-clamp-3">
                {job.description}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-auto">
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(job)}
                    className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => toggleStatus(job)}
                    className={`p-2 rounded transition-colors ${
                      job.status === 'Published' 
                        ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' 
                        : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
                    }`}
                    title={job.status === 'Published' ? 'Unpublish' : 'Publish'}
                  >
                    {job.status === 'Published' ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                
                <button 
                  onClick={() => deleteJob(job._id)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                  title="Delete Permanently"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingId ? 'Edit Job' : 'Add New Job'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Job Title *</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Department / Category *</label>
                  <input
                    required
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Engineering, Marketing"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Job Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Location *</label>
                  <input
                    required
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Remote / Navi Mumbai"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Experience *</label>
                  <input
                    required
                    type="text"
                    value={formData.experience}
                    onChange={e => setFormData({ ...formData, experience: e.target.value })}
                    placeholder="e.g. 4+ Years"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Published">Published</option>
                    <option value="Unpublished">Unpublished</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Job Description *</label>
                <textarea
                  required
                  rows={6}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary resize-none"
                  placeholder="Enter detailed job description..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
