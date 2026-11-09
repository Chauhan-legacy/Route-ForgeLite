import React from 'react';

export default function Sync({ status, lastSynced }) {
  const getLabel = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'offline':
        return 'Offline';
      case 'pending':
        return 'Changes pending';
      case 'conflict':
        return 'Conflict detected';
      case 'connected':
      default:
        return 'Connected';
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="sync-pill" title={`Status: ${getLabel()} (Last synced: ${formatTime(lastSynced)})`}>
      <div className={`sync-dot ${status === 'syncing' ? 'syncing' : (status === 'offline' || status === 'conflict' ? 'offline' : '')}`} />
      <span>{getLabel()}</span>
    </div>
  );
}

