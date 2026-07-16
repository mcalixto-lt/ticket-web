import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  clear() { this.map.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();

const storage = await import('../src/core/storage.js?session-tests');

test('sessão persistente permanece válida por 24 horas', () => {
  storage.setSessionUnlocked(true);
  const raw = localStorage.getItem('ticket.session.v3');
  assert.ok(raw);
  const session = JSON.parse(raw);
  const remaining = session.expiresAt - session.lastActivityAt;
  assert.equal(remaining, 24 * 60 * 60 * 1000);
  assert.equal(storage.isSessionUnlocked(), true);
});

test('sessão expirada exige novo login', () => {
  localStorage.setItem('ticket.session.v3', JSON.stringify({
    unlocked: true,
    lastActivityAt: Date.now() - 1000,
    expiresAt: Date.now() - 1,
  }));
  assert.equal(storage.isSessionUnlocked(), false);
  assert.equal(localStorage.getItem('ticket.session.v3'), null);
});

test('saída explícita remove a sessão persistente', () => {
  storage.setSessionUnlocked(true);
  storage.setSessionUnlocked(false);
  assert.equal(localStorage.getItem('ticket.session.v3'), null);
});
