/**
 * RouteForge - In-Memory Storage Adapter
 * Fast zero-dependency adapter for development and testing.
 */
class MemoryStorageAdapter {
  constructor() {
    this.routes = new Map();
    this.stops = new Map(); // routeId -> Stop[]
    this.history = new Map(); // routeId -> RouteHistory[]
  }

  async init() {
    return true;
  }

  _generateId(prefix = '') {
    const rand = Math.random().toString(36).substring(2, 10);
    const ts = Date.now().toString(36);
    return `${prefix}${ts}-${rand}`;
  }

  _checkConflict(route, expectedRevision) {
    if (typeof expectedRevision === 'number' && route.revision !== expectedRevision) {
      const err = new Error(`Revision conflict: current is ${route.revision}, expected was ${expectedRevision}`);
      err.code = 'REVISION_CONFLICT';
      throw err;
    }
  }

  _appendHistory(routeId, revision, changeType, changedBy, summary) {
    if (!this.history.has(routeId)) {
      this.history.set(routeId, []);
    }
    const list = this.history.get(routeId);
    list.unshift({
      routeId,
      revision,
      timestamp: new Date().toISOString(),
      changeType: changeType || 'update',
      changedBy: changedBy || 'anonymous',
      summary: summary || ''
    });

    // Enforce 50 entries retention cap
    if (list.length > 50) {
      list.length = 50;
    }
  }

  async createRoute({ title, settings, ownerIdentifier }) {
    const routeId = this._generateId('rf_');
    const now = new Date().toISOString();
    const route = {
      routeId,
      title: title && title.trim() ? title.trim() : 'Untitled Route',
      createdAt: now,
      updatedAt: now,
      revision: 1,
      settings: settings || { fixedStart: true, fixedEnd: false, provider: 'osrm' },
      ownerIdentifier: ownerIdentifier || 'anonymous',
      status: 'active'
    };

    this.routes.set(routeId, route);
    this.stops.set(routeId, []);
    this._appendHistory(routeId, 1, 'create', ownerIdentifier, 'Route created');

    return {
      routeId,
      revision: route.revision,
      url: `/route/${routeId}`,
      createdAt: now,
      updatedAt: now
    };
  }

  async getRoute(routeId) {
    const route = this.routes.get(routeId);
    if (!route || route.status === 'deleted') {
      const err = new Error(`Route ${routeId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const stops = (this.stops.get(routeId) || [])
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    const history = this.history.get(routeId) || [];

    return {
      route,
      stops,
      history
    };
  }

  async getRouteRevision(routeId) {
    const route = this.routes.get(routeId);
    if (!route || route.status === 'deleted') {
      const err = new Error(`Route ${routeId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }
    return {
      revision: route.revision,
      updatedAt: route.updatedAt
    };
  }

  async updateRoute(routeId, expectedRevision, changes = {}) {
    const route = this.routes.get(routeId);
    if (!route || route.status === 'deleted') {
      const err = new Error(`Route ${routeId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    this._checkConflict(route, expectedRevision);

    if (changes.title !== undefined) {
      route.title = String(changes.title).trim();
    }
    if (changes.settings !== undefined) {
      route.settings = { ...route.settings, ...changes.settings };
    }
    if (changes.status !== undefined) {
      route.status = changes.status;
    }

    route.revision += 1;
    route.updatedAt = new Date().toISOString();

    this._appendHistory(routeId, route.revision, 'update', changes.changedBy, 'Route metadata updated');

    return { route, revision: route.revision };
  }

  async addStop(routeId, expectedRevision, stopData) {
    const route = this.routes.get(routeId);
    if (!route || route.status === 'deleted') {
      const err = new Error(`Route ${routeId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    this._checkConflict(route, expectedRevision);

    const stops = this.stops.get(routeId) || [];
    const stopId = stopData.stopId || this._generateId('stop_');
    const sequence = typeof stopData.sequence === 'number' ? stopData.sequence : stops.length;

    const newStop = {
      routeId,
      stopId,
      name: (stopData.name && stopData.name.trim()) || (stopData.address && stopData.address.split(',')[0].trim()) || `Stop ${stops.length + 1}`,
      address: stopData.address ? stopData.address.trim() : '',
      latitude: typeof stopData.latitude === 'number' ? stopData.latitude : null,
      longitude: typeof stopData.longitude === 'number' ? stopData.longitude : null,
      sequence,
      metadata: stopData.metadata || { locked: false, geocodeStatus: 'pending' }
    };

    stops.push(newStop);
    stops.sort((a, b) => a.sequence - b.sequence);
    stops.forEach((s, idx) => { s.sequence = idx; });
    this.stops.set(routeId, stops);

    route.revision += 1;
    route.updatedAt = new Date().toISOString();

    this._appendHistory(routeId, route.revision, 'add_stop', stopData.changedBy, `Added stop: ${newStop.name}`);

    return { stop: newStop, revision: route.revision };
  }

  async removeStop(routeId, expectedRevision, stopId) {
    const route = this.routes.get(routeId);
    if (!route || route.status === 'deleted') {
      const err = new Error(`Route ${routeId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    this._checkConflict(route, expectedRevision);

    let stops = this.stops.get(routeId) || [];
    const initialLen = stops.length;
    const removedStop = stops.find(s => s.stopId === stopId);
    stops = stops.filter(s => s.stopId !== stopId);

    if (stops.length === initialLen) {
      const err = new Error(`Stop ${stopId} not found in route ${routeId}`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    // Renumber sequences
    stops.sort((a, b) => a.sequence - b.sequence);
    stops.forEach((s, idx) => { s.sequence = idx; });
    this.stops.set(routeId, stops);

    route.revision += 1;
    route.updatedAt = new Date().toISOString();

    this._appendHistory(
      routeId,
      route.revision,
      'remove_stop',
      null,
      `Removed stop: ${removedStop ? removedStop.name : stopId}`
    );

    return { removedStopId: stopId, revision: route.revision };
  }

  async reorderStops(routeId, expectedRevision, sequence) {
    const route = this.routes.get(routeId);
    if (!route || route.status === 'deleted') {
      const err = new Error(`Route ${routeId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    this._checkConflict(route, expectedRevision);

    const stops = this.stops.get(routeId) || [];
    const stopMap = new Map(stops.map(s => [s.stopId, s]));

    const reordered = [];
    for (let i = 0; i < sequence.length; i++) {
      const id = sequence[i];
      if (stopMap.has(id)) {
        const item = stopMap.get(id);
        item.sequence = i;
        reordered.push(item);
        stopMap.delete(id);
      }
    }

    // Append any unmentioned stops at the end
    for (const remaining of stopMap.values()) {
      remaining.sequence = reordered.length;
      reordered.push(remaining);
    }

    this.stops.set(routeId, reordered);

    route.revision += 1;
    route.updatedAt = new Date().toISOString();

    this._appendHistory(routeId, route.revision, 'reorder_stops', null, 'Stops reordered');

    return { stops: reordered, revision: route.revision };
  }

  async updateStop(routeId, expectedRevision, stopId, changes = {}) {
    const route = this.routes.get(routeId);
    if (!route || route.status === 'deleted') {
      const err = new Error(`Route ${routeId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    this._checkConflict(route, expectedRevision);

    const stops = this.stops.get(routeId) || [];
    const stop = stops.find(s => s.stopId === stopId);
    if (!stop) {
      const err = new Error(`Stop ${stopId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (changes.name !== undefined) stop.name = String(changes.name).trim();
    if (changes.address !== undefined) stop.address = String(changes.address).trim();
    if (changes.latitude !== undefined) stop.latitude = changes.latitude;
    if (changes.longitude !== undefined) stop.longitude = changes.longitude;
    if (changes.metadata !== undefined) {
      stop.metadata = { ...stop.metadata, ...changes.metadata };
    }

    route.revision += 1;
    route.updatedAt = new Date().toISOString();

    this._appendHistory(routeId, route.revision, 'update', changes.changedBy, `Updated stop: ${stop.name}`);

    return { stop, revision: route.revision };
  }
}

module.exports = MemoryStorageAdapter;

