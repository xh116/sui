// Shared byte/rate formatting. `digits` may be a number or a function of the
// unit index so existing per-component rounding stays byte-for-byte identical.
const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes, digits = 0, maxUnit = 4) {
  if (!bytes || !Number.isFinite(bytes) || bytes < 0) return "0 B";
  const limit = Math.min(maxUnit, UNITS.length - 1);
  let index = 0;
  let value = bytes;
  while (value >= 1024 && index < limit) {
    value /= 1024;
    index++;
  }
  const places = typeof digits === "function" ? digits(index) : digits;
  return `${places > 0 ? value.toFixed(places) : Math.round(value)} ${UNITS[index]}`;
}

export function formatSpeed(bytesPerSec) {
  const value = Number.isFinite(bytesPerSec) ? bytesPerSec : 0;
  if (value < 1024) return `${Math.round(value)} B/s`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB/s`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB/s`;
  return `${(value / 1024 ** 3).toFixed(1)} GB/s`;
}
