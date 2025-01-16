import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  primaryEmail: string;
  secondaryEmail?: string;
  role: string;
  provider?: {
    id: number;
    name: string;
    title: string;
    providerType: string;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user && location !== '/login') {
      window.location.href = '/login';
    }
  }, [user, isLoading, location]);

  return (
    <AuthContext.Provider value={{ user, isLoading, error: error as Error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ 
  children, 
  roles = [] 
}: { 
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation('/login');
    } else if (!isLoading && user && roles.length > 0 && !roles.includes(user.role)) {
      setLocation('/');
    }
  }, [user, isLoading, roles, setLocation]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || (roles.length > 0 && !roles.includes(user.role))) {
    return null;
  }

  return <>{children}</>;
}