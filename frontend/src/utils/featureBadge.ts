/**
 * Badge "New" pada daftar fitur tampil otomatis selama 3 hari
 * terhitung sejak tanggal rilis fitur tersebut.
 */
export const NEW_BADGE_DURATION_DAYS = 3;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * @param releasedAt tanggal rilis fitur, format "YYYY-MM-DD"
 * @param now waktu acuan (default: sekarang)
 */
export function isFeatureNew(releasedAt?: string, now: number = Date.now()): boolean {
  if (!releasedAt) return false;

  const released = new Date(`${releasedAt}T00:00:00`).getTime();
  if (Number.isNaN(released)) return false;

  const elapsed = now - released;
  return elapsed >= 0 && elapsed < NEW_BADGE_DURATION_DAYS * DAY_IN_MS;
}
