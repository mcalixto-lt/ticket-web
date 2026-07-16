import { normalizeCpf } from './logic.js';
import {
  clearActiveProfile,
  hashText,
  loadLocalAccount,
  loadLocalAccounts,
  saveLocalAccount,
  saveProfile,
  setSessionUnlocked,
  setStorageNamespace,
} from './storage.js';
import { buildProfile } from './security.js';

function namespaceFor(profile) {
  return profile?.id || profile?.cpfHash?.slice(0, 24) || 'default';
}

function activateProfile(profile) {
  const normalized = { ...profile };
  saveProfile(normalized);
  setStorageNamespace(namespaceFor(normalized));
  setSessionUnlocked(true);
  return normalized;
}

export function isCloudAuthConfigured() {
  // O acesso solicitado nesta versão é deliberadamente local e feito apenas
  // pelo CPF. Drive e OneDrive continuam independentes para as imagens.
  return false;
}

export async function registerAccount(data) {
  const profile = await buildProfile(data);
  const duplicate = loadLocalAccounts().some((account) => account?.profile?.cpfHash === profile.cpfHash);
  if (duplicate) throw new Error('Este CPF já possui cadastro neste navegador. Use a opção Entrar.');
  const id = `local-${profile.cpfHash.slice(0, 24)}`;
  const account = {
    version: 3,
    provider: 'local',
    id,
    profile: { ...profile, id, authProvider: 'local-cpf' },
    createdAt: new Date().toISOString(),
  };
  saveLocalAccount(account);
  return { profile: activateProfile(account.profile), requiresEmailConfirmation: false, provider: 'local' };
}

export async function loginAccount({ cpf }) {
  const normalizedCpf = normalizeCpf(cpf);
  if (normalizedCpf.length !== 11) throw new Error('Informe um CPF válido.');
  const cpfHash = await hashText(normalizedCpf);
  const account = loadLocalAccount(cpfHash);
  if (!account?.profile) throw new Error('CPF não cadastrado neste navegador.');
  return { profile: activateProfile(account.profile), provider: 'local' };
}

export async function signOutAccount() {
  clearActiveProfile();
  setSessionUnlocked(false);
}

// Mantidos para compatibilidade com inicializações antigas. Não há senha nesta versão.
export function consumeRecoverySessionFromUrl() { return false; }
export async function restoreCloudSession() { return null; }
export async function requestPasswordReset() { throw new Error('O acesso atual utiliza somente CPF e não possui senha.'); }
export async function resetLocalPassword() { throw new Error('O acesso atual utiliza somente CPF e não possui senha.'); }
export async function updateRecoveredPassword() { throw new Error('O acesso atual utiliza somente CPF e não possui senha.'); }
