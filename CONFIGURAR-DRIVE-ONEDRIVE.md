# Configurar Google Drive e Microsoft OneDrive

## Endereços desta versão

Endereço local desta versão (mantido para preservar os perfis existentes):

```text
http://127.0.0.1:8773
```

Para uso no celular pela internet, publique o sistema em HTTPS e substitua o exemplo abaixo pelo endereço real:

```text
https://ticket.seudominio.com
```

O endereço local e o IP da rede servem para testar o painel. Para ativar Google Drive e OneDrive no celular de forma estável, publique o Ticket. em HTTPS e cadastre esse endereço nos provedores. O Google recomenda `localhost` para testes OAuth no computador; esta entrega mantém `127.0.0.1:8773` para não separar os perfis e registros já salvos nas versões anteriores.

## Google Drive

1. Entre no Google Cloud Console e crie ou selecione um projeto.
2. Ative a Google Drive API.
3. Configure a tela de consentimento OAuth.
4. Crie um OAuth Client ID do tipo **Web application**.
5. Em **Authorized JavaScript origins**, adicione o endereço HTTPS publicado:

```text
https://ticket.seudominio.com
```

Para um teste isolado em `localhost`, o Google orienta cadastrar `http://localhost` e `http://localhost:<porta>`. Não use esse endereço para os dados existentes sem antes fazer backup, porque o navegador trata `localhost` e `127.0.0.1` como origens diferentes.

6. Copie o Client ID terminado em `.apps.googleusercontent.com`.
7. Execute `configurar-servicos.bat` e cole o Client ID do Google.
8. Reinicie `iniciar-ticket.bat`.
9. No Ticket., abra **Armazenamento > Google Drive > Conectar minha conta Google Drive**.

O Ticket. solicita o escopo `drive.file`, que permite gerenciar os arquivos criados pelo próprio aplicativo. As imagens são organizadas em `Ticket./ANO/MÊS`.

## Microsoft OneDrive

1. Entre no Microsoft Entra admin center.
2. Abra **App registrations** e crie um novo registro.
3. Escolha o tipo de conta adequado. Para contas pessoais e corporativas, selecione a opção que inclui contas pessoais Microsoft.
4. Em **Authentication**, adicione uma plataforma **Single-page application (SPA)**.
5. Adicione o redirecionamento HTTPS publicado:

```text
https://ticket.seudominio.com/
```

Para testes locais separados, também é possível cadastrar um redirecionamento `http://localhost:<porta>/` como SPA.

6. Em **API permissions**, adicione permissões delegadas do Microsoft Graph:

```text
User.Read
Files.ReadWrite
```

7. Copie o **Application (client) ID**.
8. Use `common` como Tenant para aceitar contas compatíveis ou informe o Directory (tenant) ID da organização.
9. Execute `configurar-servicos.bat`, informe o Client ID e reinicie o Ticket.
10. No Ticket., abra **Armazenamento > Microsoft OneDrive > Conectar minha conta OneDrive**.

As imagens são organizadas em `Ticket./ANO/MÊS`.

## Diagnóstico rápido

- **Botão desativado:** o Client ID ainda não foi salvo ou o Ticket. não foi reiniciado.
- **redirect_uri_mismatch / origem não autorizada:** o endereço exibido em **Armazenamento > Configuração técnica** não está cadastrado no provedor.
- **Popup bloqueado:** permita popups para o endereço do Ticket.
- **Funciona no computador, mas não no celular:** publique em HTTPS e cadastre a URL publicada nos dois provedores.
- **Imagem ficou pendente:** conecte a conta e use **Tentar sincronizar agora**.
