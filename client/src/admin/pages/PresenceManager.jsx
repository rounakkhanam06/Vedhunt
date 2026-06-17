import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { contentService } from '../../services/contentService';
import { motion } from 'framer-motion';
import { MapPin, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

export default function PresenceManager() {
  const [header, setHeader] = useState({ titlePrefix: 'Our', highlightedWord: 'Presence', description: '' });
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  
  // Modal / Form state for location
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationForm, setLocationForm] = useState({ name: '', top: '', left: '', delay: 0 });
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  
  const mapRef = useRef(null);

  useEffect(() => {
    fetchPresenceData();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      const scrollY = window.scrollY;
      document.body.classList.add('modal-open');
      document.body.style.top = `-${scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY) * -1);
      }
    };
  }, [isModalOpen]);

  const fetchPresenceData = async () => {
    try {
      const data = await contentService.getPresenceAdmin();
      if (data.header) {
        setHeader({
          titlePrefix: data.header.titlePrefix || 'Our',
          highlightedWord: data.header.highlightedWord || 'Presence',
          description: data.header.description || ''
        });
      }
      if (data.locations) {
        setLocations(data.locations);
      }
    } catch (error) {
      toast.error('Failed to load presence data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveHeader = async () => {
    setIsSavingHeader(true);
    try {
      await contentService.updatePresenceHeader(header);
      toast.success('Header updated successfully');
    } catch (error) {
      toast.error('Failed to update header');
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleMapClick = (e) => {
    if (!mapRef.current) return;
    
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const leftPercent = ((x / rect.width) * 100).toFixed(2);
    const topPercent = ((y / rect.height) * 100).toFixed(2);
    
    setLocationForm({
      ...locationForm,
      left: `${leftPercent}%`,
      top: `${topPercent}%`
    });
    
    if (!isModalOpen) {
      setEditingLocation(null);
      setIsModalOpen(true);
    }
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    setIsSavingLocation(true);
    try {
      if (editingLocation) {
        await contentService.updatePresenceLocation(editingLocation._id, locationForm);
        toast.success('Location updated');
      } else {
        await contentService.createPresenceLocation(locationForm);
        toast.success('Location created');
      }
      fetchPresenceData();
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Failed to save location');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      await contentService.deletePresenceLocation(id);
      toast.success('Location deleted');
      fetchPresenceData();
    } catch (error) {
      toast.error('Failed to delete location');
    }
  };

  const openEditModal = (loc) => {
    setEditingLocation(loc);
    setLocationForm({
      name: loc.name,
      top: loc.top,
      left: loc.left,
      delay: loc.delay || 0
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingLocation(null);
    setLocationForm({ name: '', top: '50%', left: '50%', delay: 0 });
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Manage Presence</h1>
          <p className="text-app-text-muted mt-1">Manage the interactive map section on the homepage.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Form & List */}
        <div className="space-y-8">
          
          {/* Header Editor */}
          <div className="bg-app-bg-secondary p-6 rounded-xl border border-app-border">
            <h2 className="text-lg font-semibold text-app-text mb-4">Section Header</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-app-text-muted mb-1">Title Prefix</label>
                  <input
                    type="text"
                    className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-primary transition-colors"
                    value={header.titlePrefix}
                    onChange={(e) => setHeader({ ...header, titlePrefix: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-app-text-muted mb-1">Highlighted Word</label>
                  <input
                    type="text"
                    className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-primary transition-colors"
                    value={header.highlightedWord}
                    onChange={(e) => setHeader({ ...header, highlightedWord: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-app-text-muted mb-1">Description</label>
                <textarea
                  className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-primary transition-colors min-h-[100px]"
                  value={header.description}
                  onChange={(e) => setHeader({ ...header, description: e.target.value })}
                />
              </div>
              <button
                onClick={handleSaveHeader}
                disabled={isSavingHeader}
                className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {isSavingHeader ? 'Saving...' : 'Save Header'}
              </button>
            </div>
          </div>

          {/* Locations List */}
          <div className="bg-app-bg-secondary p-6 rounded-xl border border-app-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-app-text">Locations</h2>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus size={16} /> Add
              </button>
            </div>
            
            <div className="space-y-3">
              {locations.map((loc) => (
                <div key={loc._id} className="flex items-center justify-between bg-app-bg p-3 rounded-lg border border-app-border">
                  <div>
                    <div className="font-medium text-app-text">{loc.name}</div>
                    <div className="text-xs text-app-text-muted mt-1">Top: {loc.top} | Left: {loc.left}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(loc)}
                      className="p-1.5 text-app-text-muted hover:text-primary transition-colors bg-app-bg-secondary rounded-md"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(loc._id)}
                      className="p-1.5 text-app-text-muted hover:text-red-500 transition-colors bg-app-bg-secondary rounded-md"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {locations.length === 0 && (
                <p className="text-sm text-app-text-muted text-center py-4">No locations added yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Map */}
        <div className="bg-app-bg-secondary p-6 rounded-xl border border-app-border flex flex-col">
          <h2 className="text-lg font-semibold text-app-text mb-2">Interactive Map</h2>
          <p className="text-sm text-app-text-muted mb-6">
            Click anywhere on the map to easily drop a pin and calculate Top/Left percentages.
          </p>
          
          <div className="relative w-full aspect-square flex items-center justify-center bg-[#0a0a0a] rounded-xl overflow-hidden border border-app-border">
            <div 
              ref={mapRef}
              onClick={handleMapClick}
              className="relative w-full h-full cursor-crosshair opacity-70 hover:opacity-100 transition-opacity"
            >
              <img 
                src="/india.svg" 
                alt="India Map" 
                className="w-full h-full object-contain filter invert"
                draggable={false}
              />
              
              {/* Display existing locations */}
              {locations.map((loc, idx) => (
                <div
                  key={loc._id}
                  className="absolute flex flex-col items-center justify-center pointer-events-none"
                  style={{ top: loc.top, left: loc.left }}
                >
                  <div className="relative">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
                    <div className="relative bg-app-bg p-1.5 rounded-full border border-primary/50">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                  <div className="absolute top-full mt-1 whitespace-nowrap bg-app-bg/90 px-2 py-0.5 rounded text-[10px] font-bold text-app-text z-20 border border-app-border">
                    {loc.name}
                  </div>
                </div>
              ))}

              {/* Show temporary pin if modal is open and we have coords */}
              {isModalOpen && (
                <div
                  className="absolute flex flex-col items-center justify-center pointer-events-none z-50"
                  style={{ top: locationForm.top, left: locationForm.left }}
                >
                  <div className="relative">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75 animate-ping" />
                    <div className="relative bg-app-bg p-2 rounded-full border-2 border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                      <MapPin className="w-5 h-5 text-yellow-500" />
                    </div>
                  </div>
                  {locationForm.name && (
                    <div className="absolute top-full mt-2 whitespace-nowrap bg-yellow-500 px-2 py-1 rounded text-xs font-bold text-black shadow-lg">
                      {locationForm.name}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Location Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-app-bg-secondary border border-app-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="flex justify-between items-center p-4 border-b border-app-border">
              <h3 className="text-lg font-bold text-app-text">
                {editingLocation ? 'Edit Location' : 'Add Location'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-app-text-muted hover:text-app-text transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveLocation} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-app-text-muted mb-1">City / Location Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-primary transition-colors"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="e.g. Mumbai"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-app-text-muted mb-1">Top Position (%)</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-primary transition-colors"
                    value={locationForm.top}
                    onChange={(e) => setLocationForm({ ...locationForm, top: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-app-text-muted mb-1">Left Position (%)</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-primary transition-colors"
                    value={locationForm.left}
                    onChange={(e) => setLocationForm({ ...locationForm, left: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-app-text-muted mb-1">Animation Delay (seconds)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="w-full bg-app-bg border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-primary transition-colors"
                  value={locationForm.delay}
                  onChange={(e) => setLocationForm({ ...locationForm, delay: parseFloat(e.target.value) })}
                />
              </div>

              <div className="flex gap-3 pt-2 mt-4 border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-app-text bg-app-bg border border-app-border hover:bg-app-bg-secondary transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLocation}
                  className="flex-1 px-4 py-2 rounded-lg text-white bg-primary hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSavingLocation ? (
                    'Saving...'
                  ) : (
                    <>
                      <Check size={18} /> Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
