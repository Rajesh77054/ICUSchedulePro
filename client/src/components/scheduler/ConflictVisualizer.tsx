import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, X } from "lucide-react";
import { type Shift } from "@/lib/types";
import { USERS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import type { ConflictResolutionStrategy } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ConflictVisualizerProps {
  shift: Shift;
  conflicts: {
    type: 'overlap' | 'consecutive' | 'maxDays' | 'preference';
    message: string;
    conflictingShift?: Shift;
    resolutionStrategies?: ConflictResolutionStrategy[];
  }[];
  onResolve?: (strategy: ConflictResolutionStrategy) => Promise<void>;
  onDismiss?: () => void;
}

export function ConflictVisualizer({ 
  shift, 
  conflicts, 
  onResolve,
  onDismiss 
}: ConflictVisualizerProps) {
  const { toast } = useToast();

  if (!conflicts.length) return null;

  const hasResolutionStrategies = conflicts.some(c => c.resolutionStrategies?.length);
  const user = USERS.find(u => u.id === shift.userId);

  const handleResolve = async (strategy: ConflictResolutionStrategy) => {
    try {
      await onResolve?.(strategy);
      toast({
        title: "Conflict Resolved",
        description: "The schedule has been updated successfully",
      });
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      toast({
        title: "Resolution Failed",
        description: "Failed to apply the resolution strategy. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute top-12 left-0 right-0 mx-4 z-50 bg-destructive/5 shadow-lg rounded-md border border-destructive/20"
      >
        <div className="flex items-start gap-4 p-4">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-destructive" />
          <div className="space-y-4 flex-grow">
            <div className="space-y-2">
              {conflicts.map((conflict, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="space-y-2"
                >
                  <p className="text-sm text-destructive">
                    {conflict.message}
                  </p>
                  {conflict.resolutionStrategies?.length > 0 && (
                    <Accordion type="single" collapsible>
                      <AccordionItem value="resolutions">
                        <AccordionTrigger className="text-sm">
                          View Suggested Resolutions
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            {conflict.resolutionStrategies.map((strategy, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center justify-between gap-4 p-2 rounded-md bg-background/50"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={
                                      strategy.score > 0.8 ? "default" :
                                      strategy.score > 0.6 ? "secondary" : "outline"
                                    }>
                                      {Math.round(strategy.score * 100)}% Match
                                    </Badge>
                                    <span className="text-sm font-medium">
                                      {strategy.type.charAt(0).toUpperCase() + strategy.type.slice(1)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {strategy.description}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleResolve(strategy)}
                                  className="shrink-0"
                                >
                                  Apply
                                </Button>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </motion.div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="text-destructive-foreground/70"
                >
                  <X className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}