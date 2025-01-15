import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Provider, Shift } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

interface ProviderListProps {
  providers?: Provider[];
}

export function ProviderList({ providers = [] }: ProviderListProps) {
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
        {providers.map(provider => {
          const days = getProviderStats(provider.id);
          const progress = Math.min((days / provider.targetDays) * 100, 100);

          return (
            <Link key={provider.id} href={`/provider/${provider.id}`}>
              <div className="space-y-2 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium block">
                      {provider.name}, {provider.title}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {days}/{provider.targetDays} days
                    </span>
                  </div>
                  <Button variant="ghost" size="icon">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
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
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}