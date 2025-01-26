
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2000,
      gcTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: false,
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string, {
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status >= 500) {
            throw new Error(`${res.status}: ${res.statusText}`);
          }
          throw new Error(`${res.status}: ${await res.text()}`);
        }

        return res.json();
      },
    },
    mutations: {
      retry: false,
    }
  },
});
