import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Calendar, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Shift } from "@/lib/types";

interface ConflictingShift {
  type: 'overlap' | 'consecutive_shifts' | 'overtime' | 'understaffed';
  shiftId: number;
  strategy?: 'auto_reassign' | 'notify_admin' | 'suggest_swap' | 'enforce_rule';
}

interface ConflictResolutionWizardProps {
  open: boolean;
  conflicts: ConflictingShift[];
  onOpenChange: (open: boolean) => void;
  onResolved?: () => void;
}

export function ConflictResolutionWizard({
  open,
  conflicts,
  onOpenChange,
  onResolved
}: ConflictResolutionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [resolutions, setResolutions] = useState<Record<number, string>>({});
  const [batchMode, setBatchMode] = useState<string>('manual');
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: async (conflictId: number) => {
      const strategy = resolutions[conflictId];
      const response = await fetch(`/api/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve conflict');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conflicts'] });
    },
  });

  const progress = Math.round((Object.keys(resolutions).length / conflicts.length) * 100);

  const handleBatchModeChange = (value: string) => {
    setBatchMode(value);
    if (value !== 'manual') {
      const newResolutions: Record<number, string> = {};
      conflicts.forEach(conflict => {
        newResolutions[conflict.shiftId] = value;
      });
      setResolutions(newResolutions);
    }
  };

  const handleResolve = async () => {
    try {
      // Resolve each conflict sequentially
      for (const conflict of conflicts) {
        await resolveMutation.mutateAsync(conflict.shiftId);
      }

      // Reset state
      setResolutions({});
      setBatchMode('manual');
      setCurrentStep(0);

      // Call the onResolved callback if provided
      onResolved?.();

      // Close the dialog
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to resolve conflicts:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve Schedule Conflicts</DialogTitle>
          <DialogDescription>
            {conflicts.length} conflicts detected. Choose how to resolve each conflict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <Label>Resolution Mode</Label>
            <Select value={batchMode} onValueChange={handleBatchModeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose resolution mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Resolve Manually</SelectItem>
                <SelectItem value="auto_reassign">Auto-reassign All Shifts</SelectItem>
                <SelectItem value="notify_admin">Notify Admin for All</SelectItem>
                <SelectItem value="suggest_swap">Suggest Swaps for All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {batchMode === 'manual' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Progress value={progress} className="flex-1" />
                <span className="text-sm text-muted-foreground">
                  {Object.keys(resolutions).length} of {conflicts.length} resolved
                </span>
              </div>

              {conflicts.map((conflict, index) => (
                <Card key={conflict.shiftId} className={index !== currentStep ? 'hidden' : undefined}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <h3 className="font-medium mb-2">Conflict Type</h3>
                        <div className="space-y-2 text-sm">
                          <p className="capitalize">{conflict.type.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </div>

                    <RadioGroup
                      value={resolutions[conflict.shiftId]}
                      onValueChange={(value: string) => {
                        setResolutions(prev => ({
                          ...prev,
                          [conflict.shiftId]: value
                        }));
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="auto_reassign" id={`auto-${conflict.shiftId}`} />
                        <Label htmlFor={`auto-${conflict.shiftId}`}>Auto-reassign shift</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="notify_admin" id={`notify-${conflict.shiftId}`} />
                        <Label htmlFor={`notify-${conflict.shiftId}`}>Notify admin</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="suggest_swap" id={`swap-${conflict.shiftId}`} />
                        <Label htmlFor={`swap-${conflict.shiftId}`}>Suggest swap</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="enforce_rule" id={`enforce-${conflict.shiftId}`} />
                        <Label htmlFor={`enforce-${conflict.shiftId}`}>Enforce scheduling rule</Label>
                      </div>
                    </RadioGroup>

                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                        disabled={currentStep === 0}
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={() => setCurrentStep(prev => Math.min(conflicts.length - 1, prev + 1))}
                        disabled={currentStep === conflicts.length - 1 || !resolutions[conflict.shiftId]}
                      >
                        Next
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {batchMode !== 'manual' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm">
                  All conflicts will be resolved using the selected strategy.
                  This action cannot be undone.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleResolve}
              disabled={
                resolveMutation.isPending ||
                (batchMode === 'manual' && Object.keys(resolutions).length !== conflicts.length)
              }
            >
              {resolveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                'Resolve Conflicts'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}