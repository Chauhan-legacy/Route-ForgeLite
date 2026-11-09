import React, { useState } from 'react';

export default function StopList({
  stops = [],
  onToggleLock,
  onMoveStop,
  onRemoveStop,
  onUpdateStop
}) {
  const [editingStopId, setEditingStopId] = useState(null);
  const [editAddress, setEditAddress] = useState('');

  const handleStartEdit = (stop) => {
    setEditingStopId(stop.stopId);
    setEditAddress(stop.address);
  };

  const handleSaveEdit = (stopId) => {
    if (editAddress.trim()) {
      onUpdateStop(stopId, { address: editAddress.trim() });
    }
    setEditingStopId(null);
  };

  if (!stops || stops.length === 0) {
    return (
      <div className="empty-state">
        No stops added yet.<br />Add an address above or import a CSV.
      </div>
    );
  }

  return (
    <div className="stop-list-container">
      {stops.map((stop, idx) => {
        const isLocked = stop.metadata && stop.metadata.locked;
        const geoStatus = (stop.metadata && stop.metadata.geocodeStatus) || 'ok';
        const isEditing = editingStopId === stop.stopId;

        return (
          <div key={stop.stopId || idx} className={`stop-item ${isLocked ? 'locked' : ''}`}>
            <div className="stop-seq-badge">{idx + 1}</div>

            <div className="stop-details">
              <div className="stop-name">{stop.name}</div>

              {isEditing ? (
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <input
                    type="text"
                    className="text-input"
                    style={{ height: '26px', fontSize: '0.75rem' }}
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(stop.stopId)}>Save</button>
                  <button className="btn btn-sm" onClick={() => setEditingStopId(null)}>Cancel</button>
                </div>
              ) : (
                <div className="stop-address">{stop.address}</div>
              )}

              {geoStatus === 'ambiguous' && (
                <span
                  className="stop-status-pill status-ambiguous"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleStartEdit(stop)}
                  title="Click to manually correct ambiguous address"
                >
                  Ambiguous location (click to correct)
                </span>
              )}

              {(geoStatus === 'not_found' || geoStatus === 'error') && (
                <span
                  className="stop-status-pill status-error"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleStartEdit(stop)}
                  title="Click to manually correct failed address"
                >
                  Location not found (click to correct)
                </span>
              )}
            </div>

            <div className="stop-actions">
              <button
                className={`icon-btn ${isLocked ? 'active' : ''}`}
                title={isLocked ? 'Unlock stop' : 'Lock stop in place during optimization'}
                onClick={() => onToggleLock(stop.stopId)}
              >
                {isLocked ? '🔒' : '🔓'}
              </button>

              <button
                className="icon-btn"
                title="Edit address"
                onClick={() => handleStartEdit(stop)}
              >
                ✏️
              </button>

              <button
                className="icon-btn"
                title="Move Up"
                disabled={idx === 0}
                onClick={() => onMoveStop(idx, -1)}
              >
                ↑
              </button>

              <button
                className="icon-btn"
                title="Move Down"
                disabled={idx === stops.length - 1}
                onClick={() => onMoveStop(idx, 1)}
              >
                ↓
              </button>

              <button
                className="icon-btn"
                style={{ color: '#ef4444' }}
                title="Remove Stop"
                onClick={() => onRemoveStop(stop.stopId)}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

