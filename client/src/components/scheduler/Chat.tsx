import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Send, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  const { data: room } = useQuery<ChatRoom>({
    queryKey: ['/api/chat/rooms', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/rooms/${roomId}`);
      if (!res.ok) throw new Error('Failed to fetch room details');
      return res.json();
    },
  });

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chat/messages', roomId],
    queryFn: async () => {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
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

  if (!room) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <p>Loading chat room...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="px-4 py-2">
        <CardTitle className="text-lg">{room.name}</CardTitle>
      </CardHeader>
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
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
                <div className="mt-1 p-2 bg-red-100 dark:bg-red-900 rounded-md">
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
