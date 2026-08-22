import React, { useState, useRef, useEffect, useId } from 'react';
import { LineBadge } from './common.jsx';

export default function StationSearchInput({
  id: propId,
  label,
  stations = [],
  value,
  onChange,
  placeholder = 'Search station or zone...',
  excludeId = null,
  disabled = false,
  badgeText = null,
}) {
  const generatedId = useId();
  const id = propId || generatedId;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef(null);

  const selectedStation = stations.find((s) => s.id === value);

  // Sync display text with selected value
  useEffect(() => {
    if (selectedStation) {
      setQuery(selectedStation.name);
    } else if (!value) {
      setQuery('');
    }
  }, [value, selectedStation]);

  const filteredStations = stations.filter((s) => {
    if (excludeId && s.id === excludeId) return false;
    if (!query) return true;
    const q = query.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      s.zone.toLowerCase().includes(q) ||
      (s.lines && s.lines.some((l) => l.name.toLowerCase().includes(q)))
    );
  });

  // Reset highlight index when filtered list changes
  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        // Reset query to current selected station name if closed without selecting
        if (selectedStation) {
          setQuery(selectedStation.name);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedStation]);

  const handleSelect = (station) => {
    onChange(station.id);
    setQuery(station.name);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % Math.max(1, filteredStations.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev - 1 + filteredStations.length) % Math.max(1, filteredStations.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredStations[highlightIdx]) {
        handleSelect(filteredStations[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedStation) setQuery(selectedStation.name);
    }
  };

  return (
    <div className="search-input-container" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {badgeText && <span className="label-badge">{badgeText}</span>}
        </label>
      )}

      <div className="input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          id={id}
          type="text"
          className="search-input"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (value && e.target.value !== selectedStation?.name) {
              // clear selected if user modifies input text
              onChange('');
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        {value && (
          <button
            type="button"
            className="clear-btn"
            aria-label="Clear selection"
            onClick={() => {
              onChange('');
              setQuery('');
              setIsOpen(true);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="autocomplete-dropdown" role="listbox">
          {filteredStations.length === 0 ? (
            <div className="dropdown-empty">No matching stations found</div>
          ) : (
            filteredStations.map((st, idx) => {
              const isSelected = st.id === value;
              const isHighlighted = idx === highlightIdx;
              return (
                <div
                  key={st.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`dropdown-item ${isSelected ? 'selected' : ''} ${
                    isHighlighted ? 'highlighted' : ''
                  }`}
                  onMouseDown={() => handleSelect(st)}
                  onMouseEnter={() => setHighlightIdx(idx)}
                >
                  <div className="item-main">
                    <span className="station-name">{st.name}</span>
                    <span className="station-zone">{st.zone}</span>
                  </div>
                  {st.lines && st.lines.length > 0 && (
                    <div className="item-lines">
                      {st.lines.map((l) => (
                        <LineBadge key={l.id} line={l} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
