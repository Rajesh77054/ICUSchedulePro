import { useState, useEffect, useRef } from 'react';
import { Bot, Send } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from '@tanstack/react-query';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

interface AIScheduleAssistantProps {
  currentPage: string;
  pageContext?: Record<string, any>;
}

interface HistoricalPatterns {
  preferredShifts: any[];
  previousSwaps: any[];
  workloadHistory: any[];
  consecutiveShiftPatterns: any[];
}

export function AIScheduleAssistant({ currentPage, pageContext }: AIScheduleAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    content: "Hello! I'm your AI schedule assistant with pattern learning capabilities. How can I help optimize your schedule today?",
    createdAt: new Date().toISOString()
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch historical patterns data
  const { data: historicalPatterns, isError, error: fetchError } = useQuery<HistoricalPatterns>({
    queryKey: ['/api/scheduling/historical-patterns'],
    queryFn: async () => {
      const response = await fetch('/api/scheduling/historical-patterns');
      if (!response.ok) {
        throw new Error('Failed to fetch historical patterns');
      }
      return response.json();
    }
  });

  // Fetch users data to ensure we have provider information
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input?.trim() || isLoading) {
      setError('Please enter a message');
      return;
    }

    const userMessage = { 
      id: Date.now().toString(),
      role: 'user' as const, 
      content: input,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      // Prepare shifts with user information
      const shiftsWithUsers = pageContext?.shifts?.map((shift: any) => ({
        ...shift,
        provider: users?.find((user: any) => user.id === shift.userId)
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          messages: [...messages, userMessage],
          pageContext: {
            shifts: shiftsWithUsers || [],
            users: users || [],
            currentPage,
            userId: pageContext?.userId,
            historicalPatterns: historicalPatterns || {
              preferredShifts: [],
              previousSwaps: [],
              workloadHistory: [],
              consecutiveShiftPatterns: []
            }
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch response: ${response.status}`);
      }

      const data = await response.json();

      if (!data.content) {
        throw new Error('Invalid response format - missing content');
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        createdAt: new Date().toISOString()
      }]);
    } catch (error: any) {
      console.error('Chat error:', error);
      setError(error.message || 'Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[500px]">
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] rounded-lg p-3 
                  ${message.role === 'user' 
                    ? 'bg-primary text-primary-foreground ml-4' 
                    : 'bg-muted'
                  }
                `}
              >
                {message.role === 'assistant' && (
                  <Bot className="h-4 w-4 mb-1" />
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.role === 'assistant' && historicalPatterns && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <em>Using historical pattern analysis for enhanced recommendations</em>
                  </div>
                )}
              </div>
            </div>
          ))}
          {error && <p className="text-red-500 text-center">{error}</p>}
          {isError && <p className="text-red-500 text-center">Error fetching historical patterns: {fetchError?.message}</p>}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}