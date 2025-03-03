import { useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

// Map routes to breadcrumb items with tooltips
const routeMap: Record<string, { title: string; parent?: string; tooltip?: string }> = {
  "/": { title: "Schedule" },
  "/provider": { title: "Provider Schedule", parent: "/", tooltip: "View and manage your personal schedule" },
  "/swap-requests": { title: "Shift Swaps", parent: "/", tooltip: "Request and manage shift swaps with other providers" },
  "/time-off": { title: "Time Off", parent: "/", tooltip: "Submit and track time-off requests" },
  "/admin": { title: "Administration", parent: "/", tooltip: "Access administrative functions" },
  "/admin/time-off": { title: "Time Off Admin", parent: "/admin", tooltip: "Review and manage time-off requests" },
  "/admin/users": { title: "User Management", parent: "/admin", tooltip: "Manage healthcare providers and their roles" },
  "/admin/schedule": { title: "Schedule Management", parent: "/admin", tooltip: "Manage calendar data and scheduling rules" },
  "/preferences": { title: "Preferences", parent: "/", tooltip: "Set your scheduling preferences and notifications" },
};

export function BreadcrumbNavigation() {
  const [location] = useLocation();

  // Build breadcrumb path
  const buildPath = (route: string): Array<{ path: string; title: string; tooltip?: string }> => {
    const items = [];
    let currentRoute = route;

    while (currentRoute) {
      const routeInfo = routeMap[currentRoute];
      if (!routeInfo) break;

      items.unshift({
        path: currentRoute,
        title: routeInfo.title,
        tooltip: routeInfo.tooltip,
      });

      currentRoute = routeInfo.parent || "";
    }

    return items;
  };

  const breadcrumbs = buildPath(location);
  const isLastItem = (index: number) => index === breadcrumbs.length - 1;

  return (
    <Breadcrumb className="px-4 py-2 bg-background border-b">
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => (
          <BreadcrumbItem key={item.path}>
            {isLastItem(index) ? (
              <>
                <BreadcrumbPage>{item.title}</BreadcrumbPage>
                {item.tooltip && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info 
                          className="h-4 w-4 ml-2 text-muted-foreground cursor-help" 
                          aria-label={`More information about ${item.title}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </>
            ) : (
              <>
                <BreadcrumbLink href={item.path}>{item.title}</BreadcrumbLink>
                <BreadcrumbSeparator />
              </>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}