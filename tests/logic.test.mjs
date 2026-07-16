import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWorkedMinutes,
  extractTicketFields,
  isValidCpf,
  monthlySummary,
  normalizeTime,
} from '../src/core/logic.js';

test('valida CPF conhecido', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('111.111.111-11'), false);
});

test('normaliza horários com ruído de OCR', () => {
  assert.equal(normalizeTime('18:17'), '18:17');
  assert.equal(normalizeTime('O8.1S'), '08:15');
});

test('extrai DATA e HORA do padrão do comprovante enviado', () => {
  const text = `COMPROVANTE DE REGISTRO DE PONTO\nNOME: MAURO CALIXTO DA SILVA FILHO\nDATA: 13/07/2026 HORA: 18:17`;
  const result = extractTicketFields(text, 88);
  assert.equal(result.date, '2026-07-13');
  assert.deepEqual(result.times, ['18:17']);
  assert.equal(result.anchors.data, true);
  assert.equal(result.anchors.hora, true);
  assert.ok(result.score >= 80);
});

test('extrai rótulos com erros comuns de OCR', () => {
  const result = extractTicketFields('D4TA 13/07/2026 H0RA 18:17', 70);
  assert.equal(result.date, '2026-07-13');
  assert.deepEqual(result.times, ['18:17']);
});

test('calcula quatro batidas', () => {
  assert.equal(calculateWorkedMinutes(['07:55', '12:05', '14:00', '18:15'], 4), 505);
});

test('resume saldo mensal', () => {
  const records = [
    { date: '2026-07-01', punches: ['08:00', '12:00', '14:00', '18:20'], scheduleSnapshot: { active: true, expectedMinutes: 480, requiredPunches: 4 } },
    { date: '2026-07-02', punches: ['08:00', '12:00', '14:00', '17:50'], scheduleSnapshot: { active: true, expectedMinutes: 480, requiredPunches: 4 } },
  ];
  const summary = monthlySummary(records, {}, '2026-07');
  assert.equal(summary.positive, 20);
  assert.equal(summary.negative, 10);
  assert.equal(summary.net, 10);
});

test('extrai DATA e HORA compactas próximas aos rótulos', () => {
  const result = extractTicketFields('DATA 13072026 HORA 1817', 62);
  assert.equal(result.date, '2026-07-13');
  assert.deepEqual(result.times, ['18:17']);
});

test('aceita ponto e vírgula confundido com separador da hora', () => {
  assert.equal(normalizeTime('18;17'), '18:17');
});


test('recupera a linha real do comprovante térmico completo', () => {
  const result = extractTicketFields('HATA: 15/07/2026 HORAO7:54', 74);
  assert.equal(result.date, '2026-07-15');
  assert.deepEqual(result.times, ['07:54']);
  assert.equal(result.anchors.data, true);
  assert.equal(result.anchors.hora, true);
});


test('extrai com precisão a linha do segundo comprovante completo', () => {
  const result = extractTicketFields('NOME: MAURO CALIXTO DA SILVA FILHO\nDATA:15/07/2026 HORA:07:54\nAD: RYV...', 86);
  assert.equal(result.date, '2026-07-15');
  assert.deepEqual(result.times, ['07:54']);
  assert.equal(result.anchors.data, true);
  assert.equal(result.anchors.hora, true);
  assert.ok(result.score >= 88);
});

test('prioriza a hora próxima ao rótulo HORA', () => {
  const result = extractTicketFields('NSR:000022169\nDATA:15/07/2026 HORA:07:54\nCODIGO 18:17', 82);
  assert.equal(result.date, '2026-07-15');
  assert.deepEqual(result.times, ['07:54']);
});

test('recupera hora com hífen e ruído antes do rótulo', () => {
  const result = extractTicketFields('006HORA:O7-54', 80);
  assert.deepEqual(result.times, ['07:54']);
  assert.equal(result.anchors.hora, true);
});
