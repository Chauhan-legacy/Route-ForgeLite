import React, { useState, useEffect, useCallback } from 'react';
import { RouteData, Stop, RouteSummary, TransportMode, OptimizationOptions, OptimizationResult } from './types';
import * as api from './services/api';
import { clientGeocodeAddress, TRAFFIC_DISCLAIMER } from './services/clientRouting';
import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { StopList } from './components/StopList';
import { Map } from './components/Map';
import { ImportModal } from './components/ImportModal';
import { OptimizationModal } from './components/OptimizationModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { LandingPage } from './components/LandingPage';
import { CheckCircle2, AlertTriangle, Info, Map as MapIcon, ListOrdered } from 'lucide-react';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'landing' | 'planner'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('view') === 'planner' || (params.has('routeId') && !params.has('home'))) ? 'planner' : 'landing';
  });
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [revision, setRevision] = useState<number>(1);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [summary, setSummary] = useState<RouteSummary>({
    totalDistanceMeters: 0,
    totalDurationSeconds: 0,
    provider: 'osrm',
    isFallback: false,
    mode: 'driving',
    liveTraffic: false,
    trafficStatus: TRAFFIC_DISCLAIMER
  });
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [preOptimizationStops, setPreOptimizationStops] = useState<Stop[] | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'syncing' | 'offline'>('connected');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'map' | 'stops'>('map');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 37.7749, lng: -122.4194 });
  const [isPinpointMode, setIsPinpointMode] = useState<boolean>(false);

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isOptimizeOpen, setIsOptimizeOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Toast Banner
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(current => (current && current.message === message ? null : current));
    }, 4000);
  }, []);

  // Recalculate route polyline & metrics whenever stops or transport mode changes
  const updateRouteCalculation = useCallback(async (currentStops: Stop[], mode: TransportMode, routeId?: string) => {
    const validStops = currentStops.filter(s => (s.lat ?? s.latitude) != null && (s.lng ?? s.longitude) != null);
    if (validStops.length < 2) {
      setRouteGeometry(null);
      setSummary(prev => ({
        ...prev,
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        mode
      }));
      return;
    }

    try {
      const calcData = await api.calculateRoute(routeId || 'current', validStops, mode);
      if (calcData) {
        setRouteGeometry(calcData.geometry || null);
        setSummary({
          totalDistanceMeters: calcData.totalDistanceMeters ?? calcData.summary?.totalDistanceMeters ?? 0,
          totalDurationSeconds: calcData.totalDurationSeconds ?? calcData.summary?.totalDurationSeconds ?? 0,
          provider: calcData.provider ?? calcData.summary?.provider ?? 'osrm',
          isFallback: !!(calcData.isFallback ?? calcData.summary?.isFallback),
          mode,
          liveTraffic: false,
          trafficStatus: TRAFFIC_DISCLAIMER,
          maneuvers: calcData.maneuvers || calcData.summary?.maneuvers || []
        });
      }
    } catch (err: any) {
      console.warn('Route calculation error:', err);
    }
  }, []);

  // Initial Route Load
  useEffect(() => {
    const init = async () => {
      setSyncStatus('syncing');
      try {
        await api.checkBackendHealth();
        const searchParams = new URLSearchParams(window.location.search);
        let routeId = searchParams.get('routeId');

        if (!routeId) {
          const routes = await api.listRoutes();
          if (routes.length > 0) {
            routeId = routes[0].routeId;
          }
        }

        let routeRes;
        if (routeId) {
          routeRes = await api.getRoute(routeId);
        } else {
          const created = await api.createRoute('San Francisco Delivery Corridor');
          routeId = created.routeId;

          const seedStops = [
            { name: 'Ferry Building', address: '1 Ferry Building, San Francisco, CA' },
            { name: 'Golden Gate Bridge', address: 'Golden Gate Bridge, San Francisco, CA' },
            { name: 'Union Square', address: '333 Post St, San Francisco, CA' },
            { name: 'Lombard Street', address: '1070 Lombard St, San Francisco, CA' }
          ];

          let currentRev = created.revision;
          for (const s of seedStops) {
            const addRes = await api.addStop(routeId, currentRev, s.address, s.name);
            currentRev = addRes.revision;
          }

          routeRes = await api.getRoute(routeId);
        }

        setCurrentRoute(routeRes.route);
        setStops(routeRes.stops);
        setRevision(routeRes.revision);
        setSyncStatus('connected');

        const newUrl = `?routeId=${routeRes.route.routeId}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);

        await updateRouteCalculation(routeRes.stops, 'driving', routeRes.route.routeId);
      } catch (err: any) {
        setSyncStatus('offline');
        showToast(`Route initialization notice: ${err.message}`, 'info');
      }
    };

    init();
  }, [showToast, updateRouteCalculation]);

  // Mode Change
  const handleModeChange = async (mode: TransportMode) => {
    setSummary(prev => ({ ...prev, mode }));
    await updateRouteCalculation(stops, mode, currentRoute?.routeId);
  };

  // Add Stop (supports precision coordinates, direct titles, metadata)
  const handleAddStop = async (
    address: string,
    name?: string,
    lat?: number | null,
    lng?: number | null,
    metadata?: any
  ) => {
    if (!currentRoute) return;
    setIsSaving(true);
    setSyncStatus('syncing');

    try {
      const res = await api.addStop(currentRoute.routeId, revision, address, name, lat, lng, metadata);
      const updatedStops = [...stops, res.stop];
      setStops(updatedStops);
      setRevision(res.revision);
      setSyncStatus('connected');
      showToast(`Added: ${res.stop.name}`, 'success');

      await updateRouteCalculation(updatedStops, summary.mode, currentRoute.routeId);
    } catch (err: any) {
      setSyncStatus('offline');
      showToast(`Failed to add waypoint: ${err.message}`, 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  // Map Click Waypoint Placement with Instant Optimistic Placement (Zero Lag)
  const handleMapClick = async (lat: number, lng: number) => {
    if (!currentRoute) return;
    setIsPinpointMode(false); // Immediately dismiss crosshair mode

    // 1. Instant optimistic waypoint creation in < 1ms
    const tempName = `Waypoint ${stops.length + 1}`;
    const tempAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const tempStopId = `stop_${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newStop: Stop = {
      stopId: tempStopId,
      routeId: currentRoute.routeId,
      sequence: stops.length,
      name: tempName,
      address: tempAddress,
      latitude: lat,
      longitude: lng,
      lat,
      lng,
      metadata: {
        precision: 'sub-meter',
        source: 'map_pinpoint',
        displayName: tempAddress,
      }
    };

    const updatedStops = [...stops, newStop];
    setStops(updatedStops);
    showToast(`Placed pin: ${tempName}`, 'success');
    updateRouteCalculation(updatedStops, summary.mode, currentRoute.routeId);

    // 2. Persist in background and asynchronously enrich with street name
    try {
      const res = await api.addStop(
        currentRoute.routeId,
        revision,
        tempAddress,
        tempName,
        lat,
        lng,
        newStop.metadata
      );
      setRevision(res.revision);

      // Async reverse geocoding in background without blocking UI
      api.reverseGeocode(lat, lng).then(rev => {
        if (rev && rev.title) {
          setStops(curr => curr.map(s => s.stopId === res.stop.stopId || s.stopId === tempStopId ? { ...s, name: rev.title, address: rev.fullAddress } : s));
          api.updateStop(currentRoute.routeId, res.revision, res.stop.stopId, { name: rev.title, address: rev.fullAddress }).catch(() => {});
        }
      }).catch(() => {});
    } catch (err: any) {
      console.warn('Background pin sync:', err);
    }
  };

  // Marker Reposition on Drag End
  const handleStopMove = async (stopId: string, newLat: number, newLng: number) => {
    if (!currentRoute) return;
    const targetStop = stops.find(s => s.stopId === stopId);
    if (!targetStop) return;

    // Optimistically update positions
    const optimisticStops = stops.map(s => {
      if (s.stopId === stopId) {
        return {
          ...s,
          latitude: newLat,
          longitude: newLng,
          lat: newLat,
          lng: newLng,
          metadata: {
            ...s.metadata,
            precision: 'sub-meter' as const,
          }
        };
      }
      return s;
    });
    setStops(optimisticStops);
    await updateRouteCalculation(optimisticStops, summary.mode, currentRoute.routeId);

    try {
      const rev = await api.reverseGeocode(newLat, newLng);
      const updatedName = rev.title || targetStop.name;
      const updatedAddress = rev.fullAddress || `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`;

      const res = await api.updateStop(currentRoute.routeId, revision, stopId, {
        name: updatedName,
        address: updatedAddress,
        latitude: newLat,
        longitude: newLng,
        metadata: {
          ...targetStop.metadata,
          precision: 'sub-meter',
          displayName: updatedAddress,
        }
      });

      setRevision(res.revision);
      setStops(current => current.map(s => s.stopId === stopId ? res.stop : s));
      showToast(`Repositioned: ${updatedName} (Sub-meter Pin)`, 'success');
    } catch (err: any) {
      console.warn('Persist reposition error:', err);
    }
  };

  // Toggle Lock
  const handleToggleLock = async (stopId: string) => {
    if (!currentRoute) return;
    const targetStop = stops.find(s => s.stopId === stopId);
    if (!targetStop) return;

    const newLocked = !targetStop.metadata?.locked;
    const updatedStops = stops.map(s => {
      if (s.stopId === stopId) {
        return {
          ...s,
          metadata: { ...s.metadata, locked: newLocked }
        };
      }
      return s;
    });

    setStops(updatedStops);
    try {
      const res = await api.updateStop(currentRoute.routeId, revision, stopId, {
        metadata: { ...targetStop.metadata, locked: newLocked }
      });
      setRevision(res.revision);
      showToast(newLocked ? 'Waypoint fixed in sequence' : 'Waypoint unlocked', 'info');
    } catch (err: any) {
      console.warn('Persist lock error:', err);
    }
  };

  // Move Stop Up / Down
  const handleMoveStop = async (index: number, direction: number) => {
    if (!currentRoute) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= stops.length) return;

    const newStops = [...stops];
    const [moved] = newStops.splice(index, 1);
    newStops.splice(targetIdx, 0, moved);

    const reorderedStops = newStops.map((s, idx) => ({ ...s, sequence: idx }));
    setStops(reorderedStops);

    try {
      const res = await api.reorderStops(currentRoute.routeId, revision, reorderedStops.map(s => s.stopId));
      setRevision(res.revision);
      await updateRouteCalculation(reorderedStops, summary.mode, currentRoute.routeId);
    } catch (err: any) {
      console.warn('Reorder error:', err);
    }
  };

  // Delete Stop
  const handleDeleteStop = async (stopId: string) => {
    if (!currentRoute) return;
    const newStops = stops.filter(s => s.stopId !== stopId).map((s, idx) => ({ ...s, sequence: idx }));
    setStops(newStops);

    try {
      const res = await api.removeStop(currentRoute.routeId, revision, stopId);
      setRevision(res.revision);
      await updateRouteCalculation(newStops, summary.mode, currentRoute.routeId);
      showToast('Waypoint removed', 'info');
    } catch (err: any) {
      console.warn('Delete error:', err);
    }
  };

  // Edit Stop Address
  const handleEditStop = async (stopId: string) => {
    const stop = stops.find(s => s.stopId === stopId);
    if (!stop) return;

    const newAddress = window.prompt('Update waypoint address:', stop.address);
    if (!newAddress || newAddress.trim() === stop.address) return;

    setIsSaving(true);
    try {
      const geo = await clientGeocodeAddress(newAddress.trim());
      const newName = geo.displayName ? geo.displayName.split(',')[0].trim() : stop.name;

      const res = await api.updateStop(currentRoute!.routeId, revision, stopId, {
        name: newName,
        address: geo.displayName || newAddress.trim(),
        latitude: geo.lat,
        longitude: geo.lng,
        metadata: { ...stop.metadata, geocodeStatus: geo.status }
      });

      setRevision(res.revision);
      const updatedStops = stops.map(s => s.stopId === stopId ? res.stop : s);
      setStops(updatedStops);

      showToast(`Updated: ${newName}`, 'success');
      await updateRouteCalculation(updatedStops, summary.mode, currentRoute!.routeId);
    } catch (err: any) {
      showToast(`Update error: ${err.message}`, 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  // Reverse Sequence
  const handleReverse = async () => {
    if (!currentRoute || stops.length < 2) return;
    const reversed = [...stops].reverse().map((s, idx) => ({ ...s, sequence: idx }));
    setStops(reversed);

    try {
      const res = await api.reorderStops(currentRoute.routeId, revision, reversed.map(s => s.stopId));
      setRevision(res.revision);
      await updateRouteCalculation(reversed, summary.mode, currentRoute.routeId);
      showToast('Sequence reversed', 'info');
    } catch (err: any) {
      console.warn('Reverse error:', err);
    }
  };

  // Run Optimization with Honest Before/After Measurement
  const handleRunOptimization = async (options?: Partial<OptimizationOptions>) => {
    if (!currentRoute) return;
    if (stops.length < 3) {
      showToast(`Add at least 3 waypoints to optimize route sequence (currently ${stops.length}).`, 'warning');
      return;
    }
    setIsSaving(true);
    setSyncStatus('syncing');

    const cleanOpts: OptimizationOptions = {
      objective: 'distance',
      fixedStart: true,
      fixedEnd: false,
      returnToStart: false,
      lockedStops: true,
      ...options
    };

    // Save snapshot of current sequence before optimizing
    const snapshot = [...stops];

    try {
      const res = await api.optimizeRoute(currentRoute.routeId, stops, cleanOpts);
      if (res.isAlreadyOptimal || res.savingsPercent <= 0) {
        setOptimizationResult({
          ...res,
          isAlreadyOptimal: true,
          savingsPercent: 0,
          savingsMeters: 0
        });
        setPreOptimizationStops(null);
        showToast('Route sequence is already at minimum distance (no shorter order found).', 'info');
      } else {
        setStops(res.stops);
        setRevision(res.revision);
        setOptimizationResult(res);
        setPreOptimizationStops(snapshot);
        setSyncStatus('connected');
        showToast(
          `Optimized: Saved ${res.savingsPercent}% (-${(res.savingsMeters / 1000).toFixed(1)} km)`,
          'success'
        );
        await updateRouteCalculation(res.stops, summary.mode, currentRoute.routeId);
      }
    } catch (err: any) {
      setSyncStatus('offline');
      showToast(`Optimization notice: ${err.message}`, 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  // Revert / Undo Optimization to Previous Sequence
  const handleRevertOptimization = async () => {
    if (!currentRoute || !preOptimizationStops) return;
    setIsSaving(true);
    setSyncStatus('syncing');

    const revertedStops = preOptimizationStops.map((s, idx) => ({ ...s, sequence: idx }));
    setStops(revertedStops);
    setPreOptimizationStops(null);
    setOptimizationResult(null);

    try {
      const res = await api.reorderStops(currentRoute.routeId, revision, revertedStops.map(s => s.stopId));
      setRevision(res.revision);
      await updateRouteCalculation(revertedStops, summary.mode, currentRoute.routeId);
      showToast('Reverted route to original sequence', 'info');
      setSyncStatus('connected');
    } catch (err: any) {
      console.warn('Revert error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDismissOptimization = () => {
    setOptimizationResult(null);
    setPreOptimizationStops(null);
  };

  // Bulk Import
  const handleBulkImport = async (newStopsData: Array<{ name: string; address: string; lat?: number; lng?: number; locked?: boolean }>) => {
    if (!currentRoute) return;
    setIsSaving(true);
    setSyncStatus('syncing');

    try {
      let currentRev = revision;
      const addedStops: Stop[] = [];

      for (const item of newStopsData) {
        const res = await api.addStop(currentRoute.routeId, currentRev, item.address, item.name);
        currentRev = res.revision;

        if (item.lat != null && item.lng != null) {
          const updRes = await api.updateStop(currentRoute.routeId, currentRev, res.stop.stopId, {
            latitude: item.lat,
            longitude: item.lng,
            metadata: { ...res.stop.metadata, locked: !!item.locked }
          });
          currentRev = updRes.revision;
          addedStops.push(updRes.stop);
        } else {
          addedStops.push(res.stop);
        }
      }

      const allStops = [...stops, ...addedStops];
      setStops(allStops);
      setRevision(currentRev);
      setSyncStatus('connected');
      showToast(`Loaded ${newStopsData.length} waypoints`, 'success');
      await updateRouteCalculation(allStops, summary.mode, currentRoute.routeId);
    } catch (err: any) {
      showToast(`Import error: ${err.message}`, 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  // Switch Route
  const handleSwitchRoute = async (routeId: string) => {
    try {
      setSyncStatus('syncing');
      const res = await api.getRoute(routeId);
      setCurrentRoute(res.route);
      setStops(res.stops);
      setRevision(res.revision);
      setSyncStatus('connected');

      const newUrl = `?routeId=${routeId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);

      await updateRouteCalculation(res.stops, summary.mode, routeId);
    } catch (err: any) {
      showToast(`Failed to switch route: ${err.message}`, 'warning');
    }
  };

  // Create New Route
  const handleNewRoute = async () => {
    const title = window.prompt('Enter route name:', 'New Corridor');
    if (!title) return;

    try {
      const res = await api.createRoute(title.trim());
      const routeRes = await api.getRoute(res.routeId);
      setCurrentRoute(routeRes.route);
      setStops([]);
      setRevision(routeRes.revision);
      setRouteGeometry(null);
      setOptimizationResult(null);

      const newUrl = `?routeId=${res.routeId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);

      showToast(`Created route "${title}"`, 'success');
    } catch (err: any) {
      showToast(`Failed to create route: ${err.message}`, 'warning');
    }
  };

  // Delete Route
  const handleDeleteRoute = async (routeId: string) => {
    try {
      await api.deleteRoute(routeId);
      showToast('Route removed from saved list', 'info');

      // If the currently active route was deleted, switch to another route or create new
      if (currentRoute?.routeId === routeId) {
        const remaining = await api.listRoutes();
        if (remaining.length > 0) {
          await handleSwitchRoute(remaining[0].routeId);
        } else {
          const created = await api.createRoute('Default Corridor');
          await handleSwitchRoute(created.routeId);
        }
      }
    } catch (err: any) {
      showToast(`Failed to delete route: ${err.message}`, 'warning');
    }
  };

  // Clear All Stops for a clean map slate
  const handleClearAllStops = async () => {
    if (!currentRoute || stops.length === 0) return;
    if (!window.confirm('Clear all waypoints to start fresh on a clean map?')) return;
    setIsSaving(true);
    try {
      let curRev = revision;
      for (const s of stops) {
        const res = await api.removeStop(currentRoute.routeId, curRev, s.stopId);
        curRev = res.revision;
      }
      setStops([]);
      setRevision(curRev);
      setRouteGeometry(null);
      setOptimizationResult(null);
      setPreOptimizationStops(null);
      showToast('All waypoints cleared. Clean map ready.', 'info');
    } catch (err: any) {
      showToast(`Notice clearing waypoints: ${err.message}`, 'info');
    } finally {
      setIsSaving(false);
    }
  };

  // Export Route
  const handleExport = (format: 'csv' | 'json') => {
    if (stops.length === 0) {
      showToast('No waypoints to export.', 'warning');
      return;
    }

    if (format === 'csv') {
      const rows = [
        ['Stop Order', 'Name', 'Address', 'Latitude', 'Longitude', 'Fixed Invariant'],
        ...stops.map((s, idx) => [
          idx + 1,
          `"${(s.name || '').replace(/"/g, '""')}"`,
          `"${(s.address || '').replace(/"/g, '""')}"`,
          s.lat ?? s.latitude ?? '',
          s.lng ?? s.longitude ?? '',
          s.metadata?.locked ? 'YES' : 'NO'
        ])
      ];
      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${currentRoute?.title || 'route'}-stops.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Exported CSV file', 'success');
    } else {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
        route: currentRoute,
        stops,
        summary
      }, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `${currentRoute?.title || 'route'}-export.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Exported JSON file', 'success');
    }
  };

  // Share Link
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Route link copied to clipboard', 'success');
    }
  };

  // Navigation between Landing Page and Planner Workspace
  const handleStartPlanning = async (scenario?: 'urban' | 'corridor' | 'roundtrip') => {
    setCurrentView('planner');
    const params = new URLSearchParams(window.location.search);
    params.set('view', 'planner');
    params.delete('home');
    window.history.pushState(null, '', `?${params.toString()}`);

    if (scenario) {
      let scenarioStops: { name: string; address: string }[] = [];
      if (scenario === 'urban') {
        scenarioStops = [
          { name: 'Ferry Building', address: '1 Ferry Building, San Francisco, CA' },
          { name: 'Golden Gate Bridge', address: 'Golden Gate Bridge, San Francisco, CA' },
          { name: 'Union Square', address: '333 Post St, San Francisco, CA' },
          { name: 'Lombard Street', address: '1070 Lombard St, San Francisco, CA' }
        ];
      } else if (scenario === 'corridor') {
        scenarioStops = [
          { name: 'SFO Air Cargo Hub', address: 'San Francisco International Airport, CA' },
          { name: 'Mission District Depot', address: '2400 Mission St, San Francisco, CA' },
          { name: 'Financial District Terminal', address: '555 California St, San Francisco, CA' },
          { name: 'Presidio Distribution', address: 'Presidio of San Francisco, CA' }
        ];
      } else if (scenario === 'roundtrip') {
        scenarioStops = [
          { name: 'Depot Alpha (Pier 39)', address: 'The Embarcadero, San Francisco, CA' },
          { name: 'Sunset Retail Hub', address: '1200 9th Ave, San Francisco, CA' },
          { name: 'Twin Peaks Inspection', address: 'Christmas Tree Point Rd, San Francisco, CA' },
          { name: 'Depot Alpha (Pier 39)', address: 'The Embarcadero, San Francisco, CA' }
        ];
      }

      try {
        setIsSaving(true);
        const title = `${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Route Corridor`;
        const created = await api.createRoute(title);
        let currentRev = created.revision;
        for (const s of scenarioStops) {
          const addRes = await api.addStop(created.routeId, currentRev, s.address, s.name);
          currentRev = addRes.revision;
        }
        const fullRoute = await api.getRoute(created.routeId);
        setCurrentRoute(fullRoute.route);
        setStops(fullRoute.stops);
        setRevision(fullRoute.revision);
        const newUrl = `?routeId=${created.routeId}&view=planner`;
        window.history.pushState({ path: newUrl }, '', newUrl);
        await updateRouteCalculation(fullRoute.stops, summary.mode, created.routeId);
        showToast(`Loaded ${title}`, 'success');
      } catch (err: any) {
        showToast(`Notice loading corridor: ${err.message}`, 'info');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
    const params = new URLSearchParams(window.location.search);
    params.delete('view');
    params.set('home', '1');
    window.history.pushState(null, '', `?${params.toString()}`);
  };

  if (currentView === 'landing') {
    return (
      <div className="w-screen h-screen overflow-y-auto overflow-x-hidden scroll-smooth bg-[#EFECE6]">
        <LandingPage onStartPlanning={handleStartPlanning} />
      </div>
    );
  }

  const lockedCount = stops.filter(s => s.metadata?.locked).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-editorial-bg text-editorial-ink font-sans overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[2000] flex items-center gap-2 px-4 py-2.5 rounded-full bg-editorial-surface border border-editorial-border shadow-float text-xs text-editorial-ink animate-in slide-in-from-top-3 duration-150">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-editorial-subtle flex-shrink-0" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        currentRoute={currentRoute}
        syncStatus={syncStatus}
        onSwitchRoute={handleSwitchRoute}
        onExport={handleExport}
        onShare={handleShare}
        onNewRoute={handleNewRoute}
        onDeleteRoute={handleDeleteRoute}
        onBackToLanding={handleBackToLanding}
      />

      {/* Metrics Bar */}
      <MetricsBar
        summary={summary}
        optimizationResult={optimizationResult}
        stopCount={stops.length}
        lockedCount={lockedCount}
        onModeChange={handleModeChange}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
      />

      {/* Main Workspace Split */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Column: Stops Sequence Deck */}
        <div className={`h-full flex flex-col ${activeMobileTab === 'stops' ? 'flex' : 'hidden lg:flex'}`}>
          <StopList
            stops={stops}
            onAddStop={handleAddStop}
            onToggleLock={handleToggleLock}
            onMoveStop={handleMoveStop}
            onDeleteStop={handleDeleteStop}
            onEditStop={handleEditStop}
            onOptimize={() => setIsOptimizeOpen(true)}
            onQuickOptimize={() => handleRunOptimization()}
            onReverse={handleReverse}
            onOpenImport={() => setIsImportOpen(true)}
            isSaving={isSaving}
            mapCenter={mapCenter}
            optimizationResult={optimizationResult}
            canRevert={!!preOptimizationStops}
            onRevertOptimization={handleRevertOptimization}
            onDismissOptimization={handleDismissOptimization}
            onOpenAnalytics={() => setIsAnalyticsOpen(true)}
            maneuvers={summary.maneuvers || []}
            onClearAll={handleClearAllStops}
            isPinpointMode={isPinpointMode}
            onTogglePinpointMode={() => setIsPinpointMode(prev => !prev)}
          />
        </div>

        {/* Right / Center Column: Map Engine */}
        <div className={`flex-1 h-full relative ${activeMobileTab === 'map' ? 'flex' : 'hidden lg:flex'}`}>
          <Map
            stops={stops}
            routeGeometry={routeGeometry}
            onMapClick={handleMapClick}
            onStopMove={handleStopMove}
            onMapCenterChange={setMapCenter}
            isPinpointMode={isPinpointMode}
            onTogglePinpointMode={() => setIsPinpointMode(prev => !prev)}
          />
        </div>

        {/* Mobile View Toggle */}
        <div className="lg:hidden absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex items-center p-1 rounded-full bg-editorial-surface border border-editorial-border shadow-float">
          <button
            onClick={() => setActiveMobileTab('map')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeMobileTab === 'map'
                ? 'bg-editorial-ink text-editorial-bg shadow-sm'
                : 'text-editorial-body'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Map</span>
          </button>
          <button
            onClick={() => setActiveMobileTab('stops')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeMobileTab === 'stops'
                ? 'bg-editorial-ink text-editorial-bg shadow-sm'
                : 'text-editorial-body'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Waypoints ({stops.length})</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportStops={handleBulkImport}
      />

      <OptimizationModal
        isOpen={isOptimizeOpen}
        onClose={() => setIsOptimizeOpen(false)}
        stopCount={stops.length}
        lockedCount={lockedCount}
        onRunOptimization={handleRunOptimization}
      />

      <AnalyticsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        result={optimizationResult}
        stopCount={stops.length}
      />
    </div>
  );
};

export default App;
