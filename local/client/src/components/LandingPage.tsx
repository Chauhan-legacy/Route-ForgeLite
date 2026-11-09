import React, { useState } from 'react';
import {
  MapPin,
  ArrowRight,
  Menu,
  X,
  Compass,
  Navigation,
  FileSpreadsheet,
  Activity,
  Cpu,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingDown,
  Clock,
  Fuel,
  Leaf,
  Check
} from 'lucide-react';

interface LandingPageProps {
  onStartPlanning: (scenario?: 'urban' | 'corridor' | 'roundtrip') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartPlanning }) => {
  const [activePreviewScenario, setActivePreviewScenario] = useState<'urban' | 'corridor' | 'roundtrip'>('urban');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scenarios = {
    urban: {
      title: 'Urban Express Delivery',
      subtitle: 'San Francisco Downtown Corridor',
      originalKm: '28.5',
      optimizedKm: '14.2',
      savingsPercent: '50.2%',
      timeSaved: '22 mins',
      fuelSaved: '1.2 L',
      co2Saved: '2.8 kg',
      stops: ['1 Ferry Building', '333 Post St (Union Sq)', '1070 Lombard St', 'Golden Gate Bridge'],
      circuit: 'Open-Ended Tour (Fixed Origin)'
    },
    corridor: {
      title: 'Regional Supply Corridor',
      subtitle: 'Airport Hub to Presidio Terminal',
      originalKm: '64.8',
      optimizedKm: '41.3',
      savingsPercent: '36.3%',
      timeSaved: '38 mins',
      fuelSaved: '2.0 L',
      co2Saved: '4.6 kg',
      stops: ['SFO Cargo Hub', 'Mission Depot', 'Financial District', 'Presidio Distribution'],
      circuit: 'Fixed Origin & Destination'
    },
    roundtrip: {
      title: 'Closed-Loop Inspection',
      subtitle: 'Pier 39 Sunset Return Loop',
      originalKm: '39.4',
      optimizedKm: '19.1',
      savingsPercent: '51.5%',
      timeSaved: '31 mins',
      fuelSaved: '1.7 L',
      co2Saved: '4.0 kg',
      stops: ['Depot Alpha (Pier 39)', 'Sunset Retail Hub', 'Twin Peaks Inspection', 'Depot Alpha (Pier 39)'],
      circuit: 'Full Roundtrip Circuit'
    }
  };

  const currentScenario = scenarios[activePreviewScenario];

  return (
    <div className="min-h-screen w-full bg-[#EFECE6] p-2 sm:p-5 md:p-8 flex flex-col items-center justify-start text-[#16191D] font-sans selection:bg-[#16191D] selection:text-[#FAF8F5]">
      {/* Outer Framed Sheet (Magazine / Editorial Board Canvas) */}
      <div className="w-full max-w-[1340px] bg-[#FAF8F5] border border-[#E5E1D8] shadow-float rounded-2xl md:rounded-3xl overflow-hidden relative flex flex-col">
        
        {/* Subtle Diagonal Guide Line across Canvas (Architectural Draftsman Accent) */}
        <div className="absolute top-0 right-0 w-full h-[640px] pointer-events-none overflow-hidden z-0 opacity-40">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 600" fill="none">
            <line x1="120" y1="0" x2="880" y2="600" stroke="#DDD7CC" strokeWidth="1" strokeDasharray="6 6" />
            <line x1="880" y1="0" x2="320" y2="600" stroke="#E6E0D5" strokeWidth="0.75" />
          </svg>
        </div>

        {/* Top Header Navigation */}
        <header className="relative z-20 px-6 sm:px-12 py-6 border-b border-[#EAE6DD] flex items-center justify-between bg-[#FAF8F5]/85 backdrop-blur-md">
          {/* Left: Menu & Brand Identity */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 -ml-1.5 text-editorial-ink hover:text-black transition-colors md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              {/* Minimal Geometric Logo Glyph */}
              <div className="w-7 h-7 rounded-full bg-[#16191D] text-[#FAF8F5] flex items-center justify-center shadow-subtle">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="18" r="3" />
                  <path d="M6 9v3a6 6 0 0 0 6 6h3" />
                </svg>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-[#16191D]">
                  RouteForge
                </span>
                <span className="hidden sm:inline-block text-[9px] font-mono tracking-widest uppercase text-editorial-subtle px-1.5 py-0.5 rounded bg-[#F0ECE4] border border-[#E2DDD3]">
                  v2.0
                </span>
              </div>
            </div>
          </div>

          {/* Center Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-editorial-body tracking-wide">
            <a href="#manifesto" className="hover:text-black transition-colors">
              Who We Are
            </a>
            <a href="#benchmarks" className="hover:text-black transition-colors">
              Live Benchmarks
            </a>
            <a href="#architecture" className="hover:text-black transition-colors">
              Architecture
            </a>
            <a href="#workflow" className="hover:text-black transition-colors">
              Workflow
            </a>
          </nav>

          {/* Right Action: Editorial Dark Button (Inspired by BOOK NOW) */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3EFE7] border border-[#E2DDD3] text-[10px] font-mono text-editorial-body">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>Zero API Keys &bull; 100% Free</span>
            </div>

            <button
              onClick={() => onStartPlanning()}
              className="px-5 sm:px-6 py-2.5 bg-[#16191D] hover:bg-black text-[#FAF8F5] text-xs font-mono font-medium tracking-widest uppercase transition-all shadow-subtle flex items-center gap-2 group"
            >
              <span>LAUNCH PLANNER</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden z-20 px-6 py-4 bg-[#F6F3EC] border-b border-[#E5E1D8] flex flex-col gap-3 text-xs font-medium text-editorial-body">
            <a
              href="#manifesto"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-black transition-colors"
            >
              Who We Are
            </a>
            <a
              href="#benchmarks"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-black transition-colors"
            >
              Live Benchmarks
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-black transition-colors"
            >
              Architecture
            </a>
            <a
              href="#workflow"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-black transition-colors"
            >
              Workflow
            </a>
            <div className="pt-2 border-t border-[#E5E1D8]">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onStartPlanning();
                }}
                className="w-full py-2.5 bg-[#16191D] text-[#FAF8F5] text-xs font-mono tracking-widest uppercase text-center"
              >
                Launch Planner
              </button>
            </div>
          </div>
        )}

        {/* Hero Section: Exact ProNature Composition (Editorial Serif Left + Signature Arch Visual Right) */}
        <section className="relative z-10 px-6 sm:px-12 md:px-16 pt-12 sm:pt-20 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column (Editorial Typography & Action) */}
          <div className="lg:col-span-7 flex flex-col items-start pr-0 lg:pr-6">
            
            {/* Release Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3EFE7] border border-[#E2DDD3] text-[11px] text-editorial-body mb-6 shadow-subtle">
              <Sparkles className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-editorial-subtle">Algorithmic Precision</span>
              <span className="text-[#DDD7CC]">&bull;</span>
              <span className="font-medium text-editorial-ink">Google OR-Tools + OpenFreeMap</span>
            </div>

            {/* Headline matching ProNature Editorial Style */}
            <h1 className="font-serif italic font-normal text-5xl sm:text-7xl lg:text-[5.5rem] tracking-tight text-[#16191D] leading-[1.04]">
              Captivate and<br />
              Optimize with<br />
              RouteForge.
            </h1>

            {/* Subhead matching the light flowing italic cursive/serif line */}
            <p className="font-serif italic text-xl sm:text-2xl text-editorial-body/85 mt-6 mb-8 font-light tracking-wide max-w-xl">
              Discover the definitive multi-stop routing and tour engine.
            </p>

            <p className="text-xs sm:text-sm text-editorial-subtle max-w-lg leading-relaxed mb-9">
              Solve the complex Traveling Salesperson Problem across actual road networks. Eliminate
              wasteful backtracking, reduce driver transit hours, and verify fuel savings with transparent
              telemetry — zero credit cards, zero proprietary API tokens.
            </p>

            {/* Solid Rectangular CTA matching ProNature BOOK NOW */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
              <button
                onClick={() => onStartPlanning()}
                className="px-8 py-4 bg-[#16191D] hover:bg-black text-[#FAF8F5] text-xs font-mono font-medium tracking-widest uppercase transition-all shadow-subtle flex items-center justify-center gap-3 group"
              >
                <span>PLAN YOUR TOUR</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#benchmarks"
                className="px-6 py-4 bg-[#FAF8F5] hover:bg-[#F3EFE7] border border-[#DCD7CD] text-xs font-mono font-medium tracking-wider uppercase text-editorial-body hover:text-editorial-ink transition-colors text-center"
              >
                View Benchmarks &darr;
              </a>
            </div>

            {/* Micro Spec Badges */}
            <div className="grid grid-cols-3 gap-4 mt-12 pt-8 border-t border-[#EAE6DD] w-full max-w-lg">
              <div>
                <span className="block text-[10px] font-mono uppercase tracking-wider text-editorial-subtle">Engine</span>
                <span className="font-serif text-sm sm:text-base font-semibold text-editorial-ink mt-0.5 block">OR-Tools GLS</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono uppercase tracking-wider text-editorial-subtle">Cartography</span>
                <span className="font-serif text-sm sm:text-base font-semibold text-editorial-ink mt-0.5 block">OpenFreeMap</span>
              </div>
              <div>
                <span className="block text-[10px] font-mono uppercase tracking-wider text-editorial-subtle">Cost</span>
                <span className="font-serif text-sm sm:text-base font-semibold text-emerald-800 mt-0.5 block">₹0 Free Forever</span>
              </div>
            </div>
          </div>

          {/* Right Column: Signature ARCH-SHAPED Showcase (Direct from Inspiration Image) */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-[420px] h-[500px] sm:h-[580px] rounded-t-[210px] sm:rounded-t-[250px] rounded-b-2xl border border-[#D8D2C6] bg-gradient-to-b from-[#F2EFE8] via-[#F8F6F0] to-[#FAF8F5] overflow-hidden relative shadow-float flex flex-col justify-between p-6 sm:p-7">
              
              {/* Top Arch Watermark Badge */}
              <div className="flex flex-col items-center pt-8 sm:pt-10 z-10 text-center">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-editorial-subtle">
                  Optimal Tour Simulation
                </span>
                <span className="font-serif italic text-base sm:text-lg text-editorial-ink mt-0.5">
                  San Francisco Corridor
                </span>
              </div>

              {/* Central Vector Route Visual inside Arch */}
              <div className="relative my-auto w-full flex items-center justify-center py-6">
                {/* Background Geometric Grid / Topo Curves */}
                <svg className="w-full h-56" viewBox="0 0 340 220" fill="none">
                  {/* Faint Cartographic Grid */}
                  <g opacity="0.25" stroke="#16191D" strokeWidth="0.5">
                    <line x1="20" y1="30" x2="320" y2="30" />
                    <line x1="20" y1="80" x2="320" y2="80" />
                    <line x1="20" y1="130" x2="320" y2="130" />
                    <line x1="20" y1="180" x2="320" y2="180" />
                    <line x1="50" y1="10" x2="50" y2="210" />
                    <line x1="120" y1="10" x2="120" y2="210" />
                    <line x1="190" y1="10" x2="190" y2="210" />
                    <line x1="260" y1="10" x2="260" y2="210" />
                  </g>

                  {/* Scrambled Prior Route (Backtracking dashed line) */}
                  <path
                    d="M 50 160 L 280 40 L 130 150 L 220 70"
                    stroke="#DC2626"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeOpacity="0.4"
                  />

                  {/* Smooth Optimal Route Polyline */}
                  <path
                    id="optimalRoutePath"
                    d="M 50 160 C 90 90, 150 170, 220 70 S 260 40, 280 40"
                    stroke="#16191D"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Dynamic Moving Courier Vehicle along the Route (Sliding Object) */}
                  <circle r="6" fill="#047857" stroke="#FAF8F5" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
                    <animateMotion
                      path="M 50 160 C 90 90, 150 170, 220 70 S 260 40, 280 40"
                      dur="3.8s"
                      repeatCount="indefinite"
                      rotate="auto"
                    />
                  </circle>
                  <circle r="12" fill="#047857" opacity="0.25">
                    <animateMotion
                      path="M 50 160 C 90 90, 150 170, 220 70 S 260 40, 280 40"
                      dur="3.8s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  {/* Waypoint 1: Ferry Building */}
                  <circle cx="50" cy="160" r="8" fill="#16191D" stroke="#FAF8F5" strokeWidth="2.5" />
                  <circle cx="50" cy="160" r="14" stroke="#16191D" strokeWidth="1" strokeOpacity="0.3" className="animate-ping" />
                  <text x="50" y="190" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace">Ferry Bld.</text>

                  {/* Waypoint 2: Union Sq */}
                  <circle cx="130" cy="130" r="7" fill="#16191D" stroke="#FAF8F5" strokeWidth="2" />
                  <text x="130" y="112" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace">Union Sq</text>

                  {/* Waypoint 3: Lombard */}
                  <circle cx="215" cy="75" r="7" fill="#16191D" stroke="#FAF8F5" strokeWidth="2" />
                  <text x="215" y="98" textAnchor="middle" fill="#6B7280" fontSize="9" fontFamily="monospace">Lombard</text>

                  {/* Waypoint 4: Golden Gate */}
                  <circle cx="280" cy="40" r="8" fill="#047857" stroke="#FAF8F5" strokeWidth="2.5" />
                  <text x="280" y="24" textAnchor="middle" fill="#047857" fontWeight="bold" fontSize="9" fontFamily="monospace">Golden Gate</text>
                </svg>

                {/* Floating Telemetry Glass Pill */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[90%] bg-[#FAF8F5]/95 border border-[#D8D2C6] shadow-card rounded-xl p-3 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="block text-[9px] font-mono uppercase tracking-wider text-editorial-subtle">
                      Distance Reduction
                    </span>
                    <span className="font-serif text-sm font-semibold text-editorial-ink">
                      28.5 km &rarr; 14.2 km
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[11px] font-bold">
                    -50.2% Saved
                  </span>
                </div>
              </div>

              {/* Bottom Arch Action */}
              <div className="z-10 pt-4 border-t border-[#E5E1D8] flex items-center justify-between text-[11px] font-mono text-editorial-subtle">
                <span>37°46'39"N 122°24'00"W</span>
                <button
                  onClick={() => onStartPlanning('urban')}
                  className="text-editorial-ink font-semibold hover:underline flex items-center gap-1"
                >
                  Load in Planner &rarr;
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: WHO WE ARE (Exact Editorial Style from the Reference Image) */}
        <section id="manifesto" className="relative z-10 px-6 sm:px-12 md:px-20 py-20 sm:py-28 border-t border-[#EAE6DD] bg-[#FAF8F5]">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
            
            {/* Small Uppercase Spaced Tag */}
            <span className="text-[11px] font-mono tracking-[0.25em] uppercase text-editorial-subtle">
              WHO WE ARE
            </span>

            {/* Large Editorial Serif Italic Statement */}
            <h2 className="font-serif italic text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#16191D] mt-6 mb-8 leading-[1.18]">
              RouteForge is all about pure algorithmic clarity without the cartoonish clutter or enterprise tolls.
            </h2>

            {/* Editorial Body Description */}
            <p className="font-sans text-sm sm:text-base text-editorial-body leading-relaxed max-w-2xl mx-auto">
              We engineered RouteForge for dispatchers, couriers, and field engineers who refuse to accept
              proprietary map quotas, billing lockouts, or cartoonish interfaces. By pairing open vector cartography
              with Google OR-Tools Guided Local Search, RouteForge delivers industrial-grade route optimization
              instantly in your browser or local desktop — 100% free forever.
            </p>

            {/* Three Value Pillars with Editorial Numbers (01, 02, 03) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 pt-12 border-t border-[#EAE6DD] text-left w-full">
              <div className="flex flex-col gap-2">
                <span className="font-serif italic text-2xl text-editorial-subtle/60">01</span>
                <h3 className="font-serif text-lg font-medium text-editorial-ink">Zero API Keys</h3>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  No Google Maps Platform or Mapbox billing accounts required. MapLibre GL JS renders OpenFreeMap Positron vector tiles with zero tokens.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-serif italic text-2xl text-editorial-subtle/60">02</span>
                <h3 className="font-serif text-lg font-medium text-editorial-ink">OR-Tools Optimization</h3>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Industrial Traveling Salesperson solver with unweighted dummy sink formulation for open-ended tours, fixed origin/destinations, and locked stops.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-serif italic text-2xl text-editorial-subtle/60">03</span>
                <h3 className="font-serif text-lg font-medium text-editorial-ink">Economic & Eco Audit</h3>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Instant telemetry calculating actual road distance abated, driver hours saved, fuel savings in liters/dollars, and carbon offset in kg CO₂.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Interactive Live Benchmark Simulator */}
        <section id="benchmarks" className="relative z-10 px-6 sm:px-12 md:px-16 py-20 bg-[#F6F3EC] border-t border-[#EAE6DD]">
          <div className="max-w-5xl mx-auto">
            
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-editorial-subtle block">
                  PROVEN PERFORMANCE
                </span>
                <h2 className="font-serif italic text-3xl sm:text-4xl text-editorial-ink mt-2">
                  Live Optimization Benchmarks
                </h2>
                <p className="text-xs sm:text-sm text-editorial-subtle mt-1 max-w-md">
                  Compare real-world route reduction across common logistics profiles.
                </p>
              </div>

              {/* Scenario Toggle Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#FAF8F5] border border-[#DDD7CC] shadow-subtle">
                {(['urban', 'corridor', 'roundtrip'] as const).map(sc => (
                  <button
                    key={sc}
                    onClick={() => setActivePreviewScenario(sc)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono capitalize transition-all ${
                      activePreviewScenario === sc
                        ? 'bg-[#16191D] text-[#FAF8F5] font-semibold shadow-sm'
                        : 'text-editorial-body hover:bg-[#F0ECE4]'
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>
            </div>

            {/* Benchmark Showcase Card */}
            <div className="bg-[#FAF8F5] border border-[#D8D2C6] rounded-2xl shadow-float overflow-hidden flex flex-col">
              
              {/* Header Bar */}
              <div className="px-6 py-4 border-b border-[#EAE6DD] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF8F5]">
                <div>
                  <h3 className="font-serif text-lg font-medium text-editorial-ink">
                    {currentScenario.title}
                  </h3>
                  <span className="text-xs text-editorial-subtle">
                    {currentScenario.subtitle} &bull; <strong className="font-mono text-editorial-ink">{currentScenario.circuit}</strong>
                  </span>
                </div>

                <button
                  onClick={() => onStartPlanning(activePreviewScenario)}
                  className="self-start sm:self-auto px-4 py-2 bg-[#16191D] hover:bg-black text-[#FAF8F5] text-xs font-mono tracking-wider uppercase transition-colors flex items-center gap-1.5 shadow-subtle"
                >
                  <span>Open This Route in Planner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Telemetry Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-[#EAE6DD] bg-[#FAF8F5]">
                <div className="p-4 rounded-xl bg-[#F6F3EC] border border-[#E5E1D8]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-editorial-subtle">Distance Saved</span>
                    <TrendingDown className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="font-serif text-2xl font-semibold text-editorial-ink mt-1">
                    -{(parseFloat(currentScenario.originalKm) - parseFloat(currentScenario.optimizedKm)).toFixed(1)} km
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 font-bold mt-0.5 block">
                    {currentScenario.savingsPercent} reduction
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#F6F3EC] border border-[#E5E1D8]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-editorial-subtle">Time Saved</span>
                    <Clock className="w-4 h-4 text-editorial-subtle" />
                  </div>
                  <div className="font-serif text-2xl font-semibold text-editorial-ink mt-1">
                    {currentScenario.timeSaved}
                  </div>
                  <span className="text-[10px] text-editorial-subtle mt-0.5 block">
                    Direct transit savings
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#F6F3EC] border border-[#E5E1D8]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-editorial-subtle">Fuel Saved</span>
                    <Fuel className="w-4 h-4 text-editorial-subtle" />
                  </div>
                  <div className="font-serif text-2xl font-semibold text-editorial-ink mt-1">
                    {currentScenario.fuelSaved}
                  </div>
                  <span className="text-[10px] text-editorial-subtle mt-0.5 block">
                    Based on 8.5L/100km
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#F6F3EC] border border-[#E5E1D8]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-editorial-subtle">CO₂ Abated</span>
                    <Leaf className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="font-serif text-2xl font-semibold text-emerald-900 mt-1">
                    {currentScenario.co2Saved}
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 font-semibold mt-0.5 block">
                    Green fleet footprint
                  </span>
                </div>
              </div>

              {/* Waypoint Deck Split */}
              <div className="p-6 bg-[#FAF8F5]">
                <span className="text-[10px] font-mono uppercase tracking-wider text-editorial-subtle block mb-3">
                  Optimal Stop Sequence Generated by Google OR-Tools:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {currentScenario.stops.map((stop, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#F6F3EC] border border-[#E5E1D8] flex items-center gap-3 text-xs"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#16191D] text-[#FAF8F5] text-[10px] font-mono font-bold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-editorial-ink truncate">{stop}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: System Architecture & Feature Grid */}
        <section id="architecture" className="relative z-10 px-6 sm:px-12 md:px-16 py-20 bg-[#FAF8F5] border-t border-[#EAE6DD]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-editorial-subtle">
                TECHNICAL RIGOR
              </span>
              <h2 className="font-serif italic text-3xl sm:text-4xl text-editorial-ink mt-2 mb-4">
                Engineered for High-Precision Logistics
              </h2>
              <p className="text-xs sm:text-sm text-editorial-subtle leading-relaxed">
                Every component is built around zero-cost open standards, strict mathematical rigor,
                and real-world transport topology.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="p-6 rounded-2xl bg-[#F6F3EC] border border-[#E5E1D8] flex flex-col gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#16191D] text-[#FAF8F5] flex items-center justify-center shadow-subtle">
                  <Compass className="w-4 h-4" />
                </div>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">
                  Sub-Meter Geocoding
                </h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Parse raw decimal coordinates, Google Maps URLs, or use Komoot Photon autocomplete with instant reverse geocoding and draggable pins.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-6 rounded-2xl bg-[#F6F3EC] border border-[#E5E1D8] flex flex-col gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#16191D] text-[#FAF8F5] flex items-center justify-center shadow-subtle">
                  <Cpu className="w-4 h-4" />
                </div>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">
                  OR-Tools Guided Search
                </h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Solves open-ended TSPs via unweighted dummy sink nodes, honoring fixed start/destination requirements and locked intermediate stops.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-6 rounded-2xl bg-[#F6F3EC] border border-[#E5E1D8] flex flex-col gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#16191D] text-[#FAF8F5] flex items-center justify-center shadow-subtle">
                  <Navigation className="w-4 h-4" />
                </div>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">
                  Turn-by-Turn Directions
                </h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Real driving directions derived from OSRM road graph topology. Extracted step instructions, street names, and road-snapped geometry.
                </p>
              </div>

              {/* Card 4 */}
              <div className="p-6 rounded-2xl bg-[#F6F3EC] border border-[#E5E1D8] flex flex-col gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#16191D] text-[#FAF8F5] flex items-center justify-center shadow-subtle">
                  <Activity className="w-4 h-4" />
                </div>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">
                  Economic & Eco Audit
                </h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Quantified before/after analytics calculating road distance reduction, driver time saved, fuel abated, and carbon offset in kg CO₂.
                </p>
              </div>

              {/* Card 5 */}
              <div className="p-6 rounded-2xl bg-[#F6F3EC] border border-[#E5E1D8] flex flex-col gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#16191D] text-[#FAF8F5] flex items-center justify-center shadow-subtle">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">
                  OpenFreeMap Vector Tiles
                </h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  MapLibre GL JS vector maps rendering clean Positron cartography. Zero API tokens, zero billing activation, zero watermarks.
                </p>
              </div>

              {/* Card 6 */}
              <div className="p-6 rounded-2xl bg-[#F6F3EC] border border-[#E5E1D8] flex flex-col gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#16191D] text-[#FAF8F5] flex items-center justify-center shadow-subtle">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">
                  Secure CSV Manifest
                </h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Batch load addresses from CSV spreadsheets with injection guards. Export optimized manifests to CSV, JSON, or clipboard audit.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Workflow (01, 02, 03) */}
        <section id="workflow" className="relative z-10 px-6 sm:px-12 md:px-16 py-20 bg-[#F6F3EC] border-t border-[#EAE6DD]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-14">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-editorial-subtle">
                OPERATING FLOW
              </span>
              <h2 className="font-serif italic text-3xl sm:text-4xl text-editorial-ink mt-2 mb-2">
                Three Steps to Optimal Transit
              </h2>
              <p className="text-xs text-editorial-subtle">
                From raw address inputs to a streamlined itinerary in under thirty seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] flex flex-col gap-3">
                <span className="font-serif italic text-3xl text-editorial-ink/20">01</span>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">Add Destinations</h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Search addresses with Photon autocomplete, paste coordinates, drop CSV manifests, or click directly on the vector map canvas.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] flex flex-col gap-3">
                <span className="font-serif italic text-3xl text-editorial-ink/20">02</span>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">Execute Optimization</h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Click "Optimize Tour" with one click. Google OR-Tools evaluates road distance matrices to unwind loops and eliminate deadhead miles.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#FAF8F5] border border-[#E5E1D8] flex flex-col gap-3">
                <span className="font-serif italic text-3xl text-editorial-ink/20">03</span>
                <h4 className="font-serif text-lg font-medium text-editorial-ink">Audit & Dispatch</h4>
                <p className="text-xs text-editorial-subtle leading-relaxed">
                  Review turn-by-turn guidance, examine fuel and carbon savings in the audit modal, and export manifests directly to drivers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Banner (Editorial Inverted Dark Card) */}
        <section className="relative z-10 px-6 sm:px-12 md:px-16 py-16 bg-[#16191D] text-[#FAF8F5] border-t border-[#2D3139]">
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
            <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#A1A1AA] mb-3">
              ZERO BARRIERS &bull; ZERO LATENCY
            </span>
            <h2 className="font-serif italic text-3xl sm:text-5xl font-normal text-white max-w-2xl leading-tight mb-6">
              Ready to eliminate empty transit miles?
            </h2>
            <p className="text-xs sm:text-sm text-[#D4D4D8] max-w-md mb-8 leading-relaxed">
              Launch RouteForge right now. No sign-up required, no credit card, and completely free forever.
            </p>
            <button
              onClick={() => onStartPlanning()}
              className="px-8 py-4 bg-[#FAF8F5] hover:bg-white text-[#16191D] text-xs font-mono font-semibold tracking-widest uppercase transition-all shadow-float flex items-center gap-2 group"
            >
              <span>LAUNCH ROUTE PLANNER NOW</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* Minimalist Editorial Footer */}
        <footer className="relative z-10 px-6 sm:px-12 py-8 bg-[#FAF8F5] border-t border-[#EAE6DD] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-editorial-subtle">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#16191D] text-[#FAF8F5] flex items-center justify-center text-[10px]">
              <MapPin className="w-3 h-3" />
            </div>
            <span className="font-serif font-medium text-editorial-ink text-sm">RouteForge</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F0ECE4] border border-[#E2DDD3]">
              v2.0
            </span>
          </div>

          <div className="flex items-center gap-6 text-[11px] font-mono">
            <a href="#manifesto" className="hover:text-editorial-ink transition-colors">Manifesto</a>
            <a href="#benchmarks" className="hover:text-editorial-ink transition-colors">Benchmarks</a>
            <a href="#architecture" className="hover:text-editorial-ink transition-colors">Architecture</a>
            <button onClick={() => onStartPlanning()} className="hover:text-editorial-ink transition-colors font-bold underline">
              Launch Planner
            </button>
          </div>

          <div className="text-[10px] font-mono text-editorial-subtle">
            MIT License &bull; Free Open Data &bull; Python FastAPI & OR-Tools
          </div>
        </footer>

      </div>
    </div>
  );
};

export default LandingPage;
