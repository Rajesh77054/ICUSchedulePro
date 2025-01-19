import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  Settings,
  BarChart,
  MessageSquare,
  UserCog,
  Database,
  Repeat,
  User
} from "lucide-react";

interface SidebarItem {
  href: string;
  icon: JSX.Element;
  label: string;
  tooltip: string;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export function Sidebar() {
  const sidebarSections: Record<string, SidebarItem[]> = {
    personal: [
      {
        href: "/",
        icon: <Calendar className="h-4 w-4" />,
        label: "Calendar",
        tooltip: "View and manage your calendar",
      },
      {
        href: "/provider/me",
        icon: <User className="h-4 w-4" />,
        label: "Personal Schedule",
        tooltip: "View and manage your personal schedule",
      },
    ],
    admin: [
      {
        href: "/admin/users",
        icon: <UserCog className="h-4 w-4" />,
        label: "Users",
        tooltip: "Manage healthcare providers and their roles",
      },
      {
        href: "/admin/schedule",
        icon: <Database className="h-4 w-4" />,
        label: "Schedule Rules",
        tooltip: "Manage calendar data and scheduling rules",
      },
      {
        href: "/swap-requests",
        icon: <Repeat className="h-4 w-4" />,
        label: "Shift Swaps",
        tooltip: "Review and manage shift swap requests",
      },
      {
        href: "/admin/time-off",
        icon: <Clock className="h-4 w-4" />,
        label: "Time Off",
        tooltip: "Review and manage time-off requests",
      },
    ],
    other: [
      {
        href: "/chat",
        icon: <MessageSquare className="h-4 w-4" />,
        label: "Team Chat",
        tooltip: "Chat with your team members",
      },
      {
        href: "/analytics",
        icon: <BarChart className="h-4 w-4" />,
        label: "Analytics",
        tooltip: "View scheduling analytics and reports",
      },
      {
        href: "/preferences",
        icon: <Settings className="h-4 w-4" />,
        label: "Settings",
        tooltip: "Configure your preferences",
      },
    ],
  };

  return (
    <div className="fixed inset-y-0 left-0 z-50 hidden w-64 bg-gray-900 md:block">
      <div className="flex h-full flex-col gap-y-5 bg-gray-900 px-6">
        <div className="flex h-16 shrink-0 items-center text-white">
          <span className="text-xl font-semibold">Team Calendar</span>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            {Object.entries(sidebarSections).map(([key, items]) => (
              <li key={key}>
                <div className="text-xs font-semibold leading-6 text-gray-400 uppercase">
                  {key}
                </div>
                <ul role="list" className="mt-2 space-y-1">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex gap-x-3 rounded-md p-2 text-sm leading-6 text-gray-400 hover:bg-gray-800 hover:text-white"
                        )}
                        title={item.tooltip}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}