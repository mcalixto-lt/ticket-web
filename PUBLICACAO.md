# Publicação do Ticket.

## Vercel, Netlify ou hospedagem compatível com Vite

1. Envie a pasta do projeto para um repositório.
2. Use `npm run build` como comando de compilação.
3. Use `dist` como diretório de saída.
4. Publique em HTTPS.

## Variáveis opcionais

```env
VITE_GOOGLE_CLIENT_ID=
VITE_MICROSOFT_CLIENT_ID=
VITE_MICROSOFT_TENANT_ID=common
```

Depois da publicação, adicione a origem HTTPS do sistema às origens autorizadas do Google e como URI de redirecionamento do tipo SPA na Microsoft.

## PWA

A versão publicada registra `ticket-service-worker-v143.js` e utiliza o cache `ticket-shell-v143`. Em localhost, o service worker é removido para evitar que versões antigas sejam carregadas.

## Observação de segurança

A entrada somente por CPF foi solicitada para simplificar o uso. Em uma publicação pública com banco central, adicione PIN, senha ou autenticação por e-mail antes de centralizar dados pessoais.
