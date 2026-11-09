import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map from './Map';
import StopList from './StopList';
import Sync from './Sync';
import Import from './Import';

export default function App() {
  const [routeId, setRouteId] = useState(null);
  const [routeTitle, setRouteTitle] = useState('Untitled Route');
  const [stops, setStops] = useState([]);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [summary, setSummary] = useState({
    totalDistanceMeters: 0,
    totalDurationSeconds: 0,
    provider: null,
    isFallback: false
  });

  const [revision, setRevision] = useState(1);
  const [syncStatus, setSyncStatus] = useState('connected');
  const [lastSynced, setLastSynced] = useState(new Date());

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [alert, setAlert] = useState(null);
  const [newAddressInput, setNewAddressInput] = useState('');

  const isSavingRef = useRef(false);
  const revisionRef = useRef(revision);
  revisionRef.current = revision;

  // Banner Notification Helper
  const showAlert = useCallback((message, type = 'warning', timeout = 5000) => {
    setAlert({ message, type });
    if (timeout) {
      setTimeout(() => {
        setAlert(current => (current && current.message === message ? null : current));
      }, timeout);
    }
  }, []);

  // Format Helpers
  const formatDistance = (meters) => {
    if (!meters || meters <= 0) return '0 km';
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0 min';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  // API Call Wrapper
  const apiCall = async (endpoint, payload = {}) => {
    const res = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!json.ok) {
      const err = new Error(json.error ? json.error.message : 'API call failed');
      err.code = json.error ? json.error.code : 'UNKNOWN';
      throw err;
    }
    return json;
  };

  // Fetch Full Route
  const fetchRoute = useCallback(async (rId) => {
    try {
      setSyncStatus('syncing');
      const res = await apiCall('getRoute', { routeId: rId });
      const { route, stops: routeStops } = res.data;

      setRouteTitle(route.title || 'Untitled Route');
      setStops(routeStops || []);
      setRevision(res.revision);
      setSyncStatus('connected');
      setLastSynced(new Date());
    } catch (err) {
      setSyncStatus('offline');
      showAlert(`Failed to fetch route: ${err.message}`, 'danger');
    }
  }, [showAlert]);

  // Initial Route Load or Creation
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    let initialId = searchParams.get('routeId');

    const pathMatch = window.location.pathname.match(/\/route\/([a-zA-Z0-9_-]+)/);
    if (pathMatch) {
      initialId = pathMatch[1];
    }

    if (initialId) {
      setRouteId(initialId);
      fetchRoute(initialId);
    } else {
      // Create new route
      setSyncStatus('syncing');
      apiCall('createRoute', { title: 'New Multi-Stop Route' })
        .then(res => {
          const newId = res.data.routeId;
          setRouteId(newId);
          setRevision(res.revision);
          setRouteTitle('New Multi-Stop Route');
          setSyncStatus('connected');
          setLastSynced(new Date());

          const newUrl = `?routeId=${newId}`;
          window.history.pushState({ path: newUrl }, '', newUrl);
        })
        .catch(err => {
          setSyncStatus('offline');
          showAlert(`Failed to create route: ${err.message}`, 'danger');
        });
    }
  }, [fetchRoute, showAlert]);

  // Polling Sync: checks revision every 3.5 seconds
  useEffect(() => {
    if (!routeId) return;

    const interval = setInterval(async () => {
      if (isSavingRef.current) return;

      try {
        const res = await apiCall('getRouteRevision', { routeId });
        setSyncStatus('connected');

        if (res.revision > revisionRef.current) {
          // Remote modification detected
          setSyncStatus('syncing');
          await fetchRoute(routeId);
        }
      } catch (err) {
        setSyncStatus('offline');
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [routeId, fetchRoute]);

  // Conflict Handler
  const handleWriteError = (err) => {
    if (err.code === 'REVISION_CONFLICT') {
      setSyncStatus('conflict');
      showAlert('Revision conflict: Another user updated this route. Syncing changes...', 'danger');
      setTimeout(() => {
        fetchRoute(routeId);
      }, 1500);
    } else {
      showAlert(`Error: ${err.message}`, 'danger');
      setSyncStatus('offline');
    }
  };

  // Route Title Update
  const handleTitleChange = async (e) => {
    const newTitle = e.target.value;
    setRouteTitle(newTitle);
  };

  const handleTitleBlur = async () => {
    if (!routeId) return;
    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await apiCall('updateRoute', {
        routeId,
        expectedRevision: revision,
        changes: { title: routeTitle }
      });
      setRevision(res.revision);
      setSyncStatus('connected');
      setLastSynced(new Date());
    } catch (err) {
      handleWriteError(err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Add Manual Stop
  const handleAddStop = async (e) => {
    e.preventDefault();
    const address = newAddressInput.trim();
    if (!address || !routeId) return;

    setNewAddressInput('');
    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await apiCall('addStop', {
        routeId,
        expectedRevision: revision,
        stop: {
          address,
          name: address.split(',')[0].trim() || 'Stop'
        }
      });

      setStops(prev => [...prev, res.data]);
      setRevision(res.revision);
      setSyncStatus('connected');
      setLastSynced(new Date());
    } catch (err) {
      handleWriteError(err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Toggle Stop Lock
  const handleToggleLock = async (stopId) => {
    const stop = stops.find(s => s.stopId === stopId);
    if (!stop || !routeId) return;

    const newLocked = !(stop.metadata && stop.metadata.locked);
    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await apiCall('updateStop', {
        routeId,
        expectedRevision: revision,
        stopId,
        changes: {
          metadata: { locked: newLocked }
        }
      });

      setStops(prev => prev.map(s => s.stopId === stopId ? res.data : s));
      setRevision(res.revision);
      setSyncStatus('connected');
      setLastSynced(new Date());
    } catch (err) {
      handleWriteError(err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Update Stop Address (Manual Correction)
  const handleUpdateStop = async (stopId, changes) => {
    if (!routeId) return;
    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await apiCall('updateStop', {
        routeId,
        expectedRevision: revision,
        stopId,
        changes
      });

      setStops(prev => prev.map(s => s.stopId === stopId ? res.data : s));
      setRevision(res.revision);
      setSyncStatus('connected');
      setLastSynced(new Date());
      showAlert('Stop updated and location refreshed.', 'warning', 3000);
    } catch (err) {
      handleWriteError(err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Move Stop Up / Down
  const handleMoveStop = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= stops.length || !routeId) return;

    const newStops = stops.slice();
    const temp = newStops[index];
    newStops[index] = newStops[targetIdx];
    newStops[targetIdx] = temp;

    const sequence = newStops.map(s => s.stopId);
    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await apiCall('reorderStops', {
        routeId,
        expectedRevision: revision,
        sequence
      });

      setStops(res.data);
      setRevision(res.revision);
      setSyncStatus('connected');
      setLastSynced(new Date());
    } catch (err) {
      handleWriteError(err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Remove Stop
  const handleRemoveStop = async (stopId) => {
    if (!routeId) return;
    isSavingRef.current = true;
    setSyncStatus('syncing');

    try {
      const res = await apiCall('removeStop', {
        routeId,
        expectedRevision: revision,
        stopId
      });

      setStops(prev => prev.filter(s => s.stopId !== stopId).map((s, idx) => ({ ...s, sequence: idx })));
      setRevision(res.revision);
      setSyncStatus('connected');
      setLastSynced(new Date());
    } catch (err) {
      handleWriteError(err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Calculate Route
  const handleCalculateRoute = async (provider = 'osrm') => {
    if (stops.length < 2) {
      showAlert('At least 2 stops are required to calculate a route.', 'warning', 4000);
      return;
    }

    setSyncStatus('syncing');
    try {
      const res = await apiCall('calculateRoute', {
        routeId,
        provider,
        allowFallback: true
      });

      const data = res.data;
      setRouteGeometry(data.geometry);
      setSummary({
        totalDistanceMeters: data.totalDistanceMeters,
        totalDurationSeconds: data.totalDurationSeconds,
        provider: data.provider,
        isFallback: data.isFallback
      });

      if (data.isFallback) {
        showAlert('OSRM was unavailable. Displaying straight-line fallback route.', 'warning', 6000);
      } else {
        showAlert('Road route calculated successfully.', 'warning', 2500);
      }
      setSyncStatus('connected');
    } catch (err) {
      showAlert(`Routing error: ${err.message}`, 'danger');
      setSyncStatus('connected');
    }
  };

  // Optimize Route
  const handleOptimizeRoute = async () => {
    if (stops.length < 3) {
      showAlert('Add at least 3 stops to run route optimization.', 'warning', 4000);
      return;
    }

    setSyncStatus('syncing');
    try {
      const res = await apiCall('optimizeRoute', {
        routeId,
        options: { fixedStart: true, fixedEnd: false, lockedStops: true }
      });

      const data = res.data;
      setStops(data.stops);
      setRevision(res.revision);

      const origKm = (data.originalDistanceMeters / 1000).toFixed(1);
      const optKm = (data.optimizedDistanceMeters / 1000).toFixed(1);
      const pct = data.savingsPercent;

      showAlert(`Route optimized! Distance reduced from ${origKm} km to ${optKm} km (${pct}% savings).`, 'warning', 6000);
      setSyncStatus('connected');
      setLastSynced(new Date());

      // Recalculate polyline with new stop order
      handleCalculateRoute('osrm');
    } catch (err) {
      handleWriteError(err);
    }
  };

  // Import Stops from CSV / Paste
  const handleImportStops = async (parsedStops) => {
    if (!parsedStops || parsedStops.length === 0 || !routeId) return;

    showAlert(`Importing and geocoding ${parsedStops.length} stops...`, 'warning');
    let currentRev = revision;
    const addedStops = [];

    for (const stop of parsedStops) {
      try {
        const res = await apiCall('addStop', {
          routeId,
          expectedRevision: currentRev,
          stop: {
            name: stop.name,
            address: stop.address
          }
        });
        currentRev = res.revision;
        addedStops.push(res.data);
      } catch (err) {
        console.error('Failed to import stop', stop, err);
      }
    }

    setRevision(currentRev);
    setStops(prev => [...prev, ...addedStops]);
    showAlert(`Successfully imported ${addedStops.length} stops.`, 'warning', 4000);
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (!routeId) return;
    try {
      const res = await apiCall('exportRoute', { routeId, format: 'csv' });
      const blob = new Blob([res.data.content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = res.data.filename || 'RouteForge-stops.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      showAlert(`Export failed: ${err.message}`, 'danger');
    }
  };

  // Copy Shareable Link
  const handleCopyShareLink = () => {
    const url = window.location.origin + (routeId ? `?routeId=${routeId}` : '');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showAlert('Shareable URL copied to clipboard!', 'warning', 3000);
      });
    } else {
      prompt('Copy route URL:', url);
    }
  };

  return (
    <div className="app-container">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="brand-section">
          <span className="brand-logo">RouteForge</span>
          <span className="brand-target-badge">Node.js + React</span>
          <input
            type="text"
            className="route-title-input"
            value={routeTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            placeholder="Route Title"
            title="Click to rename route"
          />
        </div>

        <div className="top-actions">
          <Sync status={syncStatus} lastSynced={lastSynced} />

          <button className="btn btn-sm" onClick={handleCopyShareLink} title="Share route link">
            Share Link
          </button>

          <button className="btn btn-sm" onClick={handleExportCSV} title="Export stops as protected CSV">
            Export CSV
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="workspace">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="control-row">
              <button className="btn btn-sm" onClick={() => setIsImportOpen(true)} style={{ flex: 1 }}>
                📥 Import Addresses / CSV
              </button>
            </div>

            <form className="add-stop-form" onSubmit={handleAddStop}>
              <input
                type="text"
                className="text-input"
                placeholder="Add address or location..."
                value={newAddressInput}
                onChange={(e) => setNewAddressInput(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm">Add</button>
            </form>
          </div>

          <StopList
            stops={stops}
            onToggleLock={handleToggleLock}
            onMoveStop={handleMoveStop}
            onRemoveStop={handleRemoveStop}
            onUpdateStop={handleUpdateStop}
          />

          <div className="sidebar-footer">
            <div className="summary-metrics">
              <div>Stops: <span className="metric-value">{stops.length}</span></div>
              <div>Distance: <span className="metric-value">{formatDistance(summary.totalDistanceMeters)}</span></div>
              <div>Duration: <span className="metric-value">{formatDuration(summary.totalDurationSeconds)}</span></div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Engine: <span style={{
                fontWeight: 600,
                color: summary.provider ? (summary.isFallback ? '#f59e0b' : '#10b981') : 'var(--text-secondary)'
              }}>
                {summary.provider ? (summary.isFallback ? 'Straight-line estimate' : 'Road route (OSRM)') : 'Not calculated'}
              </span>
            </div>

            <div className="route-action-buttons">
              <button className="btn btn-primary" onClick={() => handleCalculateRoute('osrm')}>
                Calculate Road
              </button>
              <button
                className="btn"
                onClick={handleOptimizeRoute}
                style={{ background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2563eb' }}
              >
                ⚡ Optimize
              </button>
            </div>
          </div>
        </aside>

        {/* Map Area */}
        <section className="map-container">
          {alert && (
            <div className={`alert-banner banner-${alert.type}`}>
              <span>{alert.message}</span>
              <button
                className="icon-btn"
                style={{ marginLeft: 'auto', color: 'inherit' }}
                onClick={() => setAlert(null)}
              >
                ×
              </button>
            </div>
          )}

          <Map
            stops={stops}
            routeGeometry={routeGeometry}
            isFallback={summary.isFallback}
          />
        </section>
      </main>

      {/* CSV / Paste Modal */}
      <Import
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportStops={handleImportStops}
      />
    </div>
  );
}

