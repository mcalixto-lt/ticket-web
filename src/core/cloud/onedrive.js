let msalInstance;
let currentConfigKey = '';
const SCOPES = ['User.Read', 'Files.ReadWrite'];

async function getMsal(clientId, tenantId = 'common') {
  if (!clientId) throw new Error('O OneDrive ainda não foi ativado pelo administrador desta instalação.');
  const key = `${clientId}|${tenantId}`;
  if (msalInstance && key === currentConfigKey) return msalInstance;
  const { PublicClientApplication, BrowserCacheLocation } = await import('@azure/msal-browser');
  msalInstance = new PublicClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
      redirectUri: `${window.location.origin}${window.location.pathname}`,
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
      storeAuthStateInCookie: false,
    },
  });
  await msalInstance.initialize();
  currentConfigKey = key;
  return msalInstance;
}

async function getToken(clientId, tenantId, interactive = false) {
  const msal = await getMsal(clientId, tenantId);
  let account = msal.getActiveAccount() || msal.getAllAccounts()[0];
  if (!account || interactive) {
    const login = await msal.loginPopup({ scopes: SCOPES, prompt: account ? 'select_account' : 'select_account' });
    account = login.account;
    msal.setActiveAccount(account);
  }
  try {
    const result = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return result.accessToken;
  } catch {
    const result = await msal.acquireTokenPopup({ scopes: SCOPES, account });
    return result.accessToken;
  }
}

async function graphFetch(url, token, options = {}) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`OneDrive: ${response.status} ${text.slice(0, 200)}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function findChild(token, parentId, name) {
  try {
    return await graphFetch(`/me/drive/items/${parentId}:/${encodeURIComponent(name)}:`, token);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function createFolder(token, parentId, name) {
  return graphFetch(`/me/drive/items/${parentId}/children`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
  });
}

async function ensureFolder(token, parentId, name) {
  return (await findChild(token, parentId, name)) || createFolder(token, parentId, name);
}

export async function connectOneDrive(clientId, tenantId) {
  await getToken(clientId, tenantId, true);
  return { connected: true };
}

export async function uploadToOneDrive({ clientId, tenantId, blob, filename, date }) {
  const token = await getToken(clientId, tenantId, false);
  const root = await graphFetch('/me/drive/root', token);
  const [year, month] = date.split('-');
  const ticketFolder = await ensureFolder(token, root.id, 'Ticket.');
  const yearFolder = await ensureFolder(token, ticketFolder.id, year);
  const monthFolder = await ensureFolder(token, yearFolder.id, month);
  return graphFetch(`/me/drive/items/${monthFolder.id}:/${encodeURIComponent(filename)}:/content`, token, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
}

export async function disconnectOneDrive() {
  if (!msalInstance) return;
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (account) await msalInstance.logoutPopup({ account, postLogoutRedirectUri: window.location.href });
}
