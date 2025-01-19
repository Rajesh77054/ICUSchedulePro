import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Send, Bot, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

interface PageContext {
  shifts?: any[];
  requests?: any[];
  analytics?: any[];
  users?: any[];
}

interface Message {
  id: number;
  content: string;
  type: 'user' | 'assistant';
  suggestion?: boolean;
  createdAt: string;
}

interface AIScheduleAssistantProps {
  currentPage: string;
  pageContext: PageContext;
}

const defaultPageContext: PageContext = {
  shifts: [],
  requests: [],
  analytics: [],
  users: []
};

const pageContextSuggestions: Record<string, string[]> = {
  dashboard: [
    "Would you like to review your upcoming shifts?",
    "Need help with a shift swap request?",
    "Want to check available coverage options?",
  ],
  'my-schedule': [
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
  analytics: [
    "Need help analyzing scheduling patterns?",
    "Want to review coverage metrics?",
    "Would you like to generate a report?",
  ],
  schedule: [
    "Need help with schedule conflicts?",
    "Want to review coverage patterns?",
    "Would you like to generate a new schedule?",
  ],
  'personal-dashboard': [
    "Want to review your upcoming shifts?",
    "Need help with shift swaps?",
    "Would you like to request time off?",
    "Want to check your schedule progress?",
  ],
  'time-off-admin': [
    "Need to review pending time-off requests?",
    "Want to check coverage during time-off periods?",
    "Would you like to create a time-off request for someone?",
    "Need to analyze time-off patterns?",
  ],
  'provider': [
    "Want to update your schedule preferences?",
    "Need to request time off?",
    "Would you like to see your monthly schedule summary?",
  ]
};

const generatePageGreeting = (page: string) => {
  const greetings: Record<string, string> = {
    dashboard: "Hello! I'm your schedule assistant. How can I help you manage your schedule today?",
    'my-schedule': "Welcome to your personal schedule! How can I assist you with your shifts?",
    'swap-requests': "Looking to manage shift swaps? I can help you review and handle requests.",
    'time-off': "Need help with time-off management? I'm here to assist!",
    preferences: "Let's help you customize your scheduling preferences.",
    users: "Need help with user management? I can assist with that!",
    analytics: "Ready to analyze scheduling data? What metrics would you like to explore?",
    schedule: "Let's help you manage the schedule. What would you like to do?",
    provider: "Welcome to your provider dashboard! How can I assist you today?",
    'personal-dashboard': "Welcome to your personal dashboard! How can I help you today?",
    'time-off-admin': "Welcome to the time-off admin panel. How can I assist you?"
  };

  return greetings[page] || "Hello! I'm your schedule assistant. How can I help you today?";
};

export function AIScheduleAssistant({ currentPage, pageContext = defaultPageContext }: AIScheduleAssistantProps) {
  const [contextLoaded, setContextLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const currentContext = currentPage.toLowerCase().split('/').pop() || 'dashboard';

  useEffect(() => {
    console.log("AIScheduleAssistant received context:", pageContext);
    if (pageContext?.shifts?.length > 0) {
      console.log("Valid shifts found:", pageContext.shifts.length);
      setContextLoaded(true);
    }
  }, [pageContext]);

  useEffect(() => {
    const pageSuggestions = pageContextSuggestions[currentContext] || pageContextSuggestions['dashboard'];
    const greeting = generatePageGreeting(currentContext);

    setMessages([
      {
        id: Date.now(),
        content: greeting,
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
  }, [currentPage, currentContext]);

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

    // Get last message for context
    const lastMessage = messages[messages.length - 1];
    const input = content.toLowerCase();

    setMessages(prev => [...prev, {
      id: Date.now(),
      content,
      type: 'user',
      createdAt: new Date().toISOString(),
    }]);
    setMessage('');

    // Handle conversation flow
    let contextualResponse = '';

    if (lastMessage?.content.includes("Would you like to review your upcoming shifts?") && 
        (input.includes("yes") || input.includes("sure") || input.includes("okay"))) {
      const upcomingShifts = (pageContext?.shifts || []).filter(shift => {
        if (!shift?.endDate) return false;
        return new Date(shift.endDate) > new Date();
      });

      if (upcomingShifts.length > 0) {
        contextualResponse = `Here are your upcoming shifts:\n`;
        upcomingShifts.forEach(shift => {
          const startDate = format(new Date(shift.startDate), 'MMM d, yyyy');
          const endDate = format(new Date(shift.endDate), 'MMM d, yyyy');
          contextualResponse += `\n• ${startDate} - ${endDate} (${shift.status})`;
        });
      } else {
        contextualResponse = "You don't have any upcoming shifts scheduled.";
      }
    } else if (input.toLowerCase().includes('schedule a new shift') || input.toLowerCase().includes("let's schedule")) {
      contextualResponse = "I'll help you schedule a new shift. Click the calendar icon to open the scheduling interface, or you can click any empty time slot on the calendar to start scheduling.";
    } else if (input.includes('shift') || input.includes('schedule')) {
      console.log('Processing shifts from context:', pageContext?.shifts);

      const upcomingShifts = (pageContext?.shifts || []).filter(shift => {
        if (!shift || !shift.endDate) return false;
        const endDate = new Date(shift.endDate);
        const isUpcoming = endDate > new Date();
        console.log(`Shift ${shift?.id} end date:`, endDate, 'is upcoming:', isUpcoming);
        return isUpcoming;
      });

      console.log('Filtered upcoming shifts:', upcomingShifts);

      if (upcomingShifts && upcomingShifts.length > 0) {
        contextualResponse = `You have ${upcomingShifts.length} upcoming shifts:\n`;
        upcomingShifts.forEach(shift => {
          const startDate = format(new Date(shift.startDate), 'MMM d, yyyy');
          const endDate = format(new Date(shift.endDate), 'MMM d, yyyy');
          contextualResponse += `\n• ${startDate} - ${endDate} (${shift.status})`;
        });
      } else {
        contextualResponse = "You don't have any shifts scheduled yet. Would you like to add some?";
      }
    } else if (input.includes('swap') || input.includes('trade')) {
      if (pageContext?.requests?.length) {
        contextualResponse = `You have ${pageContext.requests.length} pending swap requests. Would you like to review them?`;
      } else {
        contextualResponse = "No pending swap requests. Would you like to initiate a shift swap?";
      }
    } else if (input.includes('time off') || input.includes('leave')) {
      contextualResponse = "I can help you submit a time-off request. Would you like to proceed?";
    } else if (input.includes('coverage') || input.includes('available')) {
      contextualResponse = "Let me check the coverage for you. What dates are you interested in?";
    } else {
      // Default responses based on current page context
      const responses = pageContextSuggestions[currentContext] || pageContextSuggestions['dashboard'];
      contextualResponse = responses[Math.floor(Math.random() * responses.length)];
    }

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: contextualResponse,
        type: 'assistant',
        createdAt: new Date().toISOString(),
      }]);
    }, 500);
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