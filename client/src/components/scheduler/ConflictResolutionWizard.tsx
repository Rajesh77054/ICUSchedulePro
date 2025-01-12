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
import type { Shift } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

interface ConflictingShift {
  qgenda: {
    startDate: string;
    endDate: string;
    summary: string;
  };
  local: Shift;
}

interface ConflictResolutionWizardProps {
  open: boolean;
  conflicts: ConflictingShift[];
  onOpenChange: (open: boolean) => void;
  onResolve: (resolutions: Array<{ shiftId: number; action: 'keep-qgenda' | 'keep-local' }>) => Promise<void>;
}

export function ConflictResolutionWizard({
  open,
  conflicts,
  onOpenChange,
  onResolve,
}: ConflictResolutionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [resolutions, setResolutions] = useState<Record<number, 'keep-qgenda' | 'keep-local'>>({});
  const [batchMode, setBatchMode] = useState<'keep-qgenda' | 'keep-local' | 'manual'>('manual');
  const [isResolving, setIsResolving] = useState(false);
  const queryClient = useQueryClient();

  const progress = Math.round((Object.keys(resolutions).length / conflicts.length) * 100);

  const handleBatchModeChange = (value: 'keep-qgenda' | 'keep-local' | 'manual') => {
    setBatchMode(value);
    if (value !== 'manual') {
      const newResolutions: Record<number, 'keep-qgenda' | 'keep-local'> = {};
      conflicts.forEach(conflict => {
        newResolutions[conflict.local.id] = value;
      });
      setResolutions(newResolutions);
    }
  };

  const handleResolve = async () => {
    try {
      setIsResolving(true);
      await onResolve(
        Object.entries(resolutions).map(([shiftId, action]) => ({
          shiftId: parseInt(shiftId),
          action,
        }))
      );

      // Invalidate queries to refresh calendar data
      await queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });

      // Reset state
      setResolutions({});
      setBatchMode('manual');
      setCurrentStep(0);

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to resolve conflicts:', error);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resolve Calendar Conflicts</DialogTitle>
          <DialogDescription>
            {conflicts.length} conflicts found between QGenda and local schedules.
            Choose how to resolve each conflict.
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
                <SelectItem value="keep-qgenda">Keep All QGenda Shifts</SelectItem>
                <SelectItem value="keep-local">Keep All Local Shifts</SelectItem>
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
                <Card key={conflict.local.id} className={index !== currentStep ? 'hidden' : undefined}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start gap-6">
                      <div className="flex-1">
                        <h3 className="font-medium mb-2">QGenda Shift</h3>
                        <div className="space-y-2 text-sm">
                          <p className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(conflict.qgenda.startDate), 'MMM d, yyyy')} - 
                            {format(new Date(conflict.qgenda.endDate), 'MMM d, yyyy')}
                          </p>
                          <p>{conflict.qgenda.summary}</p>
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-medium mb-2">Local Shift</h3>
                        <div className="space-y-2 text-sm">
                          <p className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(conflict.local.startDate), 'MMM d, yyyy')} - 
                            {format(new Date(conflict.local.endDate), 'MMM d, yyyy')}
                          </p>
                          {conflict.local.schedulingNotes && (
                            <p>{conflict.local.schedulingNotes}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <RadioGroup
                      value={resolutions[conflict.local.id]}
                      onValueChange={(value: 'keep-qgenda' | 'keep-local') => {
                        setResolutions(prev => ({
                          ...prev,
                          [conflict.local.id]: value
                        }));
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="keep-qgenda" id={`qgenda-${conflict.local.id}`} />
                        <Label htmlFor={`qgenda-${conflict.local.id}`}>Keep QGenda shift</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="keep-local" id={`local-${conflict.local.id}`} />
                        <Label htmlFor={`local-${conflict.local.id}`}>Keep local shift</Label>
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
                        disabled={currentStep === conflicts.length - 1 || !resolutions[conflict.local.id]}
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
                  All conflicts will be resolved by keeping the {batchMode === 'keep-qgenda' ? 'QGenda' : 'local'} shifts.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleResolve}
              disabled={
                isResolving || 
                (batchMode === 'manual' && Object.keys(resolutions).length !== conflicts.length)
              }
            >
              {isResolving ? (
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