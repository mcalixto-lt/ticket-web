import { uploadToGoogleDrive } from './google-drive.js';
import { uploadToOneDrive } from './onedrive.js';

export async function uploadEvidenceToCloud({ settings, blob, filename, date }) {
  if (!settings || settings.provider === 'local') return { provider: 'local', status: 'local' };
  if (!navigator.onLine) throw new Error('Sem internet. A imagem ficará na fila para sincronização.');
  if (settings.provider === 'google') {
    const result = await uploadToGoogleDrive({
      clientId: settings.googleClientId,
      blob,
      filename,
      date,
    });
    return { provider: 'google', status: 'synced', remoteId: result.id, remoteName: result.name, remoteUrl: result.webViewLink || '' };
  }
  if (settings.provider === 'onedrive') {
    const result = await uploadToOneDrive({
      clientId: settings.microsoftClientId,
      tenantId: settings.microsoftTenantId,
      blob,
      filename,
      date,
    });
    return { provider: 'onedrive', status: 'synced', remoteId: result.id, remoteName: result.name, remoteUrl: result.webUrl || '' };
  }
  throw new Error('Provedor de armazenamento desconhecido.');
}
