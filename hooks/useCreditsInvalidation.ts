import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { CACHE_KEYS } from '@/config/constants';

/**
 * Hook utilitaire pour invalider les crédits dans le cache React Query
 * Utilise l'ID de l'utilisateur de la session pour cibler la bonne query
 */
export function useCreditsInvalidation() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const invalidateCredits = async () => {
    const userId = session?.user?.id;
    if (userId) {
      try {
        // First try to refetch the query
        await queryClient.refetchQueries({ 
          queryKey: [CACHE_KEYS.CREDITS, userId]
        });
      } catch (error) {
        // Fallback: invalidate and let the query refetch naturally
        queryClient.invalidateQueries({ 
          queryKey: [CACHE_KEYS.CREDITS, userId]
        });
      }
    }
  };

  const updateCreditsCache = async (newBalance: number) => {
    const userId = session?.user?.id;
    if (userId) {
      // Update the cache directly with the new balance
      queryClient.setQueryData([CACHE_KEYS.CREDITS, userId], {
        allowed: true,
        balance: newBalance
      });
      console.log('🔄 [CreditsInvalidation] Cache updated with balance:', newBalance);
    }
  };

  return { invalidateCredits, updateCreditsCache };
}
