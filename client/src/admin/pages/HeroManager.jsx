import { useHero, useUpdateHero } from '../../hooks/useHero';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import { Loader2 } from 'lucide-react';

const heroFormConfig = [
  { type: 'text', label: 'Main Heading', name: 'heading', required: true },
  { type: 'textarea', label: 'Subheading', name: 'subheading' },
  { type: 'text', label: 'Primary Button Text', name: 'primaryButtonText', required: true },
  { type: 'url', label: 'Primary Button Link', name: 'primaryButtonLink', required: true },
  { type: 'text', label: 'Secondary Button Text', name: 'secondaryButtonText' },
  { type: 'url', label: 'Secondary Button Link', name: 'secondaryButtonLink' },
  { type: 'image', label: 'Background Image', name: 'backgroundImageUrl' },
  { type: 'boolean', label: 'Active', name: 'isActive' }
];

const HeroManager = () => {
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
      <div className="rounded-md bg-red-50 p-4 text-red-700">
        Error loading hero data. Make sure backend is running.
      </div>
    );
  }

  // Fallback defaults if no hero exists yet
  const defaultInitial = {
    heading: '',
    subheading: '',
    primaryButtonText: '',
    primaryButtonLink: '',
    secondaryButtonText: '',
    secondaryButtonLink: '',
    backgroundImageUrl: '',
    backgroundImagePublicId: '',
    isActive: true,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Hero Section</h1>
        <p className="mt-1 text-sm text-gray-500">
          Update the content and image for the main landing area of the website.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
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
