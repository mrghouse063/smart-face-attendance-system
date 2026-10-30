export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function formatRealTime(value: Date | string): string {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return typeof value === 'string' ? value : '';
  }
  return dt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatRealDate(value: Date | string): string {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return typeof value === 'string' ? value : '';
  }
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatRealReadableDate(value: Date | string): string {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) {
    return typeof value === 'string' ? value : '';
  }
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
