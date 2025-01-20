import { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AIScheduleAssistant } from "./AIScheduleAssistant";

interface ChatDialogProps {
  trigger?: React.ReactNode;
  className?: string;
  currentPage: string;
  pageContext?: Record<string, any>;
}

export function ChatDialog({ trigger, className, currentPage, pageContext = {} }: ChatDialogProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    console.log("ChatDialog received pageContext:", pageContext);
  }, [pageContext]);

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
            <span className="sr-only">Open AI Assistant</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Schedule Assistant</DialogTitle>
        <AIScheduleAssistant 
          currentPage={currentPage} 
          pageContext={{
            ...pageContext,
            shifts: Array.isArray(pageContext?.shifts) ? pageContext.shifts : []
          }} 
        />
      </DialogContent>
    </Dialog>
  );
}