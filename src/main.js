import './styles.css';
import { icon } from './icons.js';
import { runtimeConfig } from './config.js';
import {
  APP_NAME,
  DEFAULT_SCHEDULE,
  WEEKDAYS,
  accumulatedTicketBalance,
  calculateRecord,
  closingPeriodForDate,
  closingPeriodForMonth,
  classifyPunches,
  cloneDefaultSchedule,
  firstName,
  formatCpf,
  formatDateBr,
  formatDuration,
  formatLongDate,
  labelsForPunches,
  mergePunches,
  monthKey,
  monthName,
  nextClosingPeriod,
  normalizeClosingPeriodSettings,
  normalizeTime,
  periodSummary,
  parseTimeToMinutes,
  recordStatusTone,
  scheduleForDate,
  isContinuousClosingPeriod,
  todayIso,
  uuid,
} from './core/logic.js';
import {
  addSyncJob,
  clearAllData,
  deleteEvidence,
  exportBackup,
  findEvidenceByHash,
  getEvidence,
  getRecord,
  hashBlob,
  hashText,
  hasLocalAccounts,
  isEvidenceLinked,
  isSessionUnlocked,
  touchSession,
  listEvidence,
  listEvidenceForDate,
  listRecords,
  listSyncJobs,
  loadBalanceSettings,
  loadClosingPeriodSettings,
  loadCloudSettings,
  loadProfile,
  loadSchedule,
  loadTheme,
  migrateLegacyDataToCurrent,
  saveBalanceSettings,
  saveClosingPeriodSettings,
  saveCloudSettings,
  saveEvidence,
  saveRecordWithEvidence,
  saveSchedule,
  saveTheme,
  setStorageNamespace,
  updateSyncJob,
} from './core/storage.js';
import {
  loginAccount,
  registerAccount,
  signOutAccount,
} from './core/auth.js';
import { analyzeImageQuality, makeHighContrastImage, makeThumbnail, rotateImage } from './core/image-processing.js';
import { uploadEvidenceToCloud } from './core/cloud/cloud-manager.js';
import { connectGoogleDrive, disconnectGoogleDrive } from './core/cloud/google-drive.js';
import { connectOneDrive, disconnectOneDrive } from './core/cloud/onedrive.js';

const app = document.querySelector('#app');
const cachedProfile = loadProfile();
if (cachedProfile) setStorageNamespace(cachedProfile.id || cachedProfile.cpfHash?.slice(0, 24) || 'default');
const state = {
  profile: cachedProfile,
  schedule: loadSchedule(DEFAULT_SCHEDULE),
  cloud: {
    ...loadCloudSettings(),
    googleClientId: runtimeConfig.googleClientId || loadCloudSettings().googleClientId,
    microsoftClientId: runtimeConfig.microsoftClientId || loadCloudSettings().microsoftClientId,
    microsoftTenantId: runtimeConfig.microsoftTenantId || loadCloudSettings().microsoftTenantId,
  },
  records: [],
  view: 'dashboard',
  selectedMonth: monthKey(todayIso()),
  selectedReportMonth: monthKey(todayIso()),
  balanceSettings: loadBalanceSettings(),
  closingPeriod: loadClosingPeriodSettings(),
  sourceImage: null,
  selectedImage: null,
  selectedImageUrl: '',
  selectedImageName: '',
  imageDisplayMode: 'color',
  captureMode: 'receipt',
  captureDate: '',
  captureTime: '',
  imageQuality: null,
  ocrResult: null,
  cameraStream: null,
  installPrompt: null,
  busy: false,
  authMode: hasLocalAccounts() || cachedProfile ? 'login' : 'register',
  theme: loadTheme(),
};

document.documentElement.dataset.theme = state.theme;


function effectiveGoogleClientId() {
  return String(runtimeConfig.googleClientId || state.cloud.googleClientId || '').trim();
}

function effectiveMicrosoftClientId() {
  return String(runtimeConfig.microsoftClientId || state.cloud.microsoftClientId || '').trim();
}

function effectiveMicrosoftTenantId() {
  return String(runtimeConfig.microsoftTenantId || state.cloud.microsoftTenantId || 'common').trim() || 'common';
}

let dashboardClockTimer = null;
let authGreetingTimer = null;
let sessionActivityTrackingBound = false;
let lastSessionTouchAt = 0;

function displayFirstName(fullName = '') {
  const raw = firstName(fullName).trim();
  if (!raw) return 'Colaborador';
  const lower = raw.toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}

function greetingForTime(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatCurrentTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}


function formatPeriodLabel(period) {
  if (!period?.startDate || !period?.endDate) return 'Período não definido';
  return `${formatDateBr(period.startDate)} até ${formatDateBr(period.endDate)}`;
}

function balanceReferenceDate() {
  return state.balanceSettings?.referenceDate || '';
}

function previousBalanceMinutes(throughDate = todayIso()) {
  const referenceDate = balanceReferenceDate();
  if (referenceDate && throughDate < referenceDate) return 0;
  return Number(state.balanceSettings?.minutes || 0);
}

function calculatedTicketBalance(throughDate = todayIso()) {
  return accumulatedTicketBalance(state.records, state.schedule, {
    afterDate: balanceReferenceDate(),
    throughDate,
  });
}

function totalAccumulatedBalance(throughDate = todayIso()) {
  return previousBalanceMinutes(throughDate) + calculatedTicketBalance(throughDate);
}

function dayOptions(selectedValue) {
  return Array.from({ length: 31 }, (_, index) => index + 1)
    .map((day) => `<option value="${day}" ${Number(selectedValue) === day ? 'selected' : ''}>${day}</option>`)
    .join('');
}

function updateDashboardDateTime() {
  const now = new Date();
  const greeting = document.querySelector('#dashboardGreeting');
  const dateTime = document.querySelector('#dashboardDateTime');
  if (greeting) greeting.textContent = `${greetingForTime(now)}, ${displayFirstName(state.profile?.fullName)}`;
  if (dateTime) dateTime.textContent = `${formatLongDate(todayIso())} | ${formatCurrentTime(now)}`;
}

function startDashboardClock() {
  if (dashboardClockTimer) clearInterval(dashboardClockTimer);
  updateDashboardDateTime();
  dashboardClockTimer = window.setInterval(updateDashboardDateTime, 15000);
}

function updateAuthGreeting() {
  const greeting = document.querySelector('#authGreeting');
  if (greeting) greeting.textContent = greetingForTime(new Date());
}

function startAuthGreetingClock() {
  if (authGreetingTimer) clearInterval(authGreetingTimer);
  updateAuthGreeting();
  authGreetingTimer = window.setInterval(updateAuthGreeting, 30_000);
}

function bindPersistentSessionActivity() {
  if (sessionActivityTrackingBound) return;
  sessionActivityTrackingBound = true;
  const refreshSession = () => {
    if (!state.profile) return;
    const now = Date.now();
    if (now - lastSessionTouchAt < 60_000) return;
    lastSessionTouchAt = now;
    if (!touchSession()) void logout();
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, refreshSession, { passive: true });
  });
  window.addEventListener('focus', refreshSession);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshSession();
  });
}

const viewTitles = {
  dashboard: ['Painel', 'Resumo da sua jornada'],
  scan: ['Registrar ponto', 'Escaneie o comprovante pela câmera'],
  history: ['Histórico diário', 'Registros imutáveis e comprovantes'],
  calendar: ['Calendário', 'Visualização mensal da jornada'],
  reports: ['Relatórios', 'Fechamento e saldo mensal'],
  settings: ['Configurações', 'Jornada e identificação'],
  storage: ['Armazenamento', 'Dispositivo, Google Drive ou OneDrive'],
  help: ['Ajuda', 'Orientações para usar o Ticket.'],
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function logoMarkup({ compact = false } = {}) {
  return `<div class="brand ${compact ? 'brand-compact' : ''}">
    <svg class="brand-icon" viewBox="0 0 128 128" role="img" aria-label="Símbolo do Ticket." xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="126" height="126" rx="28" fill="#061b3a" stroke="#102f5d" stroke-width="2"></rect>
      <path d="M27 27h62v16H68v52H49V43H27z" fill="#f3c650"></path>
      <circle cx="87" cy="84" r="23" fill="#061b3a" stroke="#f3c650" stroke-width="6"></circle>
      <path d="M87 69v16l11 7" fill="none" stroke="#f3c650" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="107" cy="106" r="7" fill="#f3c650"></circle>
    </svg>
    <div class="brand-word">Ticket<span>.</span></div>
  </div>`;
}

function toast(message, tone = 'info', timeout = 4200) {
  let container = document.querySelector('#toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const element = document.createElement('div');
  element.className = `toast toast-${tone}`;
  element.innerHTML = `${icon(tone === 'success' ? 'check' : tone === 'error' ? 'alert' : 'info', 19)}<span>${escapeHtml(message)}</span>`;
  container.appendChild(element);
  requestAnimationFrame(() => element.classList.add('show'));
  setTimeout(() => {
    element.classList.remove('show');
    setTimeout(() => element.remove(), 220);
  }, timeout);
}

function setBusy(value, message = '') {
  state.busy = value;
  document.body.classList.toggle('is-busy', value);
  const overlay = document.querySelector('#busyOverlay');
  if (overlay) {
    overlay.classList.toggle('hidden', !value);
    const label = overlay.querySelector('[data-busy-label]');
    if (label) label.textContent = message || 'Processando…';
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function authTabs() {
  return `<div class="auth-tabs" role="tablist" aria-label="Acesso">
    <button type="button" class="auth-tab ${state.authMode === 'login' ? 'active' : ''}" data-auth-mode="login">Entrar</button>
    <button type="button" class="auth-tab ${state.authMode === 'register' ? 'active' : ''}" data-auth-mode="register">Criar cadastro</button>
  </div>`;
}

function renderLogin() {
  const mode = state.authMode;
  app.innerHTML = `<main class="login-page">
    <section class="login-visual" aria-hidden="true">
      <div class="login-visual-inner">
        ${logoMarkup()}
        <h1>Seu ponto.<br />Sua hora.<br /><span>Seu controle.</span></h1>
        <p>Fotografe o comprovante, informe DATA e HORA e acompanhe o saldo do mês.</p>
        <div class="login-feature-list">
          <div>${icon('scan')}<span>Registro do comprovante completo</span></div>
          <div>${icon('lock')}<span>Perfil e registros protegidos</span></div>
          <div>${icon('cloud')}<span>Drive e OneDrive opcionais</span></div>
        </div>
      </div>
    </section>
    <section class="login-panel-wrap">
      <div class="login-card">
        ${logoMarkup({ compact: true })}
        <div class="auth-greeting" aria-live="polite"><span id="authGreeting">${greetingForTime()}</span></div>
        ${authTabs()}
        <div class="login-heading">
          <span class="eyebrow">${mode === 'register' ? 'Novo colaborador' : 'Acesso rápido'}</span>
          <h2>${mode === 'register' ? 'Crie seu cadastro' : 'Acesse sua conta'}</h2>
          <p>${mode === 'register'
            ? 'Cadastre nome completo, CPF e e-mail. Os dados ficarão gravados neste navegador.'
            : 'Informe somente o CPF cadastrado neste navegador.'}</p>
        </div>
        <form id="loginForm" class="login-form" autocomplete="on">
          <input type="hidden" name="mode" value="${mode}" />
          ${mode === 'register' ? `<label class="input-group">
            <span>${icon('user', 19)} Nome completo</span>
            <input name="fullName" type="text" maxlength="120" placeholder="Digite seu nome completo" required autocomplete="name" />
          </label>
          <label class="input-group">
            <span>${icon('mail', 19)} E-mail</span>
            <input name="email" type="email" maxlength="160" placeholder="nome@exemplo.com" required autocomplete="email" />
          </label>` : ''}
          <label class="input-group">
            <span>${icon('id', 19)} CPF</span>
            <input id="loginCpf" name="cpf" type="text" inputmode="numeric" maxlength="14" placeholder="000.000.000-00" required autocomplete="username" />
          </label>
          ${mode === 'register' ? `<label class="check-row">
            <input name="immutableConfirm" type="checkbox" required />
            <span>Confirmo que nome completo, CPF e e-mail estão corretos.</span>
          </label>` : ''}
          <button class="button button-gold button-block" type="submit">${mode === 'register' ? 'Criar cadastro e entrar' : 'Entrar no sistema'}</button>
        </form>
        <div class="security-note">
          ${icon('storage', 20)}
          <div><strong>Perfil salvo neste navegador</strong><small>Ao fechar a página, o cadastro permanece gravado. Para voltar, use somente o CPF.</small></div>
        </div>
      </div>
      <p class="login-footer">${APP_NAME} • Controle pessoal de jornada</p>
    </section>
    <div id="busyOverlay" class="busy-overlay hidden"><span class="spinner"></span><strong data-busy-label>Processando…</strong></div>
  </main>`;

  document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => {
    state.authMode = button.dataset.authMode;
    renderLogin();
  }));
  startAuthGreetingClock();
  const form = document.querySelector('#loginForm');
  const cpfInput = document.querySelector('#loginCpf');
  cpfInput.addEventListener('input', () => { cpfInput.value = formatCpf(cpfInput.value); });
  form.addEventListener('submit', handleLoginSubmit);
}

function sidebarItem(view, label, iconName) {
  return `<button class="nav-item" data-view-target="${escapeHtml(view)}">${icon(iconName, 19)}<span>${escapeHtml(label)}</span></button>`;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    setBusy(true, data.mode === 'register' ? 'Criando cadastro…' : 'Localizando perfil…');
    if (data.mode === 'register') {
      const result = await registerAccount(data);
      state.profile = result.profile;
      await bootApp();
      toast('Cadastro criado e salvo neste navegador.', 'success');
    } else {
      const result = await loginAccount(data);
      state.profile = result.profile;
      await bootApp();
      toast('Acesso realizado.', 'success');
    }
  } catch (error) {
    const message = error.message || 'Não foi possível entrar.';
    if (data.mode === 'register' && message.includes('CPF já possui cadastro')) {
      state.authMode = 'login';
      renderLogin();
      const cpfInput = document.querySelector('#loginCpf');
      if (cpfInput) cpfInput.value = formatCpf(data.cpf || '');
      toast('Este CPF já está cadastrado. Entre usando o CPF informado.', 'info', 6500);
    } else {
      toast(message, 'error', 6500);
    }
  } finally {
    setBusy(false);
  }
}

function renderShell() {
  if (authGreetingTimer) {
    clearInterval(authGreetingTimer);
    authGreetingTimer = null;
  }
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">${logoMarkup({ compact: true })}</div>
      <nav class="sidebar-nav" aria-label="Navegação principal">
        ${sidebarItem('dashboard', 'Painel', 'home')}
        ${sidebarItem('scan', 'Registrar Ponto', 'clock')}
        ${sidebarItem('history', 'Histórico Diário', 'history')}
        ${sidebarItem('calendar', 'Calendário', 'calendar')}
        ${sidebarItem('reports', 'Relatórios', 'report')}
        ${sidebarItem('settings', 'Configurações', 'settings')}
        ${sidebarItem('storage', 'Armazenamento', 'storage')}
        ${sidebarItem('help', 'Ajuda', 'help')}
      </nav>
      <div class="sidebar-profile">
        <div class="avatar">${escapeHtml(displayFirstName(state.profile.fullName).charAt(0))}</div>
        <div><strong>${escapeHtml(displayFirstName(state.profile.fullName))}</strong><small>${escapeHtml(state.profile.cpfMasked)}</small></div>
        <button id="logoutButton" class="icon-button" title="Sair">${icon('logout', 19)}</button>
      </div>
    </aside>

    <main class="main-area">
      <header class="mobile-header">
        ${logoMarkup({ compact: true })}
        <button id="mobileMenuButton" class="icon-button" aria-label="Abrir menu">${icon('menu', 23)}</button>
      </header>
      <header class="page-topbar">
        <div><h1 id="pageTitle">Painel</h1><p id="pageSubtitle">Resumo da sua jornada</p></div>
        <div class="topbar-actions">
          <span id="onlineBadge" class="online-badge">${icon('wifi', 16)} <span>Online</span></span>
          <button id="themeToggleButton" class="icon-button theme-toggle" title="Alternar modo claro/escuro">${icon(state.theme === 'dark' ? 'sun' : 'moon', 20)}</button>
          <button class="icon-button" title="Notificações">${icon('bell', 20)}</button>
        </div>
      </header>

      <div class="content-area">
        ${dashboardViewTemplate()}
        ${scanViewTemplate()}
        ${historyViewTemplate()}
        ${calendarViewTemplate()}
        ${reportsViewTemplate()}
        ${settingsViewTemplate()}
        ${storageViewTemplate()}
        ${helpViewTemplate()}
      </div>
    </main>

    <nav class="mobile-bottom-nav" aria-label="Navegação móvel">
      <button data-view-target="dashboard">${icon('home', 20)}<span>Início</span></button>
      <button data-view-target="scan">${icon('camera', 20)}<span>Registrar</span></button>
      <button data-view-target="history">${icon('history', 20)}<span>Histórico</span></button>
      <button id="moreMenuButton">${icon('more', 21)}<span>Mais</span></button>
    </nav>

    <div id="moreSheet" class="bottom-sheet-backdrop hidden">
      <div class="bottom-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-heading"><strong>Mais opções</strong><button id="closeMoreSheet" class="icon-button">${icon('close')}</button></div>
        <div class="sheet-grid">
          <button data-view-target="calendar">${icon('calendar')}<span>Calendário</span></button>
          <button data-view-target="reports">${icon('report')}<span>Relatórios</span></button>
          <button data-view-target="settings">${icon('settings')}<span>Configurações</span></button>
          <button data-view-target="storage">${icon('storage')}<span>Armazenamento</span></button>
          <button data-view-target="help">${icon('help')}<span>Ajuda</span></button>
          <button id="mobileThemeButton">${icon(state.theme === 'dark' ? 'sun' : 'moon')}<span>${state.theme === 'dark' ? 'Modo claro' : 'Modo noturno'}</span></button>
          <button id="mobileLogoutButton">${icon('logout')}<span>Sair</span></button>
        </div>
      </div>
    </div>

    <div id="imageModal" class="modal-backdrop hidden">
      <div class="image-modal-card">
        <div class="modal-header"><strong>Comprovante original</strong><button data-close-modal="imageModal" class="icon-button">${icon('close')}</button></div>
        <div class="modal-image-wrap"><img id="modalEvidenceImage" alt="Comprovante original" /></div>
        <div id="modalEvidenceInfo" class="modal-footer"></div>
      </div>
    </div>

    <div id="busyOverlay" class="busy-overlay hidden"><span class="spinner"></span><strong data-busy-label>Processando…</strong></div>
  </div>`;

  bindShellEvents();
  bindPersistentSessionActivity();
  startDashboardClock();
  renderProfileSummary();
  renderBalanceSettings();
  renderClosingPeriodSettings();
  renderScheduleEditor();
  renderStorageSettings();
  navigate(state.view, { stopCamera: false });
}

function dashboardViewTemplate() {
  return `<section class="view" data-view="dashboard">
    <div class="dashboard-greeting">
      <div><span class="eyebrow">Visão geral</span><h2 id="dashboardGreeting">${greetingForTime()}, ${escapeHtml(displayFirstName(state.profile.fullName))}</h2><p id="dashboardDateTime">${escapeHtml(formatLongDate(todayIso()))} | ${formatCurrentTime()}</p></div>
      <span id="todayStatusPill" class="status-pill status-neutral">Aguardando registros</span>
    </div>
    <div class="stats-grid stats-grid-five">
      <article class="stat-card featured"><span>Batidas de Hoje</span><strong id="dashPunchCount">0 de 4</strong><small id="dashNextPunch">Próxima: Entrada</small></article>
      <article class="stat-card"><span>Meta do Dia</span><strong id="dashExpectedToday">08h00</strong><small>Jornada prevista</small></article>
      <article class="stat-card"><span>Horas Trabalhadas</span><strong id="dashWorkedToday">00h00</strong><small>Atualizado a cada comprovante</small></article>
      <article class="stat-card"><span>Saldo do Dia</span><strong id="dashDayBalance">00h00</strong><small id="dashDayBalanceCaption">Aguardando registros</small></article>
      <article class="stat-card"><span>Saldo do Mês</span><strong id="dashMonthBalance">00h00</strong><small>Saldo do período atual</small></article>
    </div>
    <article class="balance-overview-card">
      <div class="balance-overview-grid">
        <div><span>Saldo anterior informado</span><strong id="dashPreviousBalance">00h00</strong></div>
        <div><span>Saldo calculado pelo Ticket.</span><strong id="dashTicketBalance">00h00</strong></div>
        <div class="balance-total"><span>Saldo total acumulado</span><strong id="dashTotalBalance">00h00</strong></div>
      </div>
      <div class="current-period-banner">${icon('calendar', 18)}<span>Período atual: <strong id="dashCurrentPeriod">01/01/2026 até 31/01/2026</strong></span></div>
    </article>
    <article class="panel-card recent-panel">
      <div class="panel-heading"><div><h3>Últimos registros</h3><p>Resumo das jornadas mais recentes</p></div><button class="text-button" data-view-target="history">Ver histórico ${icon('chevronRight', 16)}</button></div>
      <div class="desktop-table"><table><thead><tr><th>Data</th><th>Entrada</th><th>Almoço saída</th><th>Almoço volta</th><th>Saída final</th><th>Total</th><th>Saldo</th></tr></thead><tbody id="recentRecordsBody"></tbody></table></div>
      <div id="recentMobileList" class="mobile-record-list"></div>
      <div class="dashboard-actions">
        <button id="registerReceiptButton" class="button button-navy">${icon('camera', 19)} Registrar Ponto</button>
        <button id="registerEnvironmentButton" class="button button-outline">${icon('image', 19)} Registrar ambiente</button>
      </div>
    </article>
  </section>`;
}

function scanViewTemplate() {
  const isEnvironment = state.captureMode === 'environment';
  return `<section class="view" data-view="scan">
    <div class="section-intro"><div><span class="eyebrow">Registro por fotografia</span><h2>${isEnvironment ? 'Registrar ambiente' : 'Capturar comprovante'}</h2><p>${isEnvironment
      ? 'Fotografe o ambiente da empresa. A data e a hora serão preenchidas automaticamente pelo dispositivo.'
      : 'Fotografe o comprovante inteiro e informe manualmente a DATA e a HORA utilizadas no cálculo.'}</p></div></div>
    <div class="scan-layout">
      <article class="scanner-card">
        <div class="scanner-header"><button id="scanBackButton" class="text-button">${icon('arrowLeft', 18)} Voltar</button><strong>${isEnvironment ? 'Registrar presença no ambiente' : 'Registrar comprovante'}</strong><button id="clearScanButton" class="icon-button" title="Limpar">${icon('close', 19)}</button></div>
        <div id="scannerViewport" class="scanner-viewport">
          <video id="cameraVideo" class="hidden" playsinline muted></video>
          <img id="scanPreviewImage" class="hidden" alt="Prévia da fotografia" />
          <div id="scanPlaceholder" class="scanner-placeholder">
            ${icon(isEnvironment ? 'image' : 'scan', 56)}
            <strong>${isEnvironment ? 'Fotografe o ambiente da empresa' : 'Posicione todo o comprovante'}</strong>
            <span>Use a câmera traseira ou selecione uma imagem da galeria.</span>
          </div>
          <div class="scanner-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>
        <div id="qualityBar" class="quality-bar"><span class="quality-dot"></span><strong>Sem imagem</strong><small>Selecione ou fotografe uma imagem</small></div>
        <div class="scanner-controls">
          <input id="imageFileInput" type="file" accept="image/*" hidden />
          <button id="chooseImageButton" class="round-action" title="Abrir galeria" aria-label="Abrir galeria de fotos">${icon('image', 22)}</button>
          <button id="captureButton" class="capture-button" aria-label="Capturar foto"><span></span></button>
          <button id="rotateImageButton" class="round-action" title="Girar imagem">${icon('rotate', 22)}</button>
        </div>
        <div id="imageStyleControls" class="image-style-controls hidden">
          <span>Como deseja salvar a fotografia?</span>
          <div class="segmented-control" role="group" aria-label="Aparência da fotografia">
            <button type="button" class="active" data-image-style="color">Em cores</button>
            <button type="button" data-image-style="contrast">Alto contraste</button>
          </div>
        </div>
        <div class="scan-secondary-actions single-action">
          <button id="openCameraButton" class="button button-outline">${icon('camera', 18)} Abrir câmera</button>
          <button id="continueRegistrationButton" class="button button-gold" disabled>${icon(isEnvironment ? 'clock' : 'edit', 18)} ${isEnvironment ? 'Confirmar horário do dispositivo' : 'Informar DATA e HORA'}</button>
        </div>
      </article>
      <article id="reviewCard" class="review-card hidden">
        <div class="panel-heading"><div><span class="eyebrow">Informações do registro</span><h3>${isEnvironment ? 'Confirme o registro do ambiente' : 'Informação utilizada no cálculo'}</h3><p>${isEnvironment
          ? 'A data e a hora foram obtidas do dispositivo. Este registro comprova presença, mas não altera as batidas nem o cálculo da jornada.'
          : 'Informe manualmente a data e o horário exibidos no comprovante.'}</p></div></div>
        <form id="reviewForm" class="review-grid review-grid-single">
          <div class="review-column editable-column">
            <div class="column-title">${icon(isEnvironment ? 'lock' : 'edit', 18)} <strong>Informação utilizada no cálculo</strong></div>
            <label><span>Data</span><input id="confirmedDateField" type="date" required ${isEnvironment ? 'readonly' : ''} /></label>
            <label><span>Horário(s) — um por linha</span><textarea id="confirmedTimesField" rows="3" required ${isEnvironment ? 'readonly' : ''}></textarea></label>
            <div><span class="field-caption">Classificação automática</span><div id="classificationPreview" class="classification-preview"></div></div>
            ${isEnvironment ? `<div class="inline-alert environment-alert">${icon('info', 18)} <span>Este registro será salvo como evidência auxiliar de presença. Ele não será usado como batida e não modificará as horas trabalhadas.</span></div>` : ''}
            <label class="check-row compact"><input id="recordLockConfirm" type="checkbox" required /><span>Revisei os dados e autorizo o bloqueio definitivo deste registro.</span></label>
            <div class="form-actions"><button id="cancelReviewButton" class="button button-outline" type="button">Cancelar</button><button class="button button-success" type="submit">${icon('save', 18)} Confirmar e salvar</button></div>
          </div>
        </form>
      </article>
    </div>
  </section>`;
}

function historyViewTemplate() {
  return `<section class="view" data-view="history">
    <div class="section-intro split"><div><span class="eyebrow">Registros</span><h2>Histórico diário</h2><p>Cada registro preserva a fotografia e as informações confirmadas para o cálculo.</p></div><label class="compact-input"><span>Mês</span><input id="historyMonthPicker" type="month" value="${state.selectedMonth}" /></label></div>
    <div id="historyList" class="history-list"></div>
  </section>`;
}

function calendarViewTemplate() {
  return `<section class="view" data-view="calendar">
    <div class="section-intro split"><div><span class="eyebrow">Visão mensal</span><h2>Calendário de jornada</h2><p>Toque em um dia para visualizar as batidas.</p></div><div class="calendar-nav"><button id="calendarPrev" class="icon-button">${icon('chevronLeft')}</button><strong id="calendarTitle"></strong><button id="calendarNext" class="icon-button">${icon('chevronRight')}</button></div></div>
    <article class="panel-card calendar-card"><div class="calendar-weekdays"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div><div id="calendarGrid" class="calendar-grid"></div><div class="calendar-legend"><span><i class="legend-complete"></i>Completo</span><span><i class="legend-positive"></i>Extra</span><span><i class="legend-negative"></i>Negativo</span><span><i class="legend-warning"></i>Incompleto</span><span><i class="legend-off"></i>Folga</span></div></article>
  </section>`;
}

function reportsViewTemplate() {
  return `<section class="view" data-view="reports">
    <div class="section-intro split"><div><span class="eyebrow">Fechamento</span><h2>Relatório mensal</h2><p>Resumo conforme o período de fechamento configurado.</p></div><div class="report-actions"><label class="compact-input"><span>Mês de início</span><input id="reportMonthPicker" type="month" value="${state.selectedReportMonth}" /></label><button id="exportBackupButton" class="button button-outline">${icon('download', 18)} Backup</button></div></div>
    <div class="report-period-banner">${icon('calendar', 19)}<span>Período selecionado: <strong id="reportPeriodRange">--/--/---- até --/--/----</strong></span></div>
    <div class="summary-grid summary-grid-six"><article><span>Horas extras</span><strong id="reportPositive">+00h00</strong></article><article><span>Horas negativas</span><strong id="reportNegative">-00h00</strong></article><article><span>Saldo do período</span><strong id="reportNet">00h00</strong></article><article><span>Saldo anterior</span><strong id="reportPreviousBalance">00h00</strong></article><article><span>Saldo total acumulado</span><strong id="reportTotalBalance">00h00</strong></article><article><span>Registro Pendente</span><strong id="reportPending">0</strong></article></div>
    <article class="panel-card"><div class="desktop-table"><table><thead><tr><th>Data</th><th>Batidas</th><th>Trabalhado</th><th>Previsto</th><th>Saldo</th><th>Situação</th></tr></thead><tbody id="reportRecordsBody"></tbody></table></div><div id="reportMobileList" class="mobile-record-list"></div></article>
  </section>`;
}

function settingsViewTemplate() {
  const closing = normalizeClosingPeriodSettings(state.closingPeriod);
  const balanceType = state.balanceSettings?.type || (Number(state.balanceSettings?.minutes || 0) > 0 ? 'positive' : Number(state.balanceSettings?.minutes || 0) < 0 ? 'negative' : 'none');
  const absoluteBalance = Math.abs(Number(state.balanceSettings?.minutes || 0));
  return `<section class="view" data-view="settings">
    <div class="section-intro"><div><span class="eyebrow">Preferências</span><h2>Configurações</h2><p>Defina a jornada, o saldo anterior e o período mensal de fechamento. Os registros de ponto já salvos não serão alterados.</p></div></div>
    <div class="settings-grid">
      <article class="panel-card"><div class="panel-heading"><div><h3>Identificação bloqueada</h3><p>Dados confirmados no primeiro acesso.</p></div>${icon('lock', 21)}</div><dl id="profileDetails" class="profile-details"></dl></article>

      <article class="panel-card balance-settings-card">
        <div class="panel-heading"><div><h3>Definir saldo anterior</h3><p>Informe o saldo que você já possuía antes de começar a registrar no Ticket.</p></div>${icon('clock', 22)}</div>
        <form id="balanceSettingsForm" class="settings-form">
          <label class="input-group light"><span>Tipo do saldo</span><select id="balanceType"><option value="positive" ${balanceType === 'positive' ? 'selected' : ''}>Positivo</option><option value="negative" ${balanceType === 'negative' ? 'selected' : ''}>Negativo</option><option value="none" ${balanceType === 'none' ? 'selected' : ''}>Sem saldo anterior</option></select></label>
          <div class="settings-form-row">
            <label class="input-group light"><span>Horas</span><input id="balanceHours" type="number" inputmode="numeric" min="0" max="9999" value="${Math.floor(absoluteBalance / 60)}" /></label>
            <label class="input-group light"><span>Minutos</span><input id="balanceMinutes" type="number" inputmode="numeric" min="0" max="59" value="${absoluteBalance % 60}" /></label>
          </div>
          <label class="input-group light"><span>Data de referência</span><input id="balanceReferenceDate" type="date" value="${escapeHtml(state.balanceSettings?.referenceDate || todayIso())}" /></label>
          <label class="input-group light"><span>Observação opcional</span><input id="balanceNote" type="text" maxlength="160" value="${escapeHtml(state.balanceSettings?.note || '')}" placeholder="Ex.: saldo informado pela empresa" /></label>
          <p class="form-help">O saldo informado será considerado válido até a data de referência. O Ticket. somará apenas os registros posteriores a essa data.</p>
          <button class="button button-navy button-block" type="submit">${icon('save', 18)} Salvar saldo anterior</button>
        </form>
        <div class="settings-subsection"><h4>${icon('history', 18)} Histórico de atualização</h4><div id="balanceHistoryList" class="balance-history-list"></div></div>
      </article>

      <article class="panel-card closing-period-card">
        <div class="panel-heading"><div><h3>Período de fechamento do ponto</h3><p>Defina o dia inicial e o dia final de cada ciclo mensal.</p></div>${icon('calendar', 22)}</div>
        <form id="closingPeriodForm" class="settings-form">
          <label class="input-group light"><span>Modo de fechamento</span><select id="closingMode"><option value="calendar" ${closing.mode === 'calendar' ? 'selected' : ''}>Mês normal — dia 1 ao último dia</option><option value="custom" ${closing.mode === 'custom' ? 'selected' : ''}>Personalizado</option></select></label>
          <div class="settings-form-row">
            <label class="input-group light"><span>Dia inicial do ciclo</span><select id="closingStartDay">${dayOptions(closing.startDay)}</select></label>
            <label class="input-group light"><span>Dia final do ciclo</span><select id="closingEndDay">${dayOptions(closing.endDay)}</select></label>
          </div>
          <p class="form-help">Para um ciclo contínuo, o dia final deve ser o dia imediatamente anterior ao dia inicial. Exemplo: 16 até 15.</p>
          <div class="period-preview-card"><span>Período atual do ponto</span><strong id="currentPeriodPreview">--/--/---- até --/--/----</strong><hr/><span>Próximo período</span><strong id="nextPeriodPreview">--/--/---- até --/--/----</strong></div>
          <button class="button button-navy button-block" type="submit">${icon('save', 18)} Salvar período</button>
        </form>
      </article>

      <article class="panel-card schedule-card settings-span-2"><div class="panel-heading"><div><h3>Jornada semanal</h3><p>Segunda a sábado vêm ativados como padrão.</p></div><button id="saveScheduleButton" class="button button-navy">Salvar jornada</button></div><div id="scheduleEditor" class="schedule-editor"></div></article>
      <article class="panel-card"><div class="panel-heading"><div><h3>Instalação no celular</h3><p>Adicione o Ticket. à tela inicial para abrir como aplicativo.</p></div>${icon('download', 22)}</div><button id="installPwaButton" class="button button-outline" disabled>Instalar Ticket.</button><p class="muted-note">A opção fica disponível quando o navegador permite a instalação.</p></article>
      <article class="panel-card account-actions-card"><div class="panel-heading"><div><h3>Sessão da conta</h3><p>Encerre o acesso quando não for mais utilizar este dispositivo.</p></div>${icon('logout', 22)}</div><button id="settingsLogoutButton" class="button button-outline">Sair da conta</button></article>
      <article class="panel-card danger-card settings-span-2"><div class="panel-heading"><div><h3>Redefinir instalação</h3><p>Apaga registros e imagens locais deste navegador. A conta na nuvem não é excluída.</p></div>${icon('trash', 22)}</div><button id="resetDataButton" class="button button-danger">Apagar dados locais</button></article>
    </div>
  </section>`;
}

function storageViewTemplate() {
  const googleConfigured = Boolean(effectiveGoogleClientId());
  const microsoftConfigured = Boolean(effectiveMicrosoftClientId());
  return `<section class="view" data-view="storage">
    <div class="section-intro"><div><span class="eyebrow">Cópias das imagens</span><h2>Armazenamento</h2><p>Escolha onde os comprovantes serão preservados após a confirmação.</p></div></div>
    <div class="storage-options">
      <button class="storage-option" data-provider="local"><span class="provider-icon local">${icon('storage', 28)}</span><div><strong>Somente neste dispositivo</strong><small>Imagens armazenadas no navegador atual.</small></div><i class="radio-dot"></i></button>
      <button class="storage-option" data-provider="google"><span class="provider-icon google">${icon('drive', 28)}</span><div><strong>Google Drive</strong><small>${googleConfigured ? 'Conecte sua conta e sincronize em uma pasta Ticket.' : 'Aguardando ativação pelo administrador.'}</small></div><i class="radio-dot"></i></button>
      <button class="storage-option" data-provider="onedrive"><span class="provider-icon onedrive">${icon('cloud', 28)}</span><div><strong>Microsoft OneDrive</strong><small>${microsoftConfigured ? 'Conecte sua conta Microsoft para sincronizar.' : 'Aguardando ativação pelo administrador.'}</small></div><i class="radio-dot"></i></button>
    </div>
    <div class="storage-config-grid">
      <article class="panel-card"><div class="panel-heading"><div><h3>Conta de armazenamento</h3><p>O colaborador apenas autoriza a própria conta. Os identificadores técnicos são definidos uma única vez pelo administrador.</p></div></div>
        <div id="googleConfig" class="provider-config">
          <div class="integration-state ${googleConfigured ? 'ready' : 'pending'}">${icon(googleConfigured ? 'check' : 'alert', 19)}<span>${googleConfigured ? 'Integração Google preparada para autorização.' : 'Integração Google ainda não configurada nesta instalação.'}</span></div>
          <button id="connectGoogleButton" class="button button-outline" ${googleConfigured ? '' : 'disabled'}>${googleConfigured ? 'Conectar minha conta Google Drive' : 'Configuração do administrador necessária'}</button>
        </div>
        <div id="microsoftConfig" class="provider-config">
          <div class="integration-state ${microsoftConfigured ? 'ready' : 'pending'}">${icon(microsoftConfigured ? 'check' : 'alert', 19)}<span>${microsoftConfigured ? 'Integração Microsoft preparada para autorização.' : 'Integração Microsoft ainda não configurada nesta instalação.'}</span></div>
          <button id="connectOneDriveButton" class="button button-outline" ${microsoftConfigured ? '' : 'disabled'}>${microsoftConfigured ? 'Conectar minha conta OneDrive' : 'Configuração do administrador necessária'}</button>
        </div>
        <label class="check-row compact"><input id="keepLocalCopy" type="checkbox" /><span>Manter também uma cópia neste dispositivo.</span></label>
        <div id="cloudStatus" class="cloud-status"></div>
        <details id="adminIntegrationDetails" class="admin-integration">
          <summary>${icon('settings', 18)} Diagnóstico da integração</summary>
          <div class="admin-integration-body">
            <p>Na publicação, o Client ID deve ser definido no Render. Um valor antigo salvo no celular não substitui mais a configuração oficial.</p>
            <div class="origin-helper"><span>Origem autorizada no Google Cloud</span><code id="currentOriginValue"></code><button id="copyOriginButton" class="button button-outline" type="button">Copiar origem</button></div>
            ${runtimeConfig.googleClientId ? '<div class="integration-state ready">'+icon('check', 19)+'<span>Google Client ID carregado pelo Render.</span></div>' : '<label class="input-group light"><span>Google OAuth Client ID (somente teste local)</span><input id="googleClientId" type="text" placeholder="000000000.apps.googleusercontent.com" /></label>'}
            ${runtimeConfig.microsoftClientId ? '<div class="integration-state ready">'+icon('check', 19)+'<span>Microsoft Client ID carregado pelo Render.</span></div>' : '<label class="input-group light"><span>Microsoft Application Client ID (somente teste local)</span><input id="microsoftClientId" type="text" placeholder="00000000-0000-0000-0000-000000000000" /></label><label class="input-group light"><span>Microsoft Tenant</span><input id="microsoftTenantId" type="text" placeholder="common" /></label>'}
            ${(!runtimeConfig.googleClientId || !runtimeConfig.microsoftClientId) ? '<button id="saveIntegrationConfigButton" class="button button-navy" type="button">Salvar configuração local</button>' : ''}
          </div>
        </details>
      </article>
      <article class="panel-card"><div class="panel-heading"><div><h3>Fila de sincronização</h3><p>Envios pendentes são preservados até a internet voltar.</p></div>${icon('cloud', 22)}</div><div id="syncQueueSummary" class="sync-summary"></div><button id="retrySyncButton" class="button button-navy">Tentar sincronizar agora</button></article>
      <article class="panel-card"><div class="panel-heading"><div><h3>Como ativar a sincronização</h3><p>Crie uma credencial OAuth para aplicativo web no Google e uma aplicação SPA na Microsoft. Depois configure os Client IDs no Render e faça um novo deploy.</p></div>${icon('help', 22)}</div><p class="privacy-caption">O pacote inclui o guia <strong>CONFIGURAR-DRIVE-ONEDRIVE.md</strong> com o passo a passo e as URLs que precisam ser autorizadas.</p></article>
    </div>
  </section>`;
}

function helpViewTemplate() {
  return `<section class="view" data-view="help">
    <div class="section-intro"><div><span class="eyebrow">Central de ajuda</span><h2>Como usar o Ticket.</h2><p>Fluxo recomendado para obter uma leitura mais precisa.</p></div></div>
    <div class="help-grid">
      <article class="help-card"><span>1</span>${icon('camera', 26)}<h3>Fotografe por inteiro</h3><p>Guarde todo o comprovante ou fotografe o ambiente quando o relógio de ponto estiver indisponível.</p></article>
      <article class="help-card"><span>2</span>${icon('image', 26)}<h3>Escolha a aparência</h3><p>Salve a fotografia em cores ou aplique alto contraste para destacar a impressão térmica.</p></article>
      <article class="help-card"><span>3</span>${icon('edit', 26)}<h3>Informe DATA e HORA</h3><p>No comprovante, digite manualmente os dados exibidos. No registro de ambiente, o dispositivo preenche automaticamente.</p></article>
      <article class="help-card"><span>4</span>${icon('lock', 26)}<h3>Confirme e bloqueie</h3><p>Depois de salvar, a interface não permite alterar o registro.</p></article>
    </div>
    <article class="panel-card help-note"><h3>Sobre os registros</h3><p>O Ticket. guarda a fotografia completa como evidência. A data e a hora digitadas no comprovante são usadas somente para classificar a batida e calcular a jornada.</p></article>
  </section>`;
}

function bindShellEvents() {
  document.querySelectorAll('[data-view-target]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.viewTarget === 'scan') {
        state.captureMode = 'receipt';
        resetScan();
        renderScanModeCopy();
      }
      navigate(button.dataset.viewTarget);
    });
  });
  document.querySelector('#logoutButton')?.addEventListener('click', logout);
  document.querySelector('#mobileLogoutButton')?.addEventListener('click', logout);
  document.querySelector('#themeToggleButton')?.addEventListener('click', toggleTheme);
  document.querySelector('#mobileThemeButton')?.addEventListener('click', toggleTheme);
  document.querySelector('#mobileMenuButton')?.addEventListener('click', openMoreSheet);
  document.querySelector('#moreMenuButton')?.addEventListener('click', openMoreSheet);
  document.querySelector('#closeMoreSheet')?.addEventListener('click', closeMoreSheet);
  document.querySelector('#moreSheet')?.addEventListener('click', (event) => {
    if (event.target.id === 'moreSheet') closeMoreSheet();
  });
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => document.querySelector(`#${button.dataset.closeModal}`)?.classList.add('hidden'));
  });
  document.querySelector('#imageModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'imageModal') event.currentTarget.classList.add('hidden');
  });
  window.addEventListener('online', handleConnectivityChange);
  window.addEventListener('offline', handleConnectivityChange);
  bindDashboardEvents();
  bindScanEvents();
  bindHistoryEvents();
  bindCalendarEvents();
  bindReportEvents();
  bindSettingsEvents();
  bindStorageEvents();
  handleConnectivityChange();
}

function openMoreSheet() {
  document.querySelector('#moreSheet')?.classList.remove('hidden');
}

function closeMoreSheet() {
  document.querySelector('#moreSheet')?.classList.add('hidden');
}

async function logout() {
  stopCamera();
  if (dashboardClockTimer) {
    clearInterval(dashboardClockTimer);
    dashboardClockTimer = null;
  }
  await signOutAccount();
  state.profile = null;
  state.view = 'dashboard';
  state.authMode = 'login';
  renderLogin();
}

function applyTheme(theme) {
  state.theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = state.theme;


function effectiveGoogleClientId() {
  return String(runtimeConfig.googleClientId || state.cloud.googleClientId || '').trim();
}

function effectiveMicrosoftClientId() {
  return String(runtimeConfig.microsoftClientId || state.cloud.microsoftClientId || '').trim();
}

function effectiveMicrosoftTenantId() {
  return String(runtimeConfig.microsoftTenantId || state.cloud.microsoftTenantId || 'common').trim() || 'common';
}
  saveTheme(state.theme);
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  if (document.querySelector('.app-shell')) renderShell();
  else renderLogin();
}

function navigate(view, options = {}) {
  if (!viewTitles[view]) view = 'dashboard';
  if (options.stopCamera !== false && view !== 'scan') stopCamera();
  state.view = view;
  document.querySelectorAll('.view').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
  document.querySelectorAll('[data-view-target]').forEach((button) => button.classList.toggle('active', button.dataset.viewTarget === view));
  const [title, subtitle] = view === 'scan' && state.captureMode === 'environment'
    ? ['Registrar ambiente', 'Fotografia de presença com horário do dispositivo']
    : viewTitles[view];
  const titleElement = document.querySelector('#pageTitle');
  const subtitleElement = document.querySelector('#pageSubtitle');
  if (titleElement) titleElement.textContent = title;
  if (subtitleElement) subtitleElement.textContent = subtitle;
  closeMoreSheet();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'calendar') renderCalendar();
  if (view === 'history') renderHistory();
  if (view === 'reports') renderReports();
  if (view === 'storage') renderStorageSettings();
}

function handleConnectivityChange() {
  const badge = document.querySelector('#onlineBadge');
  if (!badge) return;
  badge.classList.toggle('offline', !navigator.onLine);
  badge.innerHTML = `${icon(navigator.onLine ? 'wifi' : 'alert', 16)} <span>${navigator.onLine ? 'Online' : 'Offline'}</span>`;
}

function punchTimes(record) {
  return (record?.punches || []).map((punch) => (typeof punch === 'string' ? punch : punch.time));
}

function partialWorkedMinutes(times = []) {
  const sorted = [...times].sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
  let total = 0;
  for (let index = 0; index + 1 < sorted.length; index += 2) {
    total += parseTimeToMinutes(sorted[index + 1]) - parseTimeToMinutes(sorted[index]);
  }
  return total;
}

function recordCells(record, requiredPunches = 4) {
  const times = punchTimes(record);
  if (requiredPunches === 2) return [times[0] || '—', '—', '—', times[1] || '—'];
  return [times[0] || '—', times[1] || '—', times[2] || '—', times[3] || '—'];
}

function emptyState(message, iconName = 'history') {
  return `<div class="empty-state">${icon(iconName, 34)}<strong>${escapeHtml(message)}</strong><span>Os novos registros aparecerão aqui.</span></div>`;
}

async function refreshData() {
  await migrateLegacyDataToCurrent();
  state.records = await listRecords();
  renderDashboard();
  renderHistory();
  renderCalendar();
  renderReports();
  await renderSyncQueue();
}

function renderDashboard() {
  const today = todayIso();
  const todayRecord = state.records.find((record) => record.date === today);
  const todaySchedule = todayRecord?.scheduleSnapshot || scheduleForDate(today, state.schedule);
  const times = punchTimes(todayRecord);
  const calc = todayRecord ? calculateRecord(todayRecord, state.schedule) : null;
  const currentPeriod = closingPeriodForDate(today, state.closingPeriod);
  const month = periodSummary(state.records, state.schedule, currentPeriod.startDate, currentPeriod.endDate);
  const required = Number(todaySchedule.requiredPunches || 4);
  const labels = labelsForPunches(required);
  const nextLabel = labels[times.length] || (times.length >= required ? 'Jornada concluída' : 'Entrada');

  const workedToday = calc?.workedMinutes ?? partialWorkedMinutes(times);
  const dayBalance = calc?.complete ? calc.balanceMinutes : null;
  document.querySelector('#dashMonthBalance').textContent = formatDuration(month.net, { signed: true, suffix: true });
  document.querySelector('#dashMonthBalance').className = month.net > 0 ? 'positive-text' : month.net < 0 ? 'negative-text' : '';
  const previousBalance = previousBalanceMinutes(today);
  const ticketBalance = calculatedTicketBalance(today);
  const totalBalance = previousBalance + ticketBalance;
  const previousElement = document.querySelector('#dashPreviousBalance');
  const ticketElement = document.querySelector('#dashTicketBalance');
  const totalElement = document.querySelector('#dashTotalBalance');
  previousElement.textContent = formatDuration(previousBalance, { signed: true, suffix: true });
  ticketElement.textContent = formatDuration(ticketBalance, { signed: true, suffix: true });
  totalElement.textContent = formatDuration(totalBalance, { signed: true, suffix: true });
  previousElement.className = previousBalance > 0 ? 'positive-text' : previousBalance < 0 ? 'negative-text' : '';
  ticketElement.className = ticketBalance > 0 ? 'positive-text' : ticketBalance < 0 ? 'negative-text' : '';
  totalElement.className = totalBalance > 0 ? 'positive-text' : totalBalance < 0 ? 'negative-text' : '';
  document.querySelector('#dashCurrentPeriod').textContent = formatPeriodLabel(currentPeriod);
  document.querySelector('#dashPunchCount').textContent = `${times.length} de ${required}`;
  document.querySelector('#dashNextPunch').textContent = times.length >= required ? 'Jornada registrada' : `Próxima: ${nextLabel}`;
  document.querySelector('#dashWorkedToday').textContent = formatDuration(workedToday, { suffix: true });
  document.querySelector('#dashExpectedToday').textContent = formatDuration(todaySchedule.expectedMinutes || 0, { suffix: true });
  const dayBalanceElement = document.querySelector('#dashDayBalance');
  dayBalanceElement.textContent = formatDuration(dayBalance, { signed: true, suffix: true });
  dayBalanceElement.className = dayBalance > 0 ? 'positive-text' : dayBalance < 0 ? 'negative-text' : '';
  document.querySelector('#dashDayBalanceCaption').textContent = calc?.complete ? 'Saldo final do dia' : times.length ? 'Aguardando todas as batidas' : 'Aguardando registros';

  const pill = document.querySelector('#todayStatusPill');
  if (!todaySchedule.active) {
    pill.textContent = 'Dia de folga';
    pill.className = 'status-pill status-neutral';
  } else if (calc?.complete) {
    pill.textContent = 'Jornada atual completa';
    pill.className = 'status-pill status-complete';
  } else if (times.length) {
    pill.textContent = `Registro ${times.length} de ${required}`;
    pill.className = 'status-pill status-warning';
  } else {
    pill.textContent = 'Aguardando registros';
    pill.className = 'status-pill status-neutral';
  }

  const latest = [...state.records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const body = document.querySelector('#recentRecordsBody');
  const mobile = document.querySelector('#recentMobileList');
  if (!latest.length) {
    body.innerHTML = `<tr><td colspan="7">${emptyState('Nenhum registro salvo')}</td></tr>`;
    mobile.innerHTML = emptyState('Nenhum registro salvo');
    return;
  }
  body.innerHTML = latest.map((record) => {
    const calculation = calculateRecord(record, state.schedule);
    const cells = recordCells(record, calculation.requiredPunches);
    return `<tr>
      <td><strong>${formatDateBr(record.date)}</strong></td>
      ${cells.map((value) => `<td>${value}</td>`).join('')}
      <td>${formatDuration(calculation.workedMinutes, { suffix: true })}</td>
      <td class="${calculation.balanceMinutes > 0 ? 'positive-text' : calculation.balanceMinutes < 0 ? 'negative-text' : ''}">${formatDuration(calculation.balanceMinutes, { signed: true, suffix: true })}</td>
    </tr>`;
  }).join('');
  mobile.innerHTML = latest.slice(0, 4).map((record) => {
    const calculation = calculateRecord(record, state.schedule);
    return `<button class="mini-record" data-open-record="${record.date}"><span><strong>${formatDateBr(record.date).slice(0, 5)}</strong><small>${punchTimes(record).join(' · ')}</small></span><b class="${calculation.balanceMinutes > 0 ? 'positive-text' : calculation.balanceMinutes < 0 ? 'negative-text' : ''}">${formatDuration(calculation.balanceMinutes, { signed: true, suffix: true })}</b></button>`;
  }).join('');
  document.querySelectorAll('[data-open-record]').forEach((button) => button.addEventListener('click', () => {
    state.selectedMonth = monthKey(button.dataset.openRecord);
    navigate('history');
    setTimeout(() => document.querySelector(`[data-record-date="${button.dataset.openRecord}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }));
}

function bindDashboardEvents() {
  document.querySelector('#registerReceiptButton')?.addEventListener('click', () => {
    state.captureMode = 'receipt';
    resetScan();
    renderScanModeCopy();
    navigate('scan', { stopCamera: false });
  });
  document.querySelector('#registerEnvironmentButton')?.addEventListener('click', () => {
    state.captureMode = 'environment';
    resetScan();
    renderScanModeCopy();
    navigate('scan', { stopCamera: false });
  });
}

function bindHistoryEvents() {
  document.querySelector('#historyMonthPicker')?.addEventListener('change', (event) => {
    state.selectedMonth = event.target.value || monthKey(todayIso());
    renderHistory();
    renderCalendar();
  });
}

function recordEvidenceIds(record) {
  const ids = new Set(record?.evidenceIds || []);
  for (const punch of record?.punches || []) {
    if (typeof punch !== 'string' && punch?.evidenceId) ids.add(punch.evidenceId);
  }
  return [...ids];
}

function historyCard(record, evidenceIds = recordEvidenceIds(record)) {
  const calculation = calculateRecord(record, state.schedule);
  const classified = classifyPunches(punchTimes(record), calculation.requiredPunches);
  const tone = recordStatusTone(calculation);
  const environmentRecords = record.environmentRecords || [];
  const environmentSummary = environmentRecords.length
    ? `<div class="environment-records"><strong>${icon('image', 16)} Registros de ambiente</strong>${environmentRecords.map((item) => `<span>${escapeHtml(item.time || '--:--')} · evidência auxiliar, sem efeito no cálculo</span>`).join('')}</div>`
    : '';
  const gallery = evidenceIds.length
    ? `<div class="evidence-gallery">${evidenceIds.map((evidenceId, index) => `<button class="evidence-chip" data-evidence-id="${evidenceId}">${icon('image', 16)} Foto ${index + 1}</button>`).join('')}</div>`
    : '<span class="evidence-missing">Nenhuma fotografia disponível</span>';
  return `<article class="history-card" data-record-date="${record.date}">
    <div class="history-card-header"><div><span>${formatLongDate(record.date)}</span><strong>${formatDateBr(record.date)}</strong></div><span class="status-chip tone-${tone}">${calculation.status}</span></div>
    <div class="punch-timeline">${classified.map((item) => `<div><i></i><span>${item.order}ª batida · ${escapeHtml(item.label)}</span><strong>${item.time}</strong></div>`).join('')}</div>
    <div class="history-totals"><div><span>Total trabalhado</span><strong>${formatDuration(calculation.workedMinutes, { suffix: true })}</strong></div><div><span>Saldo do dia</span><strong class="${calculation.balanceMinutes > 0 ? 'positive-text' : calculation.balanceMinutes < 0 ? 'negative-text' : ''}">${formatDuration(calculation.balanceMinutes, { signed: true, suffix: true })}</strong></div></div>
    ${environmentSummary}
    <div class="history-card-footer"><span>${icon('lock', 16)} Registro bloqueado</span></div>
    ${gallery}
  </article>`;
}

async function renderHistory() {
  const picker = document.querySelector('#historyMonthPicker');
  if (picker) picker.value = state.selectedMonth;
  const list = document.querySelector('#historyList');
  if (!list) return;
  const records = [...state.records].filter((record) => monthKey(record.date) === state.selectedMonth).sort((a, b) => b.date.localeCompare(a.date));
  if (!records.length) {
    list.innerHTML = emptyState(`Nenhum registro em ${monthName(state.selectedMonth)}`);
    return;
  }
  const cards = await Promise.all(records.map(async (record) => {
    const linked = recordEvidenceIds(record);
    const dated = await listEvidenceForDate(record.date).catch(() => []);
    const legacyDated = (await listEvidence().catch(() => []))
      .filter((item) => item.confirmedDate === record.date || item.date === record.date);
    const allIds = [...new Set([...linked, ...dated.map((item) => item.id), ...legacyDated.map((item) => item.id)])];
    return historyCard(record, allIds);
  }));
  list.innerHTML = cards.join('');
  list.querySelectorAll('[data-evidence-id]').forEach((button) => button.addEventListener('click', () => openEvidence(button.dataset.evidenceId)));
}

async function openEvidence(id) {
  const evidence = await getEvidence(id);
  if (!evidence?.blob) {
    toast('A imagem não está disponível neste dispositivo.', 'error');
    return;
  }
  const modal = document.querySelector('#imageModal');
  const image = document.querySelector('#modalEvidenceImage');
  const info = document.querySelector('#modalEvidenceInfo');
  const url = URL.createObjectURL(evidence.blob);
  image.src = url;
  image.onload = () => setTimeout(() => URL.revokeObjectURL(url), 1000);
  const typeLabel = evidence.captureType === 'environment' ? 'Registro de ambiente' : 'Comprovante de ponto';
  const styleLabel = evidence.imageDisplayMode === 'contrast' ? 'Alto contraste' : 'Em cores';
  info.innerHTML = `<span>${escapeHtml(typeLabel)} • ${formatDateBr(evidence.confirmedDate)} • ${escapeHtml((evidence.confirmedTimes || []).join(', '))}</span><span>${escapeHtml(styleLabel)} • ${evidence.cloud?.status === 'synced' ? `Sincronizado: ${escapeHtml(evidence.cloud.provider)}` : 'Cópia local'}</span>`;
  modal.classList.remove('hidden');
}

function bindCalendarEvents() {
  document.querySelector('#calendarPrev')?.addEventListener('click', () => shiftMonth(-1));
  document.querySelector('#calendarNext')?.addEventListener('click', () => shiftMonth(1));
}

function shiftMonth(delta) {
  const [year, month] = state.selectedMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  state.selectedMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const historyPicker = document.querySelector('#historyMonthPicker');
  if (historyPicker) historyPicker.value = state.selectedMonth;
  renderCalendar();
  renderHistory();
}

function renderCalendar() {
  const grid = document.querySelector('#calendarGrid');
  const title = document.querySelector('#calendarTitle');
  if (!grid || !title) return;
  const [year, month] = state.selectedMonth.split('-').map(Number);
  title.textContent = monthName(state.selectedMonth);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const previousDays = new Date(year, month - 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    let cellYear = year;
    let cellMonth = month;
    let day;
    let outside = false;
    if (index < firstDay) {
      day = previousDays - firstDay + index + 1;
      cellMonth -= 1;
      if (cellMonth === 0) { cellMonth = 12; cellYear -= 1; }
      outside = true;
    } else if (index >= firstDay + daysInMonth) {
      day = index - firstDay - daysInMonth + 1;
      cellMonth += 1;
      if (cellMonth === 13) { cellMonth = 1; cellYear += 1; }
      outside = true;
    } else {
      day = index - firstDay + 1;
    }
    const iso = `${cellYear}-${String(cellMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = state.records.find((item) => item.date === iso);
    const daySchedule = scheduleForDate(iso, state.schedule);
    let tone = daySchedule.active ? 'empty' : 'off';
    let label = daySchedule.active ? 'Sem registro' : 'Folga';
    if (record) {
      const calculation = calculateRecord(record, state.schedule);
      tone = recordStatusTone(calculation);
      label = calculation.status;
    }
    cells.push(`<button class="calendar-day ${outside ? 'outside' : ''} day-${tone} ${iso === todayIso() ? 'today' : ''}" data-calendar-date="${iso}" title="${label}"><span>${day}</span>${record ? '<i></i>' : ''}</button>`);
  }
  grid.innerHTML = cells.join('');
  grid.querySelectorAll('[data-calendar-date]').forEach((button) => button.addEventListener('click', () => {
    const record = state.records.find((item) => item.date === button.dataset.calendarDate);
    if (!record) {
      toast(`${formatDateBr(button.dataset.calendarDate)}: nenhum registro.`, 'info');
      return;
    }
    state.selectedMonth = monthKey(record.date);
    navigate('history');
    setTimeout(() => document.querySelector(`[data-record-date="${record.date}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }));
}

function bindReportEvents() {
  document.querySelector('#reportMonthPicker')?.addEventListener('change', (event) => {
    state.selectedReportMonth = event.target.value || monthKey(closingPeriodForDate(todayIso(), state.closingPeriod).startDate);
    renderReports();
  });
  document.querySelector('#exportBackupButton')?.addEventListener('click', async () => {
    try {
      const blob = await exportBackup();
      downloadBlob(blob, `ticket-backup-${todayIso()}.json`);
      toast('Backup leve exportado.', 'success');
    } catch (error) {
      toast(error.message || 'Falha ao exportar backup.', 'error');
    }
  });
}

function renderReports() {
  const picker = document.querySelector('#reportMonthPicker');
  if (picker) picker.value = state.selectedReportMonth;
  const period = closingPeriodForMonth(state.selectedReportMonth, state.closingPeriod);
  const summary = periodSummary(state.records, state.schedule, period.startDate, period.endDate);
  const positive = document.querySelector('#reportPositive');
  const negative = document.querySelector('#reportNegative');
  const net = document.querySelector('#reportNet');
  const previous = document.querySelector('#reportPreviousBalance');
  const total = document.querySelector('#reportTotalBalance');
  const pending = document.querySelector('#reportPending');
  const periodRange = document.querySelector('#reportPeriodRange');
  if (!positive) return;
  positive.textContent = formatDuration(summary.positive, { signed: true, suffix: true });
  negative.textContent = `-${formatDuration(summary.negative, { suffix: true })}`;
  net.textContent = formatDuration(summary.net, { signed: true, suffix: true });
  net.className = summary.net > 0 ? 'positive-text' : summary.net < 0 ? 'negative-text' : '';
  const previousValue = previousBalanceMinutes(period.endDate);
  const totalValue = totalAccumulatedBalance(period.endDate);
  previous.textContent = formatDuration(previousValue, { signed: true, suffix: true });
  previous.className = previousValue > 0 ? 'positive-text' : previousValue < 0 ? 'negative-text' : '';
  total.textContent = formatDuration(totalValue, { signed: true, suffix: true });
  total.className = totalValue > 0 ? 'positive-text' : totalValue < 0 ? 'negative-text' : '';
  pending.textContent = String(summary.pending);
  periodRange.textContent = formatPeriodLabel(period);

  const body = document.querySelector('#reportRecordsBody');
  const mobile = document.querySelector('#reportMobileList');
  if (!summary.records.length) {
    body.innerHTML = `<tr><td colspan="6">${emptyState('Nenhum registro neste período')}</td></tr>`;
    mobile.innerHTML = emptyState('Nenhum registro neste período');
    return;
  }
  body.innerHTML = summary.records.map((record) => {
    const { calculation } = record;
    return `<tr><td><strong>${formatDateBr(record.date)}</strong></td><td>${punchTimes(record).join(' • ')}</td><td>${formatDuration(calculation.workedMinutes, { suffix: true })}</td><td>${formatDuration(calculation.expectedMinutes, { suffix: true })}</td><td class="${calculation.balanceMinutes > 0 ? 'positive-text' : calculation.balanceMinutes < 0 ? 'negative-text' : ''}">${formatDuration(calculation.balanceMinutes, { signed: true, suffix: true })}</td><td><span class="status-chip tone-${recordStatusTone(calculation)}">${calculation.status}</span></td></tr>`;
  }).join('');
  mobile.innerHTML = summary.records.map(historyCard).join('');
  mobile.querySelectorAll('[data-evidence-id]').forEach((button) => button.addEventListener('click', () => openEvidence(button.dataset.evidenceId)));
}

function renderProfileSummary() {
  const target = document.querySelector('#profileDetails');
  if (!target || !state.profile) return;
  target.innerHTML = `<div><dt>Nome completo</dt><dd>${escapeHtml(state.profile.fullName)}</dd></div><div><dt>E-mail</dt><dd>${escapeHtml(state.profile.email || 'Não informado')}</dd></div><div><dt>CPF</dt><dd>${escapeHtml(state.profile.cpfMasked)}</dd></div><div><dt>Status</dt><dd><span class="status-chip tone-complete">${icon('lock', 14)} Bloqueado</span></dd></div>`;
}

function bindSettingsEvents() {
  document.querySelector('#saveScheduleButton')?.addEventListener('click', saveScheduleFromEditor);
  document.querySelector('#balanceSettingsForm')?.addEventListener('submit', saveBalanceSettingsFromForm);
  document.querySelector('#closingPeriodForm')?.addEventListener('submit', saveClosingPeriodFromForm);
  document.querySelector('#balanceType')?.addEventListener('change', updateBalanceInputState);
  document.querySelector('#closingMode')?.addEventListener('change', handleClosingModeChange);
  document.querySelector('#closingStartDay')?.addEventListener('change', handleClosingStartDayChange);
  document.querySelector('#closingEndDay')?.addEventListener('change', updateClosingPeriodPreviewFromForm);
  document.querySelector('#settingsLogoutButton')?.addEventListener('click', logout);
  document.querySelector('#resetDataButton')?.addEventListener('click', async () => {
    const confirmation = window.prompt('Digite APAGAR para excluir definitivamente os dados deste navegador.');
    if (confirmation !== 'APAGAR') return;
    try {
      setBusy(true, 'Apagando dados locais…');
      await clearAllData({ removeAccount: true });
      await signOutAccount();
      state.profile = null;
      state.records = [];
      state.schedule = cloneDefaultSchedule();
      renderLogin();
      toast('Dados locais apagados.', 'success');
    } catch (error) {
      toast(error.message || 'Não foi possível apagar os dados.', 'error');
    } finally {
      setBusy(false);
    }
  });
  document.querySelector('#installPwaButton')?.addEventListener('click', async () => {
    if (!state.installPrompt) {
      toast('Use o menu do navegador e escolha “Adicionar à tela inicial”.', 'info');
      return;
    }
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    updateInstallButton();
  });
}

function updateBalanceInputState() {
  const type = document.querySelector('#balanceType')?.value || 'none';
  const disabled = type === 'none';
  ['balanceHours', 'balanceMinutes'].forEach((id) => {
    const field = document.querySelector(`#${id}`);
    if (field) field.disabled = disabled;
  });
}

function renderBalanceSettings() {
  const historyTarget = document.querySelector('#balanceHistoryList');
  if (!historyTarget) return;
  updateBalanceInputState();
  const history = [...(state.balanceSettings?.history || [])].sort((a, b) => String(b.changedAt).localeCompare(String(a.changedAt)));
  if (!history.length) {
    historyTarget.innerHTML = '<div class="empty-inline">Nenhuma atualização de saldo registrada.</div>';
    return;
  }
  historyTarget.innerHTML = history.slice(0, 12).map((entry) => {
    const changedAt = new Date(entry.changedAt);
    const dateTime = Number.isNaN(changedAt.getTime()) ? 'Data não informada' : `${changedAt.toLocaleDateString('pt-BR')} às ${changedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const previous = Number(entry.previousMinutes || 0);
    const current = Number(entry.minutes || 0);
    return `<div class="balance-history-item"><span>${icon('calendar', 16)}</span><div><small>${escapeHtml(dateTime)}</small><strong>Saldo alterado de ${formatDuration(previous, { signed: true, suffix: true })} para <b class="${current > 0 ? 'positive-text' : current < 0 ? 'negative-text' : ''}">${formatDuration(current, { signed: true, suffix: true })}</b></strong>${entry.note ? `<em>${escapeHtml(entry.note)}</em>` : ''}</div></div>`;
  }).join('');
}

async function saveBalanceSettingsFromForm(event) {
  event.preventDefault();
  const type = document.querySelector('#balanceType')?.value || 'none';
  const hours = Math.max(0, Number.parseInt(document.querySelector('#balanceHours')?.value || '0', 10) || 0);
  const minutesPart = Number.parseInt(document.querySelector('#balanceMinutes')?.value || '0', 10) || 0;
  const referenceDate = document.querySelector('#balanceReferenceDate')?.value || todayIso();
  const note = document.querySelector('#balanceNote')?.value?.trim() || '';
  if (minutesPart < 0 || minutesPart > 59) {
    toast('Os minutos devem estar entre 0 e 59.', 'error');
    return;
  }
  let minutes = hours * 60 + minutesPart;
  if (type === 'negative') minutes *= -1;
  if (type === 'none') minutes = 0;
  const previousMinutes = Number(state.balanceSettings?.minutes || 0);
  const confirmed = window.confirm(`Confirmar saldo anterior de ${formatDuration(minutes, { signed: true, suffix: true })}, válido até ${formatDateBr(referenceDate)}?\n\nAs batidas e os cálculos diários já registrados não serão alterados.`);
  if (!confirmed) return;
  const changedAt = new Date().toISOString();
  state.balanceSettings = {
    minutes,
    type,
    referenceDate,
    note,
    updatedAt: changedAt,
    history: [
      ...(state.balanceSettings?.history || []),
      { id: uuid(), previousMinutes, minutes, referenceDate, note, changedAt },
    ],
  };
  saveBalanceSettings(state.balanceSettings);
  renderBalanceSettings();
  renderDashboard();
  renderReports();
  toast('Saldo anterior salvo sem alterar os registros de ponto.', 'success', 6000);
}

function closingDraftFromForm() {
  const mode = document.querySelector('#closingMode')?.value === 'custom' ? 'custom' : 'calendar';
  return normalizeClosingPeriodSettings({
    mode,
    startDay: Number(document.querySelector('#closingStartDay')?.value || 1),
    endDay: Number(document.querySelector('#closingEndDay')?.value || 31),
  });
}

function updateClosingPeriodPreviewFromForm() {
  const draft = closingDraftFromForm();
  const current = closingPeriodForDate(todayIso(), draft);
  const next = nextClosingPeriod(current, draft);
  const currentTarget = document.querySelector('#currentPeriodPreview');
  const nextTarget = document.querySelector('#nextPeriodPreview');
  if (currentTarget) currentTarget.textContent = formatPeriodLabel(current);
  if (nextTarget) nextTarget.textContent = formatPeriodLabel(next);
}

function handleClosingModeChange() {
  const mode = document.querySelector('#closingMode')?.value || 'calendar';
  const start = document.querySelector('#closingStartDay');
  const end = document.querySelector('#closingEndDay');
  if (!start || !end) return;
  if (mode === 'calendar') {
    start.value = '1';
    end.value = '31';
  } else if (start.value === '1' && end.value === '31') {
    start.value = '16';
    end.value = '15';
  }
  start.disabled = mode === 'calendar';
  end.disabled = mode === 'calendar';
  updateClosingPeriodPreviewFromForm();
}

function handleClosingStartDayChange() {
  const start = Number(document.querySelector('#closingStartDay')?.value || 1);
  const end = document.querySelector('#closingEndDay');
  if (end) end.value = String(start === 1 ? 31 : start - 1);
  updateClosingPeriodPreviewFromForm();
}

function renderClosingPeriodSettings() {
  const mode = document.querySelector('#closingMode');
  const start = document.querySelector('#closingStartDay');
  const end = document.querySelector('#closingEndDay');
  if (!mode || !start || !end) return;
  const closing = normalizeClosingPeriodSettings(state.closingPeriod);
  mode.value = closing.mode;
  start.value = String(closing.startDay);
  end.value = String(closing.endDay);
  start.disabled = closing.mode === 'calendar';
  end.disabled = closing.mode === 'calendar';
  updateClosingPeriodPreviewFromForm();
}

function saveClosingPeriodFromForm(event) {
  event.preventDefault();
  const draft = closingDraftFromForm();
  if (!isContinuousClosingPeriod(draft)) {
    const expectedEnd = draft.startDay === 1 ? 31 : draft.startDay - 1;
    toast(`Para manter ciclos mensais contínuos, use o dia final ${expectedEnd} para um ciclo iniciado no dia ${draft.startDay}.`, 'error', 7000);
    return;
  }
  state.closingPeriod = { ...draft, updatedAt: new Date().toISOString() };
  saveClosingPeriodSettings(state.closingPeriod);
  const current = closingPeriodForDate(todayIso(), state.closingPeriod);
  state.selectedReportMonth = monthKey(current.startDate);
  renderClosingPeriodSettings();
  renderDashboard();
  renderReports();
  toast(`Período mensal salvo: ${formatPeriodLabel(current)}.`, 'success', 6000);
}

function renderScheduleEditor() {
  const editor = document.querySelector('#scheduleEditor');
  if (!editor) return;
  editor.innerHTML = WEEKDAYS.map((day) => {
    const item = state.schedule[day.key] || DEFAULT_SCHEDULE[day.key];
    const expectedHours = Math.floor(Number(item.expectedMinutes || 0) / 60);
    const expectedMinutes = Number(item.expectedMinutes || 0) % 60;
    return `<div class="schedule-row" data-schedule-day="${day.key}">
      <label class="day-toggle"><input type="checkbox" data-field="active" ${item.active ? 'checked' : ''}/><span></span><strong>${day.short}</strong><small>${day.long}</small></label>
      <label><span>Entrada</span><input type="time" data-field="start" value="${item.start}" ${item.active ? '' : 'disabled'} /></label>
      <label><span>Saída</span><input type="time" data-field="end" value="${item.end}" ${item.active ? '' : 'disabled'} /></label>
      <label><span>Carga</span><input type="time" data-field="expected" value="${String(expectedHours).padStart(2, '0')}:${String(expectedMinutes).padStart(2, '0')}" ${item.active ? '' : 'disabled'} /></label>
      <label><span>Batidas</span><select data-field="requiredPunches" ${item.active ? '' : 'disabled'}><option value="4" ${Number(item.requiredPunches) === 4 ? 'selected' : ''}>4</option><option value="2" ${Number(item.requiredPunches) === 2 ? 'selected' : ''}>2</option></select></label>
    </div>`;
  }).join('');
  editor.querySelectorAll('[data-field="active"]').forEach((checkbox) => checkbox.addEventListener('change', () => {
    const row = checkbox.closest('.schedule-row');
    row.querySelectorAll('input:not([data-field="active"]), select').forEach((field) => { field.disabled = !checkbox.checked; });
  }));
}

function saveScheduleFromEditor() {
  const updated = {};
  document.querySelectorAll('.schedule-row').forEach((row) => {
    const get = (field) => row.querySelector(`[data-field="${field}"]`);
    const expected = get('expected').value || '00:00';
    const [hours, minutes] = expected.split(':').map(Number);
    updated[row.dataset.scheduleDay] = {
      active: get('active').checked,
      start: get('start').value || '08:00',
      end: get('end').value || '18:00',
      expectedMinutes: hours * 60 + minutes,
      requiredPunches: Number(get('requiredPunches').value || 4),
    };
  });
  state.schedule = updated;
  saveSchedule(updated);
  refreshData();
  toast('Jornada semanal salva. Registros antigos permaneceram inalterados.', 'success');
}

function updateInstallButton() {
  const button = document.querySelector('#installPwaButton');
  if (!button) return;
  button.disabled = !state.installPrompt;
  button.textContent = state.installPrompt ? 'Instalar Ticket. neste dispositivo' : 'Instalação pelo menu do navegador';
}

function bindStorageEvents() {
  document.querySelectorAll('[data-provider]').forEach((button) => button.addEventListener('click', () => {
    const provider = button.dataset.provider;
    if (provider === 'google' && !effectiveGoogleClientId()) {
      document.querySelector('#adminIntegrationDetails')?.setAttribute('open', '');
      toast('Configure primeiro o Google OAuth Client ID. O guia está no pacote do projeto.', 'info', 6500);
      return;
    }
    if (provider === 'onedrive' && !effectiveMicrosoftClientId()) {
      document.querySelector('#adminIntegrationDetails')?.setAttribute('open', '');
      toast('Configure primeiro o Microsoft Application Client ID. O guia está no pacote do projeto.', 'info', 6500);
      return;
    }
    state.cloud.provider = provider;
    saveCloudSettings(state.cloud);
    renderStorageSettings();
    toast(`Armazenamento definido como ${provider === 'local' ? 'dispositivo' : provider === 'google' ? 'Google Drive' : 'OneDrive'}.`, 'success');
  }));
  document.querySelector('#googleClientId')?.addEventListener('change', saveCloudFormFields);
  document.querySelector('#microsoftClientId')?.addEventListener('change', saveCloudFormFields);
  document.querySelector('#microsoftTenantId')?.addEventListener('change', saveCloudFormFields);
  document.querySelector('#keepLocalCopy')?.addEventListener('change', saveCloudFormFields);
  document.querySelector('#cloudOcrEnabled')?.addEventListener('change', saveCloudFormFields);
  document.querySelector('#copyOriginButton')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast('Origem copiada.', 'success');
    } catch {
      toast(`Copie esta origem: ${window.location.origin}`, 'info', 6500);
    }
  });
  document.querySelector('#saveIntegrationConfigButton')?.addEventListener('click', () => {
    saveCloudFormFields();
    toast('Configuração técnica salva nesta instalação.', 'success');
    renderShell();
  });
  document.querySelector('#connectGoogleButton')?.addEventListener('click', async () => {
    saveCloudFormFields();
    if (!effectiveGoogleClientId()) {
      document.querySelector('#adminIntegrationDetails')?.setAttribute('open', '');
      toast('A integração do Google Drive precisa ser configurada uma única vez pelo administrador.', 'info', 6500);
      return;
    }
    try {
      setBusy(true, 'Conectando ao Google Drive…');
      await connectGoogleDrive(effectiveGoogleClientId());
      state.cloud.googleConnected = true;
      saveCloudSettings(state.cloud);
      renderStorageSettings();
      toast('Google Drive conectado.', 'success');
    } catch (error) {
      toast(error.message || 'Falha ao conectar o Google Drive.', 'error', 6500);
    } finally {
      setBusy(false);
    }
  });
  document.querySelector('#connectOneDriveButton')?.addEventListener('click', async () => {
    saveCloudFormFields();
    if (!effectiveMicrosoftClientId()) {
      document.querySelector('#adminIntegrationDetails')?.setAttribute('open', '');
      toast('A integração do OneDrive precisa ser configurada uma única vez pelo administrador.', 'info', 6500);
      return;
    }
    try {
      setBusy(true, 'Conectando ao OneDrive…');
      await connectOneDrive(effectiveMicrosoftClientId(), effectiveMicrosoftTenantId());
      state.cloud.microsoftConnected = true;
      saveCloudSettings(state.cloud);
      renderStorageSettings();
      toast('OneDrive conectado.', 'success');
    } catch (error) {
      toast(error.message || 'Falha ao conectar o OneDrive.', 'error', 6500);
    } finally {
      setBusy(false);
    }
  });
  document.querySelector('#retrySyncButton')?.addEventListener('click', retryPendingSync);
}

function saveCloudFormFields() {
  const google = document.querySelector('#googleClientId');
  const microsoft = document.querySelector('#microsoftClientId');
  const tenant = document.querySelector('#microsoftTenantId');
  const local = document.querySelector('#keepLocalCopy');
  const cloudOcr = document.querySelector('#cloudOcrEnabled');
  if (google && !runtimeConfig.googleClientId) state.cloud.googleClientId = google.value.trim();
  if (microsoft && !runtimeConfig.microsoftClientId) state.cloud.microsoftClientId = microsoft.value.trim();
  if (tenant && !runtimeConfig.microsoftTenantId) state.cloud.microsoftTenantId = tenant.value.trim() || 'common';
  if (local) state.cloud.keepLocalCopy = local.checked;
  if (cloudOcr) state.cloud.cloudOcrEnabled = cloudOcr.checked;
  saveCloudSettings(state.cloud);
}

function renderStorageSettings() {
  document.querySelectorAll('[data-provider]').forEach((button) => button.classList.toggle('selected', button.dataset.provider === state.cloud.provider));
  const googleConfig = document.querySelector('#googleConfig');
  const microsoftConfig = document.querySelector('#microsoftConfig');
  if (!googleConfig || !microsoftConfig) return;
  googleConfig.classList.toggle('active', state.cloud.provider === 'google');
  microsoftConfig.classList.toggle('active', state.cloud.provider === 'onedrive');
  const googleInput = document.querySelector('#googleClientId');
  if (googleInput) googleInput.value = effectiveGoogleClientId();
  const microsoftInput = document.querySelector('#microsoftClientId');
  if (microsoftInput) microsoftInput.value = effectiveMicrosoftClientId();
  const tenantInput = document.querySelector('#microsoftTenantId');
  if (tenantInput) tenantInput.value = effectiveMicrosoftTenantId();
  document.querySelector('#keepLocalCopy').checked = state.cloud.keepLocalCopy !== false;
  const cloudOcrToggle = document.querySelector('#cloudOcrEnabled');
  if (cloudOcrToggle) cloudOcrToggle.checked = state.cloud.cloudOcrEnabled !== false;
  const originValue = document.querySelector('#currentOriginValue');
  if (originValue) originValue.textContent = window.location.origin;
  const cloudStatus = document.querySelector('#cloudStatus');
  if (state.cloud.provider === 'local') {
    cloudStatus.innerHTML = `${icon('storage', 18)} <span>As imagens serão mantidas somente neste navegador.</span>`;
  } else if (state.cloud.provider === 'google') {
    cloudStatus.innerHTML = `${icon('drive', 18)} <span>${state.cloud.googleConnected ? 'Google Drive autorizado nesta sessão.' : 'Conecte a conta antes do primeiro envio.'}</span>`;
  } else {
    cloudStatus.innerHTML = `${icon('cloud', 18)} <span>${state.cloud.microsoftConnected ? 'OneDrive autorizado.' : 'Conecte a conta antes do primeiro envio.'}</span>`;
  }
  renderSyncQueue();
}

async function renderSyncQueue() {
  const target = document.querySelector('#syncQueueSummary');
  if (!target) return;
  const jobs = await listSyncJobs();
  const pending = jobs.filter((job) => job.status !== 'synced');
  const failed = pending.filter((job) => job.status === 'failed');
  target.innerHTML = `<div><span>Pendentes</span><strong>${pending.length}</strong></div><div><span>Com erro</span><strong>${failed.length}</strong></div><div><span>Provedor atual</span><strong>${state.cloud.provider === 'local' ? 'Local' : state.cloud.provider === 'google' ? 'Drive' : 'OneDrive'}</strong></div>`;
  const button = document.querySelector('#retrySyncButton');
  if (button) button.disabled = !pending.length || state.cloud.provider === 'local';
}

async function retryPendingSync() {
  const jobs = (await listSyncJobs()).filter((job) => job.status !== 'synced');
  if (!jobs.length) {
    toast('Não há imagens pendentes.', 'info');
    return;
  }
  if (state.cloud.provider === 'local') {
    toast('Selecione Google Drive ou OneDrive.', 'error');
    return;
  }
  setBusy(true, 'Sincronizando imagens pendentes…');
  let success = 0;
  for (const job of jobs) {
    try {
      const evidence = await getEvidence(job.evidenceId);
      if (!evidence?.blob) throw new Error('Imagem local não encontrada.');
      const cloud = await uploadEvidenceToCloud({ settings: state.cloud, blob: evidence.blob, filename: job.filename, date: evidence.confirmedDate });
      evidence.cloud = cloud;
      await saveEvidence(evidence);
      await updateSyncJob({ ...job, status: 'synced', syncedAt: new Date().toISOString(), error: '' });
      success += 1;
    } catch (error) {
      await updateSyncJob({ ...job, status: 'failed', attempts: Number(job.attempts || 0) + 1, error: error.message, updatedAt: new Date().toISOString() });
    }
  }
  setBusy(false);
  await renderSyncQueue();
  toast(`${success} imagem(ns) sincronizada(s).`, success ? 'success' : 'error');
}

function bindScanEvents() {
  document.querySelector('#scanBackButton')?.addEventListener('click', () => navigate('dashboard'));
  document.querySelector('#openCameraButton')?.addEventListener('click', openCamera);
  document.querySelector('#captureButton')?.addEventListener('click', captureOrOpenCamera);
  document.querySelector('#chooseImageButton')?.addEventListener('click', () => document.querySelector('#imageFileInput').click());
  document.querySelector('#imageFileInput')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (file) await setSelectedImage(file, file.name);
    event.target.value = '';
  });
  document.querySelector('#rotateImageButton')?.addEventListener('click', rotateSelectedImage);
  document.querySelectorAll('[data-image-style]').forEach((button) => button.addEventListener('click', () => applyImageStyle(button.dataset.imageStyle)));
  document.querySelector('#continueRegistrationButton')?.addEventListener('click', () => {
    prepareManualReview();
    document.querySelector('#reviewCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelector('#clearScanButton')?.addEventListener('click', resetScan);
  document.querySelector('#cancelReviewButton')?.addEventListener('click', () => {
    document.querySelector('#reviewCard').classList.add('hidden');
    document.querySelector('#recordLockConfirm').checked = false;
  });
  document.querySelector('#reviewForm')?.addEventListener('submit', saveConfirmedRecord);
  document.querySelector('#confirmedDateField')?.addEventListener('input', updateReviewClassification);
  document.querySelector('#confirmedTimesField')?.addEventListener('input', updateReviewClassification);
}

async function openCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('A câmera direta não está disponível. Use “Escolher imagem”.');
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    state.cameraStream = stream;
    const video = document.querySelector('#cameraVideo');
    video.srcObject = stream;
    await video.play();
    video.classList.remove('hidden');
    document.querySelector('#scanPreviewImage').classList.add('hidden');
    document.querySelector('#scanPlaceholder').classList.add('hidden');
    document.querySelector('#qualityBar').innerHTML = '<span class="quality-dot good"></span><strong>Câmera pronta</strong><small>Centralize o comprovante e toque no círculo.</small>';
  } catch (error) {
    toast(error.message || 'Não foi possível abrir a câmera.', 'error');
  }
}

function stopCamera() {
  state.cameraStream?.getTracks().forEach((track) => track.stop());
  state.cameraStream = null;
  const video = document.querySelector('#cameraVideo');
  if (video) {
    video.pause?.();
    video.srcObject = null;
    video.classList.add('hidden');
  }
}

async function captureOrOpenCamera() {
  if (!state.cameraStream) {
    await openCamera();
    return;
  }
  const video = document.querySelector('#cameraVideo');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1920;
  canvas.height = video.videoHeight || 1080;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
  stopCamera();
  if (blob) await setSelectedImage(blob, `ticket-${Date.now()}.jpg`);
}

async function setSelectedImage(blob, name = 'comprovante.jpg') {
  try {
    if (!blob.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');
    const hash = await hashBlob(blob);
    const duplicate = await findEvidenceByHash(hash);
    if (duplicate) {
      const linked = await isEvidenceLinked(duplicate.id);
      if (linked) throw new Error(`Esta fotografia já foi registrada em ${formatDateBr(duplicate.confirmedDate)}.`);
      // Corrige automaticamente resíduos de uma gravação antiga interrompida:
      // a imagem existia no banco, mas não estava vinculada a nenhum registro.
      await deleteEvidence(duplicate.id);
      toast('Foi encontrado um comprovante antigo sem vínculo. O sistema reparou o registro e permitirá salvá-lo novamente.', 'info', 6500);
    }
    if (state.selectedImageUrl) URL.revokeObjectURL(state.selectedImageUrl);
    state.sourceImage = blob;
    state.selectedImage = blob;
    state.selectedImageName = name;
    state.imageDisplayMode = 'color';
    const capturedNow = new Date();
    state.captureDate = todayIso();
    state.captureTime = `${String(capturedNow.getHours()).padStart(2, '0')}:${String(capturedNow.getMinutes()).padStart(2, '0')}`;
    state.selectedImageUrl = URL.createObjectURL(blob);
    state.imageQuality = await analyzeImageQuality(blob);
    state.ocrResult = null;
    const image = document.querySelector('#scanPreviewImage');
    image.src = state.selectedImageUrl;
    image.classList.remove('hidden');
    document.querySelector('#scanPlaceholder').classList.add('hidden');
    document.querySelector('#cameraVideo').classList.add('hidden');
    document.querySelector('#continueRegistrationButton').disabled = false;
    document.querySelector('#imageStyleControls').classList.remove('hidden');
    document.querySelectorAll('[data-image-style]').forEach((button) => button.classList.toggle('active', button.dataset.imageStyle === 'color'));
    document.querySelector('#reviewCard').classList.add('hidden');
    renderQualityBar();
  } catch (error) {
    toast(error.message || 'Não foi possível usar a imagem.', 'error');
  }
}

function renderQualityBar() {
  const bar = document.querySelector('#qualityBar');
  if (!bar || !state.imageQuality) return;
  const quality = state.imageQuality;
  const tone = quality.score >= 78 ? 'good' : quality.score >= 55 ? 'medium' : 'bad';
  bar.innerHTML = `<span class="quality-dot ${tone}"></span><strong>Qualidade: ${quality.label}</strong><small>${quality.issues.length ? escapeHtml(quality.issues.join(' • ')) : `${quality.width} × ${quality.height}px • Documento legível`}</small>`;
}

async function rotateSelectedImage() {
  if (!state.selectedImage) {
    toast('Selecione uma imagem primeiro.', 'info');
    return;
  }
  setBusy(true, 'Girando imagem…');
  try {
    const rotated = await rotateImage(state.sourceImage || state.selectedImage, 90);
    await setSelectedImage(rotated, state.selectedImageName);
  } finally {
    setBusy(false);
  }
}

async function applyImageStyle(mode) {
  if (!state.sourceImage || state.busy) return;
  const normalized = mode === 'contrast' ? 'contrast' : 'color';
  setBusy(true, normalized === 'contrast' ? 'Aplicando alto contraste…' : 'Restaurando cores…');
  try {
    state.imageDisplayMode = normalized;
    state.selectedImage = normalized === 'contrast'
      ? await makeHighContrastImage(state.sourceImage)
      : state.sourceImage;
    if (state.selectedImageUrl) URL.revokeObjectURL(state.selectedImageUrl);
    state.selectedImageUrl = URL.createObjectURL(state.selectedImage);
    const image = document.querySelector('#scanPreviewImage');
    image.src = state.selectedImageUrl;
    state.imageQuality = await analyzeImageQuality(state.selectedImage);
    renderQualityBar();
    document.querySelectorAll('[data-image-style]').forEach((button) => button.classList.toggle('active', button.dataset.imageStyle === normalized));
    document.querySelector('#reviewCard')?.classList.add('hidden');
    toast(normalized === 'contrast' ? 'Alto contraste aplicado à fotografia.' : 'Fotografia restaurada em cores.', 'success');
  } catch (error) {
    toast(error.message || 'Não foi possível ajustar a imagem.', 'error');
  } finally {
    setBusy(false);
  }
}

function currentLocalTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function prepareManualReview() {
  if (!state.selectedImage) {
    toast('Selecione ou fotografe uma imagem primeiro.', 'info');
    return;
  }
  const isEnvironment = state.captureMode === 'environment';
  const dateField = document.querySelector('#confirmedDateField');
  const timeField = document.querySelector('#confirmedTimesField');
  if (dateField) dateField.value = isEnvironment ? (state.captureDate || todayIso()) : (dateField.value || todayIso());
  if (timeField) timeField.value = isEnvironment ? (state.captureTime || currentLocalTime()) : timeField.value;
  document.querySelector('#recordLockConfirm').checked = false;
  document.querySelector('#reviewCard').classList.remove('hidden');
  updateReviewClassification();
}

function renderScanModeCopy() {
  const scanView = document.querySelector('[data-view="scan"]');
  if (!scanView) return;
  const replacement = document.createElement('template');
  replacement.innerHTML = scanViewTemplate().trim();
  scanView.replaceWith(replacement.content.firstElementChild);
  bindScanEvents();
}

function parseConfirmedTimes() {
  return [...new Set(document.querySelector('#confirmedTimesField').value.split(/[\n,;]+/).map(normalizeTime).filter(Boolean))]
    .sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
}

async function updateReviewClassification() {
  const date = document.querySelector('#confirmedDateField')?.value;
  const times = parseConfirmedTimes();
  const preview = document.querySelector('#classificationPreview');
  if (!preview || !date) return;
  if (state.captureMode === 'environment') {
    preview.innerHTML = times.length
      ? `<div><span>${icon('image', 16)}</span><strong>${times[0]}</strong><small>Evidência auxiliar de presença — não contabiliza jornada</small></div>`
      : '<p>Horário do ambiente indisponível.</p>';
    return;
  }
  const existing = await getRecord(date);
  const daySchedule = existing?.scheduleSnapshot || scheduleForDate(date, state.schedule);
  const merged = mergePunches(punchTimes(existing), times);
  const classified = classifyPunches(merged, daySchedule.requiredPunches);
  preview.innerHTML = classified.length
    ? classified.map((item) => `<div><span>${item.order}ª</span><strong>${item.time}</strong><small>${escapeHtml(item.label)}</small></div>`).join('')
    : '<p>Nenhum horário válido.</p>';
}

async function saveConfirmedRecord(event) {
  event.preventDefault();
  if (!state.selectedImage) return;
  const date = document.querySelector('#confirmedDateField').value;
  const confirmedTimes = parseConfirmedTimes();
  if (!date) {
    toast('Informe a data do comprovante.', 'error');
    return;
  }
  if (!confirmedTimes.length) {
    toast('Informe pelo menos um horário válido.', 'error');
    return;
  }

  setBusy(true, 'Salvando fotografia e registro…');
  try {
    const existing = await getRecord(date);
    const daySchedule = existing?.scheduleSnapshot || scheduleForDate(date, state.schedule);
    if (!daySchedule.active) {
      const proceed = window.confirm('Este dia está configurado como folga. Deseja registrar o comprovante mesmo assim?');
      if (!proceed) return;
    }
    const captureType = state.captureMode === 'environment' ? 'environment' : 'receipt';
    const existingTimes = punchTimes(existing);
    const requiredPunches = Number(daySchedule.requiredPunches || 4);
    let newTimes = [];
    if (captureType === 'receipt') {
      const mergedTimes = mergePunches(existingTimes, confirmedTimes);
      if (mergedTimes.length > requiredPunches) {
        throw new Error(`Este dia aceita ${requiredPunches} batidas. O registro resultaria em ${mergedTimes.length}.`);
      }
      newTimes = confirmedTimes.filter((time) => !existingTimes.includes(time));
      if (!newTimes.length) throw new Error('Todos os horários informados já existem nesse dia.');
    }

    const evidenceId = uuid();
    const sourceHash = await hashBlob(state.sourceImage || state.selectedImage);
    const imageHash = await hashBlob(state.selectedImage);
    const thumbnail = await makeThumbnail(state.selectedImage);
    const now = new Date().toISOString();

    const evidence = {
      id: evidenceId,
      date,
      hash: sourceHash,
      renderedHash: imageHash,
      blob: state.selectedImage,
      thumbnail,
      fileName: state.selectedImageName,
      mimeType: state.selectedImage.type,
      confirmedDate: date,
      confirmedTimes,
      captureType,
      imageDisplayMode: state.imageDisplayMode,
      source: captureType === 'environment' ? 'device-timestamp' : 'manual-from-photo',
      quality: state.imageQuality,
      manualCorrection: false,
      createdAt: now,
      lockedAt: now,
      immutable: true,
      cloud: { provider: state.cloud.provider, status: state.cloud.provider === 'local' ? 'local' : 'pending' },
    };

    const incomingPunches = captureType === 'receipt' ? newTimes.map((time) => ({
      id: uuid(),
      time,
      originalTime: null,
      evidenceId,
      captureType,
      manualCorrection: false,
      capturedAt: now,
      lockedAt: now,
      immutable: true,
    })) : [];
    const existingPunches = (existing?.punches || []).map((punch) => (typeof punch === 'string'
      ? { id: uuid(), time: punch, originalTime: punch, evidenceId: null, manualCorrection: false, immutable: true }
      : punch));
    const punches = [...existingPunches, ...incomingPunches].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
    const environmentRecords = captureType === 'environment'
      ? [...(existing?.environmentRecords || []), {
        id: uuid(),
        evidenceId,
        time: confirmedTimes[0],
        capturedAt: now,
        lockedAt: now,
        immutable: true,
      }]
      : [...(existing?.environmentRecords || [])];
    const recordPayload = {
      date,
      punches,
      environmentRecords,
      scheduleSnapshot: existing?.scheduleSnapshot || structuredClone(daySchedule),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      locked: true,
      evidenceIds: [...new Set([...(existing?.evidenceIds || []), evidenceId])],
    };
    recordPayload.integrityHash = await hashText(JSON.stringify({
      date: recordPayload.date,
      punches: recordPayload.punches,
      environmentRecords: recordPayload.environmentRecords,
      scheduleSnapshot: recordPayload.scheduleSnapshot,
      evidenceIds: recordPayload.evidenceIds,
    }));

    // Registro e comprovante são gravados na mesma transação. Se uma etapa
    // falhar, nenhuma das duas fica salva isoladamente.
    await saveRecordWithEvidence(recordPayload, evidence);

    const filenameTime = confirmedTimes[0]?.replace(':', '-') || 'registro';
    const extension = state.selectedImage.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${date}_${filenameTime}_${captureType === 'environment' ? 'ambiente' : 'comprovante'}.${extension}`;
    if (state.cloud.provider !== 'local') {
      const job = {
        id: uuid(),
        evidenceId,
        provider: state.cloud.provider,
        filename,
        status: 'pending',
        attempts: 0,
        createdAt: now,
      };
      await addSyncJob(job);
      try {
        const cloudResult = await uploadEvidenceToCloud({ settings: state.cloud, blob: state.selectedImage, filename, date });
        evidence.cloud = cloudResult;
        await saveEvidence(evidence);
        await updateSyncJob({ ...job, status: 'synced', syncedAt: new Date().toISOString() });
        toast(`${captureType === 'environment' ? 'Registro de ambiente' : 'Comprovante'} salvo e sincronizado com ${state.cloud.provider === 'google' ? 'Google Drive' : 'OneDrive'}.`, 'success');
      } catch (cloudError) {
        await updateSyncJob({ ...job, status: 'failed', attempts: 1, error: cloudError.message, updatedAt: new Date().toISOString() });
        toast('Registro salvo localmente. A imagem ficou na fila de sincronização.', 'info', 6000);
      }
    } else {
      toast(captureType === 'environment' ? 'Registro de ambiente salvo como evidência auxiliar. As batidas não foram alteradas.' : 'Registro salvo e bloqueado neste dispositivo.', 'success', 6000);
    }

    await resetScan();
    await refreshData();
    navigate('dashboard');
  } catch (error) {
    toast(error.message || 'Não foi possível salvar o registro.', 'error', 6500);
  } finally {
    setBusy(false);
  }
}

async function resetScan() {
  stopCamera();
  if (state.selectedImageUrl) URL.revokeObjectURL(state.selectedImageUrl);
  state.sourceImage = null;
  state.selectedImage = null;
  state.selectedImageUrl = '';
  state.selectedImageName = '';
  state.imageQuality = null;
  state.ocrResult = null;
  state.imageDisplayMode = 'color';
  state.captureDate = '';
  state.captureTime = '';
  const image = document.querySelector('#scanPreviewImage');
  if (image) {
    image.removeAttribute('src');
    image.classList.add('hidden');
  }
  document.querySelector('#scanPlaceholder')?.classList.remove('hidden');
  document.querySelector('#reviewCard')?.classList.add('hidden');
  const continueButton = document.querySelector('#continueRegistrationButton');
  if (continueButton) continueButton.disabled = true;
  document.querySelector('#imageStyleControls')?.classList.add('hidden');
  const quality = document.querySelector('#qualityBar');
  if (quality) quality.innerHTML = '<span class="quality-dot"></span><strong>Sem imagem</strong><small>Selecione ou fotografe uma imagem</small>';
  document.querySelectorAll('[data-image-style]').forEach((button) => button.classList.toggle('active', button.dataset.imageStyle === 'color'));
}

async function bootApp() {
  state.profile = state.profile || loadProfile();
  if (!state.profile) {
    state.authMode = 'login';
    renderLogin();
    return;
  }
  setStorageNamespace(state.profile.id || state.profile.cpfHash?.slice(0, 24) || 'default');
  state.schedule = loadSchedule(DEFAULT_SCHEDULE);
  state.balanceSettings = loadBalanceSettings();
  state.closingPeriod = loadClosingPeriodSettings();
  state.selectedReportMonth = monthKey(closingPeriodForDate(todayIso(), state.closingPeriod).startDate);
  const storedCloud = loadCloudSettings();
  state.cloud = {
    ...storedCloud,
    googleConnected: false,
    googleClientId: runtimeConfig.googleClientId || storedCloud.googleClientId,
    microsoftClientId: runtimeConfig.microsoftClientId || storedCloud.microsoftClientId,
    microsoftTenantId: runtimeConfig.microsoftTenantId || storedCloud.microsoftTenantId,
  };
  if (runtimeConfig.googleClientId || runtimeConfig.microsoftClientId) {
    saveCloudSettings({
      ...state.cloud,
      googleClientId: runtimeConfig.googleClientId || state.cloud.googleClientId,
      microsoftClientId: runtimeConfig.microsoftClientId || state.cloud.microsoftClientId,
      microsoftTenantId: runtimeConfig.microsoftTenantId || state.cloud.microsoftTenantId,
    });
  }
  await migrateLegacyDataToCurrent();
  state.records = await listRecords();
  renderShell();
  await refreshData();
  updateInstallButton();
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.installPrompt = event;
  updateInstallButton();
});

window.addEventListener('appinstalled', () => {
  state.installPrompt = null;
  updateInstallButton();
  toast('Ticket. instalado neste dispositivo.', 'success');
});

async function registerTicketServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(location.hostname);

    // No ambiente local, o PWA fica desativado para impedir que versões antigas
    // do localhost sejam servidas pelo cache. A instalação PWA permanece ativa
    // quando o projeto for publicado em HTTPS.
    if (isLocalDevelopment) {
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys
          .filter((key) => key === 'pontoscan-v1' || key.startsWith('ticket-shell-'))
          .map((key) => caches.delete(key)));
      }
      return;
    }

    if (location.protocol !== 'https:') return;

    await Promise.all(
      registrations
        .filter((registration) => !registration.active?.scriptURL.includes('ticket-service-worker-v152.js'))
        .map((registration) => registration.unregister()),
    );

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys
        .filter((key) => key === 'pontoscan-v1' || (key.startsWith('ticket-shell-') && key !== 'ticket-shell-v152'))
        .map((key) => caches.delete(key)));
    }

    await navigator.serviceWorker.register('./ticket-service-worker-v152.js', {
      scope: './',
      updateViaCache: 'none',
    });
  } catch (error) {
    console.warn('Não foi possível atualizar o modo instalável do Ticket.', error);
  }
}

window.addEventListener('load', registerTicketServiceWorker);

(async function start() {
  if (state.profile && isSessionUnlocked({ allowLegacyProfile: true })) {
    await bootApp();
    return;
  }
  state.authMode = hasLocalAccounts() || state.profile ? 'login' : 'register';
  renderLogin();
})();
