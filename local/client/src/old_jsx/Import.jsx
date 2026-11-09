import React, { useState } from 'react';
import csv from '../../../shared/csv.js';

export default function Import({ isOpen, onClose, onImportStops }) {
  const [pasteText, setPasteText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [warnings, setWarnings] = useState([]);

  if (!isOpen) return null;

  const handleParse = (text) => {
    setErrorMsg('');
    setWarnings([]);

    if (!text || !text.trim()) {
      setErrorMsg('Please paste addresses or select a CSV file.');
      return;
    }

    const result = csv.parseStopCSV(text);
    if (!result.success) {
      setErrorMsg(`Malformed CSV at row ${result.error.row}: ${result.error.reason}`);
      return;
    }

    if (result.warnings && result.warnings.length > 0) {
      setWarnings(result.warnings);
    }

    onImportStops(result.stops);
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setPasteText(content);
      handleParse(content);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file.');
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">Import Stops (CSV or Text)</h3>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <label className="file-dropzone">
            <span>📁 Click to choose or drop a CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Or paste addresses below (one address per line, or CSV with Name and Address columns):
          </p>

          <textarea
            className="textarea-input"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`Stephansplatz 3, 1010 Wien\nPrinz Eugen-Straße 27, 1030 Wien\nSchönbrunner Schloßstraße 47, 1130 Wien`}
          />

          {errorMsg && (
            <div style={{ color: '#f87171', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: '4px' }}>
              {errorMsg}
            </div>
          )}

          {warnings.length > 0 && (
            <div style={{ color: '#fbbf24', fontSize: '0.75rem', maxHeight: '60px', overflowY: 'auto' }}>
              {warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => handleParse(pasteText)}>
            Import & Geocode
          </button>
        </div>
      </div>
    </div>
  );
}
