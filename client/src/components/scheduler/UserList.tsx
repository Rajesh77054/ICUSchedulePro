import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User, Shift } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface UserListProps {
  users?: User[];
}

export function UserList({ users = [] }: UserListProps) {
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
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

  const filteredUsers = users.filter(user => 
    userTypeFilter === "all" || user.userType === userTypeFilter
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Staff</CardTitle>
          <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              <SelectItem value="physician">Physicians</SelectItem>
              <SelectItem value="app">APPs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredUsers.map(user => {
          const days = getUserStats(user.id);
          const progress = Math.min((days / user.targetDays) * 100, 100);

          return (
            <Link key={user.id} href={`/user/${user.id}`}>
              <div className="space-y-2 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium block">
                      {user.name}, {user.title}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {days}/{user.targetDays} days
                    </span>
                  </div>
                  <Button variant="ghost" size="icon">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="w-full">
                  <Progress
                    value={progress}
                    className="h-2 w-full"
                    style={{
                      backgroundColor: `${user.color}40`,
                      "--progress-background": user.color,
                    } as any}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}