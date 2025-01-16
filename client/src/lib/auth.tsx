import { createContext, useContext } from "react";
import type { User } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  error: null,
});

export function AuthProvider({ 
  children,
  defaultUser = null
}: { 
  children: React.ReactNode;
  defaultUser?: User | null;
}) {
  // During development, we'll use the defaultUser if provided
  // This bypasses all authentication checks
  const contextValue = {
    user: defaultUser,
    isLoading: false,
    error: null
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}