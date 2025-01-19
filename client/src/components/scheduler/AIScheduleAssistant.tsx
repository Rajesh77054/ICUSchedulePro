import { useState, useEffect, useRef } from 'react';
import { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@/hooks/use-user";
import { ShiftDialog } from "./ShiftDialog";
import { format } from 'date-fns';

interface AIScheduleAssistantProps {
  currentPage: string;
  pageContext?: Record<string, any>;
}

export function AIScheduleAssistant({ currentPage, pageContext = {} }: AIScheduleAssistantProps) {
  const [messages, setMessages] = useState([{
    id: '1',
    role: 'assistant',
    content: `Hello! I'm your schedule assistant. How can I help you manage your schedule today?`
  }]);
  const [input, setInput] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });
      
      const data = await response.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content
      }]);
    } catch (error) {
      console.error('Chat error:', error);
    }
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{start: Date, end: Date} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);


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
      {selectedDates && (
        <ShiftDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          startDate={selectedDates.start}
          endDate={selectedDates.end}
        />
      )}
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
                <p className="text-sm">{message.content}</p>
                {/* Removed unnecessary action handling  */}
                <span className="text-xs opacity-70">
                  {message.createdAt && format(new Date(message.createdAt), 'HH:mm')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask me anything about scheduling..."
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}