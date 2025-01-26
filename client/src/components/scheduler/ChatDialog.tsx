import { useState, useEffect, useCallback } from "react";
import { Bot, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AIScheduleAssistant } from "./AIScheduleAssistant";
import { Chat } from "./Chat";

interface ChatDialogProps {
  trigger?: React.ReactNode;
  className?: string;
  currentPage: string;
  pageContext?: Record<string, any>;
}

export function ChatDialog({ trigger, className, currentPage, pageContext = {} }: ChatDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ai");
  const [shiftsError, setShiftsError] = useState<Error | null>(null); //Added to handle errors

  useEffect(() => {
    console.log("ChatDialog received pageContext:", pageContext);
  }, [pageContext]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pageContext?.shifts) {
      console.error('ChatDialog: Missing page context');
      if (shiftsError) {
        console.error("Error fetching shifts:", shiftsError); //Added error handling
      }
      return;
    }
  }, [pageContext, shiftsError]);

  //Simulate fetching shifts with error handling (replace with actual useQuery)
  const [shifts, setShifts] = useState<any[]>([]);
  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const response = await fetch('/api/shifts');
        if (!response.ok) {
          if (response.status === 401) {
            setShifts([]); //Handle auth error
            setShiftsError(new Error("Authentication failed"));
          } else {
            throw new Error(`Failed to fetch shifts: ${response.status}`);
          }
        } else {
          const data = await response.json();
          setShifts(data);
          setShiftsError(null);
        }
      } catch (error) {
        setShiftsError(error as Error);
        console.error("Error fetching shifts:", error);
      }
    };
    fetchShifts();
  }, []);


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="icon"
            className={`${className} hover:bg-primary hover:text-primary-foreground transition-colors`}
          >
            <Bot className="h-5 w-5" />
            <span className="sr-only">Open Chat</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chat</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="ai" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai">
              <Bot className="h-4 w-4 mr-2" />
              Schedule Assistant
            </TabsTrigger>
            <TabsTrigger value="team">
              <MessageSquare className="h-4 w-4 mr-2" />
              Team Chat
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ai">
            <AIScheduleAssistant
              currentPage={currentPage}
              pageContext={{...pageContext, shifts}} //Added shifts to pageContext
              onSubmit={handleSubmit}
            />
          </TabsContent>
          <TabsContent value="team">
            <Chat roomId={1} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}