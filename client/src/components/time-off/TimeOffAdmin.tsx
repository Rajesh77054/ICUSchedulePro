import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, X, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeOffRequestForm } from "./TimeOffRequestForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { USERS } from "@/lib/constants";
import type { TimeOffRequest } from "@/lib/types";

export function TimeOffAdmin() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Existing code for fetching and managing requests remains unchanged

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Manage Time Off Requests</h2>
          <div className="flex items-center gap-4">
            <Select value={selectedUser ?? undefined} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {USERS.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name}, {user.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Request
            </Button>
          </div>
        </div>

        {/* Create Request Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Time Off Request</DialogTitle>
              <DialogDescription>
                Create a time off request on behalf of a user.
              </DialogDescription>
            </DialogHeader>
            <TimeOffRequestForm
              onSuccess={() => {
                setCreateDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
                toast({
                  title: "Success",
                  description: "Time off request created successfully",
                });
              }}
              onCancel={() => setCreateDialogOpen(false)}
              showUserSelect
            />
          </DialogContent>
        </Dialog>

        {/* Rest of the component remains unchanged */}
      </div>
    </div>
  );
}
