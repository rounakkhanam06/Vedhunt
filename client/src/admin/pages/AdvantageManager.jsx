import React, { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { Save, Loader, Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown } from 'lucide-react';

export default function AdvantageManager({ isNested = false }) {
  const [headerData, setHeaderData] = useState({
    heading: '',
    description: '',
    vedhuntColumnHeader: '',
    typicalColumnHeader: '',
    bottomNote: '',
  });
  const [rows, setRows] = useState([]);
  const [isHeaderSaving, setIsHeaderSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [rowToDelete, setRowToDelete] = useState(null);
  const [rowData, setRowData] = useState({
    feature: '',
    vedhunt: '',
    typical: '',
    order: 0,
    isActive: true,
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const data = await contentService.getAdvantageAdmin();
      if (data.data) {
        setHeaderData(data.data.header || {
          heading: '',
          description: '',
          vedhuntColumnHeader: '',
          typicalColumnHeader: '',
          bottomNote: '',
        });
        setRows(data.data.rows || []);
      }
    } catch (error) {
      alert('Failed to load advantage data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData(prev => ({ ...prev, [name]: value }));
  };

  const handleHeaderSubmit = async (e) => {
    e.preventDefault();
    setIsHeaderSaving(true);
    try {
      await contentService.updateAdvantageHeader(headerData);
      alert('Header updated successfully!');
    } catch (error) {
      alert('Failed to update header');
      console.error(error);
    } finally {
      setIsHeaderSaving(false);
    }
  };

  const handleOpenModal = (row = null) => {
    if (row) {
      setEditingRow(row);
      setRowData({ ...row });
    } else {
      setEditingRow(null);
      setRowData({
        feature: '',
        vedhunt: '',
        typical: '',
        order: rows.length + 1,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRow(null);
  };

  const handleRowChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRowData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRowSubmit = async (e) => {
    e.preventDefault();
    setIsSavingRow(true);
    try {
      if (editingRow) {
        await contentService.updateAdvantageRow(editingRow._id, rowData);
        alert('Row updated successfully!');
      } else {
        await contentService.createAdvantageRow(rowData);
        alert('Row added successfully!');
      }
      handleCloseModal();
      fetchData();
    } catch (error) {
      alert('Failed to save row');
      console.error(error);
    } finally {
      setIsSavingRow(false);
    }
  };

  const confirmDeleteRow = (row) => {
    setRowToDelete(row);
  };

  const handleDeleteRow = async () => {
    if (!rowToDelete) return;
    try {
      await contentService.deleteAdvantageRow(rowToDelete._id);
      setRowToDelete(null);
      fetchData();
    } catch (error) {
      alert('Failed to delete row');
      console.error(error);
    }
  };

  // Simple reordering logic
  const handleMove = async (index, direction) => {
    if (
      (direction === -1 && index === 0) || 
      (direction === 1 && index === rows.length - 1)
    ) return;
    
    const newRows = [...rows];
    const item = newRows[index];
    const swapItem = newRows[index + direction];
    
    const itemOrder = item.order;
    item.order = swapItem.order;
    swapItem.order = itemOrder;

    setRows(newRows.sort((a, b) => a.order - b.order));
    
    try {
      await Promise.all([
        contentService.updateAdvantageRow(item._id, { order: item.order }),
        contentService.updateAdvantageRow(swapItem._id, { order: swapItem.order })
      ]);
    } catch (err) {
      alert('Failed to update order');
      fetchData();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin" />
      </div>
    );
  }

  return (
    <div className={isNested ? "space-y-8" : "max-w-4xl mx-auto space-y-8"}>
      {!isNested && (
        <div>
          <h1 className="text-2xl font-bold text-white">Manage "The Vedhunt Advantage"</h1>
          <p className="mt-1 text-sm text-gray-400">
            Customize the comparison table content on the homepage.
          </p>
        </div>
      )}

      {/* Header Form */}
      <div className="bg-[#222222] border border-white/10 rounded-xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Table Header & Footer Text</h2>
        <form onSubmit={handleHeaderSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Heading</label>
              <input
                type="text"
                name="heading"
                className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none"
                value={headerData.heading}
                onChange={handleHeaderChange}
                required
              />
            </div>
            
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                name="description"
                rows="2"
                className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none"
                value={headerData.description}
                onChange={handleHeaderChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Vedhunt Column Header</label>
              <input
                type="text"
                name="vedhuntColumnHeader"
                className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none"
                value={headerData.vedhuntColumnHeader}
                onChange={handleHeaderChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Typical Column Header</label>
              <input
                type="text"
                name="typicalColumnHeader"
                className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none"
                value={headerData.typicalColumnHeader}
                onChange={handleHeaderChange}
                required
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-1">Bottom Footer Note</label>
              <input
                type="text"
                name="bottomNote"
                className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] outline-none"
                value={headerData.bottomNote}
                onChange={handleHeaderChange}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isHeaderSaving}
              className="flex items-center gap-2 px-6 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-70"
            >
              {isHeaderSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Header
            </button>
          </div>
        </form>
      </div>

      {/* Rows Table */}
      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1A1A1A]">
          <h2 className="text-lg font-semibold text-white">Comparison Rows</h2>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white text-sm font-semibold rounded-lg hover:bg-[#e66000] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-[#1A1A1A]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Feature</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Vedhunt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Typical</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row, index) => (
                <tr key={row._id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <div className="flex flex-col gap-1 items-center w-min">
                      <button 
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <span className="text-xs">{row.order}</span>
                      <button 
                        onClick={() => handleMove(index, 1)}
                        disabled={index === rows.length - 1}
                        className="text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white font-medium">{row.feature}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{row.vedhunt}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{row.typical}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${row.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {row.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <button onClick={() => handleOpenModal(row)} className="text-[#FF6B00] hover:text-[#e66000]">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => confirmDeleteRow(row)} className="text-red-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500 text-sm">
                    No comparison rows found. Click "Add Row" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#222222] rounded-xl shadow-2xl border border-white/10 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {editingRow ? 'Edit Row' : 'Add New Row'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-white">
                <Trash2 className="w-5 h-5 opacity-0 pointer-events-none" /> {/* Spacer */}
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleRowSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Feature Name</label>
                <input
                  type="text"
                  name="feature"
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                  value={rowData.feature}
                  onChange={handleRowChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vedhunt Column Text</label>
                <input
                  type="text"
                  name="vedhunt"
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                  value={rowData.vedhunt}
                  onChange={handleRowChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Typical Agency Text</label>
                <input
                  type="text"
                  name="typical"
                  required
                  className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                  value={rowData.typical}
                  onChange={handleRowChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Order</label>
                  <input
                    type="number"
                    name="order"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                    value={rowData.order}
                    onChange={handleRowChange}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      name="isActive"
                      className="w-4 h-4 rounded bg-[#1A1A1A] border-white/10 text-[#FF6B00] focus:ring-[#FF6B00]"
                      checked={rowData.isActive}
                      onChange={handleRowChange}
                    />
                    <span className="text-sm font-medium text-gray-300">Active (Visible)</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRow}
                  className="flex items-center gap-2 px-6 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] disabled:opacity-70"
                >
                  {isSavingRow ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {rowToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-[#222222] rounded-xl shadow-2xl border border-white/10 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Delete Row</h3>
              <p className="text-gray-400 text-sm text-center mb-6">
                Are you sure you want to delete <span className="text-white font-semibold">{rowToDelete.feature}</span>? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setRowToDelete(null)}
                  className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRow}
                  className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
