import { LocateFixed, Loader2, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUserLocation } from '@/hooks/useUserLocation';

export function UserLocationIndicator() {
  const { location, status, statusMessage, requestLocation } = useUserLocation();
  const title = statusMessage ?? 'Automatic device location stays in memory for nearby data requests. Saved watches or reports may store coordinates locally only when you choose to save them.';

  if (status === 'locating' && !location) {
    return <span role="status" aria-label="Finding your location" title={title} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="hidden sm:inline">Finding your location…</span>
    </span>;
  }

  if (location) {
    return <Button type="button" variant="ghost" size="sm" title={title} aria-label="Refresh device location" onClick={requestLocation} className="h-8 gap-1.5 px-2 text-[11px] text-muted-foreground">
      <LocateFixed className="h-3.5 w-3.5 text-primary" /><span className="hidden sm:inline">Using your location</span>
    </Button>;
  }

  return <Button type="button" variant="ghost" size="sm" title={title} aria-label={status === 'denied' ? 'Location permission is blocked; retry or change browser settings' : status === 'unsupported' ? 'Device location is not supported by this browser' : 'Try to use your device location'} onClick={requestLocation} disabled={status === 'locating' || status === 'unsupported'} className="h-8 gap-1.5 px-2 text-[11px] text-muted-foreground">
    <MapPinOff className="h-3.5 w-3.5" /><span className="hidden sm:inline">{status === 'denied' ? 'Location blocked · check settings' : status === 'unsupported' ? 'Location unsupported · fallback active' : status === 'locating' ? 'Finding location…' : 'Location unavailable · retry'}</span>
  </Button>;
}
