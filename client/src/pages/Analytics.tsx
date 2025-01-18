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
import { Loader2 } from "lucide-react";
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

export function Analytics() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  const { data: workloadData, isLoading: isLoadingWorkload } = useQuery({
    queryKey: ['/api/analytics/workload', timeRange],
  });

  const { data: fatigueData, isLoading: isLoadingFatigue } = useQuery({
    queryKey: ['/api/analytics/fatigue', timeRange],
  });

  const { data: distributionData, isLoading: isLoadingDistribution } = useQuery({
    queryKey: ['/api/analytics/distribution', timeRange],
  });

  if (isLoadingWorkload || isLoadingFatigue || isLoadingDistribution) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Workload Analytics</h1>
        <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
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
        {/* Work Hours Distribution */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Work Hours Distribution</CardTitle>
            <CardDescription>
              Hours worked by each provider over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData?.hoursDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="hours" fill="#8884d8" name="Hours Worked" />
                  <Bar dataKey="target" fill="#82ca9d" name="Target Hours" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Fatigue Risk Monitoring */}
        <Card className="col-span-full md:col-span-2">
          <CardHeader>
            <CardTitle>Fatigue Risk Monitoring</CardTitle>
            <CardDescription>
              Consecutive shifts and rest periods analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fatigueData?.fatigueMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="consecutiveShifts"
                    stroke="#8884d8"
                    name="Consecutive Shifts"
                  />
                  <Line
                    type="monotone"
                    dataKey="restHours"
                    stroke="#82ca9d"
                    name="Rest Hours"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Fair Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Fair Distribution</CardTitle>
            <CardDescription>
              Workload distribution across providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData?.fairnessMetrics}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {distributionData?.fairnessMetrics?.map((entry: any, index: number) => (
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
      </div>
    </div>
  );
}