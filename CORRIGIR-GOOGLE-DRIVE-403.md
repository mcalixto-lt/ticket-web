# Corrigir Erro 403 do Google Drive

A tela “Acesso bloqueado” não é causada pelo código do Ticket. Ela informa que o projeto OAuth está em **Teste** e a conta escolhida não está autorizada.

## Opção imediata — manter em teste

1. Abra o projeto correto no Google Cloud.
2. Entre em **Google Auth Platform → Público-alvo**.
3. Em **Usuários de teste**, adicione exatamente o e-mail que aparece na tela de erro.
4. Salve e aguarde alguns minutos.
5. No celular, feche a janela do Google, volte ao Ticket. e conecte novamente escolhendo essa mesma conta.

## Opção para liberar a qualquer conta

Em **Google Auth Platform → Público-alvo**, altere o status de publicação para **Em produção**. O Ticket. solicita apenas o escopo não confidencial `https://www.googleapis.com/auth/drive.file`, mas o Google ainda pode solicitar informações básicas do aplicativo e da marca.

## Verificações

- O Client ID precisa ser do tipo **Aplicativo da Web**.
- Origem autorizada: `https://ticket-web-9jfp.onrender.com`
- A Google Drive API precisa estar ativada no mesmo projeto.
- Não use Client Secret ou API Key no `VITE_GOOGLE_CLIENT_ID`.
