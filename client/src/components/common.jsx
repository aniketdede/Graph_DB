import React from 'react';

export function Loading({ text = 'Loading…' }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

export function EmptyState({ icon = '🗺️', title, hint }) {
  return (
    <div className="state">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state" role="alert">
      <div className="icon">⚠️</div>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && <button className="btn ghost" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function LineBadge({ line }) {
  if (!line) return null;
  return (
    <span className="line-badge" style={{ borderColor: line.color, color: line.color }}>
      {line.mode === 'bus' ? '🚌' : '🚇'} {line.name}
    </span>
  );
}
