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
            <h1 className="text-2xl font-bold text-app-text">Manage Navbar</h1>
            <p className="mt-1 text-sm text-app-text-muted">
              Rename or remove items from the top navigation bar.
            </p>
          </div>
        ) : <div />}
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search links..." 
            className="w-full pl-9 pr-4 py-2 bg-form-input-bg border border-app-border rounded-lg text-app-text placeholder-app-text-muted focus:ring-[#FF6B00] focus:border-[#FF6B00] sm:text-sm outline-none transition-colors"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset page on search
            }}
          />
        </div>
      </div>

      <div className="bg-app-card shadow-sm border border-app-border rounded-xl overflow-hidden">
        {isLoading && links.length === 0 ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF6B00]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-app-border">
              <thead className="bg-surface-variant">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase tracking-wider">
                    Label
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase tracking-wider">
                    Path
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase tracking-wider">
                    Order
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-app-card divide-y divide-app-border">
                {links.length > 0 ? links.map((link) => (
                  <tr key={link._id} className="hover:bg-surface-variant transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-app-text">
                      {editingId === link._id ? (
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="border border-app-border bg-form-input-bg rounded-lg px-2.5 py-1 text-app-text focus:ring-[#FF6B00] focus:border-[#FF6B00] outline-none"
                          autoFocus
                        />
                      ) : (
                        link.label
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text-muted">
                      {link.path}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text-muted">
                      {link.order}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {editingId === link._id ? (
                        <>
                          <button onClick={() => handleSaveEdit(link._id)} className="text-emerald-600 hover:text-emerald-700 font-semibold">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-app-text-muted hover:text-app-text">Cancel</button>
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
                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-app-text-muted">
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
          <div className="bg-app-card px-4 py-3 border-t border-app-border flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-app-border text-sm font-medium rounded-lg text-app-text bg-surface-variant hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-app-text-muted self-center">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="relative inline-flex items-center px-4 py-2 border border-app-border text-sm font-medium rounded-lg text-app-text bg-surface-variant hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
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
