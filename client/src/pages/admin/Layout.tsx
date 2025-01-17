import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Users, Calendar, Clock } from "lucide-react";

const navigation = [
  { name: 'User Management', href: '/admin/users', icon: Users },
  { name: 'Schedule Management', href: '/admin/schedule', icon: Calendar },
  { name: 'Time Off Management', href: '/admin/time-off', icon: Clock },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r">
        <div className="h-16 flex items-center px-4 border-b">
          <h1 className="text-lg font-semibold">Admin Dashboard</h1>
        </div>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <a
                  className={cn(
                    "flex items-center px-4 py-2 text-sm font-medium rounded-md",
                    location === item.href
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
