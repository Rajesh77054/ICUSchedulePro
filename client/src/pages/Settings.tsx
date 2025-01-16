import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Trash2, UserPlus, Edit, User } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ShiftPreferences } from "./ShiftPreferences";
import { USERS } from "@/lib/constants";

type UserFormData = {
  name: string;
  title: string;
  userType: "physician" | "app";
  targetDays: number;
  tolerance?: number;
  maxConsecutiveWeeks?: number;
  color: string;
};

export function Settings() {
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("user-management");
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query users
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  // Add/Edit User Mutation
  const { mutate: saveUser, isPending: isSavingUser } = useMutation({
    mutationFn: async (data: UserFormData & { id?: number }) => {
      const url = data.id ? `/api/users/${data.id}` : "/api/users";
      const method = data.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to save user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: `User ${selectedUser ? "updated" : "added"} successfully`,
      });
      setUserDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete User Mutation
  const { mutate: deleteUser, isPending: isDeletingUser } = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setDeleteUserDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const data: UserFormData = {
      name: formData.get("name") as string,
      title: formData.get("title") as string,
      userType: formData.get("userType") as "physician" | "app",
      targetDays: parseInt(formData.get("targetDays") as string),
      tolerance: parseInt(formData.get("tolerance") as string),
      maxConsecutiveWeeks: parseInt(formData.get("maxConsecutiveWeeks") as string),
      color: formData.get("color") as string,
    };

    if (selectedUser) {
      saveUser({ ...data, id: selectedUser });
    } else {
      saveUser(data);
    }
  };

  const currentUser = users?.find(u => u.id === selectedUser);

  return (
    <div className="container mx-auto p-4 md:py-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="user-management">User Management</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="user-management">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage healthcare providers and their roles
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  setSelectedUser(null);
                  setUserDialogOpen(true);
                }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users?.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-2 h-8 rounded"
                        style={{ backgroundColor: user.color }}
                      />
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.title} • {user.userType.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user.id);
                          setUserDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          setSelectedUser(user.id);
                          setDeleteUserDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <ShiftPreferences />
        </TabsContent>

        <TabsContent value="admin">
          <Card>
            <CardHeader>
              <CardTitle>Calendar Management</CardTitle>
              <CardDescription>
                Manage calendar data and perform administrative tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Clear Calendar</h3>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => setClearDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear Calendar
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Remove all shifts from the calendar. This action cannot be undone.
                  </p>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Calendar Export</h3>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Use this URL to subscribe to your calendar from external applications.
                      The calendar will automatically update when changes are made.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input 
                        readOnly
                        value={`${window.location.origin}/api/schedules/export/all`}
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/api/schedules/export/all`);
                          toast({
                            title: "Copied!",
                            description: "Calendar URL copied to clipboard",
                          });
                        }}
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This URL includes all shifts in iCalendar format. You can add this to
                      calendar applications like Google Calendar, Apple Calendar, or Outlook.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Edit" : "Add"} User</DialogTitle>
            <DialogDescription>
              {selectedUser ? "Edit user information" : "Add a new healthcare provider"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={currentUser?.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={currentUser?.title}
                  placeholder="e.g., MD, DO, NP, PA"
                  required
                />
              </div>
              <div>
                <Label htmlFor="userType">User Type</Label>
                <Select
                  name="userType"
                  defaultValue={currentUser?.userType}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physician">Physician</SelectItem>
                    <SelectItem value="app">APP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetDays">Target Days</Label>
                <Input
                  id="targetDays"
                  name="targetDays"
                  type="number"
                  min={1}
                  defaultValue={currentUser?.targetDays}
                  required
                />
              </div>
              <div>
                <Label htmlFor="tolerance">Tolerance (days)</Label>
                <Input
                  id="tolerance"
                  name="tolerance"
                  type="number"
                  min={0}
                  defaultValue={currentUser?.tolerance}
                />
              </div>
              <div>
                <Label htmlFor="maxConsecutiveWeeks">Max Consecutive Weeks</Label>
                <Input
                  id="maxConsecutiveWeeks"
                  name="maxConsecutiveWeeks"
                  type="number"
                  min={1}
                  defaultValue={currentUser?.maxConsecutiveWeeks}
                />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  name="color"
                  type="color"
                  defaultValue={currentUser?.color}
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingUser}>
                {isSavingUser ? (
                  <>Saving...</>
                ) : selectedUser ? (
                  "Save Changes"
                ) : (
                  "Add User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              All associated shifts and preferences will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedUser && deleteUser(selectedUser)}
              disabled={isDeletingUser}
            >
              {isDeletingUser ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Calendar Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Shifts</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove all shifts from the calendar. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => clearShifts()}>
              Clear All Shifts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}