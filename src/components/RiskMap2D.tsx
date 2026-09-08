import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent } from '@/components/ui/card';
import { jakartaDistricts } from '@/data/mockData';
import { fetchFloodStormEvents } from '@/lib/eonet';
import { fetchCityWeather, CitySearchResult } from '@/lib/openMeteo';

const riskColors: Record<string, string> = {
  safe: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

const disasterColors: Record<string, string> = {
  Floods: '#38bdf8',
  'Severe Storms': '#a855f7',
};
const disasterColor = (category: string) => disasterColors[category] ?? '#fb923c';

const popupStyles = `
  .risk-popup .leaflet-popup-content-wrapper {
    border-radius: 8px;
  }
  .leaflet-interactive {
    cursor: pointer;
  }
  .district-label {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: white;
    font-weight: 700;
    font-size: 12px;
  }
  .district-label::before {
    display: none;
  }
`;

interface RiskMap2DProps {
  searchedCity?: CitySearchResult | null;
}

export const RiskMap2D = ({ searchedCity }: RiskMap2DProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const searchedMarkerRef = useRef<L.CircleMarker | null>(null);
  const navigate = useNavigate();
  const [height, setHeight] = useState(420);

  const { data: disasterEvents = [] } = useQuery({
    queryKey: ['eonet-flood-storm-events'],
    queryFn: fetchFloodStormEvents,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const updateHeight = () => setHeight(window.innerWidth < 640 ? 340 : window.innerWidth < 1024 ? 420 : 500);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Base map + district + disaster markers (created once)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!document.getElementById('risk-popup-style')) {
      const style = document.createElement('style');
      style.id = 'risk-popup-style';
      style.textContent = popupStyles;
      document.head.appendChild(style);
    }

    map.current = L.map(mapContainer.current).setView([-6.2088, 106.8456], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map.current);

    jakartaDistricts.forEach((district) => {
      if (!map.current) return;
      const color = riskColors[district.riskLevel];
      const marker = L.circleMarker(district.coordinates, {
        radius: 20,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(map.current);

      marker.bindTooltip(`<b>${district.rainfall}</b>`, {
        direction: 'center',
        permanent: true,
        className: `district-label district-label-${district.riskLevel}`,
      });

      marker.on('click', () => {
        if (!map.current) return;
        L.popup({ offset: [0, -10], className: 'risk-popup', minWidth: 220 })
          .setLatLng(district.coordinates)
          .setContent(`
            <div style="min-width:220px; font-family: inherit;">
              <b style="font-size:1.15em;">${district.name}</b><br>
              <div style="margin: 6px 0; color:#555; font-size: 0.85em;">
                <b>Rainfall:</b> ${district.rainfall}mm &nbsp;·&nbsp;
                <b>Water:</b> ${district.waterLevel}cm
              </div>
              <span style="display:inline-block; margin-bottom:8px; padding:2px 8px; border-radius:999px; font-size:0.75em; font-weight:600; text-transform:uppercase; color:white; background:${color};">${district.riskLevel} risk</span><br>
              <button id="view-details-${district.id}" style="width:100%; margin-top:4px; padding:6px 10px; border-radius:6px; border:none; background:${color}; color:white; font-weight:600; font-size:0.85em; cursor:pointer;">
                View full details →
              </button>
            </div>
          `)
          .openOn(map.current);

        setTimeout(() => {
          document.getElementById(`view-details-${district.id}`)?.addEventListener('click', () => {
            navigate(`/district/${district.id}`);
          });
        }, 0);
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [navigate]);

  // Disaster markers (added once loaded, doesn't require full remount)
  useEffect(() => {
    if (!map.current || disasterEvents.length === 0) return;
    const layer = L.layerGroup().addTo(map.current);

    disasterEvents.forEach((event) => {
      const color = disasterColor(event.category);
      const marker = L.circleMarker([event.lat, event.lng], {
        radius: 9,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2,
      }).addTo(layer);

      marker.bindPopup(`
        <div style="min-width:200px; font-family: inherit;">
          <b>${event.title}</b><br>
          <span style="display:inline-block; margin:6px 0; padding:2px 8px; border-radius:999px; font-size:0.75em; font-weight:600; color:white; background:${color};">${event.category}</span><br>
          <a href="${event.link}" target="_blank" rel="noopener noreferrer" style="font-size:0.8em;">View source on NASA →</a>
        </div>
      `, { className: 'risk-popup' });
    });

    return () => {
      layer.remove();
    };
  }, [disasterEvents]);

  // Fly to + mark a searched city
  useEffect(() => {
    if (!map.current || !searchedCity) return;

    if (searchedMarkerRef.current) {
      searchedMarkerRef.current.remove();
      searchedMarkerRef.current = null;
    }

    map.current.flyTo([searchedCity.lat, searchedCity.lng], 10, { duration: 1.2 });

    const marker = L.circleMarker([searchedCity.lat, searchedCity.lng], {
      radius: 12,
      color: '#eab308',
      fillColor: '#eab308',
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map.current);
    searchedMarkerRef.current = marker;

    const popup = L.popup({ className: 'risk-popup', minWidth: 200 })
      .setLatLng([searchedCity.lat, searchedCity.lng])
      .setContent(`<div style="font-family:inherit;"><b>${searchedCity.name}</b><br/><span style="color:#666;font-size:0.85em;">Loading live weather…</span></div>`);
    marker.bindPopup(popup).openPopup();

    fetchCityWeather(searchedCity.lat, searchedCity.lng)
      .then((weather) => {
        marker.setPopupContent(`
          <div style="min-width:200px; font-family: inherit;">
            <b>${searchedCity.name}</b><br>
            <span style="color:#666; font-size:0.85em;">${searchedCity.country}</span>
            <div style="margin-top:6px; font-size:0.85em;">
              <b>${weather.rainfallTodayMm}mm</b> rain today · <b>${Math.round(weather.tempC)}°C</b>
            </div>
            <div style="font-size:0.7em; color:#999; margin-top:4px;">Live data from Open-Meteo</div>
          </div>
        `);
      })
      .catch(() => {
        marker.setPopupContent(`<div style="font-family:inherit;"><b>${searchedCity.name}</b><br/><span style="color:#999;font-size:0.8em;">Live weather unavailable</span></div>`);
      });

    return () => {
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchedCity]);

  return (
    <Card className="overflow-hidden">
      <div ref={mapContainer} className="w-full" style={{ height }} />
      <CardContent className="p-3 sm:p-4 bg-muted/40 border-t">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-risk-safe ring-4 ring-risk-safe/15" />
            <span className="whitespace-nowrap text-muted-foreground">Low <span className="text-foreground/70">(&lt;20mm)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-risk-medium ring-4 ring-risk-medium/15" />
            <span className="whitespace-nowrap text-muted-foreground">Medium <span className="text-foreground/70">(20–50mm)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-risk-high ring-4 ring-risk-high/15" />
            <span className="whitespace-nowrap text-muted-foreground">High <span className="text-foreground/70">(&gt;50mm)</span></span>
          </div>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full" style={{ backgroundColor: disasterColors.Floods }} />
            <span className="whitespace-nowrap text-muted-foreground">Flood <span className="text-foreground/70">(live)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full" style={{ backgroundColor: disasterColors['Severe Storms'] }} />
            <span className="whitespace-nowrap text-muted-foreground">Storm <span className="text-foreground/70">(live)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-yellow-500" />
            <span className="whitespace-nowrap text-muted-foreground">Searched city</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
