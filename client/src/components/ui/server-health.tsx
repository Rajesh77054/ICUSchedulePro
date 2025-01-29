import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, Server, Memory, Users } from "lucide-react";

interface ServerMetrics {
  uptime: number;
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
  };
  activeConnections: number;
  lastUpdated: string;
  portStatus: {
    port: number;
    status: 'active' | 'conflict' | 'error';
    connections: number;
    lastChecked: string;
  };
}

export function ServerHealth() {
  const { data: metrics } = useQuery<ServerMetrics>({
    queryKey: ['/api/metrics'],
    queryFn: async () => {
      const response = await fetch('/api/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
    refetchInterval: 5000
  });

  if (!metrics) return null;

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const getPortStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'conflict': return 'bg-red-500';
      case 'error': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <h3 className="text-sm font-medium">CPU Usage</h3>
        </div>
        <p className="mt-2 text-2xl font-bold">{(metrics.cpuUsage * 100).toFixed(1)}%</p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Memory className="h-4 w-4" />
          <h3 className="text-sm font-medium">Memory Usage</h3>
        </div>
        <p className="mt-2 text-2xl font-bold">
          {formatBytes(metrics.memoryUsage.used)} / {formatBytes(metrics.memoryUsage.total)}
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h3 className="text-sm font-medium">Active Connections</h3>
        </div>
        <p className="mt-2 text-2xl font-bold">{metrics.activeConnections}</p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          <h3 className="text-sm font-medium">Port Status</h3>
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${getPortStatusColor(metrics.portStatus.status)}`} />
            <span className="text-sm">
              Port {metrics.portStatus.port} - {metrics.portStatus.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.portStatus.connections} active connections
          </p>
        </div>
      </Card>

      {metrics.portStatus.status === 'conflict' && (
        <Alert variant="destructive" className="col-span-full">
          <AlertTitle>Port Conflict Detected</AlertTitle>
          <AlertDescription>
            Port {metrics.portStatus.port} is currently experiencing conflicts. 
            This may affect server performance.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
