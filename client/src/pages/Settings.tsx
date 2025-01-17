import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { ShiftPreferences } from "./ShiftPreferences";
import { useState } from "react";

export function Settings() {
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  // Query users
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  return (
    <div className="container mx-auto p-4 md:py-6">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Shift Preferences</CardTitle>
          <CardDescription>
            Configure scheduling preferences for healthcare providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <Label>Select User</Label>
              <Select
                value={selectedUser?.toString()}
                onValueChange={(value) => setSelectedUser(value ? parseInt(value) : null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a user to view preferences" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user: any) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}, {user.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedUser ? (
              <ShiftPreferences userId={selectedUser} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a user to view and edit their preferences
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}