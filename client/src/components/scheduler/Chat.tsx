import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Send, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: number;
  content: string;
  sender: {
    name: string;
    title: string;
  };
  messageType: 'text' | 'shift_swap' | 'urgent_coverage';
  metadata: any;
  createdAt: string;
}

interface ChatRoom {
  id: number;
  name: string;
  type: 'group' | 'direct';
  members: Array<{
    id: number;
    name: string;
    title: string;
  }>;
}

export function Chat({ roomId }: { roomId: number }) {
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: room, isLoading: isLoadingRoom, error: roomError } = useQuery<ChatRoom>({
    queryKey: ['/api/chat/rooms', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/rooms/${roomId}`);
      if (!res.ok) throw new Error('Failed to fetch room details');
      return res.json();
    },
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/messages', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    enabled: !!room, // Only fetch messages if room exists
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages', roomId] });
      setMessage('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage.mutate(message);
    }
  };

  if (isLoadingRoom || isLoadingMessages) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>Loading chat...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (roomError) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load chat room. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!room) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Chat room not found or you don't have access.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardContent className="flex-1 p-0">
        <ScrollArea ref={scrollRef} className="h-full">
          <div className="p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{msg.sender.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.createdAt), 'h:mm a')}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
                {msg.messageType === 'urgent_coverage' && (
                  <div className="mt-1 p-2 bg-destructive/10 text-destructive rounded-md">
                    <p className="text-sm font-medium">Urgent Coverage Needed</p>
                    <p className="text-xs">
                      {format(new Date(msg.metadata.shift.startDate), 'MMM d, yyyy h:mm a')} -{' '}
                      {format(new Date(msg.metadata.shift.endDate), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <form onSubmit={handleSend} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={sendMessage.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}