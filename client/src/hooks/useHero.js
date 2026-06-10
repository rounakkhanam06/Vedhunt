import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { heroService } from '../services/heroService';

export const useHero = () => {
  return useQuery({
    queryKey: ['hero'],
    queryFn: heroService.getHero,
    staleTime: 2 * 60 * 1000, // 2 minutes — hero data rarely changes
  });
};

export const useUpdateHero = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: heroService.updateHero,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['hero'] });
    },
  });
};
