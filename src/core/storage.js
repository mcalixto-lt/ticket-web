const DB_VERSION = 1;
const ACTIVE_PROFILE_KEY = 'ticket.active-profile.v2';
const LOCAL_ACCOUNT_KEY = 'ticket.local-account.v2';
const LOCAL_ACCOUNTS_KEY = 'ticket.local-accounts.v3';
const LEGACY_PROFILE_KEY = 'ticket.profile.v1';
const LEGACY_SCHEDULE_KEY = 'ticket.schedule.v1';
const LEGACY_CLOUD_KEY = 'ticket.cloud.v1';
const LEGACY_SESSION_KEY = 'ticket.unlocked.v2';
const SESSION_KEY = 'ticket.session.v3';
const SESSION_MIGRATION_KEY = 'ticket.session.migrated.v3';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const THEME_KEY = 'ticket.theme.v1';

let storageNamespace = 'default';
let dbPromise;

function safeNamespace(value = 'default') {
  return String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'default';
}

function namespacedKey(base) {
  return `${base}.${storageNamespace}`;
}

function databaseName() {
  return `ticket-db-${storageNamespace}`;
}

export function setStorageNamespace(value) {
  const next = safeNamespace(value);
  if (next === storageNamespace) return;
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
  storageNamespace = next;
}

export function getStorageNamespace() {
  return storageNamespace;
}

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName(), DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('evidence')) {
        const evidence = db.createObjectStore('evidence', { keyPath: 'id' });
        evidence.createIndex('hash', 'hash', { unique: false });
        evidence.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const sync = db.createObjectStore('syncQueue', { keyPath: 'id' });
        sync.createIndex('status', 'status', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function transaction(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = callback(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Operação cancelada.'));
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function loadProfile() {
  const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
  if (raw) return JSON.parse(raw);
  const legacy = localStorage.getItem(LEGACY_PROFILE_KEY);
  return legacy ? { ...JSON.parse(legacy), legacy: true } : null;
}

export function saveProfile(profile) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify({ ...profile }));
}

export function clearActiveProfile() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
}

export function loadLocalAccounts() {
  const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Migra automaticamente o cadastro único das versões anteriores.
  const legacyRaw = localStorage.getItem(LOCAL_ACCOUNT_KEY);
  if (!legacyRaw) return [];
  try {
    const legacy = JSON.parse(legacyRaw);
    const migrated = legacy?.profile ? [{
      version: 3,
      provider: 'local',
      id: legacy.id || legacy.profile.id,
      profile: legacy.profile,
      createdAt: legacy.createdAt || legacy.profile.createdAt || new Date().toISOString(),
    }] : [];
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(migrated));
    localStorage.removeItem(LOCAL_ACCOUNT_KEY);
    return migrated;
  } catch {
    return [];
  }
}

export function loadLocalAccount(cpfHash = '') {
  const accounts = loadLocalAccounts();
  if (cpfHash) return accounts.find((account) => account?.profile?.cpfHash === cpfHash) || null;
  const active = loadProfile();
  return accounts.find((account) => account?.profile?.id === active?.id) || accounts[0] || null;
}

export function saveLocalAccounts(accounts) {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(Array.isArray(accounts) ? accounts : []));
}

export function saveLocalAccount(account) {
  const accounts = loadLocalAccounts();
  const index = accounts.findIndex((item) => item?.profile?.cpfHash === account?.profile?.cpfHash);
  if (index >= 0) accounts[index] = account;
  else accounts.push(account);
  saveLocalAccounts(accounts);
  // Mantém compatibilidade de leitura com versões antigas sem gravar segredo.
  localStorage.removeItem(LOCAL_ACCOUNT_KEY);
}

export function hasLocalAccounts() {
  return loadLocalAccounts().length > 0;
}

export function removeLegacyProfile() {
  localStorage.removeItem(LEGACY_PROFILE_KEY);
}

export function loadSchedule(defaultSchedule) {
  const key = namespacedKey('ticket.schedule.v2');
  const raw = localStorage.getItem(key);
  if (raw) return JSON.parse(raw);
  const legacy = localStorage.getItem(LEGACY_SCHEDULE_KEY);
  if (legacy) {
    localStorage.setItem(key, legacy);
    return JSON.parse(legacy);
  }
  return structuredClone(defaultSchedule);
}

export function saveSchedule(schedule) {
  localStorage.setItem(namespacedKey('ticket.schedule.v2'), JSON.stringify(schedule));
}

export function loadCloudSettings() {
  const defaults = {
    provider: 'local',
    keepLocalCopy: true,
    googleClientId: '',
    microsoftClientId: '',
    microsoftTenantId: 'common',
    googleConnected: false,
    microsoftConnected: false,
    cloudOcrEnabled: true,
  };
  const key = namespacedKey('ticket.cloud.v2');
  const raw = localStorage.getItem(key);
  if (raw) return { ...defaults, ...JSON.parse(raw) };
  const legacy = localStorage.getItem(LEGACY_CLOUD_KEY);
  if (legacy) {
    localStorage.setItem(key, legacy);
    return { ...defaults, ...JSON.parse(legacy) };
  }
  return defaults;
}

export function saveCloudSettings(settings) {
  localStorage.setItem(namespacedKey('ticket.cloud.v2'), JSON.stringify(settings));
}

export function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme === 'dark' ? 'dark' : 'light');
}

function readPersistentSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.expiresAt ? parsed : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setSessionUnlocked(value) {
  if (value) {
    const now = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      unlocked: true,
      lastActivityAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    }));
    localStorage.setItem(SESSION_MIGRATION_KEY, '1');
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  // Limpa o marcador temporário usado pelas versões anteriores.
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
}

export function touchSession() {
  const session = readPersistentSession();
  if (!session || session.expiresAt <= Date.now()) {
    localStorage.removeItem(SESSION_KEY);
    return false;
  }
  const now = Date.now();
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    ...session,
    unlocked: true,
    lastActivityAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  }));
  return true;
}

export function isSessionUnlocked({ allowLegacyProfile = false } = {}) {
  // Migra uma sessão ainda aberta na versão anterior.
  if (sessionStorage.getItem(LEGACY_SESSION_KEY) === '1') {
    setSessionUnlocked(true);
    return true;
  }

  const session = readPersistentSession();
  if (session) {
    if (session.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.setItem(SESSION_MIGRATION_KEY, '1');
      return false;
    }
    touchSession();
    return true;
  }

  // Na primeira abertura desta atualização, preserva o usuário que estava
  // conectado e não clicou em Sair. A migração ocorre somente uma vez.
  if (allowLegacyProfile && localStorage.getItem(SESSION_MIGRATION_KEY) !== '1') {
    setSessionUnlocked(true);
    return true;
  }

  return false;
}

export async function hashText(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashBlob(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getRecord(date) {
  const db = await openDatabase();
  const tx = db.transaction('records', 'readonly');
  return requestToPromise(tx.objectStore('records').get(date));
}

export async function saveRecord(record) {
  return transaction('records', 'readwrite', (store) => store.put(record));
}

export async function saveRecordWithEvidence(record, evidence) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['records', 'evidence'], 'readwrite');
    tx.objectStore('evidence').put(evidence);
    tx.objectStore('records').put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('Falha ao gravar registro e comprovante.'));
    tx.onabort = () => reject(tx.error || new Error('Gravação cancelada para preservar a integridade.'));
  });
}

export async function listRecords() {
  const db = await openDatabase();
  const tx = db.transaction('records', 'readonly');
  return requestToPromise(tx.objectStore('records').getAll());
}

export async function saveEvidence(evidence) {
  return transaction('evidence', 'readwrite', (store) => store.put(evidence));
}

export async function getEvidence(id) {
  const db = await openDatabase();
  const tx = db.transaction('evidence', 'readonly');
  return requestToPromise(tx.objectStore('evidence').get(id));
}

export async function listEvidence() {
  const db = await openDatabase();
  const tx = db.transaction('evidence', 'readonly');
  return requestToPromise(tx.objectStore('evidence').getAll());
}

export async function findEvidenceByHash(hash) {
  const db = await openDatabase();
  const tx = db.transaction('evidence', 'readonly');
  return requestToPromise(tx.objectStore('evidence').index('hash').get(hash));
}

export async function isEvidenceLinked(evidenceId) {
  if (!evidenceId) return false;
  const records = await listRecords();
  return records.some((record) => {
    if ((record.evidenceIds || []).includes(evidenceId)) return true;
    return (record.punches || []).some((punch) => typeof punch !== 'string' && punch?.evidenceId === evidenceId);
  });
}

export async function deleteEvidence(evidenceId) {
  if (!evidenceId) return false;
  return transaction('evidence', 'readwrite', (store) => store.delete(evidenceId));
}

export async function listEvidenceForDate(date) {
  const db = await openDatabase();
  const tx = db.transaction('evidence', 'readonly');
  return requestToPromise(tx.objectStore('evidence').index('date').getAll(date));
}

export async function addSyncJob(job) {
  return transaction('syncQueue', 'readwrite', (store) => store.put(job));
}

export async function updateSyncJob(job) {
  return transaction('syncQueue', 'readwrite', (store) => store.put(job));
}

export async function listSyncJobs() {
  const db = await openDatabase();
  const tx = db.transaction('syncQueue', 'readonly');
  return requestToPromise(tx.objectStore('syncQueue').getAll());
}


async function openNamedDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('evidence')) {
        const store = db.createObjectStore('evidence', { keyPath: 'id' });
        store.createIndex('hash', 'hash', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

async function getAllFromNamed(db, storeName) {
  if (!db.objectStoreNames.contains(storeName)) return [];
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).getAll());
}

export async function migrateLegacyDataToCurrent() {
  if (storageNamespace === 'default') return false;
  const marker = `ticket.legacy-migrated.${storageNamespace}`;
  if (localStorage.getItem(marker) === '1') return false;
  try {
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();
      if (!databases.some((item) => item.name === 'ticket-db')) {
        localStorage.setItem(marker, '1');
        return false;
      }
    }
    const currentRecords = await listRecords();
    if (currentRecords.length) {
      localStorage.setItem(marker, '1');
      return false;
    }
    const legacy = await openNamedDatabase('ticket-db');
    const [records, evidence, syncQueue] = await Promise.all([
      getAllFromNamed(legacy, 'records'),
      getAllFromNamed(legacy, 'evidence'),
      getAllFromNamed(legacy, 'syncQueue'),
    ]);
    legacy.close();
    for (const item of records) await saveRecord(item);
    for (const item of evidence) await saveEvidence(item);
    for (const item of syncQueue) await addSyncJob(item);
    localStorage.setItem(marker, '1');
    return records.length > 0 || evidence.length > 0 || syncQueue.length > 0;
  } catch (error) {
    console.warn('Não foi possível migrar os dados da versão anterior.', error);
    return false;
  }
}

export async function exportBackup() {
  const [records, syncQueue] = await Promise.all([listRecords(), listSyncJobs()]);
  const profile = loadProfile();
  const schedule = loadSchedule(null);
  const cloud = loadCloudSettings();
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: profile ? { ...profile, cpfHash: undefined } : null,
    schedule,
    cloud: { provider: cloud.provider, keepLocalCopy: cloud.keepLocalCopy },
    records,
    syncQueue,
    note: 'As imagens não são incluídas neste backup leve. Use Drive ou OneDrive para preservar as fotografias.',
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export async function clearAllData({ removeAccount = true } = {}) {
  localStorage.removeItem(namespacedKey('ticket.schedule.v2'));
  localStorage.removeItem(namespacedKey('ticket.cloud.v2'));
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  localStorage.setItem(SESSION_MIGRATION_KEY, '1');
  clearActiveProfile();
  if (removeAccount) {
    localStorage.removeItem(LOCAL_ACCOUNT_KEY);
    localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
  }
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName());
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Feche outras abas do Ticket. para apagar os dados.'));
  });
}
