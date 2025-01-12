import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { type Shift } from "@/lib/types";
import { PROVIDERS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface ConflictVisualizerProps {
  shift: Shift;
  conflicts: {
    type: 'overlap' | 'consecutive' | 'maxDays';
    message: string;
    conflictingShift?: Shift;
  }[];
  onResolve?: () => void;
}

export function ConflictVisualizer({ shift, conflicts, onResolve }: ConflictVisualizerProps) {
  if (!conflicts.length) return null;

  const hasOverlappingConflicts = conflicts.some(c => c.type === 'overlap' && c.conflictingShift);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute top-12 left-0 right-0 mx-4 z-50 bg-destructive shadow-lg rounded-md border border-destructive-foreground/20"
      >
        <div className="flex items-start gap-4 p-4">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-destructive-foreground" />
          <div className="space-y-4 flex-grow">
            <div className="space-y-2">
              {conflicts.map((conflict, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-sm text-destructive-foreground"
                >
                  {conflict.message}
                </motion.p>
              ))}
            </div>
            {hasOverlappingConflicts && onResolve && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onResolve}
                className="w-full sm:w-auto"
              >
                Resolve Conflicts
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}