
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserIdentificationProps {
  onComplete: (userId: string, displayName: string) => void;
}

export function UserIdentification({ onComplete }: UserIdentificationProps) {
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Check for existing identification
    const storedUserId = localStorage.getItem("userId");
    const storedDisplayName = localStorage.getItem("userDisplayName");
    
    if (storedUserId && storedDisplayName) {
      setDisplayName(storedDisplayName);
      setIsComplete(true);
      onComplete(storedUserId, storedDisplayName);
    } else {
      // Generate new UUID if none exists
      const newUserId = crypto.randomUUID();
      localStorage.setItem("userId", newUserId);
    }
  }, [onComplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      setError("Display name must be at least 2 characters");
      return;
    }
    if (trimmedName.length > 50) {
      setError("Display name must be less than 50 characters");
      return;
    }

    const userId = localStorage.getItem("userId") || crypto.randomUUID();
    localStorage.setItem("userId", userId);
    localStorage.setItem("userDisplayName", trimmedName);
    
    setIsComplete(true);
    onComplete(userId, trimmedName);
  };

  if (isComplete) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
        <div className="bg-card p-6 rounded-lg shadow-lg w-[350px]">
          <h2 className="text-lg font-semibold mb-4">Welcome to Team Calendar</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Choose your display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setError("");
                }}
                placeholder="Enter your name"
                className="w-full"
              />
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
