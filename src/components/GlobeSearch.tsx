import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Loader2, MapPin, Search, X } from 'lucide-react';
import { searchCities, type CitySearchResult } from '@/lib/openMeteo';
import { worldCities, type WorldCity } from '@/data/worldCities';

export type GlobeSearchKind = 'city' | 'country';

export interface GlobeSearchTarget {
  location: CitySearchResult;
  kind: GlobeSearchKind;
  focusCityName?: string;
}

interface GlobeSearchProps {
  selectedCity?: CitySearchResult | null;
  selectedIsCountry?: boolean;
  onSelect: (location: CitySearchResult, kind: GlobeSearchKind) => void;
  onReset: () => void;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const countryAliases: Record<string, string[]> = {
  'United States': ['usa', 'us', 'america'],
  'United Kingdom': ['uk', 'britain', 'great britain'],
  'United Arab Emirates': ['uae'],
  'Türkiye': ['turkey'],
  'South Korea': ['korea', 'republic of korea'],
  'Côte d’Ivoire': ['ivory coast'],
  'Democratic Republic of the Congo': ['dr congo', 'drc', 'congo kinshasa'],
};

const getCountryAnchor = (cities: WorldCity[]) => {
  const center = cities.reduce((sum, city) => {
    const lat = (city.lat * Math.PI) / 180;
    const lng = (city.lng * Math.PI) / 180;
    return {
      x: sum.x + Math.cos(lat) * Math.cos(lng),
      y: sum.y + Math.cos(lat) * Math.sin(lng),
      z: sum.z + Math.sin(lat),
    };
  }, { x: 0, y: 0, z: 0 });
  const length = Math.hypot(center.x, center.y, center.z) || 1;
  const lat = (Math.atan2(center.z, Math.hypot(center.x, center.y)) * 180) / Math.PI;
  const lng = (Math.atan2(center.y, center.x) * 180) / Math.PI;
  return cities.reduce((closest, city) => {
    const cityLat = (city.lat * Math.PI) / 180;
    const cityLng = (city.lng * Math.PI) / 180;
    const dot = (center.x / length) * Math.cos(cityLat) * Math.cos(cityLng)
      + (center.y / length) * Math.cos(cityLat) * Math.sin(cityLng)
      + (center.z / length) * Math.sin(cityLat);
    const closestLat = (closest.lat * Math.PI) / 180;
    const closestLng = (closest.lng * Math.PI) / 180;
    const closestDot = (center.x / length) * Math.cos(closestLat) * Math.cos(closestLng)
      + (center.y / length) * Math.cos(closestLat) * Math.sin(closestLng)
      + (center.z / length) * Math.sin(closestLat);
    return dot > closestDot ? city : closest;
  }, cities[0] ?? { id: 0, name: '', country: '', lat, lng });
};

const countryNames = [...new Set(worldCities.map((city) => city.country))];

const matchesCountry = (country: string, query: string) => {
  const countryName = normalize(country);
  const searchText = normalize(query);
  return countryName.includes(searchText)
    || (countryAliases[country] ?? []).some((alias) => normalize(alias).includes(searchText));
};

const countryTargets = (query: string, cityResults: CitySearchResult[] = []): GlobeSearchTarget[] => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const extraCountries = cityResults
    .filter((city) => normalize(city.country).includes(normalizedQuery)
      || (countryAliases[city.country] ?? []).some((alias) => normalize(alias).includes(normalizedQuery)))
    .map((city) => city.country);
  const countries = [...new Set([...countryNames.filter((name) => matchesCountry(name, query)), ...extraCountries])].slice(0, 5);
  return countries.map((country, index) => {
    const indexedCities = worldCities.filter((city) => normalize(city.country) === normalize(country));
    const fallbackCities = cityResults.filter((city) => normalize(city.country) === normalize(country));
    const anchor = getCountryAnchor(indexedCities.length ? indexedCities : fallbackCities as WorldCity[]);
    const hash = [...country].reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 7);
    return {
      kind: 'country',
      focusCityName: anchor.name,
      location: {
        id: -(hash + index + 1),
        name: country,
        country,
        lat: anchor.lat,
        lng: anchor.lng,
      },
    };
  });
};

const createTargets = (query: string, cities: CitySearchResult[]): GlobeSearchTarget[] => {
  const countries = countryTargets(query, cities);
  const countryNamesMatched = new Set(countries.map((target) => normalize(target.location.country)));
  const normalizedQuery = normalize(query);
  const firstSearchWord = normalize(query.split(/[\s,]+/)[0] ?? '');
  let relevantCities: CitySearchResult[];

  if (countryNamesMatched.size > 0) {
    relevantCities = cities.filter((city) => countryNamesMatched.has(normalize(city.country))
      && normalize(city.name) !== normalize(city.country));
  } else {
    const exactMatches = cities.filter((city) => normalize(city.name) === normalizedQuery);
    relevantCities = exactMatches.length
      ? exactMatches.slice(0, 1)
      : cities.filter((city) => normalize(city.name).includes(firstSearchWord) || normalizedQuery.includes(normalize(city.name)));
  }

  const cityTargets = relevantCities.slice(0, 6).map((location) => ({ location, kind: 'city' as const }));
  return [...countries, ...cityTargets];
};

export const GlobeSearch = ({ selectedCity, selectedIsCountry = false, onSelect, onReset }: GlobeSearchProps) => {
  const [query, setQuery] = useState('');
  const [targets, setTargets] = useState<GlobeSearchTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const selectedText = useMemo(() => {
    if (!selectedCity) return '';
    return selectedIsCountry || normalize(selectedCity.name) === normalize(selectedCity.country)
      ? selectedCity.country
      : `${selectedCity.name}, ${selectedCity.country}`;
  }, [selectedCity, selectedIsCountry]);

  useEffect(() => setQuery(selectedText), [selectedText]);

  useEffect(() => {
    const trimmed = query.trim();
    const id = ++requestId.current;
    if (selectedCity && trimmed === selectedText) {
      setTargets([]);
      setLoading(false);
      setError(false);
      setOpen(false);
      return;
    }
    if (trimmed.length < 2) {
      setTargets([]);
      setLoading(false);
      setError(false);
      setOpen(false);
      return;
    }

    setLoading(true);
    setError(false);
    setTargets(countryTargets(trimmed));
    const timer = window.setTimeout(async () => {
      try {
        const cities = await searchCities(trimmed);
        if (requestId.current !== id) return;
        setTargets(createTargets(trimmed, cities));
      } catch {
        if (requestId.current !== id) return;
        setError(true);
        setTargets(countryTargets(trimmed));
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, selectedCity, selectedText]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const chooseTarget = (target: GlobeSearchTarget) => {
    onSelect(target.location, target.kind);
    setQuery(target.kind === 'country' ? target.location.country : `${target.location.name}, ${target.location.country}`);
    setOpen(false);
  };

  const clear = () => {
    setQuery('');
    setTargets([]);
    setOpen(false);
    onReset();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || !targets.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % targets.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + targets.length) % targets.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      chooseTarget(targets[activeIndex] ?? targets[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-[min(24rem,calc(100vw-5.5rem))]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-300" />
        <input
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Find a city or country…"
          className="h-11 w-full rounded-xl border border-sky-300/30 bg-slate-950/85 pl-10 pr-10 text-sm text-white shadow-xl shadow-slate-950/30 outline-none backdrop-blur-xl placeholder:text-slate-400 transition focus:border-sky-300/80 focus:ring-2 focus:ring-sky-300/25"
          aria-label="Find a city or country on the globe"
          aria-expanded={open && query.length >= 2}
          aria-controls="globe-search-results"
          role="combobox"
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sky-300" />}
        {!loading && query && <button type="button" onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white" aria-label="Clear globe search"><X className="h-4 w-4" /></button>}
      </div>
      {open && query.length >= 2 && <div id="globe-search-results" className="absolute z-40 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-sky-300/25 bg-slate-950/95 p-1.5 text-white shadow-2xl shadow-slate-950/50 backdrop-blur-xl" role="listbox">
        {targets.length === 0 && (loading || error) && <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-300">{loading ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : <MapPin className="h-4 w-4" />}{loading ? 'Searching places…' : 'No matching places. Try a city name.'}</div>}
        {targets.length === 0 && !loading && !error && <p className="px-3 py-3 text-sm text-slate-300">No places found. Try another spelling.</p>}
        {targets.map((target, index) => (
          <button
            key={target.kind === 'country' ? `country-${target.location.country}` : `city-${target.location.id}-${target.location.lat}`}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => chooseTarget(target)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${index === activeIndex ? 'bg-sky-500/20' : 'hover:bg-white/5'}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-500/10 text-sky-200">{target.kind === 'country' ? <Globe2 className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{target.location.name}</span><span className="block truncate text-xs text-slate-400">{target.kind === 'country' ? `Country · focus near ${target.focusCityName}` : [target.location.admin1, target.location.country].filter(Boolean).join(', ')}</span></span>
            <span className="rounded-full border border-sky-300/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-200">{target.kind}</span>
          </button>
        ))}
        {error && targets.length > 0 && <p className="px-3 py-2 text-[11px] text-slate-400">Showing saved country locations; live city search is temporarily unavailable.</p>}
        <p className="px-3 pb-1 pt-2 text-[10px] text-slate-500">Choose a result to move the globe to its weather markers.</p>
      </div>}
    </div>
  );
};
