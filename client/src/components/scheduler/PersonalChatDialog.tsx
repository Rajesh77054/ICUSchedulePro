
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChatDialog } from "./ChatDialog";

export function PersonalChatDialog({ pathname }: { pathname: string }) {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || '0');

  const { data: shifts } = useQuery({
    queryKey: ["/api/shifts", userId],
    queryFn: async () => {
      const res = await fetch(`/api/shifts?userId=${userId}`);
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const data = await res.json();
      console.log("Fetched shifts:", data);
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  const { data: swapRequests } = useQuery({
    queryKey: ['/api/swap-requests', userId],
    queryFn: async () => {
      const res = await fetch(`/api/swap-requests?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch swap requests');
      return res.json();
    },
    enabled: !!userId
  });

  // Convert swapRequests to requests for consistency
  const pageContext = {
    shifts: shifts?.map(shift => ({
      ...shift,
      startDate: new Date(shift.startDate).toISOString(),
      endDate: new Date(shift.endDate).toISOString()
    })) || [],
    requests: swapRequests || [],
    userId
  };
  
  console.log("PersonalChatDialog pageContext:", pageContext);

  return (
    <ChatDialog 
      currentPage="provider"
      pageContext={pageContext}
    />
  );
}
