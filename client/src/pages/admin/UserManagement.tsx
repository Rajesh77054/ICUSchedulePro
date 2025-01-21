
import React from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PreferencesForm } from '@/components/scheduler/preferences/PreferencesForm';
import { ShiftPreferences } from '@/components/scheduler/preferences/ShiftPreferences';

export function UserManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage user details and preferences</p>
      </div>
      
      <Card>
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">User Details</TabsTrigger>
            <TabsTrigger value="preferences">User Preferences</TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <PreferencesForm />
          </TabsContent>
          <TabsContent value="preferences">
            <ShiftPreferences />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
