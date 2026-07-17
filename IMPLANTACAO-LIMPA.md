# Ticket. 1.5.0 — implantação limpa

Esta versão corrige dois problemas estruturais:

1. O Client ID definido no Render agora tem prioridade sobre qualquer ID antigo salvo no celular.
2. Manifesto, favicon, ícones e service worker usam nomes novos, evitando reutilização do cache antigo da PWA.

## Ordem correta

1. Criar um repositório GitHub novo e enviar o conteúdo desta pasta para a raiz.
2. Criar um Static Site manual no Render, sem Blueprint.
3. Build command: `npm ci && npm run build`.
4. Publish directory: `dist`.
5. Obter a URL final do Render.
6. Criar no Google Cloud um OAuth Client do tipo Web application, autorizando exatamente a origem do Render.
7. Adicionar no Render: `VITE_GOOGLE_CLIENT_ID`.
8. Selecionar Save, rebuild, and deploy.
9. Testar no Chrome anônimo antes de instalar a PWA.
10. Só depois instalar na tela inicial e configurar o UptimeRobot.

Não use query strings como `?oauth=novo` para instalar a PWA. Use sempre a URL raiz.
