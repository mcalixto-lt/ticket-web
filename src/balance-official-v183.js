import { accumulatedTicketBalance, DEFAULT_SCHEDULE, todayIso, formatDuration } from './core/logic.js';
import { loadProfile, setStorageNamespace, loadSchedule, loadBalanceSettings, saveBalanceSettings, listRecords } from './core/storage.js';

const REFERENCE_DATE = '2026-08-12';
const BASE_MINUTES = 690;

function applyOfficialBalance() {
  const profile = loadProfile();
  if (!profile) return false;
  setStorageNamespace(profile.id || profile.cpfHash?.slice(0, 24) || 'default');
  const current = loadBalanceSettings();
  const history = Array.isArray(current.history)
    ? current.history.filter((item) => item?.id !== 'official-20260812')
    : [];
  saveBalanceSettings({
    ...current,
    minutes: BASE_MINUTES,
    type: 'positive',
    referenceDate: REFERENCE_DATE,
    note: 'Saldo oficial do banco de horas da empresa: +11h30 até 12/08/2026.',
    history: [
      ...history,
      {
        id: 'official-20260812',
        minutes: BASE_MINUTES,
        type: 'positive',
        referenceDate: REFERENCE_DATE,
        note: 'Saldo oficial da empresa: +11h30 até 12/08/2026.',
        updatedAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  });
  return true;
}

async function officialTotal() {
  const profile = loadProfile();
  if (!profile) return BASE_MINUTES;
  setStorageNamespace(profile.id || profile.cpfHash?.slice(0, 24) || 'default');
  const [records, schedule] = await Promise.all([
    listRecords().catch(() => []),
    Promise.resolve(loadSchedule(DEFAULT_SCHEDULE)),
  ]);
  return BASE_MINUTES + accumulatedTicketBalance(records, schedule, {
    afterDate: REFERENCE_DATE,
    throughDate: todayIso(),
  });
}

function normalize(text = '') {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function refreshVisibleBalance() {
  const total = await officialTotal().catch(() => BASE_MINUTES);
  const formatted = formatDuration(total, { signed: true, suffix: true });
  const elements = [...document.querySelectorAll('div,section,article')];
  const card = elements
    .filter((el) => normalize(el.textContent).includes('saldo do mes'))
    .sort((a, b) => a.childElementCount - b.childElementCount)[0];
  if (!card) return;
  const values = [...card.querySelectorAll('strong,b,span,div,p')]
    .filter((el) => /^[+\-]?\d{1,4}(?::\d{2}|h\d{2})$/.test((el.textContent || '').trim()));
  const target = values[0] || card.querySelector('[class*="value"]');
  if (target) target.textContent = formatted;
}

applyOfficialBalance();
window.__ticketOfficialBalance = { referenceDate: REFERENCE_DATE, minutes: BASE_MINUTES };

const observer = new MutationObserver(() => {
  clearTimeout(window.__ticketBalanceRefresh);
  window.__ticketBalanceRefresh = setTimeout(refreshVisibleBalance, 80);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('focus', refreshVisibleBalance);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshVisibleBalance(); });
setTimeout(refreshVisibleBalance, 250);
