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

const ChatDialog = React.memo(({ pageContext }: ChatDialogProps) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ai");
  const [pageContextError, setPageContextError] = useState<Error | null>(null);

  useEffect(() => {
    if (!pageContext) return;

    try {
      console.log("ChatDialog received pageContext:", pageContext);
    } catch (error) {
      console.error("ChatDialog pageContextError:", error);
    }
  }, [pageContext]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pageContext?.shifts) {
      console.error('ChatDialog: Missing page context');
      return;
    }
    try {
      //Simulate an async operation that might throw an error.  Replace with actual logic.
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('handleSubmit error:', error);
      // Add proper error handling here.
    }
  }, [pageContext]);

  // Placeholder for more robust error handling in Chat component
  const handleChatError = (error: Error) => {
    console.error("Error in Chat component:", error);
    // Implement proper error handling and potentially prevent recursive calls.
  };


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
              pageContext={pageContext}
              onSubmit={handleSubmit}
            />
          </TabsContent>
          <TabsContent value="team">
            {/* Add error handling to prevent recursive calls */}
            <Chat roomId={1} onError={handleChatError} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
});

export default ChatDialog;