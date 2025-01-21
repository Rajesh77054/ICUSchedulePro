
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { USERS } from '../lib/constants';
import type { User } from '../lib/types';

export function useSyncUsers() {
  const queryClient = useQueryClient();

  const { data: dbUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Compare and update if needed
  const syncUsers = () => {
    const hasChanges = dbUsers.some(dbUser => {
      const constUser = USERS.find(u => u.id === dbUser.id);
      return !constUser || 
        constUser.title !== dbUser.title || 
        constUser.userType !== dbUser.userType;
    });

    if (hasChanges) {
      // Force a refetch to update the cache
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    }
  };

  return { syncUsers, users: dbUsers };
}
