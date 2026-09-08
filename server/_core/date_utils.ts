export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Returns a date key in YYYY-MM-DD format for a given date,
 * forced to Bolivia timezone (UTC-4) to ensure consistency
 * between server (UTC) and local business operations.
 */
export function getLocalDateKey(value?: unknown): string {
  const d = value ? new Date(value as any) : new Date();

  // Bolivia is UTC-4. 
  const BOLIVIA_OFFSET_HOURS = -4;
  const boDate = new Date(d.getTime() + (BOLIVIA_OFFSET_HOURS * 60 * 60 * 1000));
  
  const y = boDate.getUTCFullYear();
  const m = pad2(boDate.getUTCMonth() + 1);
  const day = pad2(boDate.getUTCDate());
  
  return `${y}-${m}-${day}`;
}

export function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
