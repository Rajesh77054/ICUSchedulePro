
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
  provider: [
    "Want to update your schedule preferences?",
    "Need to request time off?",
    "Would you like to see your monthly schedule summary?",
  ],
  'swap-requests': [
    "Need help reviewing swap requests?",
    "Want to submit a new swap request?",
    "Would you like to check the status of your requests?",
  ],
  'time-off': [
    "Need to submit a time-off request?",
    "Want to check your time-off balance?",
    "Would you like to view approved time-off dates?",
  ],
  preferences: [
    "Want to update your scheduling preferences?",
    "Need to set your availability?",
    "Would you like to review your current settings?",
  ],
  users: [
    "Need help managing user accounts?",
    "Want to review user permissions?",
    "Would you like to update user schedules?",
  ],
  schedule: [
    "Need help with schedule conflicts?",
    "Want to review coverage patterns?",
    "Would you like to generate a new schedule?",
  ],
  analytics: [
    "Need help analyzing scheduling patterns?",
    "Want to review coverage metrics?",
    "Would you like to generate a report?",
  ],
};

export function AIScheduleAssistant({ currentPage }: { currentPage: string }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    const currentContext = currentPage.split('/').pop() || 'dashboard';
    const pageSuggestions = pageContextSuggestions[currentContext] || pageContextSuggestions['dashboard'];
    
    // Clear existing messages and set new context-aware ones
    setMessages([
      {
        id: Date.now(),
        content: `Hello! I'm your schedule assistant. How can I help you with ${currentContext}?`,
        type: 'assistant',
        createdAt: new Date().toISOString(),
      },
      ...pageSuggestions.map((suggestion, index) => ({
        id: Date.now() + index + 1,
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

    // Show typing indicator
    setMessages(prev => [...prev, {
      id: Date.now(),
      content: "Thinking...",
      type: 'assistant',
      createdAt: new Date().toISOString(),
    }]);

    // Generate contextual response based on current page and query
    const generateResponse = (query: string) => {
      const responses: Record<string, string[]> = {
        dashboard: [
          "I can help you review your upcoming shifts. Would you like to see your schedule for this week?",
          "I can assist with submitting a shift swap request. Would you like to proceed?",
          "Let me check the available coverage options for you.",
        ],
        personal: [
          "I can help update your schedule preferences. What would you like to modify?",
          "Would you like to submit a time-off request?",
          "I can show you a summary of your monthly schedule.",
        ],
        admin: [
          "I can help you review pending requests. How many would you like to see?",
          "Let me check for any scheduling conflicts.",
          "I can analyze coverage patterns for you.",
        ],
      };

      const pageResponses = responses[currentPage] || responses['dashboard'];
      const response = pageResponses[Math.floor(Math.random() * pageResponses.length)];
      
      return response + "\n\nIs there anything specific you'd like to know about this?";
    };

    // Remove typing indicator and add actual response
    setTimeout(() => {
      setMessages(prev => {
        const withoutTyping = prev.filter(msg => msg.content !== "Thinking...");
        return [...withoutTyping, {
          id: Date.now(),
          content: generateResponse(content),
          type: 'assistant',
          createdAt: new Date().toISOString(),
        }];
      });
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
