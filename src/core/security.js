import { isValidCpf, maskCpf, normalizeCpf } from './logic.js';
import { hashText } from './storage.js';

export function normalizeEmail(value = '') {
  return String(value).trim().toLowerCase();
}

export async function buildProfile({ fullName, email, cpf }) {
  const normalizedName = String(fullName || '').trim().replace(/\s+/g, ' ');
  if (normalizedName.split(' ').length < 2 || normalizedName.length < 5) {
    throw new Error('Informe o nome completo.');
  }
  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Informe um e-mail válido.');
  if (!isValidCpf(cpf)) throw new Error('O CPF informado não é válido.');
  const normalizedCpf = normalizeCpf(cpf);
  return {
    fullName: normalizedName,
    email: normalizedEmail,
    cpfMasked: maskCpf(normalizedCpf),
    cpfLast4: normalizedCpf.slice(-4),
    cpfHash: await hashText(normalizedCpf),
    createdAt: new Date().toISOString(),
    immutable: true,
  };
}
