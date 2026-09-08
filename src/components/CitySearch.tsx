import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { searchCities, CitySearchResult } from '@/lib/openMeteo';

interface CitySearchProps {
  onSelect: (city: CitySearchResult) => void;
  placeholder?: string;
}

export const CitySearch = ({ onSelect, placeholder = 'Search any city worldwide…' }: CitySearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const cities = await searchCities(query);
        setResults(cities);
      } catch {
        setError(true);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close the dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (city: CitySearchResult) => {
    onSelect(city);
    setQuery(`${city.name}, ${city.country}`);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full sm:max-w-xs">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && query && (
        <div className="absolute z-30 mt-1.5 w-full bg-popover border rounded-lg shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Searching…
            </div>
          ) : error ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              Couldn't reach the search service. Check your connection.
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">No cities found for "{query}"</div>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((city) => (
                <li key={city.id}>
                  <button
                    onClick={() => handleSelect(city)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/10 flex items-center gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      <span className="font-medium text-foreground">{city.name}</span>
                      <span className="text-muted-foreground">
                        {city.admin1 ? `, ${city.admin1}` : ''}, {city.country}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
