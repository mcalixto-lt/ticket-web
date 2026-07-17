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
  assert.match(html, /href="\/favicon-v150\.ico"/);
  assert.match(html, /href="\/apple-touch-icon-v150\.png"/);
  assert.match(html, /href="\/manifest-v150\.webmanifest"/);
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
