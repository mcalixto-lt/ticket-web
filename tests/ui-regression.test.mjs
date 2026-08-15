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
  assert.match(html, /href="\/favicon-v161\.ico"/);
  assert.match(html, /href="\/apple-touch-icon-v161\.png"/);
  assert.match(html, /href="\/manifest-v161\.webmanifest"/);
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


test('captura usa seletor nativo de horário em vez de textarea', () => {
  assert.match(mainSource, /class="confirmed-time-input" type="time"/);
  assert.doesNotMatch(mainSource, /id="addConfirmedTimeButton"/);
  assert.doesNotMatch(mainSource, /id="confirmedTimesField"/);
});

test('câmera abre pelo toque e usa captura nativa no celular', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(mainSource, /id="nativeCameraInput" type="file" accept="image\/\*" capture="environment" hidden/);
  assert.match(mainSource, /function isNativeCameraPreferred\(\)/);
  assert.match(mainSource, /if \(isNativeCameraPreferred\(\) && openNativeCamera\(\)\) return;/);
  assert.match(mainSource, /Permissão da câmera bloqueada/);
  assert.doesNotMatch(mainSource, /window\.setTimeout\(\(\) => \{[\s\S]{0,300}openCamera\(\{ automatic: true \}\)/);
  assert.doesNotMatch(html, /mobile-camera-fallback\.js/);
});

test('botão de tema aparece no cabeçalho móvel abaixo do menu', () => {
  assert.match(mainSource, /id="mobileHeaderThemeButton"/);
  assert.match(mainSource, /class="mobile-header-actions"/);
});

test('botão voltar do celular navega entre telas do Ticket', () => {
  assert.match(mainSource, /window\.addEventListener\('popstate'/);
  assert.match(mainSource, /window\.history\.pushState/);
  assert.match(mainSource, /function goBackInApp/);
});

test('registro de ambiente recebe marca d’água e horário do servidor', async () => {
  const imageSource = await readFile(new URL('../src/core/image-processing.js', import.meta.url), 'utf8');
  assert.match(mainSource, /fetchInternetTimestamp/);
  assert.match(mainSource, /method: 'HEAD'/);
  assert.match(mainSource, /addTimestampWatermark/);
  assert.match(imageSource, /export async function addTimestampWatermark/);
  assert.match(mainSource, /watermarkApplied: captureType === 'environment'/);
});

test('Google Drive orienta sobre usuário de teste e força seleção de conta', async () => {
  const googleSource = await readFile(new URL('../src/core/cloud/google-drive.js', import.meta.url), 'utf8');
  assert.match(mainSource, /Erro 403: access_denied/);
  assert.match(googleSource, /select_account consent/);
});


test('troca de tema não reconstrói o shell nem zera os registros exibidos', () => {
  const toggleBlock = mainSource.match(/function toggleTheme\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(toggleBlock, /renderShell\(\)/);
  assert.match(mainSource, /function updateThemeControls/);
});

test('captura de comprovante usa apenas um seletor de horário', () => {
  assert.doesNotMatch(mainSource, /Adicionar outro horário/);
  assert.doesNotMatch(mainSource, /addConfirmedTimeButton/);
  assert.match(mainSource, /single-time-row/);
});

test('restaura uma vez o saldo oficial do DP até 12/08 sem alterar batidas', () => {
  assert.match(mainSource, /function applyOfficialDpBalanceThrough20260812\(\)/);
  assert.match(mainSource, /officialDpBalance20260812At/);
  assert.match(mainSource, /officialBalanceMinutes = 11 \* 60 \+ 30/);
  assert.match(mainSource, /officialReferenceDate = '2026-08-12'/);
  assert.match(mainSource, /3 horas foram abonadas/);
  assert.match(mainSource, /applyOfficialDpBalanceThrough20260812\(\)/);
  assert.doesNotMatch(mainSource, /applyRequestedPreviousBalanceReset/);
});

test('salvar o saldo manualmente preserva a marca de ajuste oficial', () => {
  const handlerStart = mainSource.indexOf('async function saveBalanceSettingsFromForm');
  const handlerEnd = mainSource.indexOf('function closingDraftFromForm', handlerStart);
  const handler = mainSource.slice(handlerStart, handlerEnd);
  assert.match(handler, /adjustments: \{/);
  assert.match(handler, /\.\.\.\(state\.balanceSettings\?\.adjustments \|\| \{\}\)/);
});
