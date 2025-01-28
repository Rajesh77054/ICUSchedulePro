import { toast } from "@/hooks/use-toast";
import type { ReactElement } from "react";

interface ErrorContext {
  originalMessage: string;
  translatedMessage: string;
  suggestedFix?: string;
  documentation?: string;
  context?: string;
}

// Common error patterns and their translations
const errorPatterns = [
  {
    pattern: /Cannot find module '(.+)'/,
    translate: (match: RegExpMatchArray) => ({
      translatedMessage: `Missing dependency: ${match[1]}`,
      suggestedFix: `Try installing the package using npm install ${match[1]}`,
      context: "This error occurs when a required package is not installed in your project."
    })
  },
  {
    pattern: /TypeError: (.+) is not a function/,
    translate: (match: RegExpMatchArray) => ({
      translatedMessage: `Invalid function call: ${match[1]}`,
      suggestedFix: "Check if the function name is correct and the object containing it is properly imported/defined",
      context: "This error happens when you try to call something that isn't actually a function."
    })
  },
  {
    pattern: /ECONNREFUSED.*:(\d+)/,
    translate: (match: RegExpMatchArray) => ({
      translatedMessage: `Connection refused on port ${match[1]}`,
      suggestedFix: "Verify that the server is running and the port is correct",
      context: "This typically means the server you're trying to connect to isn't running or is on a different port."
    })
  },
  {
    pattern: /Cannot read properties of (undefined|null) \(reading '(.+)'\)/,
    translate: (match: RegExpMatchArray) => ({
      translatedMessage: `Trying to access '${match[2]}' on ${match[1]}`,
      suggestedFix: "Add a check to ensure the object exists before accessing its properties",
      context: "This error occurs when you try to access a property on an undefined or null value."
    })
  }
];

export function translateError(error: unknown): ErrorContext {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Try to match against known patterns
  for (const { pattern, translate } of errorPatterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      return {
        originalMessage: errorMessage,
        ...translate(match)
      };
    }
  }

  // Default translation for unknown errors
  return {
    originalMessage: errorMessage,
    translatedMessage: "An unexpected error occurred",
    context: "This error doesn't match any known patterns. Check the console for more details."
  };
}

interface ToastContentProps {
  translation: ErrorContext;
}

const ToastContent = ({ translation }: ToastContentProps): ReactElement => (
  <div className="space-y-2">
    <p className="font-medium text-destructive">{translation.translatedMessage}</p>
    {translation.suggestedFix && (
      <p className="text-sm text-muted-foreground">
        Suggested fix: {translation.suggestedFix}
      </p>
    )}
    {translation.context && (
      <p className="text-xs text-muted-foreground">
        Context: {translation.context}
      </p>
    )}
  </div>
);

export function showTranslatedError(error: unknown): void {
  const translation = translateError(error);

  // Show a detailed toast notification
  toast({
    title: "Error Details",
    description: <ToastContent translation={translation} />,
    variant: "destructive",
    duration: 8000
  });

  // Log detailed information to console for developers
  console.group("Detailed Error Information");
  console.error("Original Error:", translation.originalMessage);
  console.info("Translation:", translation.translatedMessage);
  if (translation.suggestedFix) console.info("Suggested Fix:", translation.suggestedFix);
  if (translation.context) console.info("Context:", translation.context);
  console.groupEnd();
}