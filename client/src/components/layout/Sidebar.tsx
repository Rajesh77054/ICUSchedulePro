import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Settings,
  Clock,
  Users,
  Menu,
  ChevronDown,
  CalendarDays,
  TimerOff,
  Repeat,
  Shield,
  LayoutDashboard,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
  active?: boolean;
}

function NavItem({ href, icon, label, tooltip, active }: NavItemProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-2 transition-colors",
                active && "bg-accent text-accent-foreground hover:bg-accent/90"
              )}
            >
              {icon}
              {label}
            </Button>
          </Link>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="right">
            <p>{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(true);
  const [schedulingOpen, setSchedulingOpen] = useState(true);

  const navigation = {
    main: [
      {
        href: "/",
        icon: <LayoutDashboard className="h-4 w-4" />,
        label: "Dashboard",
        tooltip: "View overall scheduling dashboard",
      },
      {
        href: "/schedule",
        icon: <Calendar className="h-4 w-4" />,
        label: "Schedule",
        tooltip: "View and manage the main schedule",
      },
    ],
    scheduling: [
      {
        href: "/my-schedule",
        icon: <CalendarDays className="h-4 w-4" />,
        label: "My Schedule",
        tooltip: "View and manage your personal schedule",
      },
      {
        href: "/swap-requests",
        icon: <Repeat className="h-4 w-4" />,
        label: "Shift Swaps",
        tooltip: "Request and manage shift swaps",
      },
      {
        href: "/time-off",
        icon: <TimerOff className="h-4 w-4" />,
        label: "Time Off",
        tooltip: "Submit and track time-off requests",
      },
    ],
    admin: [
      {
        href: "/admin/users",
        icon: <UserCog className="h-4 w-4" />,
        label: "User Management",
        tooltip: "Manage users and roles",
      },
      {
        href: "/admin/time-off",
        icon: <Clock className="h-4 w-4" />,
        label: "Time Off Admin",
        tooltip: "Review time-off requests",
      },
      {
        href: "/admin/settings",
        icon: <Settings className="h-4 w-4" />,
        label: "System Settings",
        tooltip: "Configure system-wide settings",
      },
    ],
  };

  const SidebarContent = (
    <div className="flex h-full flex-col gap-2">
      <div className="px-2 py-2">
        <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
          ICU Scheduling
        </h2>
        <div className="space-y-1">
          {navigation.main.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={location === item.href}
            />
          ))}
        </div>
      </div>

      <div className="px-2 py-2">
        <div className="space-y-4">
          <Collapsible
            open={schedulingOpen}
            onOpenChange={setSchedulingOpen}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-between",
                  schedulingOpen && "bg-accent/50"
                )}
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Personal
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    schedulingOpen && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              {navigation.scheduling.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={location === item.href}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible
            open={adminOpen}
            onOpenChange={setAdminOpen}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-between",
                  adminOpen && "bg-accent/50"
                )}
              >
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Administration
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    adminOpen && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              {navigation.admin.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={location === item.href}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-background px-6 py-4">
          {SidebarContent}
        </div>
      </div>

      {/* Mobile sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className="md:hidden fixed top-4 left-4 z-40"
            size="icon"
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          {SidebarContent}
        </SheetContent>
      </Sheet>
    </>
  );
}