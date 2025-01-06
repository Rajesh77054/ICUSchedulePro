import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PROVIDERS } from "@/lib/constants";
import { useQuery } from "@tanstack/react-query";
import type { Shift } from "@/lib/types";

export function ProviderList() {
  const { data: shifts } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const getProviderStats = (providerId: number) => {
    const providerShifts = shifts?.filter(s => s.providerId === providerId) || [];
    const totalDays = providerShifts.reduce((acc, shift) => {
      const start = new Date(shift.startDate);
      const end = new Date(shift.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return acc + days;
    }, 0);
    
    return totalDays;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Providers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {PROVIDERS.map(provider => {
          const days = getProviderStats(provider.id);
          const progress = Math.min((days / provider.targetDays) * 100, 100);
          
          return (
            <div key={provider.id} className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">
                  {provider.name}, {provider.title}
                </span>
                <span className="text-sm text-muted-foreground">
                  {days}/{provider.targetDays} days
                </span>
              </div>
              <Progress
                value={progress}
                className="h-2"
                style={{
                  backgroundColor: `${provider.color}40`,
                  "--progress-background": provider.color,
                } as any}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
