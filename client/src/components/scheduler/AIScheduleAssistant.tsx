
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Send, Bot, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

interface Message {
  id: number;
  content: string;
  type: 'user' | 'assistant';
  suggestion?: boolean;
  createdAt: string;
}

const pageContextSuggestions: Record<string, string[]> = {
  dashboard: [
    "Would you like to review your upcoming shifts?",
    "Need help with a shift swap request?",
    "Want to check available coverage options?",
  ],
  personal: [
    "Want to update your schedule preferences?",
    "Need to request time off?",
    "Would you like to see your monthly schedule summary?",
  ],
  admin: [
    "Need help reviewing pending requests?",
    "Want to check scheduling conflicts?",
    "Would you like to analyze coverage patterns?",
  ],
};

export function AIScheduleAssistant({ currentPage }: { currentPage: string }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    // Add initial context-aware greeting
    const pageSuggestions = pageContextSuggestions[currentPage] || [];
    setMessages([
      {
        id: 1,
        content: `Hello! I'm your schedule assistant. How can I help you with ${currentPage}?`,
        type: 'assistant',
        createdAt: new Date().toISOString(),
      },
      ...pageSuggestions.map((suggestion, index) => ({
        id: index + 2,
        content: suggestion,
        type: 'assistant',
        suggestion: true,
        createdAt: new Date().toISOString(),
      })),
    ]);
  }, [currentPage]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollArea = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now(),
      content,
      type: 'user',
      createdAt: new Date().toISOString(),
    }]);
    setMessage('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: `I understand you want to ${content}. Let me help you with that...`,
        type: 'assistant',
        createdAt: new Date().toISOString(),
      }]);
    }, 1000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  return (
    <div className="flex flex-col h-[500px]">
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] rounded-lg p-3 
                  ${msg.type === 'user' 
                    ? 'bg-primary text-primary-foreground ml-4' 
                    : 'bg-muted'
                  }
                  ${msg.suggestion ? 'cursor-pointer hover:bg-secondary' : ''}
                `}
                onClick={msg.suggestion ? () => handleSuggestionClick(msg.content) : undefined}
              >
                {msg.type === 'assistant' && !msg.suggestion && (
                  <Bot className="h-4 w-4 mb-1" />
                )}
                <p className="text-sm">{msg.content}</p>
                <span className="text-xs opacity-70">
                  {format(new Date(msg.createdAt), 'HH:mm')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(message);
          }}
          className="flex gap-2"
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask me anything about scheduling..."
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
