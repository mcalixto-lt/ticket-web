# Publicação do Ticket. no Render e monitoramento no UptimeRobot

## Arquitetura recomendada

Publique o projeto como **Static Site**, não como Web Service. O Ticket. é uma aplicação Vite executada no navegador. Static Sites do Render são servidos por CDN, recebem HTTPS automaticamente e não entram em suspensão por inatividade.

O UptimeRobot será usado para verificar disponibilidade e enviar alertas. Ele não é necessário para manter um Static Site acordado.

## 1. Enviar o projeto ao GitHub

1. Crie um repositório no GitHub, por exemplo `ticket-web`.
2. Envie o conteúdo desta pasta para a raiz do repositório.
3. Confirme que `package.json`, `render.yaml`, `src` e `public` aparecem na raiz.

Não envie `node_modules`, `dist` ou arquivos `.env`.

## 2. Publicar no Render por Blueprint

1. Entre no Render e conecte sua conta GitHub.
2. Clique em **New > Blueprint**.
3. Selecione o repositório `ticket-web`.
4. O Render localizará o arquivo `render.yaml`.
5. Confirme a criação do serviço.
6. Aguarde o build ficar como **Live**.

O endereço será parecido com:

`https://ticket-web.onrender.com`

Se o nome já estiver em uso, o Render acrescentará outro identificador.

## 3. Publicar manualmente, caso não use Blueprint

Crie um **Static Site** e use:

- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Branch: `main`
- Root Directory: vazio, se `package.json` estiver na raiz

## 4. Configurar Google Drive e OneDrive

No Render, abra o Static Site e entre em **Environment**. Adicione:

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_MICROSOFT_CLIENT_ID`
- `VITE_MICROSOFT_TENANT_ID` com valor `common`

Depois escolha **Save, rebuild, and deploy**.

No Google Cloud, cadastre como origem JavaScript autorizada exatamente a origem Render, sem barra final, por exemplo:

`https://ticket-web.onrender.com`

No Microsoft Entra, adicione como URI de redirecionamento do tipo SPA o endereço completo, por exemplo:

`https://ticket-web.onrender.com/`

Não adicione Client Secret no frontend.

## 5. Configurar o UptimeRobot

1. Crie uma conta no UptimeRobot.
2. Clique em **New Monitor**.
3. Escolha **HTTP(s)**.
4. Friendly Name: `Ticket.`
5. URL: o endereço HTTPS fornecido pelo Render.
6. Escolha o intervalo disponível no seu plano.
7. Marque seu e-mail ou aplicativo como contato de alerta.
8. Salve e aguarde o primeiro estado `Up`.

Como o Ticket. é Static Site, o monitor serve para alertar sobre indisponibilidade. Não é um mecanismo de persistência de dados.

## 6. Limitação atual dos perfis

O cadastro, os registros e as configurações do Ticket. são salvos no armazenamento do navegador. Portanto:

- O mesmo navegador no mesmo dispositivo mantém os dados.
- Outro celular, outro navegador, aba anônima ou limpeza dos dados não terá o mesmo perfil.
- A hospedagem no Render não transforma os perfis locais em contas centralizadas.
- Google Drive e OneDrive guardam as imagens, mas não substituem um banco de dados de usuários e registros.

Para login pelo mesmo CPF em qualquer aparelho e histórico sincronizado, será necessária uma próxima etapa com backend e banco de dados.
