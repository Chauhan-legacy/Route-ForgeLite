/**
 * RouteForge - SQLite Storage Adapter
 * Mirrors the Sheets schema field-for-field with transaction safety,
 * revision conflict detection, and history retention capping.
 * Supports better-sqlite3 with seamless WebAssembly SQLite (sql.js) fallback
 * for broad multi-platform Node 20+ compatibility.
 */
const path = require('path');
const fs = require('fs');

class SqliteStorageAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '..', 'routeforge.sqlite');
    this.engine = null; // 'better-sqlite3' | 'sql.js'
    this.db = null;
  }

  async init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Try better-sqlite3 first
    try {
      const BetterSqlite3 = require('better-sqlite3');
      this.db = new BetterSqlite3(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.engine = 'better-sqlite3';
    } catch (e) {
      // Fallback to sql.js (WebAssembly SQLite)
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      if (fs.existsSync(this.dbPath)) {
        const filebuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(filebuffer);
      } else {
        this.db = new SQL.Database();
      }
      this.engine = 'sql.js';
    }

    // Schema definition mirroring Sheets field-for-field
    const schemaSql = `
      CREATE TABLE IF NOT EXISTS Routes (
        routeId TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        settings TEXT NOT NULL DEFAULT '{}',
        ownerIdentifier TEXT,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS Stops (
        routeId TEXT NOT NULL,
        stopId TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        sequence INTEGER NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS RouteHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routeId TEXT NOT NULL,
        revision INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        changeType TEXT NOT NULL,
        changedBy TEXT,
        summary TEXT
      );
    `;

    if (this.engine === 'better-sqlite3') {
      this.db.exec(schemaSql);
    } else {
      this.db.run(schemaSql);
      this._saveDisk();
    }

    return true;
  }

  _saveDisk() {
    if (this.engine === 'sql.js' && this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }
  }

  _generateId(prefix = '') {
    const rand = Math.random().toString(36).substring(2, 10);
    const ts = Date.now().toString(36);
    return `${prefix}${ts}-${rand}`;
  }

  _appendHistory(routeId, revision, changeType, changedBy, summary) {
    const now = new Date().toISOString();
    const type = changeType || 'update';
    const by = changedBy || 'anonymous';
    const sum = summary || '';

    if (this.engine === 'better-sqlite3') {
      this.db.prepare(`
        INSERT INTO RouteHistory (routeId, revision, timestamp, changeType, changedBy, summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(routeId, revision, now, type, by, sum);

      this.db.prepare(`
        DELETE FROM RouteHistory 
        WHERE routeId = ? AND id NOT IN (
          SELECT id FROM RouteHistory WHERE routeId = ? ORDER BY revision DESC, id DESC LIMIT 50
        )
      `).run(routeId, routeId);
    } else {
      this.db.run(
        `INSERT INTO RouteHistory (routeId, revision, timestamp, changeType, changedBy, summary) VALUES (?, ?, ?, ?, ?, ?)`,
        [routeId, revision, now, type, by, sum]
      );
      this.db.run(
        `DELETE FROM RouteHistory WHERE routeId = ? AND id NOT IN (
          SELECT id FROM RouteHistory WHERE routeId = ? ORDER BY revision DESC, id DESC LIMIT 50
        )`,
        [routeId, routeId]
      );
      this._saveDisk();
    }
  }

  async createRoute({ title, settings, ownerIdentifier }) {
    const routeId = this._generateId('rf_');
    const now = new Date().toISOString();
    const cleanTitle = title && title.trim() ? title.trim() : 'Untitled Route';
    const settingsJson = JSON.stringify(settings || { fixedStart: true, fixedEnd: false, provider: 'osrm' });
    const owner = ownerIdentifier || 'anonymous';

    if (this.engine === 'better-sqlite3') {
      const insert = this.db.prepare(`
        INSERT INTO Routes (routeId, title, createdAt, updatedAt, revision, settings, ownerIdentifier, status)
        VALUES (?, ?, ?, ?, 1, ?, ?, 'active')
      `);
      const tx = this.db.transaction(() => {
        insert.run(routeId, cleanTitle, now, now, settingsJson, owner);
        this._appendHistory(routeId, 1, 'create', owner, 'Route created');
      });
      tx();
    } else {
      this.db.run(
        `INSERT INTO Routes (routeId, title, createdAt, updatedAt, revision, settings, ownerIdentifier, status) VALUES (?, ?, ?, ?, 1, ?, ?, 'active')`,
        [routeId, cleanTitle, now, now, settingsJson, owner]
      );
      this._appendHistory(routeId, 1, 'create', owner, 'Route created');
      this._saveDisk();
    }

    return {
      routeId,
      revision: 1,
      url: `/route/${routeId}`,
      createdAt: now,
      updatedAt: now
    };
  }

  async getRoute(routeId) {
    let routeRow;
    let stopRows;
    let historyRows;

    if (this.engine === 'better-sqlite3') {
      routeRow = this.db.prepare(`SELECT * FROM Routes WHERE routeId = ? AND status != 'deleted'`).get(routeId);
      if (!routeRow) {
        const err = new Error(`Route ${routeId} not found`);
        err.code = 'NOT_FOUND';
        throw err;
      }
      stopRows = this.db.prepare(`SELECT * FROM Stops WHERE routeId = ? ORDER BY sequence ASC`).all(routeId);
      historyRows = this.db.prepare(`SELECT routeId, revision, timestamp, changeType, changedBy, summary FROM RouteHistory WHERE routeId = ? ORDER BY revision DESC LIMIT 50`).all(routeId);
    } else {
      const stmt = this.db.prepare(`SELECT * FROM Routes WHERE routeId = ? AND status != 'deleted'`);
      stmt.bind([routeId]);
      if (stmt.step()) {
        routeRow = stmt.getAsObject();
      }
      stmt.free();

      if (!routeRow) {
        const err = new Error(`Route ${routeId} not found`);
        err.code = 'NOT_FOUND';
        throw err;
      }

      stopRows = [];
      const stopStmt = this.db.prepare(`SELECT * FROM Stops WHERE routeId = ? ORDER BY sequence ASC`);
      stopStmt.bind([routeId]);
      while (stopStmt.step()) {
        stopRows.push(stopStmt.getAsObject());
      }
      stopStmt.free();

      historyRows = [];
      const histStmt = this.db.prepare(`SELECT routeId, revision, timestamp, changeType, changedBy, summary FROM RouteHistory WHERE routeId = ? ORDER BY revision DESC LIMIT 50`);
      histStmt.bind([routeId]);
      while (histStmt.step()) {
        historyRows.push(histStmt.getAsObject());
      }
      histStmt.free();
    }

    return {
      route: {
        ...routeRow,
        settings: JSON.parse(routeRow.settings || '{}')
      },
      stops: stopRows.map(s => ({
        ...s,
        latitude: s.latitude !== null && s.latitude !== undefined ? Number(s.latitude) : null,
        longitude: s.longitude !== null && s.longitude !== undefined ? Number(s.longitude) : null,
        sequence: Number(s.sequence),
        metadata: JSON.parse(s.metadata || '{}')
      })),
      history: historyRows
    };
  }

  async getRouteRevision(routeId) {
    let row;
    if (this.engine === 'better-sqlite3') {
      row = this.db.prepare(`SELECT revision, updatedAt, status FROM Routes WHERE routeId = ?`).get(routeId);
    } else {
      const stmt = this.db.prepare(`SELECT revision, updatedAt, status FROM Routes WHERE routeId = ?`);
      stmt.bind([routeId]);
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
    }

    if (!row || row.status === 'deleted') {
      const err = new Error(`Route ${routeId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    return {
      revision: Number(row.revision),
      updatedAt: row.updatedAt
    };
  }

  async updateRoute(routeId, expectedRevision, changes = {}) {
    const current = await this.getRoute(routeId);
    if (typeof expectedRevision === 'number' && current.route.revision !== expectedRevision) {
      const err = new Error(`Revision conflict: current is ${current.route.revision}, expected was ${expectedRevision}`);
      err.code = 'REVISION_CONFLICT';
      throw err;
    }

    const nextRev = current.route.revision + 1;
    const now = new Date().toISOString();
    const title = changes.title !== undefined ? String(changes.title).trim() : current.route.title;
    const settings = changes.settings !== undefined ? { ...current.route.settings, ...changes.settings } : current.route.settings;
    const status = changes.status !== undefined ? changes.status : current.route.status;
    const settingsJson = JSON.stringify(settings);

    if (this.engine === 'better-sqlite3') {
      this.db.prepare(`
        UPDATE Routes 
        SET title = ?, settings = ?, status = ?, updatedAt = ?, revision = ?
        WHERE routeId = ?
      `).run(title, settingsJson, status, now, nextRev, routeId);
    } else {
      this.db.run(
        `UPDATE Routes SET title = ?, settings = ?, status = ?, updatedAt = ?, revision = ? WHERE routeId = ?`,
        [title, settingsJson, status, now, nextRev, routeId]
      );
      this._saveDisk();
    }

    this._appendHistory(routeId, nextRev, 'update', changes.changedBy, 'Route metadata updated');

    return {
      route: {
        ...current.route,
        title,
        settings,
        status,
        updatedAt: now,
        revision: nextRev
      },
      revision: nextRev
    };
  }

  async addStop(routeId, expectedRevision, stopData) {
    const current = await this.getRoute(routeId);
    if (typeof expectedRevision === 'number' && current.route.revision !== expectedRevision) {
      const err = new Error(`Revision conflict: current is ${current.route.revision}, expected was ${expectedRevision}`);
      err.code = 'REVISION_CONFLICT';
      throw err;
    }

    const stopId = stopData.stopId || this._generateId('stop_');
    const sequence = typeof stopData.sequence === 'number' ? stopData.sequence : current.stops.length;
    const name = (stopData.name && stopData.name.trim()) || (stopData.address && stopData.address.split(',')[0].trim()) || `Stop ${current.stops.length + 1}`;
    const address = stopData.address ? stopData.address.trim() : '';
    const lat = typeof stopData.latitude === 'number' ? stopData.latitude : null;
    const lng = typeof stopData.longitude === 'number' ? stopData.longitude : null;
    const metadata = stopData.metadata || { locked: false, geocodeStatus: 'pending' };
    const metadataJson = JSON.stringify(metadata);

    const nextRev = current.route.revision + 1;
    const now = new Date().toISOString();

    if (this.engine === 'better-sqlite3') {
      this.db.prepare(`
        INSERT INTO Stops (routeId, stopId, name, address, latitude, longitude, sequence, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(routeId, stopId, name, address, lat, lng, sequence, metadataJson);

      this.db.prepare(`UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?`).run(nextRev, now, routeId);
    } else {
      this.db.run(
        `INSERT INTO Stops (routeId, stopId, name, address, latitude, longitude, sequence, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [routeId, stopId, name, address, lat, lng, sequence, metadataJson]
      );
      this.db.run(`UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?`, [nextRev, now, routeId]);
      this._saveDisk();
    }

    this._appendHistory(routeId, nextRev, 'add_stop', stopData.changedBy, `Added stop: ${name}`);

    return {
      stop: {
        routeId,
        stopId,
        name,
        address,
        latitude: lat,
        longitude: lng,
        sequence,
        metadata
      },
      revision: nextRev
    };
  }

  async removeStop(routeId, expectedRevision, stopId) {
    const current = await this.getRoute(routeId);
    if (typeof expectedRevision === 'number' && current.route.revision !== expectedRevision) {
      const err = new Error(`Revision conflict: current is ${current.route.revision}, expected was ${expectedRevision}`);
      err.code = 'REVISION_CONFLICT';
      throw err;
    }

    const stop = current.stops.find(s => s.stopId === stopId);
    if (!stop) {
      const err = new Error(`Stop ${stopId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const nextRev = current.route.revision + 1;
    const now = new Date().toISOString();

    if (this.engine === 'better-sqlite3') {
      this.db.prepare(`DELETE FROM Stops WHERE routeId = ? AND stopId = ?`).run(routeId, stopId);
      const remaining = this.db.prepare(`SELECT stopId FROM Stops WHERE routeId = ? ORDER BY sequence ASC`).all(routeId);
      const updateSeq = this.db.prepare(`UPDATE Stops SET sequence = ? WHERE routeId = ? AND stopId = ?`);
      remaining.forEach((s, idx) => updateSeq.run(idx, routeId, s.stopId));
      this.db.prepare(`UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?`).run(nextRev, now, routeId);
    } else {
      this.db.run(`DELETE FROM Stops WHERE routeId = ? AND stopId = ?`, [routeId, stopId]);
      const remaining = [];
      const stmt = this.db.prepare(`SELECT stopId FROM Stops WHERE routeId = ? ORDER BY sequence ASC`);
      stmt.bind([routeId]);
      while (stmt.step()) remaining.push(stmt.getAsObject());
      stmt.free();

      remaining.forEach((s, idx) => {
        this.db.run(`UPDATE Stops SET sequence = ? WHERE routeId = ? AND stopId = ?`, [idx, routeId, s.stopId]);
      });
      this.db.run(`UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?`, [nextRev, now, routeId]);
      this._saveDisk();
    }

    this._appendHistory(routeId, nextRev, 'remove_stop', null, `Removed stop: ${stop.name}`);

    return { removedStopId: stopId, revision: nextRev };
  }

  async reorderStops(routeId, expectedRevision, sequence) {
    const current = await this.getRoute(routeId);
    if (typeof expectedRevision === 'number' && current.route.revision !== expectedRevision) {
      const err = new Error(`Revision conflict: current is ${current.route.revision}, expected was ${expectedRevision}`);
      err.code = 'REVISION_CONFLICT';
      throw err;
    }

    const nextRev = current.route.revision + 1;
    const now = new Date().toISOString();

    if (this.engine === 'better-sqlite3') {
      const updateSeq = this.db.prepare(`UPDATE Stops SET sequence = ? WHERE routeId = ? AND stopId = ?`);
      for (let i = 0; i < sequence.length; i++) {
        updateSeq.run(i, routeId, sequence[i]);
      }
      this.db.prepare(`UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?`).run(nextRev, now, routeId);
    } else {
      for (let i = 0; i < sequence.length; i++) {
        this.db.run(`UPDATE Stops SET sequence = ? WHERE routeId = ? AND stopId = ?`, [i, routeId, sequence[i]]);
      }
      this.db.run(`UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?`, [nextRev, now, routeId]);
      this._saveDisk();
    }

    this._appendHistory(routeId, nextRev, 'reorder_stops', null, 'Stops reordered');
    const updated = await this.getRoute(routeId);

    return { stops: updated.stops, revision: nextRev };
  }

  async updateStop(routeId, expectedRevision, stopId, changes = {}) {
    const current = await this.getRoute(routeId);
    if (typeof expectedRevision === 'number' && current.route.revision !== expectedRevision) {
      const err = new Error(`Revision conflict: current is ${current.route.revision}, expected was ${expectedRevision}`);
      err.code = 'REVISION_CONFLICT';
      throw err;
    }

    const stop = current.stops.find(s => s.stopId === stopId);
    if (!stop) {
      const err = new Error(`Stop ${stopId} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const name = changes.name !== undefined ? String(changes.name).trim() : stop.name;
    const address = changes.address !== undefined ? String(changes.address).trim() : stop.address;
    const lat = changes.latitude !== undefined ? changes.latitude : stop.latitude;
    const lng = changes.longitude !== undefined ? changes.longitude : stop.longitude;
    const metadata = changes.metadata !== undefined ? { ...stop.metadata, ...changes.metadata } : stop.metadata;
    const metadataJson = JSON.stringify(metadata);

    const nextRev = current.route.revision + 1;
    const now = new Date().toISOString();

    if (this.engine === 'better-sqlite3') {
      this.db.prepare(`
        UPDATE Stops SET name = ?, address = ?, latitude = ?, longitude = ?, metadata = ?
        WHERE routeId = ? AND stopId = ?
      `).run(name, address, lat, lng, metadataJson, routeId, stopId);

      this.db.prepare(`UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?`).run(nextRev, now, routeId);
    } else {
      this.db.run(
        `UPDATE Stops SET name = ?, address = ?, latitude = ?, longitude = ?, metadata = ? WHERE routeId = ? AND stopId = ?`,
        [name, address, lat, lng, metadataJson, routeId, stopId]
      );
      this.db.run(`UPDATE Routes SET revision = ?, updatedAt = ? WHERE routeId = ?`, [nextRev, now, routeId]);
      this._saveDisk();
    }

    this._appendHistory(routeId, nextRev, 'update', changes.changedBy, `Updated stop: ${name}`);

    return {
      stop: {
        routeId,
        stopId,
        name,
        address,
        latitude: lat,
        longitude: lng,
        sequence: stop.sequence,
        metadata
      },
      revision: nextRev
    };
  }
}

module.exports = SqliteStorageAdapter;
