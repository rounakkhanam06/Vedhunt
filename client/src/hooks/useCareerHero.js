import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentService } from '../services/contentService';

export const useCareerHero = () => {
  return useQuery({
    queryKey: ['careerHero'],
    queryFn: contentService.getCareerHero,
  });
};

export const useUpdateCareerHero = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: contentService.updateCareerHero,
    onSuccess: () => {
      queryClient.invalidateQueries(['careerHero']);
    },
  });
};
