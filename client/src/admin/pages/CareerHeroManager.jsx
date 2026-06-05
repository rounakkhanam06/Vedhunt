import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useCareerHero, useUpdateCareerHero } from '../../hooks/useCareerHero';
import { Loader2, Plus, Trash2 } from 'lucide-react';

const CareerHeroManager = ({ isNested = false }) => {
  const { data: heroData, isLoading, isError } = useCareerHero();
  const updateHeroMutation = useUpdateCareerHero();

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      headingTop: '',
      headingHighlight: '',
      description: '',
      benefits: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "benefits"
  });

  useEffect(() => {
    if (heroData?.data) {
      const data = heroData.data;
      reset({
        headingTop: data.headingTop || '',
        headingHighlight: data.headingHighlight || '',
        description: data.description || '',
        benefits: (data.benefits && data.benefits.length > 0) ? data.benefits.map(b => ({ value: b })) : []
      });
    }
  }, [heroData, reset]);

  const onSubmit = (formData) => {
    // Transform benefits back to simple array of strings
    const payload = {
      ...formData,
      benefits: formData.benefits.map(b => b.value).filter(val => val.trim() !== '')
    };
    
    updateHeroMutation.mutate(payload, {
      onSuccess: () => {
        alert('Career Hero section updated successfully!');
      },
      onError: (err) => {
        console.error("Update failed", err);
        alert('Failed to update career hero section: ' + (err.response?.data?.message || err.message));
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md bg-red-900/50 border border-red-500/50 p-4 text-red-200">
        Error loading career hero data. Make sure backend is running.
      </div>
    );
  }

  return (
    <div className={isNested ? "space-y-6" : "mx-auto max-w-4xl space-y-6"}>
      {!isNested && (
        <div>
          <h1 className="text-2xl font-bold text-white">Manage Career Hero Section</h1>
          <p className="mt-1 text-sm text-gray-400">
            Update the title, description, and benefits list for the career page header.
          </p>
        </div>
      )}

      <div className="rounded-xl bg-[#222222] p-6 shadow-xl border border-white/10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-gray-300">Top Heading Text (e.g. Join the)</label>
              <input
                {...register("headingTop")}
                type="text"
                className="rounded-md border border-white/10 bg-[#1A1A1A] px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
              />
            </div>
            
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-gray-300">Highlighted Text (e.g. Vedhunt Team)</label>
              <input
                {...register("headingHighlight")}
                type="text"
                className="rounded-md border border-white/10 bg-[#1A1A1A] px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-gray-300">Description</label>
            <textarea
              {...register("description")}
              rows={3}
              className="rounded-md border border-white/10 bg-[#1A1A1A] px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300 block">Why Work With Us (Benefits List)</label>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3">
                  <input
                    {...register(`benefits.${index}.value`, { required: true })}
                    placeholder="e.g. Flexible Work"
                    className="flex-1 rounded-md border border-white/10 bg-[#1A1A1A] px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="rounded-md bg-red-900/50 p-2 text-red-400 hover:bg-red-900/70 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => append({ value: '' })}
              className="mt-3 flex items-center gap-2 rounded-md bg-white/5 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Benefit
            </button>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={updateHeroMutation.isPending}
              className="flex justify-center rounded-md border border-transparent bg-[#FF6B00] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#e66000] focus:outline-none disabled:opacity-50 transition-colors"
            >
              {updateHeroMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CareerHeroManager;
