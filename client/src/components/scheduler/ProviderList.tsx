import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import type { User, Shift } from "@/lib/types";

interface ProviderListProps {
  users?: User[];
  onUserSelect?: (user: User) => void;
  selectedUserId?: number;
}

export function ProviderList({ users = [], onUserSelect, selectedUserId }: ProviderListProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [, navigate] = useLocation();

  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const getUserStats = (userId: number) => {
    const userShifts = shifts?.filter(s => s.userId === userId) || [];
    const totalDays = userShifts.reduce((acc, shift) => {
      const start = new Date(shift.startDate);
      const end = new Date(shift.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return acc + days;
    }, 0);

    return totalDays;
  };

  const physicians = users.filter(user => user.userType === "physician");
  const apps = users.filter(user => user.userType === "app");

  const handleUserSelect = (user: User) => {
    onUserSelect?.(user);
    navigate(`/provider/${user.id}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Healthcare Providers</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="px-4 py-2">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="physicians" className="flex-1">Physicians</TabsTrigger>
              <TabsTrigger value="apps" className="flex-1">APPs</TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="h-[400px]">
            <TabsContent value="all" className="m-0">
              <UserList 
                users={users}
                selectedUserId={selectedUserId}
                onSelect={handleUserSelect}
                getUserStats={getUserStats}
              />
            </TabsContent>
            <TabsContent value="physicians" className="m-0">
              <UserList 
                users={physicians}
                selectedUserId={selectedUserId}
                onSelect={handleUserSelect}
                getUserStats={getUserStats}
              />
            </TabsContent>
            <TabsContent value="apps" className="m-0">
              <UserList 
                users={apps}
                selectedUserId={selectedUserId}
                onSelect={handleUserSelect}
                getUserStats={getUserStats}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function UserList({ users, selectedUserId, onSelect, getUserStats }: { 
  users: User[];
  selectedUserId?: number;
  onSelect?: (user: User) => void;
  getUserStats: (userId: number) => number;
}) {
  return (
    <div className="divide-y divide-border">
      {users.map((user) => {
        const days = getUserStats(user.id);
        const progress = Math.min((days / user.targetDays) * 100, 100);

        return (
          <button
            key={user.id}
            onClick={() => onSelect?.(user)}
            className={`w-full p-4 hover:bg-accent transition-colors ${
              selectedUserId === user.id ? "bg-accent" : ""
            }`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: user.color }}
                />
                <div className="flex-1 text-left">
                  <div className="font-medium text-base">{user.name}</div>
                  <div className="text-sm text-muted-foreground">{user.title}</div>
                </div>
              </div>

              <div className="space-y-2 w-full">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Progress</span>
                  <span className="text-muted-foreground">
                    {days}/{user.targetDays} days
                  </span>
                </div>
                <div className="w-full">
                  <Progress
                    value={progress}
                    className="h-2 w-full"
                    style={{
                      backgroundColor: `${user.color}20`,
                      "--progress-background": user.color,
                    } as any}
                  />
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}