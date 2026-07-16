# Atualizar o Ticket. publicado no Render

1. Extraia este pacote.
2. No GitHub, abra o repositório `ticket-web`.
3. Use **Add file > Upload files**.
4. Envie todos os arquivos e pastas que estão dentro desta pasta, substituindo os existentes.
5. Confirme o commit com a mensagem `Atualizar Ticket para 1.4.3`.
6. O Render iniciará o deploy automaticamente.
7. Aguarde o status **Live**.
8. No celular, feche e abra novamente o Ticket. instalado. Se necessário, abra uma vez o endereço no Chrome para o service worker atualizar.

## Comportamento da sessão

Após a primeira abertura desta atualização, o usuário que não havia clicado em **Sair** será mantido conectado. A sessão é renovada durante o uso e expira após 24 horas sem atividade. Clicar em **Sair** encerra imediatamente a sessão.

## Galeria e câmera

O botão com ícone de imagem abre a galeria/seletor de arquivos. O botão **Abrir câmera** e o círculo central continuam capturando diretamente pela câmera.
