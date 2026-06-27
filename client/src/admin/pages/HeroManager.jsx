import { useHero, useUpdateHero } from '../../hooks/useHero';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import { Loader2 } from 'lucide-react';

const heroFormConfig = [
  { type: 'text', label: 'Tagline', name: 'tagline' },
  { type: 'text', label: 'Main Heading', name: 'heading', required: true },
  { type: 'textarea', label: 'Subheading', name: 'subheading' },
  { type: 'text', label: 'Primary Button Text', name: 'primaryButtonText', required: true },
  { type: 'text', label: 'Primary Button Link (e.g. /get-quote)', name: 'primaryButtonLink', required: true },
  { type: 'text', label: 'Secondary Button Text', name: 'secondaryButtonText' },
  { type: 'text', label: 'Secondary Button Link (e.g. /services)', name: 'secondaryButtonLink' },
  { type: 'text', label: 'Background Image URL', name: 'backgroundImageUrl' },
  { type: 'text', label: 'Background Video URL (e.g. Cloudinary mp4 link)', name: 'backgroundVideoUrl' },
  { type: 'boolean', label: 'Active', name: 'isActive' }
];

const HeroManager = ({ isNested = false }) => {
  const { data: heroData, isLoading, isError } = useHero();
  const updateHeroMutation = useUpdateHero();

  const handleSubmit = (data) => {
    updateHeroMutation.mutate(data, {
      onSuccess: () => {
        alert('Hero section updated successfully!');
      },
      onError: (err) => {
        console.error("Update failed", err);
        alert('Failed to update hero section: ' + (err.response?.data?.message || err.message));
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-900/50 border border-red-500/50 p-4 text-red-200">
        Error loading hero data. Make sure backend is running.
      </div>
    );
  }

  // Fallback defaults if no hero exists yet
  const defaultInitial = {
    tagline: '',
    heading: '',
    subheading: '',
    primaryButtonText: '',
    primaryButtonLink: '',
    secondaryButtonText: '',
    secondaryButtonLink: '',
    description: '',
    backgroundImageUrl: '',
    backgroundVideoUrl: '',
    isActive: true,
  };

  return (
    <div className={isNested ? "space-y-6" : "mx-auto max-w-4xl space-y-6"}>
      {!isNested && (
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Hero Section</h1>
          <p className="mt-1 text-sm text-gray-400">
            Update the content and image for the main landing area of the website.
          </p>
        </div>
      )}

      <div className="rounded-xl bg-[#222222] p-6 shadow-xl border border-white/10">
        <DynamicFormRenderer
          config={heroFormConfig}
          initialData={heroData || defaultInitial}
          onSubmit={handleSubmit}
          isLoading={updateHeroMutation.isPending}
        />
      </div>
    </div>
  );
};

export default HeroManager;
