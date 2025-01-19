import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChatDialog } from "@/components/scheduler/ChatDialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PreferencesForm } from "@/components/scheduler/PreferencesForm";

export function UserManagement() {
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query users
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  // Add/Edit User Mutation
  const { mutate: saveUser, isPending: isSavingUser } = useMutation({
    mutationFn: async (data: any) => {
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

    const data = {
      name: formData.get("name"),
      title: formData.get("title"),
      userType: formData.get("userType"),
      targetDays: parseInt(formData.get("targetDays") as string),
      tolerance: parseInt(formData.get("tolerance") as string),
      maxConsecutiveWeeks: parseInt(formData.get("maxConsecutiveWeeks") as string),
      color: formData.get("color"),
    };

    if (selectedUser) {
      saveUser({ ...data, id: selectedUser });
    } else {
      saveUser(data);
    }
  };

  const currentUser = users?.find(u => u.id === selectedUser);

  return (
    <div className="container mx-auto p-4 md:py-6 relative">
      <ChatDialog currentPage="users" />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage healthcare providers, their roles, and preferences
              </CardDescription>
            </div>
            <Button onClick={() => {
              setSelectedUser(null);
              setActiveTab("details");
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
                      setActiveTab("details");
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

      {/* Add/Edit User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedUser ? "Edit" : "Add"} User</DialogTitle>
            <DialogDescription>
              {selectedUser ? "Edit user information and preferences" : "Add a new healthcare provider"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">User Details</TabsTrigger>
              <TabsTrigger value="preferences" disabled={!selectedUser}>
                User Preferences
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <form id="userForm" onSubmit={handleSubmit}>
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
            </TabsContent>

            <TabsContent value="preferences">
              {selectedUser && (
                <PreferencesForm userId={selectedUser} />
              )}
            </TabsContent>
          </Tabs>
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
    </div>
  );
}