import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Settings, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { USERS } from "@/lib/constants";
import type { TimeOffRequest } from "@/lib/types";
import { TimeOffRequestForm } from "./TimeOffRequestForm";

export function TimeOffRequests() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | undefined>(undefined);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Time Off Requests</h2>
          <div className="flex items-center gap-4">
            <Button onClick={() => setDialogOpen(true)}>New Request</Button>
            <Link href="/admin/time-off">
              <Button variant="outline" size="icon" title="Manage Time Off Requests">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Time Off</DialogTitle>
            </DialogHeader>
            <TimeOffRequestForm
              onSuccess={() => setDialogOpen(false)}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Placeholder for the rest of the component */}
      </div>
    </div>
  );
}