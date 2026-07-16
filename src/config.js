export const runtimeConfig = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  microsoftClientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
  microsoftTenantId: import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common',
};
