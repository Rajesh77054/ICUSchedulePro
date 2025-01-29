import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, Server, HardDrive, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, AlertCircle } from "@/components/ui/alert";

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
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<ServerMetrics | null>(null);

  const { data: initialMetrics } = useQuery<ServerMetrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: 5000, // Fallback to polling if WebSocket fails
  });

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const websocket = new WebSocket(`${protocol}//${window.location.host}`);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      websocket.send(JSON.stringify({ type: 'auth', userId: 1 }));
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'metrics_update') {
        setRealtimeMetrics(data.data);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const metrics = realtimeMetrics || initialMetrics;

  if (!metrics) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="w-full h-[200px] animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const memoryUsagePercent = (metrics.memoryUsage.used / metrics.memoryUsage.total) * 100;
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'conflict': return 'bg-red-500';
      case 'error': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Server Health Monitor</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* CPU Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              CPU Load
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {metrics.cpuUsage.toFixed(2)}
              </div>
              <Progress value={metrics.cpuUsage * 10} />
            </div>
          </CardContent>
        </Card>

        {/* Memory Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Memory Usage
            </CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {formatBytes(metrics.memoryUsage.used)}
              </div>
              <Progress value={memoryUsagePercent} />
              <p className="text-xs text-muted-foreground">
                {formatBytes(metrics.memoryUsage.free)} free of {formatBytes(metrics.memoryUsage.total)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Server Uptime
            </CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUptime(metrics.uptime)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last updated: {new Date(metrics.lastUpdated).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        {/* Port Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Port Status
            </CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${getStatusColor(metrics.portStatus.status)}`} />
                <span className="text-sm">
                  Port {metrics.portStatus.port} - {metrics.portStatus.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.portStatus.connections} active connections
              </p>
              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(metrics.portStatus.lastChecked).toLocaleTimeString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alert for Port Conflicts */}
        {metrics.portStatus.status === 'conflict' && (
          <div className="col-span-full">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Port Conflict Detected</AlertTitle>
              <AlertDescription>
                Port {metrics.portStatus.port} is experiencing conflicts. This may affect server performance.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}