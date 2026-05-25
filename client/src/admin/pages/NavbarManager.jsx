import { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { Pencil, Trash2, Search, Loader2 } from 'lucide-react';

const NavbarManager = ({ isNested = false }) => {
  const [links, setLinks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');

  const limit = 10;

  const fetchLinks = async () => {
    setIsLoading(true);
    try {
      const data = await contentService.getNavbarLinksAdmin(page, limit, search);
      setLinks(data.data);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch navbar links:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [page, search]);

  const handleEditClick = (link) => {
    setEditingId(link._id);
    setEditLabel(link.label);
  };

  const handleSaveEdit = async (id) => {
    try {
      await contentService.renameNavbarLink(id, editLabel);
      setEditingId(null);
      fetchLinks();
    } catch (error) {
      alert('Failed to rename link: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this navbar link?')) {
      try {
        await contentService.deleteNavbarLink(id);
        fetchLinks();
      } catch (error) {
        alert('Failed to delete link: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className={isNested ? "space-y-6" : "mx-auto max-w-5xl space-y-6"}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {!isNested ? (
          <div>
            <h1 className="text-2xl font-bold text-white">Manage Navbar</h1>
            <p className="mt-1 text-sm text-gray-400">
              Rename or remove items from the top navigation bar.
            </p>
          </div>
        ) : <div />}
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search links..." 
            className="w-full pl-9 pr-4 py-2 bg-[#1A1A1A] border border-white/10 rounded-lg text-gray-100 placeholder-gray-500 focus:ring-[#FF6B00] focus:border-[#FF6B00] sm:text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset page on search
            }}
          />
        </div>
      </div>

      <div className="bg-[#222222] shadow-xl border border-white/10 rounded-xl overflow-hidden">
        {isLoading && links.length === 0 ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-[#1A1A1A]">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Label
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Path
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Order
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[#222222] divide-y divide-white/10">
                {links.length > 0 ? links.map((link) => (
                  <tr key={link._id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">
                      {editingId === link._id ? (
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="border border-white/10 bg-[#1A1A1A] rounded px-2 py-1 text-white focus:ring-[#FF6B00] focus:border-[#FF6B00]"
                          autoFocus
                        />
                      ) : (
                        link.label
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {link.path}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {link.order}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {editingId === link._id ? (
                        <>
                          <button onClick={() => handleSaveEdit(link._id)} className="text-green-600 hover:text-green-900">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-gray-600 hover:text-gray-900">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleEditClick(link)} className="text-[#FF6B00] hover:text-[#e66000]" title="Rename">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(link._id)} className="text-red-500 hover:text-red-400" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                      No navbar links found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-[#1A1A1A] px-4 py-3 border-t border-white/10 flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-gray-300 bg-[#222222] hover:bg-[#2d2d33] disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-400 self-center">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-gray-300 bg-[#222222] hover:bg-[#2d2d33] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavbarManager;
