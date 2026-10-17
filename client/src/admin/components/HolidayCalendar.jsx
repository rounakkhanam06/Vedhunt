import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usePageAccess } from '../../shared/crmAccess';

const inputClasses = "w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2 text-app-text placeholder-app-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-300";
const labelClasses = "block text-[12px] font-medium text-app-text-muted mb-1.5 font-mono uppercase tracking-wider";

/**
 * Company holiday calendar — the Settings "Holiday Calendar" tab and the
 * standalone HRMS → Holidays page (for HR roles without settings.manage).
 * Adding/deleting needs holidays.manage; anyone signed in can view.
 */
export default function HolidayCalendar() {
  // Admin panel (role) or Employee Portal (person-wise grant) — shared/crmAccess.js
  const { http, root, allowed } = usePageAccess();
  const canCreate = allowed('holidays.manage', 'holidays', 'create');
  const canDelete = allowed('holidays.manage', 'holidays', 'delete');
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', type: 'Public' });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: holidays = [], isLoading: loading } = useQuery({
    queryKey: ['admin', 'holidays', String(selectedYear)],
    queryFn: () => http.get(`${root}/employees/holidays?year=${selectedYear}`).then((r) => r.data.holidays || []),
  });
  const fetchHolidays = () => queryClient.invalidateQueries({ queryKey: ['admin', 'holidays'] });

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.name || !newHoliday.date) return toast.error('Name and Date are required');
    try {
      setSaving(true);
      const res = await http.post(`${root}/employees/holidays`, newHoliday);
      if (res.data.success) {
        toast.success('Holiday added');
        setNewHoliday({ name: '', date: '', type: 'Public' });
        fetchHolidays();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      const res = await http.delete(`${root}/employees/holidays/${id}`);
      if (res.data.success) {
        toast.success('Holiday deleted');
        fetchHolidays();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete holiday');
    }
  };

  return (
    <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-2xl font-bold text-app-text mb-2">Company Holiday Calendar</h3>
      <p className="text-app-text-muted text-sm mb-8">Manage official non-working holidays. Employees get paid leaves for these days.</p>

      <div className="flex justify-between items-center mb-6">
        <h4 className="text-sm font-semibold text-[#FF5A1F] uppercase tracking-widest">Holidays for {selectedYear}</h4>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text outline-none"
        >
          {[...Array(5)].map((_, i) => {
            const y = new Date().getFullYear() - 2 + i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>

      {canCreate && (
        <div className="bg-app-bg border border-app-border p-6 rounded-xl mb-8">
          <form onSubmit={handleAddHoliday} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div className="col-span-1">
              <label className={labelClasses}>Date</label>
              <input type="date" required value={newHoliday.date} onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })} className={inputClasses} />
            </div>
            <div className="col-span-1">
              <label className={labelClasses}>Holiday Name</label>
              <input type="text" required placeholder="Diwali" value={newHoliday.name} onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })} className={inputClasses} />
            </div>
            <div className="col-span-1">
              <label className={labelClasses}>Type</label>
              <select value={newHoliday.type} onChange={e => setNewHoliday({ ...newHoliday, type: e.target.value })} className={inputClasses}>
                <option value="Public">Public</option>
                <option value="Restricted">Restricted</option>
              </select>
            </div>
            <div className="col-span-1">
              <button type="submit" disabled={saving} className="w-full bg-[#FF5A1F] hover:bg-[#EA580C] text-white px-4 py-2 rounded-lg font-bold transition-all h-[42px] whitespace-nowrap">
                Add Holiday
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-app-text-muted">Loading...</div>
      ) : (
        <div className="bg-app-bg border border-app-border rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm text-app-text min-w-[500px]">
            <thead className="bg-surface-variant text-xs uppercase text-app-text-muted border-b border-app-border">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Type</th>
                {canDelete && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {holidays.length === 0 ? (
                <tr><td colSpan={canDelete ? 4 : 3} className="px-6 py-8 text-center text-app-text-muted">No holidays found for {selectedYear}</td></tr>
              ) : (
                holidays.map(h => (
                  <tr key={h._id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-4 font-mono">{new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-6 py-4 font-semibold text-app-text">{h.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${h.type === 'Public' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                        {h.type}
                      </span>
                    </td>
                    {canDelete && (
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteHoliday(h._id)} className="text-red-500 hover:text-red-400 font-medium text-xs">Delete</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
