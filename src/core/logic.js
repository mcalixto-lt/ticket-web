export const APP_NAME = 'Ticket.';

export const WEEKDAYS = [
  { key: '0', short: 'Dom', long: 'Domingo' },
  { key: '1', short: 'Seg', long: 'Segunda-feira' },
  { key: '2', short: 'Ter', long: 'Terça-feira' },
  { key: '3', short: 'Qua', long: 'Quarta-feira' },
  { key: '4', short: 'Qui', long: 'Quinta-feira' },
  { key: '5', short: 'Sex', long: 'Sexta-feira' },
  { key: '6', short: 'Sáb', long: 'Sábado' },
];

export const DEFAULT_SCHEDULE = {
  0: { active: false, start: '08:00', end: '18:00', expectedMinutes: 0, requiredPunches: 4 },
  1: { active: true, start: '08:00', end: '18:00', expectedMinutes: 480, requiredPunches: 4 },
  2: { active: true, start: '08:00', end: '18:00', expectedMinutes: 480, requiredPunches: 4 },
  3: { active: true, start: '08:00', end: '18:00', expectedMinutes: 480, requiredPunches: 4 },
  4: { active: true, start: '08:00', end: '18:00', expectedMinutes: 480, requiredPunches: 4 },
  5: { active: true, start: '08:00', end: '18:00', expectedMinutes: 480, requiredPunches: 4 },
  6: { active: true, start: '08:00', end: '12:00', expectedMinutes: 240, requiredPunches: 2 },
};

export function cloneDefaultSchedule() {
  return structuredClone(DEFAULT_SCHEDULE);
}

export function normalizeCpf(value = '') {
  return String(value).replace(/\D/g, '').slice(0, 11);
}

export function formatCpf(value = '') {
  const digits = normalizeCpf(value);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskCpf(value = '') {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export function isValidCpf(value = '') {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function normalizePersonName(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

export function firstName(value = '') {
  return String(value).trim().split(/\s+/)[0] || '';
}

export function parseTimeToMinutes(value) {
  const match = String(value || '').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function normalizeTime(value = '') {
  const cleaned = normalizeNumericToken(value).replace(/[H.;,]/gi, ':');
  const match = cleaned.match(/\b([01]?\d|2[0-3])\s*:\s*([0-5]\d)\b/);
  return match ? `${String(Number(match[1])).padStart(2, '0')}:${match[2]}` : null;
}

export function formatDuration(totalMinutes, { signed = false, suffix = false } = {}) {
  if (totalMinutes === null || totalMinutes === undefined || Number.isNaN(totalMinutes)) return '--h--';
  const value = Math.round(totalMinutes);
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return suffix
    ? `${sign}${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`
    : `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function toIsoDate(day, month, year) {
  let normalizedYear = Number(year);
  if (normalizedYear < 100) normalizedYear += 2000;
  const date = new Date(Date.UTC(normalizedYear, Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== normalizedYear
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)
  ) return null;
  return `${normalizedYear.toString().padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDateBr(isoDate) {
  if (!isoDate) return 'Não identificada';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function formatLongDate(isoDate, options = {}) {
  const date = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: options.weekday ?? 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function monthKey(isoDate) {
  return String(isoDate || '').slice(0, 7);
}

export function normalizeNumericToken(value = '') {
  return String(value)
    .toUpperCase()
    .replace(/[OQ]/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/[S]/g, '5')
    .replace(/[B]/g, '8');
}

export function normalizeOcrText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\r/g, '')
    .replace(/[‐‑–—]/g, '-')
    // Erros recorrentes em impressoras térmicas estreitas.
    .replace(/([0-9OQIL|SB])H[0Q]R[A4]/g, '$1 HORA')
    .replace(/H[0Q]R[A4]/g, 'HORA')
    .replace(/H[U0Q]N[A4]/g, 'HORA')
    .replace(/([0-9OQIL|SB])HORA/g, '$1 HORA')
    .replace(/HORA[.,]/g, 'HORA:')
    .replace(/\bHORA\s*[:.]?\s*([0-9OQIL|SB]{1,2})\s*-\s*([0-9OQIL|SB]{2})/g, 'HORA:$1:$2')
    .replace(/\bHORA\s*([0-9OQIL|SB])/g, 'HORA:$1')
    .replace(/D[A4]T[A4]/g, 'DATA')
    .replace(/DAT[A4][.,]/g, 'DATA:')
    .replace(/\b[TH]ATA(?=\s*[: ]\s*[0-9OQIL|SB])/g, 'DATA')
    .replace(/\bDATALS(?=\s*[\/:])/g, 'DATA:')
    .replace(/[ \t]+/g, ' ');
}

function parseDateToken(token) {
  const normalized = normalizeNumericToken(token).replace(/[.\-]/g, '/');
  const match = normalized.match(/\b(0?[1-9]|[12]\d|3[01])\s*\/\s*(0?[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})\b/);
  return match ? toIsoDate(match[1], match[2], match[3]) : null;
}

function allDates(text) {
  const candidates = [];
  const regex = /([0-9OQIL|SB]{1,2}\s*[\/.-]\s*[0-9OQIL|SB]{1,2}\s*[\/.-]\s*[0-9OQIL|SB]{2,4})/g;
  for (const match of String(text).matchAll(regex)) {
    const iso = parseDateToken(match[1]);
    if (iso) candidates.push({ iso, raw: match[1], index: match.index || 0 });
  }
  return candidates;
}

function allTimes(text) {
  const candidates = [];
  const regex = /([0-9OQIL|SB]{1,2}\s*[:H.;,]\s*[0-9OQIL|SB]{2})/gi;
  for (const match of String(text).matchAll(regex)) {
    const time = normalizeTime(match[1]);
    if (time) candidates.push({ time, raw: match[1], index: match.index || 0 });
  }
  return [...new Map(candidates.map((item) => [item.time, item])).values()]
    .sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
}

function nearestCandidate(anchorIndex, candidates, maxDistance = 80) {
  return candidates
    .map((candidate) => ({ ...candidate, distance: Math.abs(candidate.index - anchorIndex) }))
    .filter((candidate) => candidate.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

export function extractTicketFields(rawText = '', ocrConfidence = 0) {
  const text = normalizeOcrText(rawText);
  const dates = allDates(text);
  const times = allTimes(text);
  const dataAnchor = text.search(/\bDATA\b/);
  const horaAnchor = text.search(/\bHORA\b/);
  const hasDataAnchor = dataAnchor >= 0;
  const hasHoraAnchor = horaAnchor >= 0;

  if (hasDataAnchor && !dates.length) {
    const context = normalizeNumericToken(text.slice(dataAnchor + 4, dataAnchor + 52));
    const compactDate = context.match(/\D{0,12}(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(\d{4})/);
    if (compactDate) {
      const iso = toIsoDate(compactDate[1], compactDate[2], compactDate[3]);
      if (iso) dates.push({ iso, raw: compactDate[0], index: dataAnchor + 4 + compactDate.index });
    }
  }
  if (hasHoraAnchor && !times.length) {
    const context = normalizeNumericToken(text.slice(horaAnchor + 4, horaAnchor + 36));
    const compactTime = context.match(/\D{0,8}([01]\d|2[0-3])([0-5]\d)/);
    if (compactTime) times.push({ time: `${compactTime[1]}:${compactTime[2]}`, raw: compactTime[0], index: horaAnchor + 4 + compactTime.index });
  }

  let selectedDate = hasDataAnchor ? nearestCandidate(dataAnchor, dates, 140) : dates[0] || null;
  let selectedTimes = times;

  if (hasHoraAnchor && times.length) {
    const nearestTime = nearestCandidate(horaAnchor, times, 90);
    if (nearestTime && times.length === 1) selectedTimes = [nearestTime];
    else if (nearestTime && times.length > 1) {
      const anchorLineStart = text.lastIndexOf('\n', horaAnchor) + 1;
      const anchorLineEnd = text.indexOf('\n', horaAnchor) === -1 ? text.length : text.indexOf('\n', horaAnchor);
      const sameLine = times.filter((time) => time.index >= anchorLineStart && time.index <= anchorLineEnd);
      selectedTimes = sameLine.length ? sameLine : times;
    }
  }

  if (!selectedDate && dates.length) selectedDate = dates[0];
  const validTimes = selectedTimes.map((item) => item.time).slice(0, 6);

  let score = Math.max(0, Math.min(30, Number(ocrConfidence || 0) * 0.3));
  if (selectedDate) score += 24;
  if (validTimes.length) score += 24;
  if (hasDataAnchor) score += 9;
  if (hasHoraAnchor) score += 9;
  if (hasDataAnchor && selectedDate && Math.abs(selectedDate.index - dataAnchor) < 45) score += 5;
  if (hasHoraAnchor && validTimes.length) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    date: selectedDate?.iso || null,
    times: [...new Set(validTimes)].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b)),
    score,
    anchors: { data: hasDataAnchor, hora: hasHoraAnchor },
    normalizedText: text,
    rawText,
  };
}

export function labelsForPunches(requiredPunches = 4) {
  return requiredPunches === 2
    ? ['Entrada', 'Saída final']
    : ['Entrada', 'Saída para almoço', 'Retorno do almoço', 'Saída final'];
}

export function classifyPunches(times = [], requiredPunches = 4) {
  const labels = labelsForPunches(requiredPunches);
  return [...new Set(times)]
    .sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b))
    .map((time, index) => ({ time, label: labels[index] || `Batida adicional ${index + 1}`, order: index + 1 }));
}

export function mergePunches(existing = [], incoming = []) {
  return [...new Set([...existing, ...incoming])]
    .sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
}

export function calculateWorkedMinutes(times = [], requiredPunches = 4) {
  const sorted = [...times].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
  if (requiredPunches === 2) {
    if (sorted.length !== 2) return null;
    return parseTimeToMinutes(sorted[1]) - parseTimeToMinutes(sorted[0]);
  }
  if (sorted.length !== 4) return null;
  return (parseTimeToMinutes(sorted[1]) - parseTimeToMinutes(sorted[0]))
    + (parseTimeToMinutes(sorted[3]) - parseTimeToMinutes(sorted[2]));
}

export function scheduleForDate(isoDate, schedule = DEFAULT_SCHEDULE) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const weekday = new Date(year, month - 1, day, 12).getDay();
  return structuredClone(schedule[String(weekday)] || DEFAULT_SCHEDULE[String(weekday)]);
}

export function calculateRecord(record, schedule = DEFAULT_SCHEDULE) {
  const daySchedule = record.scheduleSnapshot || scheduleForDate(record.date, schedule);
  const requiredPunches = Number(daySchedule.requiredPunches || 4);
  const times = record.punches.map((punch) => (typeof punch === 'string' ? punch : punch.time));
  const workedMinutes = calculateWorkedMinutes(times, requiredPunches);
  const complete = times.length === requiredPunches && workedMinutes !== null;
  const expectedMinutes = Number(daySchedule.expectedMinutes || 0);
  return {
    expectedMinutes,
    requiredPunches,
    workedMinutes,
    balanceMinutes: complete ? workedMinutes - expectedMinutes : null,
    complete,
    status: complete ? 'Completo' : times.length ? 'Incompleto' : 'Sem registro',
  };
}

export function monthlySummary(records = [], schedule = DEFAULT_SCHEDULE, selectedMonth = monthKey(todayIso())) {
  const selected = records
    .filter((record) => monthKey(record.date) === selectedMonth)
    .map((record) => ({ ...record, calculation: calculateRecord(record, schedule) }))
    .sort((a, b) => b.date.localeCompare(a.date));

  let positive = 0;
  let negative = 0;
  let pending = 0;
  let completeDays = 0;
  for (const record of selected) {
    if (!record.calculation.complete) pending += 1;
    else {
      completeDays += 1;
      if (record.calculation.balanceMinutes > 0) positive += record.calculation.balanceMinutes;
      if (record.calculation.balanceMinutes < 0) negative += Math.abs(record.calculation.balanceMinutes);
    }
  }
  return { records: selected, positive, negative, net: positive - negative, pending, completeDays };
}

export function recordStatusTone(calculation) {
  if (!calculation.complete) return 'warning';
  if (calculation.balanceMinutes > 0) return 'positive';
  if (calculation.balanceMinutes < 0) return 'negative';
  return 'complete';
}

export function monthName(monthKeyValue) {
  const [year, month] = monthKeyValue.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
