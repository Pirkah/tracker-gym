/* ==========================================================================
   PULSE — Spatial & Typographic Gym Tracker (Zero-Box Design)
   ========================================================================== */

const STORAGE_KEY = 'pulse_user_data_v1';
const IDB_NAME = 'PulseUserDB';
const IDB_STORE = 'state';
const DEFAULT_REST_SEC = 180; // 3 minutes par défaut

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>`,
  check: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  swap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`,
  chart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 5-6"/></svg>`,
  close: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
  history: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`
};

let state = {
  exercises: [],
  templates: [],
  history: [],
  activeWorkout: null,
  settings: {
    autoStartTimer: true,
    soundEnabled: true,
    watchShortcutAuto: false,
    watchShortcutName: 'IronPulse Timer',
    cloudUrl: '',
    lastCloudSync: null
  },
  ui: {
    activeTab: 'workout',
    selectedStatExoId: '',
    statMetric: 'maxWeight',
    quickAddUni: false,
    focusedExoIdx: 0 // Focus Deck index during active workout ('all' or 0..n)
  }
};

let restTimer = {
  active: false,
  totalSec: DEFAULT_REST_SEC,
  endTime: 0,
  exoName: '',
  intervalId: null
};

let workoutClockInterval = null;

/* ==========================================================================
   Persistence (LocalStorage + IndexedDB + Cloud Sync)
   ========================================================================== */

function openIDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) return resolve(null);
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function saveToIDB(dataObj) {
  try {
    const db = await openIDB();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(JSON.stringify(dataObj), 'backup');
  } catch {}
}

async function loadFromIDB() {
  try {
    const db = await openIDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('backup');
      req.onsuccess = () => {
        if (req.result) {
          try { resolve(JSON.parse(req.result)); } catch { resolve(null); }
        } else resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function saveState(triggerCloud = false) {
  const payload = {
    exercises: state.exercises,
    templates: state.templates,
    history: state.history,
    activeWorkout: state.activeWorkout,
    settings: state.settings
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
  saveToIDB(payload);
  updateLiveWorkoutIndicators();

  if (triggerCloud && state.settings.cloudUrl) {
    syncToCloud(true);
  }
}

async function loadState() {
  try { localStorage.removeItem('ironpulse_data_v1'); } catch {}

  let raw = localStorage.getItem(STORAGE_KEY);
  let parsed = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!parsed) {
    parsed = await loadFromIDB();
  }

  if (parsed) {
    state.exercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];
    state.templates = Array.isArray(parsed.templates) ? parsed.templates : [];
    state.history = Array.isArray(parsed.history) ? parsed.history : [];
    state.activeWorkout = parsed.activeWorkout || null;
    state.settings = { ...state.settings, ...(parsed.settings || {}) };
  } else {
    state.exercises = [];
    state.templates = [];
    state.history = [];
    state.activeWorkout = null;
    saveState();
  }

  if (state.exercises.length > 0 && !getExercise(state.ui.selectedStatExoId)) {
    state.ui.selectedStatExoId = state.exercises[0].id;
  }
}

async function syncToCloud(silent = false) {
  const url = (state.settings.cloudUrl || '').trim();
  if (!url) {
    if (!silent) showToast('Configure une URL Cloud d’abord');
    return;
  }
  try {
    const endpoint = normalizeCloudUrl(url);
    const payload = {
      updatedAt: new Date().toISOString(),
      exercises: state.exercises,
      templates: state.templates,
      history: state.history
    };
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.settings.lastCloudSync = new Date().toISOString();
    saveState(false);
    if (!silent) {
      showToast('Synchronisé sur le Cloud');
      renderSettingsTab();
    }
  } catch {
    if (!silent) showToast('Erreur Cloud : vérifie ton URL');
  }
}

async function restoreFromCloud() {
  const url = (state.settings.cloudUrl || '').trim();
  if (!url) {
    showToast('Renseigne ton URL Cloud d’abord');
    return;
  }
  try {
    const endpoint = normalizeCloudUrl(url);
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.exercises)) {
      showToast('Aucune sauvegarde trouvée');
      return;
    }
    state.exercises = data.exercises;
    state.templates = data.templates || [];
    state.history = data.history || [];
    state.settings.lastCloudSync = new Date().toISOString();
    saveState(false);
    renderAll();
    showToast('Données restaurées depuis le Cloud');
  } catch {
    showToast('Impossible de récupérer les données');
  }
}

function normalizeCloudUrl(url) {
  let clean = url.replace(/\/+$/, '');
  if (clean.includes('firebaseio.com') || clean.includes('firebasedatabase.app')) {
    if (!clean.endsWith('.json')) clean += '/ironpulse_backup.json';
  }
  return clean;
}

/* ==========================================================================
   Helpers & Auto-Create Exercise By Name (Default Rest = 180s)
   ========================================================================== */

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getExercise(id) {
  return state.exercises.find((e) => e.id === id) || null;
}

function findOrCreateExerciseByName(rawName, isUnilateral = false, defaultRest = DEFAULT_REST_SEC) {
  const cleanName = (rawName || '').trim();
  if (!cleanName) return null;

  const existing = state.exercises.find(
    (e) => e.name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  if (existing) {
    existing.unilateral = !!isUnilateral;
    if (defaultRest) existing.defaultRest = parseInt(defaultRest) || DEFAULT_REST_SEC;
    return existing;
  }

  const created = {
    id: uid('ex'),
    name: cleanName,
    muscle: 'Général',
    unilateral: !!isUnilateral,
    defaultRest: parseInt(defaultRest) || DEFAULT_REST_SEC,
    note: ''
  };
  state.exercises.push(created);
  if (!state.ui.selectedStatExoId) {
    state.ui.selectedStatExoId = created.id;
  }
  return created;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h${String(remM).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDateShort(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function showToast(msg, isPr = false) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${isPr ? 'toast-pr' : ''}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, 2800);
}

function getPreviousExercisePerf(exerciseId) {
  const sorted = [...state.history].sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const wk of sorted) {
    const found = (wk.exercises || []).find((e) => e.exerciseId === exerciseId);
    if (found && found.sets && found.sets.some((s) => s.done)) {
      return {
        date: wk.date,
        unilateral: found.unilateral,
        sets: found.sets.filter((s) => s.done)
      };
    }
  }
  return null;
}

function checkSetPR(exerciseId, setObj, isUnilateral) {
  if (setObj.tag === 'W') return null;
  const weight = parseFloat(setObj.weight) || 0;
  const reps = isUnilateral
    ? Math.max(parseInt(setObj.repsLeft) || 0, parseInt(setObj.repsRight) || 0)
    : parseInt(setObj.reps) || 0;

  if (weight <= 0 || reps <= 0) return null;
  const current1RM = weight * (1 + reps / 30);

  let maxWeightEver = 0;
  let max1RMEver = 0;
  let hadPreviousHistory = false;

  for (const wk of state.history) {
    for (const ex of wk.exercises || []) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets || []) {
        if (!s.done || s.tag === 'W') continue;
        const w = parseFloat(s.weight) || 0;
        const r = ex.unilateral
          ? Math.max(parseInt(s.repsLeft) || 0, parseInt(s.repsRight) || 0)
          : parseInt(s.reps) || 0;
        if (w > 0 && r > 0) {
          hadPreviousHistory = true;
          if (w > maxWeightEver) maxWeightEver = w;
          const e1rm = w * (1 + r / 30);
          if (e1rm > max1RMEver) max1RMEver = e1rm;
        }
      }
    }
  }

  if (!hadPreviousHistory) return null;
  if (weight > maxWeightEver) return 'PR Poids';
  if (current1RM > max1RMEver + 0.2) return 'PR 1RM';
  return null;
}

/* ==========================================================================
   Dynamic Island Rest Timer & Apple Watch Relay (Default 3m = 180s)
   ========================================================================== */

function playTimerBeep() {
  if (!state.settings.soundEnabled) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [880, 1108.73, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.26);
    });
  } catch {}
}

function triggerWatchShortcut(seconds) {
  const shortcutName = encodeURIComponent(state.settings.watchShortcutName || 'IronPulse Timer');
  window.location.href = `shortcuts://run-shortcut?name=${shortcutName}&input=text&text=${encodeURIComponent(String(seconds))}`;
}

function startRestTimer(seconds, exoName = 'Repos') {
  const dur = Math.max(15, parseInt(seconds) || DEFAULT_REST_SEC);
  restTimer.active = true;
  restTimer.totalSec = dur;
  restTimer.endTime = Date.now() + dur * 1000;
  restTimer.exoName = exoName;

  const bar = document.getElementById('rest-timer-bar');
  bar.classList.remove('hidden');
  document.getElementById('rest-timer-exo-name').textContent = exoName;

  if (restTimer.intervalId) clearInterval(restTimer.intervalId);
  tickRestTimer();
  restTimer.intervalId = setInterval(tickRestTimer, 250);

  if (state.settings.watchShortcutAuto) {
    triggerWatchShortcut(dur);
  }
}

function tickRestTimer() {
  if (!restTimer.active) return;
  const remainingMs = restTimer.endTime - Date.now();
  const remainingSec = Math.ceil(remainingMs / 1000);

  if (remainingSec <= 0) {
    finishRestTimer();
    return;
  }

  document.getElementById('rest-timer-display').textContent = formatDuration(remainingSec);
  const circumference = 94.2;
  const ratio = Math.max(0, Math.min(1, remainingMs / (restTimer.totalSec * 1000)));
  const ring = document.getElementById('rest-timer-ring');
  if (ring) {
    ring.style.strokeDashoffset = String(circumference * (1 - ratio));
  }
}

function adjustRestTimer(deltaSec) {
  if (!restTimer.active) return;
  restTimer.endTime += deltaSec * 1000;
  restTimer.totalSec = Math.max(restTimer.totalSec, Math.ceil((restTimer.endTime - Date.now()) / 1000));
  tickRestTimer();
}

function stopRestTimer() {
  restTimer.active = false;
  if (restTimer.intervalId) {
    clearInterval(restTimer.intervalId);
    restTimer.intervalId = null;
  }
  document.getElementById('rest-timer-bar').classList.add('hidden');
}

function finishRestTimer() {
  const exoName = restTimer.exoName;
  stopRestTimer();
  playTimerBeep();
  if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
  showToast(`Repos terminé • ${exoName}`, true);

  if ('Notification' in window && Notification.permission === 'granted') {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification('Repos terminé', {
          body: `Prêt pour ta série sur ${exoName}`,
          icon: 'icon.svg',
          tag: 'ironpulse-rest-timer',
          renotify: true
        });
      });
    }
  }
}

/* ==========================================================================
   Tab 1: Spatial Workout Launcher & Connected Spine Active Workout
   ========================================================================== */

function startWorkoutFromTemplate(templateId) {
  const tpl = state.templates.find((t) => t.id === templateId);
  if (!tpl) return;

  const workoutExercises = tpl.items.map((item) => {
    const exo = getExercise(item.exerciseId);
    const isUni = exo ? !!exo.unilateral : false;
    const prev = getPreviousExercisePerf(item.exerciseId);
    const sets = [];
    const count = parseInt(item.setsCount) || 3;

    for (let i = 0; i < count; i++) {
      const prevSet = prev && prev.sets[i]
        ? prev.sets[i]
        : (prev && prev.sets.length ? prev.sets[prev.sets.length - 1] : null);
      sets.push({
        id: uid('set'),
        tag: String(i + 1),
        weight: prevSet && prevSet.weight !== undefined ? String(prevSet.weight) : '',
        reps: !isUni && prevSet && prevSet.reps !== undefined ? String(prevSet.reps) : '',
        repsLeft: isUni && prevSet && prevSet.repsLeft !== undefined ? String(prevSet.repsLeft) : '',
        repsRight: isUni && prevSet && prevSet.repsRight !== undefined ? String(prevSet.repsRight) : '',
        rir: '',
        done: false,
        prBadge: null
      });
    }

    return {
      id: uid('wexo'),
      exerciseId: item.exerciseId,
      targetReps: item.targetReps || '8-12',
      restSeconds: item.restSeconds || (exo ? exo.defaultRest : DEFAULT_REST_SEC) || DEFAULT_REST_SEC,
      unilateral: isUni,
      sets
    };
  });

  state.activeWorkout = {
    id: uid('wk'),
    templateId: tpl.id,
    name: tpl.name,
    startedAt: Date.now(),
    exercises: workoutExercises
  };
  state.ui.focusedExoIdx = 0;

  saveState();
  switchTab('workout');
  renderWorkoutTab();
  showToast(`${tpl.name} lancée`, true);
}

function startEmptyWorkout() {
  state.activeWorkout = {
    id: uid('wk'),
    templateId: null,
    name: 'Séance Libre',
    startedAt: Date.now(),
    exercises: []
  };
  state.ui.focusedExoIdx = 0;
  saveState();
  renderWorkoutTab();
}

function updateLiveWorkoutIndicators() {
  const dot = document.getElementById('active-workout-dot');
  const topActions = document.getElementById('top-bar-actions');

  if (state.activeWorkout) {
    dot.classList.remove('hidden');
    if (!workoutClockInterval) {
      workoutClockInterval = setInterval(updateHeaderClock, 1000);
    }
    updateHeaderClock();
  } else {
    dot.classList.add('hidden');
    if (workoutClockInterval) {
      clearInterval(workoutClockInterval);
      workoutClockInterval = null;
    }
    topActions.innerHTML = '';
  }
}

function updateHeaderClock() {
  const topActions = document.getElementById('top-bar-actions');
  if (!state.activeWorkout) {
    topActions.innerHTML = '';
    return;
  }
  const elapsedSec = Math.max(0, Math.floor((Date.now() - state.activeWorkout.startedAt) / 1000));
  topActions.innerHTML = `
    <div style="background:rgba(212,255,0,0.14); color:var(--volt); padding:7px 14px; border-radius:999px; font-size:0.84rem; font-weight:900; font-variant-numeric:tabular-nums; display:flex; align-items:center; gap:6px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.2);">
      <span style="width:7px; height:7px; border-radius:50%; background:var(--volt); box-shadow:0 0 8px var(--volt);"></span>
      ${formatDuration(elapsedSec)}
    </div>
  `;
}

function renderWorkoutTab() {
  const container = document.getElementById('workout-container');
  if (!state.activeWorkout) {
    renderWorkoutLauncher(container);
  } else {
    renderActiveWorkout(container);
  }
}

function renderWorkoutLauncher(container) {
  const totalSessions = state.history.length;
  const totalVolumeAll = state.history.reduce((sum, wk) => {
    return sum + (wk.exercises || []).reduce((s2, ex) => {
      return s2 + (ex.sets || []).filter((st) => st.done).reduce((s3, st) => {
        const w = parseFloat(st.weight) || 0;
        const r = ex.unilateral ? ((parseInt(st.repsLeft) || 0) + (parseInt(st.repsRight) || 0)) : (parseInt(st.reps) || 0);
        return s3 + w * r;
      }, 0);
    }, 0);
  }, 0);

  const stripsHtml = state.templates.length === 0
    ? `
      <div style="padding:38px 0; border-bottom:1px solid var(--hairline);">
        <div style="font-size:1.45rem; font-weight:900; letter-spacing:-0.03em; margin-bottom:8px;">Compose ta première séance</div>
        <p style="font-size:0.88rem; color:var(--text-dim); margin-bottom:22px; line-height:1.5;">
          Tape directement le nom de tes exercices dans ta séance type — le repos est réglé sur <strong>3 min (180s)</strong> par défaut.
        </p>
        <button type="button" class="btn btn-primary" data-action="create-template">+ Créer une séance</button>
      </div>
    `
    : state.templates.map((tpl, idx) => {
        const exoRows = tpl.items.map((it) => {
          const exo = getExercise(it.exerciseId);
          if (!exo) return '';
          return `
            <div class="strip-exo-row">
              <span class="strip-exo-name">${escapeHtml(exo.name)}</span>
              <span class="strip-exo-target">${it.setsCount} × ${escapeHtml(it.targetReps)}</span>
            </div>
          `;
        }).join('');

        return `
          <div class="workout-strip" data-action="start-template" data-id="${tpl.id}">
            <div class="strip-index-watermark">${String(idx + 1).padStart(2, '0')}</div>
            <div class="strip-body">
              <div class="strip-title">${escapeHtml(tpl.name)}</div>
              <div class="strip-exo-list">
                ${exoRows}
              </div>
            </div>
            <button type="button" class="orb-launch-btn" data-action="start-template" data-id="${tpl.id}">
              ${ICONS.play}
            </button>
          </div>
        `;
      }).join('');

  const recentHistory = [...state.history]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  const historyHtml = recentHistory.length === 0
    ? `<div style="padding:18px 0; color:var(--text-ghost); font-size:0.86rem;">Aucune séance archivée pour le moment.</div>`
    : recentHistory.map((wk) => {
        const totalSets = (wk.exercises || []).reduce((acc, ex) => acc + (ex.sets || []).filter((s) => s.done).length, 0);
        return `
          <div style="padding:16px 0; border-bottom:1px solid var(--hairline); display:flex; justify-content:space-between; align-items:center;">
            <div style="cursor:pointer; flex:1;" data-action="view-history-wk" data-id="${wk.id}">
              <div style="font-weight:800; font-size:1.05rem; letter-spacing:-0.02em;">${escapeHtml(wk.name)}</div>
              <div style="font-size:0.78rem; color:var(--text-dim); margin-top:3px;">
                ${formatDateShort(wk.date)} — ${(wk.exercises || []).length} exos • ${totalSets} séries validées
              </div>
            </div>
            <button type="button" class="circle-icon-btn" data-action="delete-history-wk" data-id="${wk.id}" title="Supprimer">
              ${ICONS.trash}
            </button>
          </div>
        `;
      }).join('');

  container.innerHTML = `
    <!-- Giant Editorial Monument (No Box!) -->
    <div class="editorial-hero">
      <div class="hero-stat-group">
        <div class="hero-stat-item">
          <span class="hero-stat-number accent">${String(totalSessions).padStart(2, '0')}</span>
          <span class="hero-stat-label">Séances</span>
        </div>
        <div class="hero-stat-item">
          <span class="hero-stat-number">${(totalVolumeAll / 1000).toFixed(1)}</span>
          <span class="hero-stat-label">Tonnes soulevées</span>
        </div>
      </div>
      <button type="button" class="btn btn-ghost" data-action="start-empty-workout">+ Séance libre</button>
    </div>

    <div class="runway-header">
      <span class="runway-title">Répertoire de séances</span>
      ${state.templates.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="create-template">+ Nouvelle</button>` : ''}
    </div>
    <div>
      ${stripsHtml}
    </div>

    <div class="runway-header" style="margin-top:36px;">
      <span class="runway-title">Journal récent</span>
    </div>
    <div>
      ${historyHtml}
    </div>
  `;
}

function renderActiveWorkout(container) {
  const wk = state.activeWorkout;
  let completedSets = 0;
  let totalSets = 0;
  wk.exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      totalSets++;
      if (s.done) completedSets++;
    });
  });

  if (state.ui.focusedExoIdx !== 'all' && state.ui.focusedExoIdx >= wk.exercises.length) {
    state.ui.focusedExoIdx = Math.max(0, wk.exercises.length - 1);
  }

  // Horizontal Exercise Focus Deck Ribbon
  const deckPills = wk.exercises.map((wExo, idx) => {
    const exo = getExercise(wExo.exerciseId);
    const allDone = wExo.sets.length > 0 && wExo.sets.every((s) => s.done);
    const isFocused = state.ui.focusedExoIdx === idx;
    return `
      <button type="button" class="deck-pill ${isFocused ? 'active' : ''} ${allDone ? 'done-all' : ''}" data-action="focus-exo-pill" data-idx="${idx}">
        <span>0${idx + 1}</span>
        <span>${escapeHtml(exo ? exo.name : 'Exercice')}</span>
      </button>
    `;
  }).join('');

  const indicesToRender = state.ui.focusedExoIdx === 'all'
    ? wk.exercises.map((_, i) => i)
    : (wk.exercises.length > 0 ? [state.ui.focusedExoIdx] : []);

  const stagesHtml = indicesToRender.map((exoIdx) => {
    const wExo = wk.exercises[exoIdx];
    if (!wExo) return '';
    const exo = getExercise(wExo.exerciseId) || {
      id: wExo.exerciseId,
      name: 'Exercice',
      unilateral: wExo.unilateral,
      note: ''
    };
    const isUni = !!wExo.unilateral;
    const prevPerf = getPreviousExercisePerf(wExo.exerciseId);

    let normalCounter = 0;
    const spineRowsHtml = wExo.sets.map((s, setIdx) => {
      if (!['W', 'D', 'F'].includes(s.tag)) normalCounter++;
      const displayTag = ['W', 'D', 'F'].includes(s.tag) ? s.tag : String(normalCounter).padStart(2, '0');
      const tagClass = ['W', 'D', 'F'].includes(s.tag) ? `tag-${s.tag}` : '';

      const prevSet = prevPerf && prevPerf.sets[setIdx]
        ? prevPerf.sets[setIdx]
        : (prevPerf && prevPerf.sets.length ? prevPerf.sets[prevPerf.sets.length - 1] : null);

      let prevText = 'Première fois';
      if (prevSet) {
        if (prevPerf.unilateral || (prevSet.repsLeft !== undefined && prevSet.repsLeft !== '')) {
          prevText = `Dernière : <strong>${prevSet.weight} kg</strong> • G:${prevSet.repsLeft || 0} / D:${prevSet.repsRight || 0}`;
        } else {
          prevText = `Dernière : <strong>${prevSet.weight} kg × ${prevSet.reps}</strong>`;
        }
      }

      const rirDisplay = s.rir ? `RIR ${s.rir}` : 'RIR';

      return `
        <div class="spine-row ${s.done ? 'completed' : ''}" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
          <div class="spine-rail">
            <button type="button" class="spine-node-btn ${tagClass}" data-action="cycle-set-tag" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" title="Normal / Échauffement W / Drop D / Échec F">
              ${displayTag}
            </button>
            <div class="spine-connector"></div>
          </div>

          <div class="spine-content">
            <div class="spine-meta-line">
              <button type="button" class="ghost-prev-tap" data-action="copy-prev-set" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
                ${ICONS.history}
                <span>${s.prBadge ? `🏆 <strong>${s.prBadge}</strong>` : prevText}</span>
              </button>
              <button type="button" class="rir-whisper-btn ${s.rir ? 'has-rir' : ''}" data-action="cycle-rir" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
                ${rirDisplay}
              </button>
            </div>

            <div class="dial-strip">
              <div class="dial-group">
                <label class="dial-field">
                  <input type="number" step="0.5" inputmode="decimal" class="dial-input" placeholder="0" value="${escapeAttr(s.weight)}" data-input="weight" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
                  <span class="dial-unit">${isUni ? 'kg/côté' : 'kg'}</span>
                </label>

                <span class="dial-divider">×</span>

                ${isUni ? `
                  <label class="dial-field dial-left">
                    <input type="number" inputmode="numeric" class="dial-input" placeholder="0" value="${escapeAttr(s.repsLeft)}" data-input="repsLeft" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
                    <span class="dial-unit unit-g">G</span>
                  </label>
                  <label class="dial-field dial-right">
                    <input type="number" inputmode="numeric" class="dial-input" placeholder="0" value="${escapeAttr(s.repsRight)}" data-input="repsRight" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
                    <span class="dial-unit unit-d">D</span>
                  </label>
                ` : `
                  <label class="dial-field">
                    <input type="number" inputmode="numeric" class="dial-input" placeholder="0" value="${escapeAttr(s.reps)}" data-input="reps" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
                    <span class="dial-unit">reps</span>
                  </label>
                `}
              </div>

              <button type="button" class="liquid-check-orb ${s.done ? 'checked' : ''}" data-action="toggle-set-done" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
                ${ICONS.check}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const nextIdx = exoIdx + 1 < wk.exercises.length ? exoIdx + 1 : null;

    return `
      <div class="exo-stage">
        <div class="exo-stage-top">
          <div style="flex:1;">
            <span class="exo-stage-kicker">MOUVEMENT 0${exoIdx + 1} SUR 0${wk.exercises.length}</span>
            <h2 class="exo-stage-title">${escapeHtml(exo.name)}</h2>
            <div class="exo-stage-tags">
              <button type="button" class="glass-tag ${isUni ? 'uni' : 'bi'}" data-action="toggle-live-unilateral" data-exo-idx="${exoIdx}">
                ${isUni ? '🦿 Unilatéral G / D' : '🏋️ Bilatéral'}
              </button>
              <span class="glass-tag">Cible ${escapeHtml(wExo.targetReps)}</span>
              <button type="button" class="glass-tag" data-action="edit-live-rest" data-exo-idx="${exoIdx}">
                ⏱️ Repos ${formatDuration(wExo.restSeconds || DEFAULT_REST_SEC)}
              </button>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="circle-icon-btn" data-action="open-exo-stats-quick" data-exo-id="${exo.id}" title="Courbes">${ICONS.chart}</button>
            <button type="button" class="circle-icon-btn" data-action="swap-live-exo" data-exo-idx="${exoIdx}" title="Remplacer">${ICONS.swap}</button>
            <button type="button" class="circle-icon-btn" data-action="remove-live-exo" data-exo-idx="${exoIdx}" title="Retirer">${ICONS.close}</button>
          </div>
        </div>

        <div class="exo-whisper-note">
          ${ICONS.pin}
          <input type="text" style="width:100%; font-size:0.84rem; color:#fff;" placeholder="Note de réglage (hauteur siège, cran poulie...)" value="${escapeAttr(exo.note || '')}" data-input="exo-note" data-exo-id="${exo.id}" />
        </div>

        <div class="spine-timeline">
          ${spineRowsHtml}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-left:46px;">
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="add-live-set" data-exo-idx="${exoIdx}">+ Série</button>
            ${wExo.sets.length > 1 ? `<button type="button" class="btn btn-sm" style="color:var(--text-ghost);" data-action="remove-live-set" data-exo-idx="${exoIdx}">- Série</button>` : ''}
          </div>
          ${state.ui.focusedExoIdx !== 'all' && nextIdx !== null ? `
            <button type="button" class="btn btn-ghost btn-sm" data-action="focus-exo-pill" data-idx="${nextIdx}">
              Exo suivant →
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <div>
        <div style="font-size:0.74rem; color:var(--text-dim); font-weight:700;">${escapeHtml(wk.name)} • ${completedSets}/${totalSets} séries</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn-secondary btn-sm" data-action="add-exo-to-live">+ Exo</button>
        <button type="button" class="btn btn-primary btn-sm" data-action="finish-workout">Valider ✓</button>
      </div>
    </div>

    ${wk.exercises.length > 0 ? `
      <div class="exo-deck-ribbon">
        ${deckPills}
        <button type="button" class="deck-pill ${state.ui.focusedExoIdx === 'all' ? 'active' : ''}" data-action="focus-exo-pill" data-idx="all">
          Tout dérouler
        </button>
      </div>
    ` : ''}

    ${stagesHtml || `
      <div style="padding:36px 0; text-align:center;">
        <p style="color:var(--text-dim); margin-bottom:16px;">Aucun exercice dans cette séance.</p>
        <button type="button" class="btn btn-primary" data-action="add-exo-to-live">+ Ajouter un exercice</button>
      </div>
    `}

    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:28px; padding-top:16px; border-top:1px solid var(--hairline);">
      <button type="button" class="btn btn-danger btn-sm" data-action="cancel-workout">Abandonner</button>
      <button type="button" class="btn btn-primary" data-action="finish-workout">Terminer la séance</button>
    </div>
  `;
}

/* ==========================================================================
   Tab 2: Programmes & Open Stream Exercise Library
   ========================================================================== */

function renderTemplatesTab() {
  const container = document.getElementById('templates-container');

  const tplListHtml = state.templates.length === 0
    ? `
      <div style="padding:28px 0; border-bottom:1px solid var(--hairline); color:var(--text-dim); font-size:0.88rem; line-height:1.5;">
        Aucune séance programmée. Appuie sur <strong>+ Nouvelle séance</strong> et tape directement le nom de tes exercices !
      </div>
    `
    : state.templates.map((tpl, idx) => {
        const exoLines = tpl.items.map((item, i) => {
          const exo = getExercise(item.exerciseId);
          if (!exo) return '';
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; font-size:0.88rem;">
              <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span style="color:var(--volt); font-weight:900; font-size:0.74rem;">0${i + 1}</span>
                <strong style="font-weight:700;">${escapeHtml(exo.name)}</strong>
                ${exo.unilateral ? `<span style="font-size:0.7rem; color:var(--orchid); font-weight:800;">G/D</span>` : ''}
              </div>
              <span style="color:var(--text-dim); font-weight:700;">${item.setsCount} × ${escapeHtml(item.targetReps)} • ${formatDuration(item.restSeconds || DEFAULT_REST_SEC)}</span>
            </div>
          `;
        }).join('');

        return `
          <div style="padding:22px 0; border-bottom:1px solid var(--hairline);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div style="display:flex; align-items:baseline; gap:10px;">
                <span style="font-size:0.75rem; font-weight:900; color:var(--text-ghost);">0${idx + 1}</span>
                <h3 style="font-size:1.3rem; font-weight:900; letter-spacing:-0.03em;">${escapeHtml(tpl.name)}</h3>
              </div>
              <div style="display:flex; gap:6px;">
                <button type="button" class="circle-icon-btn" data-action="edit-template" data-id="${tpl.id}">${ICONS.edit}</button>
                <button type="button" class="circle-icon-btn" data-action="delete-template" data-id="${tpl.id}">${ICONS.trash}</button>
              </div>
            </div>
            <div style="padding-left:24px; border-left:1.5px solid rgba(255,255,255,0.08);">${exoLines}</div>
          </div>
        `;
      }).join('');

  const exercisesHtml = state.exercises.length === 0
    ? `<div style="padding:18px 0; color:var(--text-ghost); font-size:0.84rem;">Ta bibliothèque est vide.</div>`
    : state.exercises.map((exo) => `
        <div style="padding:14px 0; border-bottom:1px solid var(--hairline); display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div>
            <div style="font-weight:800; font-size:1rem; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span>${escapeHtml(exo.name)}</span>
              <span class="glass-tag ${exo.unilateral ? 'uni' : 'bi'}" style="padding:3px 9px; font-size:0.68rem;">
                ${exo.unilateral ? 'Unilatéral G/D' : 'Bilatéral'}
              </span>
            </div>
            ${exo.note ? `<div style="font-size:0.78rem; color:var(--text-dim); margin-top:4px;">${escapeHtml(exo.note)}</div>` : ''}
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="circle-icon-btn" data-action="edit-exercise" data-id="${exo.id}">${ICONS.edit}</button>
            <button type="button" class="circle-icon-btn" data-action="delete-exercise" data-id="${exo.id}">${ICONS.trash}</button>
          </div>
        </div>
      `).join('');

  container.innerHTML = `
    <div class="runway-header">
      <span class="runway-title">Mes Séances Types</span>
      <button type="button" class="btn btn-primary btn-sm" data-action="create-template">+ Nouvelle séance</button>
    </div>
    ${tplListHtml}

    <div class="runway-header" style="margin-top:36px;">
      <span class="runway-title">Répertoire d'exercices (${state.exercises.length})</span>
    </div>

    <form id="quick-add-exo-form" style="padding:10px 0 22px; border-bottom:1px solid var(--hairline); margin-bottom:8px;">
      <input type="text" id="quick-exo-name" class="open-input-line" placeholder="Ajouter un exercice à la volée..." required />
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
        <button type="button" id="quick-exo-uni-btn" class="glass-tag ${state.ui.quickAddUni ? 'uni' : 'bi'}">
          ${state.ui.quickAddUni ? '🦿 Unilatéral (G / D séparés)' : '🏋️ Bilatéral (2 côtés)'}
        </button>
        <button type="submit" class="btn btn-primary btn-sm">+ Ajouter</button>
      </div>
    </form>

    ${exercisesHtml}
  `;

  const uniBtn = document.getElementById('quick-exo-uni-btn');
  if (uniBtn) {
    uniBtn.addEventListener('click', () => {
      state.ui.quickAddUni = !state.ui.quickAddUni;
      renderTemplatesTab();
      const inp = document.getElementById('quick-exo-name');
      if (inp) inp.focus();
    });
  }

  const quickForm = document.getElementById('quick-add-exo-form');
  if (quickForm) {
    quickForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = document.getElementById('quick-exo-name');
      const name = inp.value.trim();
      if (!name) return;
      findOrCreateExerciseByName(name, state.ui.quickAddUni, DEFAULT_REST_SEC);
      state.ui.quickAddUni = false;
      saveState();
      renderTemplatesTab();
      showToast(`"${name}" ajouté`);
    });
  }
}

/* ==========================================================================
   Tab 3: Sculptural Horizon Curve & Unilateral Balance Beam
   ========================================================================== */

function getExerciseStatsHistory(exerciseId) {
  const sorted = [...state.history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const sessions = [];

  for (const wk of sorted) {
    const found = (wk.exercises || []).find((e) => e.exerciseId === exerciseId);
    if (!found || !found.sets) continue;
    const workingSets = found.sets.filter((s) => s.done && s.tag !== 'W');
    if (workingSets.length === 0) continue;

    let maxWeight = 0;
    let best1RM = 0;
    let totalVolume = 0;
    let totalRepsLeft = 0;
    let totalRepsRight = 0;
    let bestSetDesc = '';

    workingSets.forEach((s) => {
      const w = parseFloat(s.weight) || 0;
      if (found.unilateral) {
        const rL = parseInt(s.repsLeft) || 0;
        const rR = parseInt(s.repsRight) || 0;
        const maxR = Math.max(rL, rR);
        totalRepsLeft += rL;
        totalRepsRight += rR;
        totalVolume += w * (rL + rR);
        if (w >= maxWeight) {
          maxWeight = w;
          bestSetDesc = `${w}kg (G:${rL}/D:${rR})`;
        }
        const e1rm = w * (1 + maxR / 30);
        if (e1rm > best1RM) best1RM = e1rm;
      } else {
        const r = parseInt(s.reps) || 0;
        totalVolume += w * r;
        if (w >= maxWeight) {
          maxWeight = w;
          bestSetDesc = `${w}kg × ${r}`;
        }
        const e1rm = w * (1 + r / 30);
        if (e1rm > best1RM) best1RM = e1rm;
      }
    });

    sessions.push({
      date: wk.date,
      workoutName: wk.name,
      unilateral: found.unilateral,
      maxWeight: Math.round(maxWeight * 10) / 10,
      best1RM: Math.round(best1RM * 10) / 10,
      totalVolume: Math.round(totalVolume),
      totalRepsLeft,
      totalRepsRight,
      bestSetDesc,
      sets: workingSets
    });
  }

  return sessions;
}

function renderStatsTab() {
  const container = document.getElementById('stats-container');
  const currentExo = getExercise(state.ui.selectedStatExoId) || state.exercises[0];
  if (!currentExo) {
    container.innerHTML = `
      <div style="padding:38px 0; color:var(--text-dim);">
        Crée tes exercices dans l'onglet <strong>Programmes</strong> et valide une séance pour voir tes courbes.
      </div>
    `;
    return;
  }

  const optionsHtml = state.exercises.map((e) => `
    <option value="${e.id}" ${e.id === currentExo.id ? 'selected' : ''} style="background:#111; color:#fff;">
      ${escapeHtml(e.name)} ${e.unilateral ? '• Unilatéral G/D' : ''}
    </option>
  `).join('');

  const sessions = getExerciseStatsHistory(currentExo.id);
  const allTimeMaxWeight = sessions.reduce((m, s) => Math.max(m, s.maxWeight), 0);
  const allTimeBest1RM = sessions.reduce((m, s) => Math.max(m, s.best1RM), 0);
  const allTimeMaxVol = sessions.reduce((m, s) => Math.max(m, s.totalVolume), 0);

  let sumLeft = 0;
  let sumRight = 0;
  sessions.forEach((s) => {
    sumLeft += s.totalRepsLeft;
    sumRight += s.totalRepsRight;
  });
  const totalUniReps = sumLeft + sumRight;
  const leftPct = totalUniReps > 0 ? Math.round((sumLeft / totalUniReps) * 100) : 50;
  const rightPct = totalUniReps > 0 ? 100 - leftPct : 50;

  const metric = state.ui.statMetric;

  const sessionRowsHtml = [...sessions].reverse().map((s) => {
    const setsText = s.sets.map((st) => {
      if (s.unilateral) return `${st.weight}kg (G:${st.repsLeft}/D:${st.repsRight})`;
      return `${st.weight}kg × ${st.reps}`;
    }).join('  •  ');

    return `
      <div style="padding:16px 0; border-bottom:1px solid var(--hairline);">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
          <span style="font-weight:900; font-size:0.95rem;">${formatDateShort(s.date)}</span>
          <span style="font-size:0.8rem; color:var(--volt); font-weight:800;">Max ${s.bestSetDesc} • 1RM ${s.best1RM}kg</span>
        </div>
        <div style="font-size:0.82rem; color:var(--text-dim);">${setsText}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="border-bottom:1.5px solid var(--volt); padding-bottom:8px; margin-bottom:8px;">
      <select id="stats-exo-select" style="width:100%; font-size:1.35rem; font-weight:900; letter-spacing:-0.03em; color:#fff; cursor:pointer;">
        ${optionsHtml}
      </select>
    </div>

    <!-- Open Sculptural Metrics Strip (Zero Boxes!) -->
    <div class="sculptural-metrics-strip">
      <div class="sculpt-metric">
        <span class="sculpt-metric-val" style="color:var(--volt);">${allTimeMaxWeight}<small>kg</small></span>
        <span class="sculpt-metric-lbl">Record Poids</span>
      </div>
      <div class="sculpt-metric">
        <span class="sculpt-metric-val">${allTimeBest1RM}<small>kg</small></span>
        <span class="sculpt-metric-lbl">1RM Estimé</span>
      </div>
      <div class="sculpt-metric">
        <span class="sculpt-metric-val">${allTimeMaxVol}<small>kg</small></span>
        <span class="sculpt-metric-lbl">Volume Max</span>
      </div>
    </div>

    ${currentExo.unilateral ? `
      <div class="balance-beam-wrap">
        <div class="balance-beam-labels">
          <span style="color:var(--ice);">GAUCHE ${leftPct}% (${sumLeft} reps)</span>
          <span style="color:var(--orchid);">(${sumRight} reps) ${rightPct}% DROITE</span>
        </div>
        <div class="balance-track">
          <div class="balance-fill-left" style="width:${leftPct}%;"></div>
          <div class="balance-fill-right" style="width:${rightPct}%;"></div>
        </div>
      </div>
    ` : ''}

    <!-- Full-Bleed Edge-to-Edge Horizon Wave -->
    <div class="full-bleed-chart-stage">
      <div class="chart-pills-bar">
        <button type="button" class="deck-pill ${metric === 'maxWeight' ? 'active' : ''}" data-action="set-stat-metric" data-metric="maxWeight">Charge Max</button>
        <button type="button" class="deck-pill ${metric === 'e1rm' ? 'active' : ''}" data-action="set-stat-metric" data-metric="e1rm">1RM Estimé</button>
        <button type="button" class="deck-pill ${metric === 'volume' ? 'active' : ''}" data-action="set-stat-metric" data-metric="volume">Volume</button>
        ${currentExo.unilateral ? `<button type="button" class="deck-pill ${metric === 'asymmetry' ? 'active' : ''}" data-action="set-stat-metric" data-metric="asymmetry">Gauche vs Droite</button>` : ''}
      </div>
      <div style="height:220px; width:100%;">
        ${buildSmoothSvgChart(sessions, metric)}
      </div>
    </div>

    <div class="runway-header">
      <span class="runway-title">Chronologie (${sessions.length})</span>
    </div>
    ${sessions.length ? sessionRowsHtml : '<div style="padding:16px 0; color:var(--text-ghost);">Valide une séance avec cet exercice pour tracer sa courbe.</div>'}
  `;

  const sel = document.getElementById('stats-exo-select');
  if (sel) {
    sel.addEventListener('change', (e) => {
      state.ui.selectedStatExoId = e.target.value;
      renderStatsTab();
    });
  }
}

function buildSmoothCurvePath(pts) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

function buildSmoothSvgChart(sessions, metric) {
  if (!sessions || sessions.length === 0) {
    return `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-ghost); font-size:0.86rem;">Aucune donnée sur cet exercice.</div>`;
  }

  const w = 520;
  const h = 210;
  const padL = 36;
  const padR = 36;
  const padT = 32;
  const padB = 32;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  if (metric === 'asymmetry') {
    const valsL = sessions.map((s) => s.totalRepsLeft);
    const valsR = sessions.map((s) => s.totalRepsRight);
    const allVals = [...valsL, ...valsR];
    const minV = Math.max(0, Math.min(...allVals) - 2);
    const maxV = Math.max(...allVals, minV + 4) + 2;

    const getX = (i) => sessions.length === 1 ? padL + plotW / 2 : padL + (i / (sessions.length - 1)) * plotW;
    const getY = (v) => padT + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;

    const ptsL = sessions.map((s, i) => ({ x: getX(i), y: getY(s.totalRepsLeft) }));
    const ptsR = sessions.map((s, i) => ({ x: getX(i), y: getY(s.totalRepsRight) }));

    const pathL = buildSmoothCurvePath(ptsL);
    const pathR = buildSmoothCurvePath(ptsR);

    const dotsL = ptsL.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#38bdf8" stroke="#050507" stroke-width="2"/>`).join('');
    const dotsR = ptsR.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#e879f9" stroke="#050507" stroke-width="2"/>`).join('');
    const labelsX = sessions.map((s, i) => `<text x="${getX(i)}" y="${h - 8}" fill="rgba(255,255,255,0.4)" font-size="11" font-weight="700" text-anchor="middle">${formatDateShort(s.date)}</text>`).join('');

    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
        <path d="${pathL}" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" />
        <path d="${pathR}" fill="none" stroke="#e879f9" stroke-width="3.5" stroke-dasharray="6,5" stroke-linecap="round" />
        ${dotsL}
        ${dotsR}
        ${labelsX}
      </svg>
    `;
  }

  const values = sessions.map((s) => {
    if (metric === 'e1rm') return s.best1RM;
    if (metric === 'volume') return s.totalVolume;
    return s.maxWeight;
  });

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padRange = (maxVal - minVal) === 0 ? Math.max(5, maxVal * 0.1) : (maxVal - minVal) * 0.22;
  const low = Math.max(0, minVal - padRange);
  const high = maxVal + padRange;

  const getX = (i) => sessions.length === 1 ? padL + plotW / 2 : padL + (i / (sessions.length - 1)) * plotW;
  const getY = (v) => padT + plotH - ((v - low) / (high - low || 1)) * plotH;

  const pts = values.map((v, i) => ({ x: getX(i), y: getY(v), v }));
  const curvePath = buildSmoothCurvePath(pts);
  const areaPath = pts.length > 1
    ? `${curvePath} L ${pts[pts.length - 1].x} ${padT + plotH} L ${pts[0].x} ${padT + plotH} Z`
    : '';

  const nodes = pts.map((p, i) => `
    <circle cx="${p.x}" cy="${p.y}" r="6" fill="#d4ff00" stroke="#050507" stroke-width="2.5" />
    <text x="${p.x}" y="${p.y - 12}" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">${p.v}</text>
    <text x="${p.x}" y="${h - 8}" fill="rgba(255,255,255,0.4)" font-size="11" font-weight="700" text-anchor="middle">${formatDateShort(sessions[i].date)}</text>
  `).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
      <defs>
        <linearGradient id="voltHorizon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d4ff00" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#d4ff00" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${pts.length > 1 ? `<path d="${areaPath}" fill="url(#voltHorizon)" />` : ''}
      ${pts.length > 1 ? `<path d="${curvePath}" fill="none" stroke="#d4ff00" stroke-width="3.5" stroke-linecap="round" />` : ''}
      ${nodes}
    </svg>
  `;
}

/* ==========================================================================
   Tab 4: Apple Watch & Cloud Sync (Frameless Rows)
   ========================================================================== */

function renderSettingsTab() {
  const container = document.getElementById('settings-container');
  const notifStatus = ('Notification' in window) ? Notification.permission : 'unsupported';

  container.innerHTML = `
    <div class="runway-header">
      <span class="runway-title">Apple Watch & Chrono (3m00 par défaut)</span>
    </div>

    <div style="padding:16px 0; border-bottom:1px solid var(--hairline); display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <div>
        <div style="font-weight:800; font-size:0.98rem;">Notifications iOS / Watch</div>
        <div style="font-size:0.78rem; color:var(--text-dim); margin-top:2px;">Fait vibrer l'Apple Watch quand l'iPhone est verrouillé</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-action="request-notif-perm">
        ${notifStatus === 'granted' ? 'Activé' : 'Activer'}
      </button>
    </div>

    <div style="padding:16px 0; border-bottom:1px solid var(--hairline); display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <div>
        <div style="font-weight:800; font-size:0.98rem;">Relais Minuteur Natif Watch</div>
        <div style="font-size:0.78rem; color:var(--text-dim); margin-top:2px;">Lance automatiquement le minuteur Apple Watch à chaque série</div>
      </div>
      <input type="checkbox" id="toggle-watch-shortcut" ${state.settings.watchShortcutAuto ? 'checked' : ''} style="width:24px; height:24px; accent-color:var(--volt);" />
    </div>

    <div style="padding:14px 0 28px;">
      <button type="button" class="btn btn-ghost" data-action="open-watch-guide">
        Guide Raccourci iOS "IronPulse Timer" →
      </button>
    </div>

    <div class="runway-header">
      <span class="runway-title">Synchronisation Cloud & Fichier</span>
    </div>

    <div style="padding:12px 0 20px; border-bottom:1px solid var(--hairline);">
      <input type="text" id="cloud-url-input" class="open-input-line" placeholder="URL Firebase Realtime Database (optionnel)..." value="${escapeAttr(state.settings.cloudUrl || '')}" />
      ${state.settings.lastCloudSync ? `<div style="font-size:0.76rem; color:var(--volt); margin-top:8px; font-weight:700;">Dernière synchro : ${new Date(state.settings.lastCloudSync).toLocaleString('fr-FR')}</div>` : ''}
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button type="button" class="btn btn-primary btn-sm" data-action="cloud-push">Envoyer Cloud</button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="cloud-pull">Restaurer Cloud</button>
      </div>
    </div>

    <div style="padding:20px 0; display:flex; gap:10px;">
      <button type="button" class="btn btn-secondary btn-sm" style="flex:1;" data-action="export-json">Exporter .json</button>
      <label class="btn btn-secondary btn-sm" style="flex:1; cursor:pointer;">
        Importer .json
        <input type="file" id="import-json-input" accept=".json,application/json" style="display:none;" />
      </label>
    </div>
  `;

  const watchToggle = document.getElementById('toggle-watch-shortcut');
  if (watchToggle) {
    watchToggle.addEventListener('change', (e) => {
      state.settings.watchShortcutAuto = e.target.checked;
      saveState();
      showToast(e.target.checked ? 'Relais Apple Watch activé' : 'Relais désactivé');
    });
  }

  const cloudInput = document.getElementById('cloud-url-input');
  if (cloudInput) {
    cloudInput.addEventListener('change', (e) => {
      state.settings.cloudUrl = e.target.value.trim();
      saveState();
    });
  }

  const importInput = document.getElementById('import-json-input');
  if (importInput) {
    importInput.addEventListener('change', handleJsonImport);
  }
}

/* ==========================================================================
   Modals (Default 180s = 3 minutes everywhere)
   ========================================================================== */

function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function openExerciseModal(exoId = null, onCreatedCallback = null) {
  const existing = exoId ? getExercise(exoId) : null;
  openModal(existing ? 'Modifier l’exercice' : 'Nouvel exercice', `
    <form id="exo-form" style="display:flex; flex-direction:column; gap:18px;">
      <div>
        <input type="text" name="name" class="open-input-line" required placeholder="Nom de l'exercice..." value="${escapeAttr(existing ? existing.name : '')}" />
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0;">
        <div>
          <div style="font-weight:800; font-size:0.95rem;">Unilatéral (Gauche / Droite séparés)</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">Active les cadrans G et D sur chaque série</div>
        </div>
        <input type="checkbox" name="unilateral" ${existing && existing.unilateral ? 'checked' : ''} style="width:24px; height:24px; accent-color:var(--volt);" />
      </div>
      <div style="display:grid; grid-template-columns:1fr 1.5fr; gap:16px;">
        <div>
          <span style="font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase;">Repos (sec)</span>
          <input type="number" name="defaultRest" class="open-input-line" value="${existing ? existing.defaultRest : DEFAULT_REST_SEC}" />
        </div>
        <div>
          <span style="font-size:0.7rem; font-weight:800; color:var(--text-dim); text-transform:uppercase;">Note réglage</span>
          <input type="text" name="note" class="open-input-line" placeholder="Siège 4, poulie 2..." value="${escapeAttr(existing ? existing.note || '' : '')}" />
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-block" style="margin-top:8px;">Enregistrer</button>
    </form>
  `);

  document.getElementById('exo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    if (!name) return;

    if (existing) {
      existing.name = name;
      existing.defaultRest = parseInt(fd.get('defaultRest')) || DEFAULT_REST_SEC;
      existing.unilateral = fd.get('unilateral') === 'on';
      existing.note = fd.get('note').trim();
    } else {
      const newExo = {
        id: uid('ex'),
        name,
        muscle: 'Général',
        defaultRest: parseInt(fd.get('defaultRest')) || DEFAULT_REST_SEC,
        unilateral: fd.get('unilateral') === 'on',
        note: fd.get('note').trim()
      };
      state.exercises.push(newExo);
      if (onCreatedCallback) onCreatedCallback(newExo);
    }

    saveState();
    closeModal();
    renderAll();
    showToast('Exercice enregistré');
  });
}

function openTemplateModal(templateId = null) {
  const existing = templateId ? state.templates.find((t) => t.id === templateId) : null;
  let draftName = existing ? existing.name : '';

  let draftItems = existing
    ? existing.items.map((it) => {
        const ex = getExercise(it.exerciseId);
        return {
          exoName: ex ? ex.name : '',
          unilateral: ex ? !!ex.unilateral : false,
          setsCount: it.setsCount || 3,
          targetReps: it.targetReps || '8-12',
          restSeconds: it.restSeconds || DEFAULT_REST_SEC
        };
      })
    : [
        { exoName: '', unilateral: false, setsCount: 3, targetReps: '8-10', restSeconds: DEFAULT_REST_SEC }
      ];

  function renderModalContent(focusIndex = null) {
    const datalistOptions = state.exercises.map(
      (ex) => `<option value="${escapeAttr(ex.name)}"></option>`
    ).join('');

    const itemsHtml = draftItems.map((it, idx) => `
      <div style="padding:16px 0; border-bottom:1px solid var(--hairline);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-weight:900; font-size:0.74rem; color:var(--volt); letter-spacing:0.1em;">MOUVEMENT 0${idx + 1}</span>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="glass-tag ${it.unilateral ? 'uni' : 'bi'} tpl-toggle-uni" data-idx="${idx}">
              ${it.unilateral ? '🦿 Unilatéral G/D' : '🏋️ Bilatéral'}
            </button>
            ${idx > 0 ? `<button type="button" class="circle-icon-btn tpl-move-up" style="width:28px; height:28px;" data-idx="${idx}">↑</button>` : ''}
            ${idx < draftItems.length - 1 ? `<button type="button" class="circle-icon-btn tpl-move-down" style="width:28px; height:28px;" data-idx="${idx}">↓</button>` : ''}
            ${draftItems.length > 1 ? `<button type="button" class="circle-icon-btn tpl-remove-item" style="width:28px; height:28px;" data-idx="${idx}">${ICONS.close}</button>` : ''}
          </div>
        </div>

        <input
          type="text"
          list="existing-exos-datalist"
          class="open-input-line tpl-exo-name-input"
          data-idx="${idx}"
          placeholder="Tape le nom de l'exercice..."
          value="${escapeAttr(it.exoName)}"
          style="margin-bottom:12px;"
        />

        <div style="display:flex; gap:18px; align-items:baseline;">
          <label style="display:flex; align-items:baseline; gap:6px; flex:1;">
            <input type="number" class="open-input-line tpl-sets-input" style="font-size:1.25rem; font-weight:900; padding:4px 0;" data-idx="${idx}" value="${it.setsCount}" min="1" max="15" />
            <span style="font-size:0.72rem; color:var(--text-dim); font-weight:800;">SÉRIES</span>
          </label>
          <label style="display:flex; align-items:baseline; gap:6px; flex:1.2;">
            <input type="text" class="open-input-line tpl-reps-input" style="font-size:1.25rem; font-weight:900; padding:4px 0;" data-idx="${idx}" value="${escapeAttr(it.targetReps)}" placeholder="8-10" />
            <span style="font-size:0.72rem; color:var(--text-dim); font-weight:800;">REPS</span>
          </label>
          <label style="display:flex; align-items:baseline; gap:6px; flex:1;">
            <input type="number" class="open-input-line tpl-rest-input" style="font-size:1.25rem; font-weight:900; padding:4px 0;" data-idx="${idx}" value="${it.restSeconds || DEFAULT_REST_SEC}" step="15" />
            <span style="font-size:0.72rem; color:var(--text-dim); font-weight:800;">SEC</span>
          </label>
        </div>
      </div>
    `).join('');

    openModal(existing ? 'Modifier la séance' : 'Composer une séance', `
      <datalist id="existing-exos-datalist">${datalistOptions}</datalist>
      <div style="margin-bottom:12px;">
        <input type="text" id="tpl-name-input" class="open-input-line" style="font-size:1.45rem; font-weight:900;" placeholder="Titre de la séance (ex: Push, Pull...)" value="${escapeAttr(draftName)}" />
      </div>
      <div id="tpl-items-wrap">${itemsHtml}</div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-top:18px;">
        <button type="button" class="btn btn-secondary btn-block" id="tpl-add-exo-btn">
          + Ajouter un mouvement (ou touche Entrée)
        </button>
        <button type="button" class="btn btn-primary btn-block" id="tpl-save-btn">
          Enregistrer la séance
        </button>
      </div>
    `);

    if (focusIndex !== null) {
      const targetInput = document.querySelector(`.tpl-exo-name-input[data-idx="${focusIndex}"]`);
      if (targetInput) targetInput.focus();
    }

    document.getElementById('tpl-name-input').addEventListener('input', (e) => {
      draftName = e.target.value;
    });

    document.querySelectorAll('.tpl-exo-name-input').forEach((el) => {
      el.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const val = e.target.value;
        draftItems[i].exoName = val;
        const match = state.exercises.find((ex) => ex.name.toLowerCase() === val.trim().toLowerCase());
        if (match) {
          draftItems[i].unilateral = !!match.unilateral;
          draftItems[i].restSeconds = match.defaultRest || DEFAULT_REST_SEC;
        }
      });

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          draftItems.push({ exoName: '', unilateral: false, setsCount: 3, targetReps: '8-10', restSeconds: DEFAULT_REST_SEC });
          renderModalContent(draftItems.length - 1);
        }
      });
    });

    document.querySelectorAll('.tpl-toggle-uni').forEach((el) => {
      el.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        draftItems[i].unilateral = !draftItems[i].unilateral;
        renderModalContent();
      });
    });

    document.querySelectorAll('.tpl-sets-input').forEach((el) => {
      el.addEventListener('input', (e) => { draftItems[parseInt(e.target.dataset.idx)].setsCount = parseInt(e.target.value) || 3; });
    });

    document.querySelectorAll('.tpl-reps-input').forEach((el) => {
      el.addEventListener('input', (e) => { draftItems[parseInt(e.target.dataset.idx)].targetReps = e.target.value; });
    });

    document.querySelectorAll('.tpl-rest-input').forEach((el) => {
      el.addEventListener('input', (e) => { draftItems[parseInt(e.target.dataset.idx)].restSeconds = parseInt(e.target.value) || DEFAULT_REST_SEC; });
    });

    document.querySelectorAll('.tpl-remove-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        draftItems.splice(parseInt(e.currentTarget.dataset.idx), 1);
        renderModalContent();
      });
    });

    document.querySelectorAll('.tpl-move-up').forEach((el) => {
      el.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        [draftItems[i - 1], draftItems[i]] = [draftItems[i], draftItems[i - 1]];
        renderModalContent();
      });
    });

    document.querySelectorAll('.tpl-move-down').forEach((el) => {
      el.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        [draftItems[i + 1], draftItems[i]] = [draftItems[i], draftItems[i + 1]];
        renderModalContent();
      });
    });

    document.getElementById('tpl-add-exo-btn').addEventListener('click', () => {
      draftItems.push({
        exoName: '',
        unilateral: false,
        setsCount: 3,
        targetReps: '8-10',
        restSeconds: DEFAULT_REST_SEC
      });
      renderModalContent(draftItems.length - 1);
    });

    document.getElementById('tpl-save-btn').addEventListener('click', () => {
      const finalName = draftName.trim() || 'Ma Séance';
      const resolvedItems = [];

      draftItems.forEach((it) => {
        const clean = (it.exoName || '').trim();
        if (!clean) return;
        const exoObj = findOrCreateExerciseByName(clean, it.unilateral, it.restSeconds);
        if (exoObj) {
          resolvedItems.push({
            exerciseId: exoObj.id,
            setsCount: parseInt(it.setsCount) || 3,
            targetReps: it.targetReps || '8-10',
            restSeconds: parseInt(it.restSeconds) || DEFAULT_REST_SEC
          });
        }
      });

      if (resolvedItems.length === 0) {
        showToast('Tape le nom d’au moins un exercice');
        return;
      }

      if (existing) {
        existing.name = finalName;
        existing.items = resolvedItems;
      } else {
        state.templates.push({ id: uid('tpl'), name: finalName, items: resolvedItems });
      }
      saveState();
      closeModal();
      renderAll();
      showToast('Séance enregistrée !');
    });
  }

  renderModalContent(0);
}

function openWatchGuideModal() {
  openModal('Relais Apple Watch', `
    <div style="font-size:0.9rem; line-height:1.6; color:var(--text-dim);">
      <p style="margin-bottom:14px;">
        Pour déclencher le vrai minuteur natif de ton Apple Watch automatiquement depuis l'appli :
      </p>
      <div style="padding-left:16px; border-left:2px solid var(--volt); color:#fff;">
        <strong>1.</strong> Ouvre l'app <strong>Raccourcis</strong> sur ton iPhone.<br/><br/>
        <strong>2.</strong> Crée un raccourci nommé exactement :<br/>
        <span style="color:var(--volt); font-weight:900;">IronPulse Timer</span><br/><br/>
        <strong>3.</strong> Ajoute l'action <strong>Démarrer le minuteur</strong>.<br/><br/>
        <strong>4.</strong> Maintiens le doigt sur la durée → choisis <strong>Entrée du raccourci</strong> en <strong>Secondes</strong>.
      </div>
    </div>
  `);
}

/* ==========================================================================
   Events
   ========================================================================== */

function setupEvents() {
  document.querySelectorAll('.dock-item').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.getElementById('timer-minus-15').addEventListener('click', () => adjustRestTimer(-15));
  document.getElementById('timer-plus-15').addEventListener('click', () => adjustRestTimer(15));
  document.getElementById('timer-skip').addEventListener('click', stopRestTimer);
  document.getElementById('timer-watch-trigger').addEventListener('click', () => {
    const rem = Math.max(5, Math.ceil((restTimer.endTime - Date.now()) / 1000));
    triggerWatchShortcut(rem);
  });

  const main = document.getElementById('main-content');

  main.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'start-template') {
      startWorkoutFromTemplate(btn.dataset.id);
    } else if (action === 'start-empty-workout') {
      startEmptyWorkout();
    } else if (action === 'focus-exo-pill') {
      const raw = btn.dataset.idx;
      state.ui.focusedExoIdx = raw === 'all' ? 'all' : parseInt(raw);
      renderWorkoutTab();
    } else if (action === 'toggle-live-unilateral') {
      const idx = parseInt(btn.dataset.exoIdx);
      const wExo = state.activeWorkout.exercises[idx];
      wExo.unilateral = !wExo.unilateral;
      const libExo = getExercise(wExo.exerciseId);
      if (libExo) libExo.unilateral = wExo.unilateral;
      saveState();
      renderWorkoutTab();
    } else if (action === 'cycle-set-tag') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      const setIdx = parseInt(btn.dataset.setIdx);
      const s = state.activeWorkout.exercises[exoIdx].sets[setIdx];
      const order = ['1', 'W', 'D', 'F'];
      const cur = ['W', 'D', 'F'].includes(s.tag) ? s.tag : '1';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      s.tag = next === '1' ? String(setIdx + 1) : next;
      saveState();
      renderWorkoutTab();
    } else if (action === 'cycle-rir') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      const setIdx = parseInt(btn.dataset.setIdx);
      const s = state.activeWorkout.exercises[exoIdx].sets[setIdx];
      const rirs = ['', '0', '1', '2', '3+'];
      s.rir = rirs[(rirs.indexOf(s.rir || '') + 1) % rirs.length];
      saveState();
      renderWorkoutTab();
    } else if (action === 'copy-prev-set') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      const setIdx = parseInt(btn.dataset.setIdx);
      const wExo = state.activeWorkout.exercises[exoIdx];
      const s = wExo.sets[setIdx];
      const prevPerf = getPreviousExercisePerf(wExo.exerciseId);
      const prevSet = prevPerf && prevPerf.sets[setIdx]
        ? prevPerf.sets[setIdx]
        : (prevPerf && prevPerf.sets.length ? prevPerf.sets[prevPerf.sets.length - 1] : null);
      if (prevSet) {
        s.weight = String(prevSet.weight ?? '');
        if (wExo.unilateral) {
          s.repsLeft = String(prevSet.repsLeft ?? prevSet.reps ?? '');
          s.repsRight = String(prevSet.repsRight ?? prevSet.reps ?? '');
        } else {
          s.reps = String(prevSet.reps ?? prevSet.repsLeft ?? '');
        }
        saveState();
        renderWorkoutTab();
        showToast('Charges copiées');
      }
    } else if (action === 'toggle-set-done') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      const setIdx = parseInt(btn.dataset.setIdx);
      const wExo = state.activeWorkout.exercises[exoIdx];
      const s = wExo.sets[setIdx];
      s.done = !s.done;

      if (s.done) {
        const pr = checkSetPR(wExo.exerciseId, s, wExo.unilateral);
        s.prBadge = pr;
        if (pr) showToast(`Nouveau Record (${pr}) !`, true);
        if (state.settings.autoStartTimer) {
          const exoObj = getExercise(wExo.exerciseId);
          startRestTimer(wExo.restSeconds || DEFAULT_REST_SEC, exoObj ? exoObj.name : 'Exercice');
        }
      } else {
        s.prBadge = null;
      }

      saveState();
      renderWorkoutTab();
    } else if (action === 'add-live-set') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      const wExo = state.activeWorkout.exercises[exoIdx];
      const lastSet = wExo.sets[wExo.sets.length - 1] || {};
      wExo.sets.push({
        id: uid('set'),
        tag: String(wExo.sets.length + 1),
        weight: lastSet.weight || '',
        reps: lastSet.reps || '',
        repsLeft: lastSet.repsLeft || '',
        repsRight: lastSet.repsRight || '',
        rir: '',
        done: false
      });
      saveState();
      renderWorkoutTab();
    } else if (action === 'remove-live-set') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      const wExo = state.activeWorkout.exercises[exoIdx];
      if (wExo.sets.length > 1) {
        wExo.sets.pop();
        saveState();
        renderWorkoutTab();
      }
    } else if (action === 'edit-live-rest') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      const wExo = state.activeWorkout.exercises[exoIdx];
      const val = prompt('Temps de repos (secondes) :', wExo.restSeconds || DEFAULT_REST_SEC);
      if (val !== null) {
        wExo.restSeconds = Math.max(15, parseInt(val) || DEFAULT_REST_SEC);
        saveState();
        renderWorkoutTab();
      }
    } else if (action === 'swap-live-exo') {
      openSwapOrAddExoModal(parseInt(btn.dataset.exoIdx));
    } else if (action === 'add-exo-to-live') {
      openSwapOrAddExoModal(null);
    } else if (action === 'remove-live-exo') {
      state.activeWorkout.exercises.splice(parseInt(btn.dataset.exoIdx), 1);
      saveState();
      renderWorkoutTab();
    } else if (action === 'open-exo-stats-quick') {
      state.ui.selectedStatExoId = btn.dataset.exoId;
      switchTab('stats');
    } else if (action === 'finish-workout') {
      finishActiveWorkout();
    } else if (action === 'cancel-workout') {
      if (confirm('Abandonner la séance en cours ?')) {
        state.activeWorkout = null;
        stopRestTimer();
        saveState();
        renderWorkoutTab();
      }
    } else if (action === 'create-template') {
      openTemplateModal(null);
    } else if (action === 'edit-template') {
      openTemplateModal(btn.dataset.id);
    } else if (action === 'delete-template') {
      if (confirm('Supprimer cette séance ?')) {
        state.templates = state.templates.filter((t) => t.id !== btn.dataset.id);
        saveState();
        renderTemplatesTab();
      }
    } else if (action === 'create-exercise') {
      openExerciseModal(null);
    } else if (action === 'edit-exercise') {
      openExerciseModal(btn.dataset.id);
    } else if (action === 'delete-exercise') {
      if (confirm('Supprimer cet exercice ?')) {
        state.exercises = state.exercises.filter((ex) => ex.id !== btn.dataset.id);
        saveState();
        renderTemplatesTab();
      }
    } else if (action === 'set-stat-metric') {
      state.ui.statMetric = btn.dataset.metric;
      renderStatsTab();
    } else if (action === 'delete-history-wk') {
      if (confirm('Supprimer cette séance de l’historique ?')) {
        state.history = state.history.filter((h) => h.id !== btn.dataset.id);
        saveState();
        renderWorkoutTab();
      }
    } else if (action === 'view-history-wk') {
      openHistoryDetailModal(btn.dataset.id);
    } else if (action === 'request-notif-perm') {
      if ('Notification' in window) {
        Notification.requestPermission().then(() => renderSettingsTab());
      } else {
        showToast('Ajoute d’abord l’app sur l’écran d’accueil');
      }
    } else if (action === 'open-watch-guide') {
      openWatchGuideModal();
    } else if (action === 'cloud-push') {
      syncToCloud(false);
    } else if (action === 'cloud-pull') {
      restoreFromCloud();
    } else if (action === 'export-json') {
      exportDataJson();
    }
  });

  main.addEventListener('input', (e) => {
    const inputType = e.target.dataset.input;
    if (!inputType) return;

    if (inputType === 'exo-note') {
      const exo = getExercise(e.target.dataset.exoId);
      if (exo) {
        exo.note = e.target.value;
        saveState();
      }
      return;
    }

    if (!state.activeWorkout) return;
    const exoIdx = parseInt(e.target.dataset.exoIdx);
    const setIdx = parseInt(e.target.dataset.setIdx);
    const s = state.activeWorkout.exercises[exoIdx]?.sets[setIdx];
    if (!s) return;

    s[inputType] = e.target.value;
    saveState();
  });
}

function openSwapOrAddExoModal(replaceIdx = null) {
  let modalUni = false;

  function renderPicker() {
    const listHtml = state.exercises.map((ex) => `
      <div class="pick-live-exo-btn" data-id="${ex.id}" style="padding:14px 0; border-bottom:1px solid var(--hairline); cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:800; font-size:1rem;">${escapeHtml(ex.name)}</span>
        <span class="glass-tag ${ex.unilateral ? 'uni' : 'bi'}">${ex.unilateral ? 'Unilatéral G/D' : 'Bilatéral'}</span>
      </div>
    `).join('');

    openModal(replaceIdx !== null ? 'Remplacer le mouvement' : 'Ajouter un mouvement', `
      <form id="modal-instant-exo-form" style="padding-bottom:18px; border-bottom:1px solid var(--hairline); margin-bottom:14px;">
        <input type="text" id="modal-instant-exo-name" class="open-input-line" placeholder="Tape un nouvel exercice..." required />
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
          <button type="button" id="modal-instant-uni" class="glass-tag ${modalUni ? 'uni' : 'bi'}">
            ${modalUni ? '🦿 Unilatéral G/D' : '🏋️ Bilatéral'}
          </button>
          <button type="submit" class="btn btn-primary btn-sm">+ Créer & Choisir</button>
        </div>
      </form>
      <div>${listHtml}</div>
    `);

    document.getElementById('modal-instant-uni').addEventListener('click', () => {
      modalUni = !modalUni;
      renderPicker();
    });

    document.getElementById('modal-instant-exo-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('modal-instant-exo-name').value.trim();
      if (!name) return;
      const created = findOrCreateExerciseByName(name, modalUni, DEFAULT_REST_SEC);
      if (created) {
        applyLiveExerciseSelection(created.id, replaceIdx);
        closeModal();
      }
    });

    document.querySelectorAll('.pick-live-exo-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyLiveExerciseSelection(btn.dataset.id, replaceIdx);
        closeModal();
      });
    });
  }

  renderPicker();
}

function applyLiveExerciseSelection(exerciseId, replaceIdx) {
  const exo = getExercise(exerciseId);
  if (!exo || !state.activeWorkout) return;
  const isUni = !!exo.unilateral;
  const prev = getPreviousExercisePerf(exerciseId);

  const newSets = [0, 1, 2].map((i) => {
    const prevSet = prev && prev.sets[i] ? prev.sets[i] : null;
    return {
      id: uid('set'),
      tag: String(i + 1),
      weight: prevSet ? String(prevSet.weight ?? '') : '',
      reps: !isUni && prevSet ? String(prevSet.reps ?? '') : '',
      repsLeft: isUni && prevSet ? String(prevSet.repsLeft ?? '') : '',
      repsRight: isUni && prevSet ? String(prevSet.repsRight ?? '') : '',
      rir: '',
      done: false
    };
  });

  const block = {
    id: uid('wexo'),
    exerciseId: exo.id,
    targetReps: '8-10',
    restSeconds: exo.defaultRest || DEFAULT_REST_SEC,
    unilateral: isUni,
    sets: newSets
  };

  if (replaceIdx !== null) {
    state.activeWorkout.exercises[replaceIdx] = block;
    state.ui.focusedExoIdx = replaceIdx;
  } else {
    state.activeWorkout.exercises.push(block);
    state.ui.focusedExoIdx = state.activeWorkout.exercises.length - 1;
  }
  saveState();
  renderWorkoutTab();
}

function finishActiveWorkout() {
  const wk = state.activeWorkout;
  if (!wk) return;

  let anyDone = false;
  wk.exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      const hasWeight = parseFloat(s.weight) > 0;
      const hasReps = ex.unilateral
        ? (parseInt(s.repsLeft) > 0 || parseInt(s.repsRight) > 0)
        : (parseInt(s.reps) > 0);
      if (s.done || (hasWeight && hasReps)) {
        s.done = true;
        anyDone = true;
      }
    });
  });

  if (!anyDone) {
    showToast('Valide au moins une série');
    return;
  }

  const durationSec = Math.max(60, Math.floor((Date.now() - wk.startedAt) / 1000));
  state.history.push({
    id: wk.id,
    templateId: wk.templateId,
    name: wk.name,
    date: new Date().toISOString(),
    durationSec,
    exercises: wk.exercises
  });

  state.activeWorkout = null;
  stopRestTimer();
  saveState(true);
  renderAll();
  showToast('Séance enregistrée !', true);
}

function openHistoryDetailModal(wkId) {
  const wk = state.history.find((h) => h.id === wkId);
  if (!wk) return;

  const html = (wk.exercises || []).map((ex) => {
    const exoObj = getExercise(ex.exerciseId);
    const setsLines = (ex.sets || []).filter((s) => s.done).map((s, i) => {
      const perf = ex.unilateral
        ? `${s.weight} kg/côté • G: ${s.repsLeft} | D: ${s.repsRight}`
        : `${s.weight} kg × ${s.reps} reps`;
      return `<div style="font-size:0.86rem; padding:4px 0; color:var(--text-dim);">0${i + 1} — <strong style="color:#fff;">${perf}</strong></div>`;
    }).join('');

    return `
      <div style="padding:14px 0; border-bottom:1px solid var(--hairline);">
        <div style="font-weight:900; font-size:1.05rem; margin-bottom:6px;">${escapeHtml(exoObj ? exoObj.name : 'Exercice')}</div>
        ${setsLines}
      </div>
    `;
  }).join('');

  openModal(`${wk.name}`, html);
}

function exportDataJson() {
  const dataStr = JSON.stringify({
    exportedAt: new Date().toISOString(),
    exercises: state.exercises,
    templates: state.templates,
    history: state.history
  }, null, 2);

  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Sauvegarde exportée');
}

function handleJsonImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!Array.isArray(parsed.exercises)) throw new Error('Invalid');
      state.exercises = parsed.exercises;
      state.templates = parsed.templates || [];
      state.history = parsed.history || [];
      saveState();
      renderAll();
      showToast('Sauvegarde importée');
    } catch {
      showToast('Fichier invalide');
    }
  };
  reader.readAsText(file);
}

function switchTab(tabName) {
  state.ui.activeTab = tabName;
  document.querySelectorAll('.tab-view').forEach((sec) => sec.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');

  document.querySelectorAll('.dock-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });

  const kickers = {
    workout: state.activeWorkout ? 'EN DIRECT' : "AUJOURD'HUI",
    templates: 'ARCHITECTURE',
    stats: 'TRAJECTOIRE',
    settings: 'SYSTÈME'
  };
  const titles = {
    workout: state.activeWorkout ? 'Séance active' : 'Entraînement',
    templates: 'Programmes',
    stats: 'Courbes & PR',
    settings: 'Watch & Cloud'
  };
  document.getElementById('page-kicker').textContent = kickers[tabName] || 'PULSE';
  document.getElementById('page-title').textContent = titles[tabName] || 'PULSE';
  renderAll();
}

function renderAll() {
  updateLiveWorkoutIndicators();
  renderWorkoutTab();
  renderTemplatesTab();
  renderStatsTab();
  renderSettingsTab();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}

async function initApp() {
  await loadState();
  setupEvents();
  renderAll();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', initApp);
