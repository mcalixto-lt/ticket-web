(() => {
  const PROFILE_KEY = 'ticket.active-profile.v2';
  const BASE_KEY = 'ticket.balance-settings.v1';
  const MIGRATION_KEY = 'ticket.balance-baseline.2026-08-12.v1';

  function safeNamespace(value = 'default') {
    return String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'default';
  }

  function applyBaseline() {
    let profile = null;
    try {
      profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch {
      return false;
    }
    if (!profile) return false;

    const namespace = safeNamespace(profile.id || profile.cpfHash?.slice(0, 24) || 'default');
    const settingsKey = `${BASE_KEY}.${namespace}`;
    const migrationKey = `${MIGRATION_KEY}.${namespace}`;

    if (localStorage.getItem(migrationKey) === '1') return true;

    let current = {};
    try {
      current = JSON.parse(localStorage.getItem(settingsKey) || '{}') || {};
    } catch {
      current = {};
    }

    const previousHistory = Array.isArray(current.history) ? current.history : [];
    const updatedAt = new Date().toISOString();
    const next = {
      ...current,
      minutes: 690,
      type: 'positive',
      referenceDate: '2026-08-12',
      note: 'Saldo oficial do banco de horas da empresa informado em 12/08/2026: +11h30.',
      history: [
        ...previousHistory,
        {
          id: `baseline-20260812-${Date.now()}`,
          minutes: 690,
          type: 'positive',
          referenceDate: '2026-08-12',
          note: 'Atualização do saldo oficial da empresa: +11h30 até 12/08/2026.',
          updatedAt,
        },
      ],
      updatedAt,
    };

    localStorage.setItem(settingsKey, JSON.stringify(next));
    localStorage.setItem(migrationKey, '1');
    return true;
  }

  if (!applyBaseline()) {
    window.addEventListener('storage', applyBaseline);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) applyBaseline();
    });
    const timer = window.setInterval(() => {
      if (applyBaseline()) window.clearInterval(timer);
    }, 750);
    window.setTimeout(() => window.clearInterval(timer), 30000);
  }
})();
