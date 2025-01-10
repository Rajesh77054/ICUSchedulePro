import { useState } from "react";
import { useLocation } from "wouter";
import {
  Calendar,
  Settings,
  Clock,
  Users,
  CalendarDays,
  TimerOff,
  Repeat,
} from "lucide-react";
import {
  Sidebar as UISidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";

export function Sidebar() {
  const [location] = useLocation();

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
        href: "/provider/1",
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

  return (
    <SidebarProvider defaultOpen={true}>
      <UISidebar>
        <SidebarHeader>
          <h2 className="px-2 text-lg font-semibold tracking-tight">
            ICU Scheduling
          </h2>
          <SidebarTrigger className="absolute right-2 top-2 md:hidden" />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {navigation.main.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    tooltip={item.label}
                  >
                    <a href={item.href} className="flex items-center gap-2">
                      {item.icon}
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>
              <Users className="mr-2" />
              Scheduling
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.scheduling.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.href}
                      tooltip={item.label}
                    >
                      <a href={item.href} className="flex items-center gap-2">
                        {item.icon}
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>
              <Clock className="mr-2" />
              Time Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.timeManagement.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.href}
                      tooltip={item.label}
                    >
                      <a href={item.href} className="flex items-center gap-2">
                        {item.icon}
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/preferences"}
                tooltip="Settings"
              >
                <a href="/preferences" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </UISidebar>
    </SidebarProvider>
  );
}