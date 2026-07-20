import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');

test('define o gerador de itens da barra lateral antes de montar o painel', () => {
  const definition = mainSource.indexOf('function sidebarItem(');
  const use = mainSource.indexOf("sidebarItem('dashboard'");
  assert.ok(definition >= 0, 'sidebarItem deve estar definido');
  assert.ok(use >= 0, 'sidebarItem deve ser utilizado no painel');
  assert.ok(definition < use, 'sidebarItem precisa ser definido antes do uso');
});

test('cadastro duplicado direciona o colaborador para a tela Entrar', () => {
  assert.match(mainSource, /message\.includes\('CPF já possui cadastro'\)/);
  assert.match(mainSource, /state\.authMode = 'login'/);
  assert.match(mainSource, /cpfInput\.value = formatCpf\(data\.cpf/);
});

test('painel contém os cinco indicadores na ordem solicitada', () => {
  const labels = [
    'Batidas de Hoje',
    'Meta do Dia',
    'Horas Trabalhadas',
    'Saldo do Dia',
    'Saldo do Mês',
  ];
  let previous = -1;
  for (const label of labels) {
    const index = mainSource.indexOf(`<span>${label}</span>`);
    assert.ok(index > previous, `${label} deve aparecer na ordem correta`);
    previous = index;
  }
});

test('remove leitura original e mantém somente informação usada no cálculo', () => {
  assert.doesNotMatch(mainSource, /<strong>Leitura original<\/strong>/);
  assert.doesNotMatch(mainSource, /id="originalDateField"/);
  assert.match(mainSource, /<strong>Informação utilizada no cálculo<\/strong>/);
});

test('oferece registro de ambiente e imagem em alto contraste', () => {
  assert.match(mainSource, /id="registerEnvironmentButton"/);
  assert.match(mainSource, /data-image-style="contrast"/);
  assert.match(mainSource, /captureType === 'environment'/);
});

test('remove botão de adicionar manualmente sem fotografia', () => {
  assert.doesNotMatch(mainSource, /manualEntryButton/);
  assert.doesNotMatch(mainSource, />Adicionar manualmente</);
});

test('registro de ambiente é evidência auxiliar e não cria uma batida', () => {
  assert.match(mainSource, /captureType === 'receipt' \? newTimes\.map/);
  assert.match(mainSource, /Evidência auxiliar de presença — não contabiliza jornada/);
  assert.match(mainSource, /As batidas não foram alteradas/);
});

test('saldo do dia só é fechado quando a jornada está completa', () => {
  assert.match(mainSource, /const dayBalance = calc\?\.complete \? calc\.balanceMinutes : null/);
  assert.match(mainSource, /Aguardando todas as batidas/);
});

test('marca principal usa SVG incorporado e favicons públicos absolutos', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(main, /<svg class="brand-icon"/);
  assert.doesNotMatch(main, /<img src="\.\/icons\/favicon\.svg"/);
  assert.match(html, /href="\/favicon-v152\.ico"/);
  assert.match(html, /href="\/apple-touch-icon-v152\.png"/);
  assert.match(html, /href="\/manifest-v152\.webmanifest"/);
});


test('mantém a sessão por 24 horas e permite saída explícita', async () => {
  const storageSource = await readFile(new URL('../src/core/storage.js', import.meta.url), 'utf8');
  assert.match(storageSource, /SESSION_DURATION_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(storageSource, /localStorage\.setItem\(SESSION_KEY/);
  assert.match(storageSource, /expiresAt: now \+ SESSION_DURATION_MS/);
  assert.match(storageSource, /export function touchSession/);
  assert.match(mainSource, /isSessionUnlocked\(\{ allowLegacyProfile: true \}\)/);
});

test('galeria não força a câmera e a captura direta permanece disponível', () => {
  assert.match(mainSource, /id="imageFileInput" type="file" accept="image\/\*" hidden/);
  assert.doesNotMatch(mainSource, /id="imageFileInput"[^>]*capture="environment"/);
  assert.match(mainSource, /id="openCameraButton"/);
  assert.match(mainSource, /id="chooseImageButton"[^>]*Abrir galeria/);
});

test('painel usa Registrar Ponto e saudação dinâmica com data e hora', () => {
  assert.match(mainSource, /Registrar Ponto<\/button>/);
  assert.doesNotMatch(mainSource, /Registrar novo ponto \(foto\)/);
  assert.match(mainSource, /function greetingForTime/);
  assert.match(mainSource, /id="dashboardGreeting"/);
  assert.match(mainSource, /id="dashboardDateTime"/);
  assert.match(mainSource, /\| \$\{formatCurrentTime\(\)\}/);
});


test('ícone interno usa cores sólidas compatíveis com Chrome móvel', () => {
  assert.match(mainSource, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(mainSource, /fill="#f3c650"/);
  assert.doesNotMatch(mainSource, /url\(#ticketGold\)/);
});

test('tela de acesso mostra saudação dinâmica acima das abas', () => {
  const greetingIndex = mainSource.indexOf('class="auth-greeting"');
  const tabsIndex = mainSource.indexOf('${authTabs()}');
  assert.ok(greetingIndex >= 0, 'saudação de acesso deve existir');
  assert.ok(tabsIndex > greetingIndex, 'saudação deve aparecer acima das abas');
  assert.match(mainSource, /id="authGreeting"/);
  assert.match(mainSource, /startAuthGreetingClock\(\)/);
});


test('painel mostra saldo anterior, saldo calculado, total e período atual', () => {
  assert.match(mainSource, /id="dashPreviousBalance"/);
  assert.match(mainSource, /id="dashTicketBalance"/);
  assert.match(mainSource, /id="dashTotalBalance"/);
  assert.match(mainSource, /id="dashCurrentPeriod"/);
  assert.match(mainSource, /Saldo anterior informado/);
  assert.match(mainSource, /Saldo total acumulado/);
});

test('configurações possuem saldo anterior com histórico sem alterar batidas', () => {
  assert.match(mainSource, /id="balanceSettingsForm"/);
  assert.match(mainSource, /id="balanceHistoryList"/);
  assert.match(mainSource, /As batidas e os cálculos diários já registrados não serão alterados/);
  assert.match(mainSource, /saveBalanceSettings\(state\.balanceSettings\)/);
});

test('configurações possuem ciclo mensal e relatório por período', () => {
  assert.match(mainSource, /id="closingPeriodForm"/);
  assert.match(mainSource, /id="closingStartDay"/);
  assert.match(mainSource, /id="closingEndDay"/);
  assert.match(mainSource, /id="currentPeriodPreview"/);
  assert.match(mainSource, /periodSummary\(state\.records/);
  assert.match(mainSource, /id="reportPeriodRange"/);
});
