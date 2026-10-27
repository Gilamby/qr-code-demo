/* =========================================================
   FOUTMELDING VOOR HET TEAM: veel serverfouten in korte tijd → één e-mail (max. één per uur)
   Elke 5 minuten: ≥ 10 onverwachte fouten (500) in de laatste 15 minuten? Dan een mail naar het team-adres met
   de meest voorkomende foutmeldingen en paden (geen gegevens van klanten of bezoekers). Uit met ERROR_ALERTS=off.
   Uptime van buitenaf (is de server helemaal plat?) hoort bij een externe dienst; zie docs/hosting.md.
   ========================================================= */
import { recentErrors } from './common/http';

let lastAlert = 0;
export function errorSummary(now = Date.now(), windowMin = 15) {
  const since = now - windowMin * 60e3, list = recentErrors.filter((e) => Date.parse(e.at) >= since);
  const by = new Map<string, number>();
  for (const e of list) { const k = e.method + ' ' + e.path + ' — ' + e.message; by.set(k, (by.get(k) || 0) + 1); }
  return { count: list.length, top: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) };
}
export async function checkErrors(mailer: { sendErrorAlert: (count: number, lines: string[]) => Promise<void> }, now = Date.now(), min = 10) {
  if (process.env.ERROR_ALERTS === 'off') return false;
  const s = errorSummary(now); if (s.count < min || now - lastAlert < 3600e3) return false;
  lastAlert = now;
  await mailer.sendErrorAlert(s.count, s.top.map(([k, n]) => n + '× ' + k)).catch((e) => console.error('Foutmelding mailen mislukt:', e.message));
  return true;
}
export const resetErrorAlert = () => { lastAlert = 0; };
