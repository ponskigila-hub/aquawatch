import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RiskLevel } from '@/types/flood';
import { RiskBadge } from './RiskBadge';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, AlertCircle, CheckCircle, BellOff, ExternalLink } from 'lucide-react';
import type { LiveAlert } from '@/lib/liveAlerts';

interface AlertListProps {
  alerts: LiveAlert[];
  regionLabel: string;
  isLoading?: boolean;
}

const levelConfig: Record<RiskLevel, { icon: typeof AlertTriangle; border: string; iconColor: string }> = {
  high: { icon: AlertTriangle, border: 'border-l-risk-high', iconColor: 'text-risk-high' },
  medium: { icon: AlertCircle, border: 'border-l-risk-medium', iconColor: 'text-risk-medium' },
  safe: { icon: CheckCircle, border: 'border-l-risk-safe', iconColor: 'text-risk-safe' },
};

export const AlertList = ({ alerts, regionLabel, isLoading = false }: AlertListProps) => {
  const highCount = alerts.filter((alert) => alert.level === 'high').length;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Alerts &amp; Rain Signals</CardTitle>
          <CardDescription>Weather signals and reported events near {regionLabel}</CardDescription>
        </div>
        {highCount > 0 && <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-risk-high/10 text-risk-high whitespace-nowrap">{highCount} high</span>}
      </CardHeader>
      <CardContent>
        {isLoading && alerts.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Checking the latest weather and reported events…</div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <BellOff className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No active event or high-rain signals in this region</p>
          </div>
        ) : (
          <ScrollArea className="h-[340px] pr-3 -mr-3">
            <div className="space-y-3">
              {alerts.map((alert) => {
                const config = levelConfig[alert.level];
                const Icon = config.icon;
                return (
                  <div key={alert.id} className={`p-3.5 rounded-lg border border-l-4 ${config.border} bg-card`}>
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0"><Icon className={`w-4 h-4 shrink-0 ${config.iconColor}`} /><h4 className="font-semibold text-sm truncate">{alert.location}</h4></div>
                      <RiskBadge level={alert.level} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-1.5 leading-snug">{alert.message}</p>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{alert.source} · {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
                      {alert.url && <a href={alert.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary whitespace-nowrap">Source <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground mt-3">These are estimates, not official emergency alerts. Follow local authorities for safety advice.</p>
      </CardContent>
    </Card>
  );
};
