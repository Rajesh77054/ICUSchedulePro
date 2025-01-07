import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { type Shift } from "@/lib/types";
import { PROVIDERS } from "@/lib/constants";

interface ConflictVisualizerProps {
  shift: Shift;
  conflicts: {
    type: 'overlap' | 'consecutive' | 'maxDays';
    message: string;
    conflictingShift?: Shift;
  }[];
}

export function ConflictVisualizer({ shift, conflicts }: ConflictVisualizerProps) {
  if (!conflicts.length) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute top-0 left-0 right-0 p-2 bg-destructive/90 text-destructive-foreground rounded-t-md"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="space-y-1 text-sm">
            {conflicts.map((conflict, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                {conflict.message}
              </motion.p>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
