import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { User } from "@/lib/types";

interface UserListProps {
  onUserSelect?: (user: User) => void;
  selectedUserId?: number;
}

export function ProviderList({ onUserSelect, selectedUserId }: UserListProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [, navigate] = useLocation();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const physicians = users.filter(user => user.userType === "physician");
  const apps = users.filter(user => user.userType === "app");

  const handleUserSelect = (user: User) => {
    onUserSelect?.(user);
    navigate(`/provider/${user.id}`);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Healthcare Providers</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="px-4">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="physicians" className="flex-1">Physicians</TabsTrigger>
              <TabsTrigger value="apps" className="flex-1">APPs</TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="h-[400px] py-2">
            <TabsContent value="all" className="m-0">
              <UserList 
                users={users}
                selectedUserId={selectedUserId}
                onSelect={handleUserSelect}
              />
            </TabsContent>
            <TabsContent value="physicians" className="m-0">
              <UserList 
                users={physicians}
                selectedUserId={selectedUserId}
                onSelect={handleUserSelect}
              />
            </TabsContent>
            <TabsContent value="apps" className="m-0">
              <UserList 
                users={apps}
                selectedUserId={selectedUserId}
                onSelect={handleUserSelect}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function UserList({ users, selectedUserId, onSelect }: { 
  users: User[];
  selectedUserId?: number;
  onSelect?: (user: User) => void;
}) {
  return (
    <div className="space-y-1">
      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => onSelect?.(user)}
          className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-accent transition-colors ${
            selectedUserId === user.id ? "bg-accent" : ""
          }`}
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: user.color }}
          />
          <div className="flex-1 text-left">
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.title}</div>
          </div>
        </button>
      ))}
    </div>
  );
}