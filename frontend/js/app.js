/**
 * RouteForge Intelligence — Frontend Studio Controller
 * Handles Leaflet map synchronization (CartoDB Voyager), stop sequencer, CSV parsing,
 * real-time polling sync, multi-tasking workspace routes, and FastAPI communication.
 */
(function () {
  'use strict';

  // Application State
  const state = {
    routeId: null,
    route: null,
    stops: [],
    routeGeometry: null,
    allRoutes: [],
    summary: {
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      provider: null,
      isFallback: false
    },
    analytics: {
      savingsPercent: 0,
      savingsMeters: 0
    },
    syncStatus: 'connected',
    lastSynced: new Date(),
    expectedRevision: 1,
    isSaving: false
  };

  let map = null;
  let markersLayer = null;
  let routeLayer = null;
  let pollTimer = null;

  // DOM Elements
  const titleInput = document.getElementById('routeTitle');
  const syncDot = document.getElementById('syncDot');
  const syncText = document.getElementById('syncText');
  const stopListEl = document.getElementById('stopList');
  const totalDistEl = document.getElementById('totalDist');
  const totalTimeEl = document.getElementById('totalTime');
  const routeTypeEl = document.getElementById('routeType');
  const alertBanner = document.getElementById('alertBanner');
  const alertMessage = document.getElementById('alertMessage');
  const alertIcon = document.getElementById('alertIcon');
  const importModal = document.getElementById('importModal');
  const addStopForm = document.getElementById('addStopForm');
  const addStopInput = document.getElementById('addStopInput');
  const pasteAddresses = document.getElementById('pasteAddresses');
  const csvFileInput = document.getElementById('csvFileInput');
  const routeMenuPopover = document.getElementById('routeMenuPopover');
  const popoverRouteList = document.getElementById('popoverRouteList');

  // Vector SVG Icons
  const ICONS = {
    lock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    unlock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`,
    edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    up: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
    down: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    delete: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
  };

  // Utility: Formatting
  function formatDistance(meters) {
    if (!meters || meters <= 0) return '0.0 km';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0 min';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Toast Alerts & Notifications
  function showAlert(msg, type = 'warning', autoDismissMs = 4500) {
    alertMessage.textContent = msg;
    alertBanner.className = `floating-alert banner-${type}`;
    if (alertIcon) alertIcon.innerHTML = ICONS.info;
    alertBanner.style.display = 'flex';
    if (autoDismissMs) {
      setTimeout(dismissAlert, autoDismissMs);
    }
  }

  function dismissAlert() {
    alertBanner.style.display = 'none';
  }
  window.dismissAlert = dismissAlert;

  // Sync Status Badge
  function updateSyncUI(status, label) {
    state.syncStatus = status;
    syncDot.className = `sync-ping-dot ${status === 'syncing' ? 'syncing' : (status === 'offline' ? 'offline' : '')}`;
    syncText.textContent = label || (status === 'connected' ? 'Connected' : (status === 'syncing' ? 'Syncing...' : 'Offline'));
  }

  // Local REST API Wrapper
  async function apiCall(endpoint, payload = {}) {
    const res = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      const err = new Error(json.error ? json.error.message : 'API call failed');
      err.code = json.error ? json.error.code : 'UNKNOWN';
      err.status = res.status;
      throw err;
    }
    return json;
  }

  // Map Initialization with CartoDB Voyager tiles
  function initMap() {
    if (typeof L === 'undefined') {
      showAlert('Leaflet map failed to load from CDN. Running in list-only mode.', 'danger');
      return;
    }

    try {
      map = L.map('map', { zoomControl: false }).setView([48.2082, 16.3738], 12);
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      // CartoDB Voyager Pastel Tiles (Luxury Modern Aesthetic)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '© OpenStreetMap, © CARTO'
      }).addTo(map);

      markersLayer = L.featureGroup().addTo(map);
      routeLayer = L.geoJSON(null).addTo(map);
    } catch (e) {
      console.error('Map init error:', e);
    }
  }

  // Redraw Markers and Polyline Route
  function renderMap() {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();

    const bounds = [];
    state.stops.forEach((stop, idx) => {
      if (typeof stop.latitude === 'number' && typeof stop.longitude === 'number') {
        const isLocked = stop.metadata && stop.metadata.locked;
        const icon = L.divIcon({
          className: 'rf-marker-pin-wrapper',
          html: `<div class="rf-marker-pin ${isLocked ? 'locked' : ''}">${idx + 1}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = L.marker([stop.latitude, stop.longitude], { icon });
        marker.bindPopup(`
          <div style="font-family:'Plus Jakarta Sans', sans-serif; padding:4px 2px;">
            <strong style="color:#0f172a; font-size:0.85rem;">Stop ${idx + 1}: ${escapeHtml(stop.name)}</strong><br>
            <span style="font-size:0.75rem; color:#64748b;">${escapeHtml(stop.address)}</span><br>
            ${isLocked ? '<span style="color:#d97706; font-size:0.7rem; font-weight:700;">Locked Stop (2-Opt Invariant)</span>' : ''}
          </div>
        `);

        markersLayer.addLayer(marker);
        bounds.push([stop.latitude, stop.longitude]);
      }
    });

    if (routeLayer) {
      routeLayer.clearLayers();
      if (state.routeGeometry) {
        routeLayer.addData(state.routeGeometry);
        routeLayer.setStyle({
          color: state.summary.isFallback ? '#d97706' : '#4f46e5',
          weight: 5,
          opacity: 0.9,
          dashArray: state.summary.isFallback ? '6, 8' : null
        });
      }
    }

    if (bounds.length > 0 && (!state.routeGeometry || state.stops.length <= 1)) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (state.routeGeometry && routeLayer.getBounds().isValid()) {
      map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
    }
  }

  // Fit Route Bounds Helper
  window.fitRouteBounds = function () {
    if (!map) return;
    if (routeLayer && state.routeGeometry && routeLayer.getBounds().isValid()) {
      map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });
    } else if (markersLayer && markersLayer.getLayers().length > 0) {
      map.fitBounds(markersLayer.getBounds(), { padding: [40, 40], maxZoom: 15 });
    } else {
      showAlert('No stop locations to display on map.', 'warning', 2000);
    }
  };

  // Render Stop List
  function renderStopList() {
    const count = state.stops.length;
    const stopCountEl = document.getElementById('stopCount');
    if (stopCountEl) stopCountEl.textContent = `${count} Stop${count === 1 ? '' : 's'}`;

    const itinBadge = document.getElementById('itineraryCountBadge');
    if (itinBadge) itinBadge.textContent = `${count} stop${count === 1 ? '' : 's'}`;

    totalDistEl.textContent = formatDistance(state.summary.totalDistanceMeters);
    totalTimeEl.textContent = formatDuration(state.summary.totalDurationSeconds);

    const lockedCount = state.stops.filter(s => s.metadata && s.metadata.locked).length;
    const lockedBadge = document.getElementById('lockedCountBadge');
    if (lockedBadge) {
      lockedBadge.textContent = `${lockedCount} Locked`;
    }

    if (state.summary.provider) {
      if (state.summary.isFallback) {
        routeTypeEl.textContent = 'Straight-line';
        routeTypeEl.className = 'pill-tag pill-tag-amber';
      } else {
        routeTypeEl.textContent = 'Road (OSRM)';
        routeTypeEl.className = 'pill-tag pill-tag-blue';
      }
    } else {
      routeTypeEl.textContent = 'Road (OSRM)';
      routeTypeEl.className = 'pill-tag pill-tag-blue';
    }

    if (state.stops.length === 0) {
      stopListEl.innerHTML = `
        <div class="itinerary-empty-state">
          <div class="empty-icon-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h4 class="empty-title">Your itinerary is empty</h4>
          <p class="empty-desc">Enter any address or landmark in the search bar above, or import a CSV file to generate your route.</p>
        </div>
      `;
      return;
    }

    let html = '';
    state.stops.forEach((stop, idx) => {
      const isLocked = stop.metadata && stop.metadata.locked;
      const geoStatus = (stop.metadata && stop.metadata.geocodeStatus) || 'ok';
      let statusBadge = '';

      if (geoStatus === 'ambiguous') {
        statusBadge = `<span class="stop-status-pill status-ambiguous" onclick="editStopPrompt('${stop.stopId}')" title="Click to manually correct">Ambiguous location</span>`;
      } else if (geoStatus === 'not_found' || geoStatus === 'error') {
        statusBadge = `<span class="stop-status-pill status-error" onclick="editStopPrompt('${stop.stopId}')" title="Click to manually correct">Location not found</span>`;
      }

      html += `
        <div class="stop-item ${isLocked ? 'locked' : ''}" data-stop-id="${stop.stopId}">
          <div class="stop-seq-badge">${String(idx + 1).padStart(2, '0')}</div>
          <div class="stop-details">
            <div class="stop-name">${escapeHtml(stop.name)}</div>
            <div class="stop-address">${escapeHtml(stop.address)}</div>
            ${statusBadge}
          </div>
          <div class="stop-actions">
            <button class="icon-btn-ghost ${isLocked ? 'active' : ''}" title="${isLocked ? 'Unlock stop (allow reordering)' : 'Lock stop in place (2-Opt invariant)'}" onclick="toggleLock('${stop.stopId}')">
              ${isLocked ? ICONS.lock : ICONS.unlock}
            </button>
            <button class="icon-btn-ghost" title="Edit Address" onclick="editStopPrompt('${stop.stopId}')">
              ${ICONS.edit}
            </button>
            <button class="icon-btn-ghost" title="Move Up" ${idx === 0 ? 'disabled' : ''} onclick="moveStop(${idx}, -1)">
              ${ICONS.up}
            </button>
            <button class="icon-btn-ghost" title="Move Down" ${idx === state.stops.length - 1 ? 'disabled' : ''} onclick="moveStop(${idx}, 1)">
              ${ICONS.down}
            </button>
            <button class="icon-btn-ghost" style="color:var(--accent-rose);" title="Remove" onclick="deleteStop('${stop.stopId}')">
              ${ICONS.delete}
            </button>
          </div>
        </div>
      `;
    });

    stopListEl.innerHTML = html;
  }

  // Fetch Full Route
  async function pullRoute(rId) {
    try {
      updateSyncUI('syncing', 'Syncing...');
      const res = await apiCall('getRoute', { routeId: rId });
      state.route = res.data.route;
      state.stops = res.data.stops;
      state.expectedRevision = res.revision;
      titleInput.value = state.route.title || 'Untitled Route';

      renderStopList();
      renderMap();
      updateSyncUI('connected', 'Connected');
    } catch (err) {
      updateSyncUI('offline', 'Sync error');
      showAlert(`Failed to fetch route: ${err.message}`, 'danger');
    }
  }

  // Polling Sync: Every 3.5 seconds
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!state.routeId || state.isSaving) return;

      try {
        const res = await apiCall('getRouteRevision', { routeId: state.routeId });
        updateSyncUI('connected', 'Connected');

        if (res.revision > state.expectedRevision) {
          await pullRoute(state.routeId);
        }
      } catch (err) {
        updateSyncUI('offline', 'Offline');
      }
    }, 3500);
  }

  // Conflict Handler
  function handleWriteError(err) {
    if (err.code === 'REVISION_CONFLICT' || err.status === 409) {
      showAlert('Revision conflict: Another session updated this route. Reloading...', 'danger');
      setTimeout(() => pullRoute(state.routeId), 1200);
    } else {
      showAlert(`Error: ${err.message}`, 'danger');
      updateSyncUI('offline', 'Save failed');
    }
  }

  // Multi-Tasking: Route Switcher Popover
  window.toggleRouteMenu = async function () {
    const isVisible = routeMenuPopover.style.display !== 'none';
    if (isVisible) {
      routeMenuPopover.style.display = 'none';
    } else {
      routeMenuPopover.style.display = 'block';
      await loadPopoverRoutes();
    }
  };

  document.addEventListener('click', (e) => {
    if (routeMenuPopover && !routeMenuPopover.contains(e.target) && !document.getElementById('routeSelectorBtn').contains(e.target)) {
      routeMenuPopover.style.display = 'none';
    }
  });

  async function loadPopoverRoutes() {
    try {
      const res = await fetch('/api/listRoutes');
      const data = await res.json();
      if (!data.ok) return;

      state.allRoutes = data.data;
      let html = '';
      data.data.forEach(r => {
        const isActive = r.routeId === state.routeId;
        const dateStr = new Date(r.updatedAt || r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
        html += `
          <div class="popover-item ${isActive ? 'active' : ''}" onclick="switchRoute('${r.routeId}')">
            <div>
              <div style="font-size:0.82rem; font-weight:700; color:#0f172a;">${escapeHtml(r.title)}</div>
              <div style="font-size:0.72rem; color:#64748b;">Rev ${r.revision} • ${dateStr}</div>
            </div>
            ${isActive ? ICONS.check : ''}
          </div>
        `;
      });
      popoverRouteList.innerHTML = html || '<div class="popover-empty">No routes created yet.</div>';
    } catch (e) {
      popoverRouteList.innerHTML = '<div class="popover-empty">Failed to load routes.</div>';
    }
  }

  window.switchRoute = async function (newRouteId) {
    if (newRouteId === state.routeId) {
      routeMenuPopover.style.display = 'none';
      return;
    }
    state.routeId = newRouteId;
    routeMenuPopover.style.display = 'none';
    if (window.history.pushState) {
      const newUrl = `/?routeId=${newRouteId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
    await pullRoute(newRouteId);
    showAlert('Switched route workspace.', 'success', 2500);
  };

  window.createNewRoute = async function (e) {
    if (e) e.stopPropagation();
    try {
      const routeCount = (state.allRoutes.length || 0) + 1;
      const res = await apiCall('createRoute', { title: `Delivery Run #${routeCount}` });
      state.routeId = res.data.routeId;
      state.expectedRevision = res.revision;
      routeMenuPopover.style.display = 'none';

      if (window.history.pushState) {
        const newUrl = `/?routeId=${state.routeId}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
      }

      await pullRoute(state.routeId);
      showAlert('New route created!', 'success', 3000);
    } catch (err) {
      showAlert(`Failed to create route: ${err.message}`, 'danger');
    }
  };

  // Reverse Stops Order
  window.reverseRoute = async function () {
    if (state.stops.length < 2) {
      showAlert('Need at least 2 stops to reverse route.', 'warning', 2500);
      return;
    }
    const reversedSequence = state.stops.map(s => s.stopId).reverse();
    state.isSaving = true;
    updateSyncUI('syncing', 'Reversing sequence...');

    try {
      const res = await apiCall('reorderStops', {
        routeId: state.routeId,
        expectedRevision: state.expectedRevision,
        sequence: reversedSequence
      });
      state.expectedRevision = res.revision;
      state.stops = res.data;
      renderStopList();
      renderMap();
      calculateRoute('osrm');
      showAlert('Route direction reversed.', 'success', 2500);
    } catch (err) {
      handleWriteError(err);
    } finally {
      state.isSaving = false;
    }
  };

  // Update Route Title
  titleInput.addEventListener('change', async () => {
    const newTitle = titleInput.value.trim() || 'Untitled Route';
    state.isSaving = true;
    updateSyncUI('syncing', 'Saving title...');

    try {
      const res = await apiCall('updateRoute', {
        routeId: state.routeId,
        expectedRevision: state.expectedRevision,
        changes: { title: newTitle }
      });
      state.expectedRevision = res.revision;
      state.route.title = newTitle;
      updateSyncUI('connected', 'Saved');
    } catch (err) {
      handleWriteError(err);
    } finally {
      state.isSaving = false;
    }
  });

  // Add Stop from Search Bar
  addStopForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const addr = addStopInput.value.trim();
    if (!addr) return;

    addStopInput.value = '';
    state.isSaving = true;
    updateSyncUI('syncing', 'Geocoding location...');

    try {
      const res = await apiCall('addStop', {
        routeId: state.routeId,
        expectedRevision: state.expectedRevision,
        stop: {
          address: addr,
          name: addr.split(',')[0].trim() || 'Stop'
        }
      });

      state.expectedRevision = res.revision;
      state.stops.push(res.data);
      renderStopList();
      renderMap();
      updateSyncUI('connected', 'Saved');

      if (state.stops.length >= 2) {
        calculateRoute('osrm');
      }
    } catch (err) {
      handleWriteError(err);
    } finally {
      state.isSaving = false;
    }
  });

  // Toggle Lock
  window.toggleLock = async function (stopId) {
    const stop = state.stops.find(s => s.stopId === stopId);
    if (!stop) return;

    const currentLocked = !!(stop.metadata && stop.metadata.locked);
    const newLocked = !currentLocked;

    state.isSaving = true;
    updateSyncUI('syncing', 'Updating lock status...');

    try {
      const res = await apiCall('updateStop', {
        routeId: state.routeId,
        expectedRevision: state.expectedRevision,
        stopId,
        changes: {
          metadata: {
            ...stop.metadata,
            locked: newLocked
          }
        }
      });

      state.expectedRevision = res.revision;
      const idx = state.stops.findIndex(s => s.stopId === stopId);
      if (idx !== -1) {
        state.stops[idx] = res.data;
      }
      renderStopList();
      renderMap();
      updateSyncUI('connected', 'Saved');
    } catch (err) {
      handleWriteError(err);
    } finally {
      state.isSaving = false;
    }
  };

  // Move Stop Up/Down
  window.moveStop = async function (idx, direction) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= state.stops.length) return;

    const newStops = [...state.stops];
    const temp = newStops[idx];
    newStops[idx] = newStops[targetIdx];
    newStops[targetIdx] = temp;

    const newSeq = newStops.map(s => s.stopId);
    state.isSaving = true;
    updateSyncUI('syncing', 'Updating sequence...');

    try {
      const res = await apiCall('reorderStops', {
        routeId: state.routeId,
        expectedRevision: state.expectedRevision,
        sequence: newSeq
      });

      state.expectedRevision = res.revision;
      state.stops = res.data;
      renderStopList();
      renderMap();
      updateSyncUI('connected', 'Saved');
      calculateRoute('osrm');
    } catch (err) {
      handleWriteError(err);
    } finally {
      state.isSaving = false;
    }
  };

  // Delete Stop
  window.deleteStop = async function (stopId) {
    state.isSaving = true;
    updateSyncUI('syncing', 'Removing stop...');

    try {
      const res = await apiCall('removeStop', {
        routeId: state.routeId,
        expectedRevision: state.expectedRevision,
        stopId
      });

      state.expectedRevision = res.revision;
      state.stops = state.stops.filter(s => s.stopId !== stopId);
      state.stops.forEach((s, idx) => { s.sequence = idx; });
      renderStopList();
      renderMap();
      updateSyncUI('connected', 'Saved');
      if (state.stops.length >= 2) {
        calculateRoute('osrm');
      }
    } catch (err) {
      handleWriteError(err);
    } finally {
      state.isSaving = false;
    }
  };

  // Edit Stop
  window.editStopPrompt = async function (stopId) {
    const stop = state.stops.find(s => s.stopId === stopId);
    if (!stop) return;

    const newAddr = prompt('Update stop address / location:', stop.address);
    if (!newAddr || newAddr.trim() === stop.address) return;

    state.isSaving = true;
    updateSyncUI('syncing', 'Resolving location...');

    try {
      const geoRes = await apiCall('geocode', { address: newAddr.trim() });
      const geo = geoRes.data;

      const res = await apiCall('updateStop', {
        routeId: state.routeId,
        expectedRevision: state.expectedRevision,
        stopId,
        changes: {
          address: newAddr.trim(),
          name: newAddr.split(',')[0].trim(),
          latitude: geo.lat,
          longitude: geo.lng,
          metadata: {
            ...stop.metadata,
            geocodeStatus: geo.status,
            displayName: geo.displayName || ''
          }
        }
      });

      state.expectedRevision = res.revision;
      const idx = state.stops.findIndex(s => s.stopId === stopId);
      if (idx !== -1) {
        state.stops[idx] = res.data;
      }
      renderStopList();
      renderMap();
      showAlert('Address resolved & location updated.', 'success', 2500);
      calculateRoute('osrm');
    } catch (err) {
      handleWriteError(err);
    } finally {
      state.isSaving = false;
    }
  };

  // Calculate Road Route
  window.calculateRoute = async function (provider = 'osrm') {
    if (state.stops.length < 2) {
      showAlert('At least 2 stops are required to calculate road trajectory.', 'warning', 3000);
      return;
    }

    updateSyncUI('syncing', 'Querying OSRM road trajectory...');
    try {
      const res = await apiCall('calculateRoute', {
        routeId: state.routeId,
        provider,
        allowFallback: true
      });

      const data = res.data;
      state.routeGeometry = data.geometry;
      state.summary = {
        totalDistanceMeters: data.totalDistanceMeters,
        totalDurationSeconds: data.totalDurationSeconds,
        provider: data.provider,
        isFallback: data.isFallback
      };

      if (data.isFallback) {
        showAlert('OSRM was unavailable. Displaying straight-line fallback.', 'warning', 5000);
      } else {
        showAlert('Road trajectory computed successfully.', 'success', 2500);
      }

      renderStopList();
      renderMap();
      updateSyncUI('connected', 'Route ready');
    } catch (err) {
      showAlert(`Routing error: ${err.message}`, 'danger');
      updateSyncUI('connected', 'Routing error');
    }
  };

  // Optimize Route Sequence (Nearest Neighbor + 2-Opt)
  window.optimizeRoute = async function () {
    if (state.stops.length < 3) {
      showAlert('Add at least 3 stops to run tour optimization.', 'warning', 3000);
      return;
    }

    updateSyncUI('syncing', 'Optimizing tour sequence (2-Opt)...');
    try {
      const res = await apiCall('optimizeRoute', {
        routeId: state.routeId,
        options: { fixedStart: true, fixedEnd: false, lockedStops: true }
      });

      const data = res.data;
      state.expectedRevision = res.revision;
      state.stops = data.stops;

      const origKm = (data.originalDistanceMeters / 1000).toFixed(1);
      const optKm = (data.optimizedDistanceMeters / 1000).toFixed(1);
      const pct = data.savingsPercent;

      // Update Analytics & Stat Card
      const savingsPctEl = document.getElementById('savingsPercent');
      const savingsSubtext = document.getElementById('savingsSubtext');
      const savingsBadge = document.getElementById('savingsBadge');

      if (savingsPctEl) savingsPctEl.textContent = `${pct}%`;
      if (savingsSubtext) savingsSubtext.textContent = `Reduced: ${origKm} km down to ${optKm} km`;
      if (savingsBadge) savingsBadge.textContent = 'Optimized';

      showAlert(`Tour optimized: ${origKm} km reduced to ${optKm} km (${pct}% savings).`, 'success', 5000);
      renderStopList();
      calculateRoute('osrm');
    } catch (err) {
      handleWriteError(err);
    }
  };

  // Import Modal Handlers
  window.openImportModal = function () {
    importModal.style.display = 'flex';
    document.getElementById('importError').style.display = 'none';
  };

  window.closeImportModal = function () {
    importModal.style.display = 'none';
    pasteAddresses.value = '';
    csvFileInput.value = '';
  };

  window.handleFileSelect = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      pasteAddresses.value = evt.target.result;
    };
    reader.readAsText(file);
  };

  window.processImport = async function () {
    const text = pasteAddresses.value.trim();
    if (!text) {
      document.getElementById('importError').textContent = 'Please enter or upload addresses.';
      document.getElementById('importError').style.display = 'block';
      return;
    }

    closeImportModal();
    showAlert('Resolving coordinates for imported stops...', 'warning', 4000);

    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    let addedCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const cleanLine = lines[i].replace(/^["']|["']$/g, '').trim();
      if (!cleanLine || (i === 0 && cleanLine.toLowerCase().includes('address') && lines.length > 1)) {
        continue;
      }

      try {
        const res = await apiCall('addStop', {
          routeId: state.routeId,
          expectedRevision: state.expectedRevision,
          stop: {
            address: cleanLine,
            name: cleanLine.split(',')[0].trim() || 'Stop'
          }
        });
        state.expectedRevision = res.revision;
        state.stops.push(res.data);
        addedCount++;
        renderStopList();
        renderMap();
      } catch (err) {
        console.error('Stop import error:', cleanLine, err);
      }
    }

    showAlert(`Imported ${addedCount} stops successfully.`, 'success', 3500);
    if (state.stops.length >= 2) {
      calculateRoute('osrm');
    }
  };

  // Export CSV
  window.exportCSV = async function () {
    try {
      const res = await apiCall('exportRoute', { routeId: state.routeId, format: 'csv' });
      const blob = new Blob([res.data.content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = res.data.filename || 'RouteForge-stops.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showAlert('Route stops CSV exported.', 'success', 2500);
    } catch (err) {
      showAlert(`Export failed: ${err.message}`, 'danger');
    }
  };

  // Copy Share URL
  window.copyShareUrl = function () {
    const url = `${window.location.origin}/?routeId=${state.routeId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showAlert('Route link copied to clipboard!', 'success', 2500);
      });
    } else {
      prompt('Copy route URL:', url);
    }
  };

  // Initialize Application
  async function initApp() {
    initMap();

    const params = new URLSearchParams(window.location.search);
    let queryRouteId = params.get('routeId');

    const pathMatch = window.location.pathname.match(/\/route\/([a-zA-Z0-9_\-]+)/);
    if (pathMatch) {
      queryRouteId = pathMatch[1];
    }

    if (queryRouteId) {
      state.routeId = queryRouteId;
      await pullRoute(queryRouteId);
      startPolling();
    } else {
      updateSyncUI('syncing', 'Initializing workspace...');
      try {
        const res = await apiCall('createRoute', { title: 'Delivery Run #1' });
        state.routeId = res.data.routeId;
        state.expectedRevision = res.revision;
        state.route = { title: 'Delivery Run #1', revision: res.revision };
        titleInput.value = state.route.title;

        if (window.history.pushState) {
          const newUrl = `/?routeId=${state.routeId}`;
          window.history.pushState({ path: newUrl }, '', newUrl);
        }

        renderStopList();
        startPolling();
        updateSyncUI('connected', 'Connected');
      } catch (err) {
        showAlert(`Failed to initialize route: ${err.message}`, 'danger');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
