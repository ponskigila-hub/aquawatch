import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/components/ThemeProvider';
import { UserLocationProvider } from '@/hooks/useUserLocation';
import Index from './pages/Index';
import DistrictDetail from './pages/DistrictDetail';
import NotFound from './pages/NotFound';

const ForecastPage = lazy(() => import('./pages/ForecastPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const HazardsPage = lazy(() => import('./pages/HazardsPage'));
const AirQualityPage = lazy(() => import('./pages/AirQualityPage'));
const OceanPage = lazy(() => import('./pages/OceanPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const queryClient = new QueryClient();

const App = () => (
  <UserLocationProvider>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/forecast" element={<Suspense fallback={<main className="container mx-auto p-8 text-sm text-muted-foreground">Loading forecast…</main>}><ForecastPage /></Suspense>} />
            <Route path="/community" element={<Suspense fallback={<main className="container mx-auto p-8 text-sm text-muted-foreground">Loading community tools…</main>}><CommunityPage /></Suspense>} />
            <Route path="/tools" element={<Suspense fallback={<main className="container mx-auto p-8 text-sm text-muted-foreground">Loading map tools…</main>}><ToolsPage /></Suspense>} />
            <Route path="/hazards" element={<Suspense fallback={<main className="container mx-auto p-8 text-sm text-muted-foreground">Loading hazard layers…</main>}><HazardsPage /></Suspense>} />
            <Route path="/air-quality" element={<Suspense fallback={<main className="container mx-auto p-8 text-sm text-muted-foreground">Loading air-quality layers…</main>}><AirQualityPage /></Suspense>} />
            <Route path="/ocean" element={<Suspense fallback={<main className="container mx-auto p-8 text-sm text-muted-foreground">Loading ocean layers…</main>}><OceanPage /></Suspense>} />
            <Route path="/history" element={<Suspense fallback={<main className="container mx-auto p-8 text-sm text-muted-foreground">Loading weather history…</main>}><HistoryPage /></Suspense>} />
            <Route path="/district/:id" element={<DistrictDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </UserLocationProvider>
);

export default App;
