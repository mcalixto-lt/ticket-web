const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
let gisPromise;
let tokenClient;
let accessToken = null;
let expiresAt = 0;
let activeClientId = '';

function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Não foi possível carregar a autenticação do Google.'));
    document.head.appendChild(script);
  });
  return gisPromise;
}

async function requestToken(clientId) {
  if (!clientId) throw new Error('O Google Drive ainda não foi ativado pelo administrador desta instalação.');
  await loadGoogleIdentity();
  if (!tokenClient || activeClientId !== clientId) {
    activeClientId = clientId;
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: () => {},
    });
  }
  return new Promise((resolve, reject) => {
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || 'A autorização do Google Drive foi cancelada.'));
        return;
      }
      accessToken = response.access_token;
      expiresAt = Date.now() + Math.max(60, Number(response.expires_in || 3600) - 60) * 1000;
      resolve(accessToken);
    };
    tokenClient.error_callback = () => reject(new Error('Não foi possível abrir a autorização do Google Drive.'));
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function getToken(clientId) {
  if (accessToken && Date.now() < expiresAt) return accessToken;
  return requestToken(clientId);
}

async function driveFetch(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive: ${response.status} ${text.slice(0, 180)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function escapeQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function findFolder(token, name, parentId) {
  const q = [
    `name='${escapeQuery(name)}'`,
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
    `'${parentId}' in parents`,
  ].join(' and ');
  const params = new URLSearchParams({ q, spaces: 'drive', fields: 'files(id,name)', pageSize: '10' });
  const result = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, token);
  return result.files?.[0] || null;
}

async function createFolder(token, name, parentId) {
  return driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
}

async function ensureFolder(token, name, parentId = 'root') {
  return (await findFolder(token, name, parentId)) || createFolder(token, name, parentId);
}

async function multipartUpload(token, blob, metadata) {
  const boundary = `ticket_${crypto.randomUUID().replaceAll('-', '')}`;
  const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const body = new Blob([prefix, blob, suffix], { type: `multipart/related; boundary=${boundary}` });
  return driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', token, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

export async function connectGoogleDrive(clientId) {
  await requestToken(clientId);
  return { connected: true };
}

export async function uploadToGoogleDrive({ clientId, blob, filename, date }) {
  const token = await getToken(clientId);
  const [year, month] = date.split('-');
  const root = await ensureFolder(token, 'Ticket.');
  const yearFolder = await ensureFolder(token, year, root.id);
  const monthFolder = await ensureFolder(token, month, yearFolder.id);
  return multipartUpload(token, blob, { name: filename, parents: [monthFolder.id] });
}

export function disconnectGoogleDrive() {
  if (accessToken && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  expiresAt = 0;
}
