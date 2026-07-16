# Ticket. Web

Painel web mobile-first para registrar comprovantes de ponto e fotografias do ambiente de trabalho, organizar as batidas e calcular jornada, saldo diário e saldo mensal.

## Executar no Windows

1. Extraia o ZIP em uma pasta nova.
2. Feche servidores de versões anteriores.
3. Execute `iniciar-ticket.bat`.
4. O navegador abrirá em `http://127.0.0.1:8773/`.

O inicializador instala as dependências pelo registro público do npm quando necessário.

## Acesso pelo celular

Com o computador e o celular na mesma rede Wi-Fi, use no celular o endereço exibido pelo inicializador, por exemplo:

```text
http://192.168.1.10:8773/
```

Para acessar fora da rede local, instalar como PWA e usar autenticação de Drive/OneDrive no celular, publique o projeto em HTTPS. Consulte `PUBLICACAO.md`.

## Cadastro e entrada

- Criar cadastro: nome completo, CPF e e-mail.
- Entrar: somente CPF.
- Vários colaboradores podem ser cadastrados no mesmo navegador.
- Cada CPF recebe um banco local separado para registros, fotografias e configurações.

> A entrada somente por CPF funciona como seleção de perfil local. Para uma publicação pública com dados centralizados, será necessário reforçar a autenticação futuramente.

## Registro de comprovante

1. Fotografe ou selecione o comprovante completo.
2. Escolha salvar a imagem em cores ou em alto contraste.
3. Informe manualmente a DATA e a HORA exibidas no comprovante.
4. Confirme o bloqueio do registro.

O sistema não tenta substituir os dados digitados por uma leitura automática. A fotografia completa fica vinculada à batida como evidência.

## Registrar ambiente

O botão **Registrar ambiente** permite fotografar o local de trabalho quando o relógio de ponto estiver indisponível. A data e a hora são preenchidas pelo dispositivo, mas a fotografia é salva somente como evidência auxiliar: ela não cria uma batida e não altera as horas trabalhadas.

## Visão geral

Os indicadores aparecem nesta ordem:

1. Batidas de Hoje;
2. Meta do Dia;
3. Horas Trabalhadas;
4. Saldo do Dia;
5. Saldo do Mês.

Enquanto a jornada não estiver completa, o Saldo do Dia é identificado como parcial.

## Integridade das fotografias

A fotografia e o registro são gravados na mesma transação no IndexedDB. Uma fotografia só é tratada como duplicada quando já está vinculada a um registro. O Histórico Diário reúne todos os comprovantes associados à data.

## Armazenamento

- Dispositivo: funciona sem credenciais externas.
- Google Drive: exige `VITE_GOOGLE_CLIENT_ID`.
- Microsoft OneDrive: exige `VITE_MICROSOFT_CLIENT_ID` e, opcionalmente, `VITE_MICROSOFT_TENANT_ID`.

Use `configurar-servicos.bat` para gravar os IDs públicos em `.env.local`. O guia completo está em `CONFIGURAR-DRIVE-ONEDRIVE.md`.

## Comandos

```bash
npm install
npm run dev
npm test
npm run build
```

## Estrutura principal

- `src/main.js`: interface, cadastro, fotografias, registros e sincronização.
- `src/core/image-processing.js`: rotação, análise de qualidade, miniaturas e alto contraste.
- `src/core/storage.js`: perfis, IndexedDB, evidências e gravação atômica.
- `src/core/cloud/google-drive.js`: autorização e envio ao Google Drive.
- `src/core/cloud/onedrive.js`: autorização e envio ao Microsoft OneDrive.
- `public/ticket-service-worker-v140.js`: PWA publicada.
