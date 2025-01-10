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

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

function NavItem({ href, icon, label, active }: NavItemProps) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-2",
          active && "bg-accent text-accent-foreground"
        )}
      >
        {icon}
        {label}
      </Button>
    </Link>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [schedulingOpen, setSchedulingOpen] = useState(true);
  const [timeManagementOpen, setTimeManagementOpen] = useState(true);

  const navigation = {
    main: [
      {
        href: "/",
        icon: <Calendar className="h-4 w-4" />,
        label: "Schedule",
      },
    ],
    scheduling: [
      {
        href: "/personal",
        icon: <CalendarDays className="h-4 w-4" />,
        label: "Personal Schedule",
      },
      {
        href: "/swap-requests",
        icon: <Repeat className="h-4 w-4" />,
        label: "Shift Swaps",
      },
    ],
    timeManagement: [
      {
        href: "/time-off",
        icon: <TimerOff className="h-4 w-4" />,
        label: "Time Off",
      },
      {
        href: "/time-off/admin",
        icon: <Clock className="h-4 w-4" />,
        label: "Time Off Admin",
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
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Scheduling
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
            open={timeManagementOpen}
            onOpenChange={setTimeManagementOpen}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Management
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    timeManagementOpen && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1">
              {navigation.timeManagement.map((item) => (
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

      <div className="mt-auto px-2 py-2">
        <NavItem
          href="/preferences"
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          active={location === "/preferences"}
        />
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
            className="md:hidden"
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