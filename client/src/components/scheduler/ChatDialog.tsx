import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Chat } from "./Chat";

interface ChatDialogProps {
  roomId?: number;
  trigger?: React.ReactNode;
  className?: string;
}

export function ChatDialog({ roomId = 1, trigger, className }: ChatDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="icon"
            className={className}
          >
            <MessageCircle className="h-5 w-5" />
            <span className="sr-only">Open chat</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Team Chat</DialogTitle>
        </DialogHeader>
        <Chat roomId={roomId} />
      </DialogContent>
    </Dialog>
  );
}
