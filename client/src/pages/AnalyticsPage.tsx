import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, TrendingUp, Users, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface WorkloadData {
  name: string;
  actualDays: number;
  targetDays: number;
  utilization: number;
}

interface DistributionData {
  type: string;
  totalDays: number;
  shiftCount: number;
  avgShiftLength: number;
}

interface FatigueData {
  name: string;
  maxAllowed: number;
  currentConsecutive: number;
  fatigueRisk: 'low' | 'medium' | 'high';
}

type TimeRange = 'week' | 'month' | 'quarter';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  const { data: workloadData, isLoading: isLoadingWorkload, error: workloadError } = useQuery<WorkloadData[]>({
    queryKey: ["/api/analytics/workload", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/workload?timeRange=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch workload data');
      return res.json();
    }
  });

  const { data: distributionData, isLoading: isLoadingDistribution, error: distributionError } = useQuery<DistributionData[]>({
    queryKey: ["/api/analytics/distribution", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/distribution?timeRange=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch distribution data');
      return res.json();
    }
  });

  const { data: fatigueData, isLoading: isLoadingFatigue, error: fatigueError } = useQuery<FatigueData[]>({
    queryKey: ["/api/analytics/fatigue", timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/fatigue?timeRange=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch fatigue data');
      return res.json();
    }
  });

  if (isLoadingWorkload || isLoadingDistribution || isLoadingFatigue) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="w-full h-[400px] animate-pulse bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (workloadError || distributionError || fatigueError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load analytics data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <Select 
          value={timeRange} 
          onValueChange={(value: TimeRange) => setTimeRange(value)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Staff Utilization Chart */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Staff Utilization
            </CardTitle>
            <CardDescription>
              Actual vs target days worked by staff member
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actualDays" name="Actual Days" fill="#0088FE" />
                  <Bar dataKey="targetDays" name="Target Days" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Staff Distribution Chart */}
        <Card className="col-span-full md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Distribution
            </CardTitle>
            <CardDescription>
              Distribution of shifts by staff type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    dataKey="totalDays"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    label={(entry) => entry.type}
                  >
                    {distributionData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Fatigue Risk Chart */}
        <Card className="col-span-full md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Fatigue Risk
            </CardTitle>
            <CardDescription>
              Staff fatigue risk based on consecutive shifts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fatigueData} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Bar
                    dataKey="currentConsecutive"
                    fill="#8884d8"
                    stroke={(entry) => {
                      const data = entry as FatigueData;
                      switch (data.fatigueRisk) {
                        case 'high':
                          return '#ef4444';
                        case 'medium':
                          return '#f97316';
                        default:
                          return '#22c55e';
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}