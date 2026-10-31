/* ==========================================================================
   PULSE — iOS Liquid Glass Gym Tracker
   ========================================================================== */

const STORAGE_KEY = 'pulse_user_data_v1';
const IDB_NAME = 'PulseUserDB';
const IDB_STORE = 'state';

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>`,
  check: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  swap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>`,
  chart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 5-6"/></svg>`,
  close: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  edit: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  pin: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
  history: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`
};

// Clean user state (0 pre-installed exercises, you build your own!)
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
    quickAddUni: false
  }
};

let restTimer = {
  active: false,
  totalSec: 90,
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
  // Remove old demo data key if present
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
   Helpers & Auto-Create Exercise By Name
   ========================================================================== */

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getExercise(id) {
  return state.exercises.find((e) => e.id === id) || null;
}

function findOrCreateExerciseByName(rawName, isUnilateral = false, defaultRest = 90) {
  const cleanName = (rawName || '').trim();
  if (!cleanName) return null;

  const existing = state.exercises.find(
    (e) => e.name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  if (existing) {
    existing.unilateral = !!isUnilateral;
    if (defaultRest) existing.defaultRest = parseInt(defaultRest) || 90;
    return existing;
  }

  const created = {
    id: uid('ex'),
    name: cleanName,
    muscle: 'Général',
    unilateral: !!isUnilateral,
    defaultRest: parseInt(defaultRest) || 90,
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
   Dynamic Island Rest Timer & Apple Watch Relay
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
  const dur = Math.max(15, parseInt(seconds) || 90);
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
   Tab 1: Workout Launcher & Active Workout
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
      restSeconds: item.restSeconds || (exo ? exo.defaultRest : 90) || 90,
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

  saveState();
  switchTab('workout');
  renderWorkoutTab();
  showToast(`${tpl.name} démarrée`, true);
}

function startEmptyWorkout() {
  state.activeWorkout = {
    id: uid('wk'),
    templateId: null,
    name: 'Séance Libre',
    startedAt: Date.now(),
    exercises: []
  };
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
    <div style="background:rgba(208,253,62,0.14); color:var(--volt); padding:7px 14px; border-radius:999px; font-size:0.84rem; font-weight:800; font-variant-numeric:tabular-nums; display:flex; align-items:center; gap:6px;">
      <span style="width:7px; height:7px; border-radius:50%; background:var(--volt);"></span>
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

  const templatesHtml = state.templates.length === 0
    ? `
      <div class="card" style="text-align:center; padding:32px 20px;">
        <div style="font-size:1.15rem; font-weight:800; margin-bottom:6px;">Crée ton premier programme</div>
        <p style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:18px; line-height:1.45;">
          Tape directement le nom de tes exercices dans ta séance type (tu n'as même pas besoin de les créer à l'avance).
        </p>
        <button type="button" class="btn btn-primary" data-action="create-template">+ Créer ma première séance</button>
      </div>
    `
    : state.templates.map((tpl) => {
        const pills = tpl.items.map((it) => {
          const exo = getExercise(it.exerciseId);
          if (!exo) return '';
          return `
            <span class="soft-pill">
              ${escapeHtml(exo.name)}
              <strong>${it.setsCount}×${escapeHtml(it.targetReps)}</strong>
            </span>
          `;
        }).join('');

        return `
          <div class="workout-program-card" data-action="start-template" data-id="${tpl.id}">
            <div class="workout-program-top">
              <div>
                <div class="workout-program-title">${escapeHtml(tpl.name)}</div>
                <div class="workout-program-sub">${tpl.items.length} exercices programmés</div>
              </div>
              <button type="button" class="play-circle-btn" data-action="start-template" data-id="${tpl.id}">
                ${ICONS.play}
              </button>
            </div>
            <div class="pill-cloud">${pills}</div>
          </div>
        `;
      }).join('');

  const recentHistory = [...state.history]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const historyHtml = recentHistory.length === 0
    ? `<div class="card" style="color:var(--text-secondary); font-size:0.86rem;">Aucune séance enregistrée pour le moment.</div>`
    : recentHistory.map((wk) => {
        const totalSets = (wk.exercises || []).reduce((acc, ex) => acc + (ex.sets || []).filter((s) => s.done).length, 0);
        return `
          <div class="card" style="padding:16px 18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="cursor:pointer; flex:1;" data-action="view-history-wk" data-id="${wk.id}">
              <div style="font-weight:800; font-size:0.98rem; letter-spacing:-0.01em;">${escapeHtml(wk.name)}</div>
              <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:4px; font-weight:500;">
                ${formatDateShort(wk.date)} • ${(wk.exercises || []).length} exos • ${totalSets} séries
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button type="button" class="circle-icon-btn" data-action="delete-history-wk" data-id="${wk.id}" title="Supprimer">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        `;
      }).join('');

  container.innerHTML = `
    <div class="hero-summary">
      <div class="hero-summary-left">
        <span class="hero-summary-title">BILAN GLOBAL</span>
        <div class="hero-summary-val"><span>${totalSessions}</span> séances • ${(totalVolumeAll / 1000).toFixed(1)}t</div>
      </div>
      <button type="button" class="btn btn-ghost" data-action="start-empty-workout">+ Libre</button>
    </div>

    <div class="section-header">
      <span class="section-title">Mes Séances</span>
      ${state.templates.length > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-action="create-template">+ Nouvelle</button>` : ''}
    </div>
    <div class="template-grid">
      ${templatesHtml}
    </div>

    <div class="section-header" style="margin-top:28px;">
      <span class="section-title">Historique récent</span>
    </div>
    ${historyHtml}
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

  const blocksHtml = wk.exercises.map((wExo, exoIdx) => {
    const exo = getExercise(wExo.exerciseId) || {
      id: wExo.exerciseId,
      name: 'Exercice',
      muscle: 'Général',
      unilateral: wExo.unilateral,
      note: ''
    };
    const isUni = !!wExo.unilateral;
    const prevPerf = getPreviousExercisePerf(wExo.exerciseId);

    let normalCounter = 0;
    const setsHtml = wExo.sets.map((s, setIdx) => {
      if (!['W', 'D', 'F'].includes(s.tag)) normalCounter++;
      const displayTag = ['W', 'D', 'F'].includes(s.tag) ? s.tag : `S${normalCounter}`;
      const tagClass = ['W', 'D', 'F'].includes(s.tag) ? `set-badge-${s.tag}` : '';

      const prevSet = prevPerf && prevPerf.sets[setIdx]
        ? prevPerf.sets[setIdx]
        : (prevPerf && prevPerf.sets.length ? prevPerf.sets[prevPerf.sets.length - 1] : null);

      let prevText = 'Première fois';
      if (prevSet) {
        if (prevPerf.unilateral || (prevSet.repsLeft !== undefined && prevSet.repsLeft !== '')) {
          prevText = `Dernière : <strong>${prevSet.weight}kg</strong> (G:${prevSet.repsLeft || 0} • D:${prevSet.repsRight || 0})`;
        } else {
          prevText = `Dernière : <strong>${prevSet.weight}kg × ${prevSet.reps}</strong>`;
        }
      }

      const rirDisplay = s.rir ? `RIR ${s.rir}` : 'RIR';

      return `
        <div class="set-capsule ${s.done ? 'completed' : ''}" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
          <div class="set-capsule-top">
            <div class="set-capsule-left">
              <button type="button" class="set-badge-pill ${tagClass}" data-action="cycle-set-tag" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
                ${displayTag}
              </button>
              <button type="button" class="prev-history-pill" data-action="copy-prev-set" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
                ${ICONS.history}
                <span>${s.prBadge ? `🏆 <strong>${s.prBadge}</strong>` : prevText}</span>
              </button>
            </div>
            <button type="button" class="rir-pill-btn ${s.rir ? 'has-rir' : ''}" data-action="cycle-rir" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              ${rirDisplay}
            </button>
          </div>

          <div class="set-capsule-inputs">
            <label class="input-well">
              <input type="number" step="0.5" inputmode="decimal" class="well-input" placeholder="0" value="${escapeAttr(s.weight)}" data-input="weight" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
              <span class="well-unit">${isUni ? 'kg/côté' : 'kg'}</span>
            </label>

            ${isUni ? `
              <label class="input-well input-well-left">
                <input type="number" inputmode="numeric" class="well-input" placeholder="0" value="${escapeAttr(s.repsLeft)}" data-input="repsLeft" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
                <span class="well-unit well-unit-left">G</span>
              </label>
              <label class="input-well input-well-right">
                <input type="number" inputmode="numeric" class="well-input" placeholder="0" value="${escapeAttr(s.repsRight)}" data-input="repsRight" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
                <span class="well-unit well-unit-right">D</span>
              </label>
            ` : `
              <label class="input-well">
                <input type="number" inputmode="numeric" class="well-input" placeholder="0" value="${escapeAttr(s.reps)}" data-input="reps" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
                <span class="well-unit">reps</span>
              </label>
            `}

            <button type="button" class="check-circle-btn ${s.done ? 'checked' : ''}" data-action="toggle-set-done" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              ${ICONS.check}
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card card-active-exo">
        <div class="exo-header">
          <div style="flex:1;">
            <span class="exo-number-chip">EXERCICE ${exoIdx + 1}</span>
            <div class="exo-title">${escapeHtml(exo.name)}</div>
            <div class="exo-submeta">
              <button type="button" class="badge ${isUni ? 'badge-unilateral' : 'badge-bilateral'}" data-action="toggle-live-unilateral" data-exo-idx="${exoIdx}" style="cursor:pointer;">
                ${isUni ? 'Unilatéral G / D' : 'Bilatéral'}
              </button>
              <span class="meta-chip">Cible ${escapeHtml(wExo.targetReps)}</span>
              <button type="button" class="meta-chip" data-action="edit-live-rest" data-exo-idx="${exoIdx}" style="cursor:pointer;">
                Repos ${wExo.restSeconds}s
              </button>
            </div>
          </div>
          <div class="exo-actions">
            <button type="button" class="circle-icon-btn" data-action="open-exo-stats-quick" data-exo-id="${exo.id}" title="Courbes">${ICONS.chart}</button>
            <button type="button" class="circle-icon-btn" data-action="swap-live-exo" data-exo-idx="${exoIdx}" title="Remplacer">${ICONS.swap}</button>
            <button type="button" class="circle-icon-btn" data-action="remove-live-exo" data-exo-idx="${exoIdx}" title="Retirer">${ICONS.close}</button>
          </div>
        </div>

        <div class="exo-note-pill">
          ${ICONS.pin}
          <input type="text" class="exo-note-input" placeholder="Ajouter une note de réglage (siège, poulie...)" value="${escapeAttr(exo.note || '')}" data-input="exo-note" data-exo-id="${exo.id}" />
        </div>

        <div class="sets-list">
          ${setsHtml}
        </div>

        <div class="exo-footer-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-action="add-live-set" data-exo-idx="${exoIdx}">+ Ajouter une série</button>
          ${wExo.sets.length > 1 ? `<button type="button" class="btn btn-sm" style="color:var(--text-tertiary);" data-action="remove-live-set" data-exo-idx="${exoIdx}">Retirer</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="live-workout-banner">
      <div class="live-workout-meta">
        <h2>${escapeHtml(wk.name)}</h2>
        <div class="live-workout-stats">${completedSets} sur ${totalSets} séries validées</div>
      </div>
      <button type="button" class="btn btn-primary btn-sm" data-action="finish-workout">Terminer</button>
    </div>

    ${blocksHtml}

    <div style="display:flex; flex-direction:column; gap:12px; margin-top:20px;">
      <button type="button" class="btn btn-secondary btn-block" data-action="add-exo-to-live">+ Ajouter un exercice</button>
      <div style="display:grid; grid-template-columns:1fr 1.4fr; gap:10px;">
        <button type="button" class="btn btn-danger btn-block" data-action="cancel-workout">Abandonner</button>
        <button type="button" class="btn btn-primary btn-block" data-action="finish-workout">Valider la séance</button>
      </div>
    </div>
  `;
}

/* ==========================================================================
   Tab 2: Programmes & Ultra-Fast Inline Exercise Creator
   ========================================================================== */

function renderTemplatesTab() {
  const container = document.getElementById('templates-container');

  const tplListHtml = state.templates.length === 0
    ? `
      <div class="card" style="text-align:center; padding:26px 18px; color:var(--text-secondary); font-size:0.86rem;">
        Aucune séance créée. Appuie sur <strong>+ Nouvelle séance</strong> ci-dessus pour composer ton programme en tapant tes exos directement !
      </div>
    `
    : state.templates.map((tpl) => {
        const exoLines = tpl.items.map((item, idx) => {
          const exo = getExercise(item.exerciseId);
          if (!exo) return '';
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.86rem;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="color:var(--volt); font-weight:800; font-size:0.76rem;">0${idx + 1}</span>
                <strong style="font-weight:700;">${escapeHtml(exo.name)}</strong>
                ${exo.unilateral ? `<span class="badge badge-unilateral">Unilatéral G/D</span>` : ''}
              </div>
              <span style="color:var(--text-secondary); font-weight:700;">${item.setsCount} × ${escapeHtml(item.targetReps)}</span>
            </div>
          `;
        }).join('');

        return `
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h3 style="font-size:1.12rem; font-weight:800; letter-spacing:-0.02em;">${escapeHtml(tpl.name)}</h3>
              <div style="display:flex; gap:6px;">
                <button type="button" class="circle-icon-btn" data-action="edit-template" data-id="${tpl.id}">${ICONS.edit}</button>
                <button type="button" class="circle-icon-btn" data-action="delete-template" data-id="${tpl.id}">${ICONS.trash}</button>
              </div>
            </div>
            <div>${exoLines || '<span style="color:var(--text-tertiary); font-size:0.82rem;">Aucun exercice</span>'}</div>
          </div>
        `;
      }).join('');

  const exercisesHtml = state.exercises.length === 0
    ? `<div class="card" style="color:var(--text-secondary); font-size:0.84rem; text-align:center;">Ta bibliothèque est vide. Ajoute un exercice ci-dessus ou crée directement une séance type !</div>`
    : state.exercises.map((exo) => `
        <div class="card" style="padding:15px 18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <div>
            <div style="font-weight:800; font-size:0.96rem; display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
              <span>${escapeHtml(exo.name)}</span>
              <span class="badge ${exo.unilateral ? 'badge-unilateral' : 'badge-bilateral'}">
                ${exo.unilateral ? 'Unilatéral G/D' : 'Bilatéral'}
              </span>
            </div>
            ${exo.note ? `<div style="font-size:0.78rem; color:var(--text-secondary); margin-top:5px;">📌 ${escapeHtml(exo.note)}</div>` : ''}
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="circle-icon-btn" data-action="edit-exercise" data-id="${exo.id}" title="Modifier">${ICONS.edit}</button>
            <button type="button" class="circle-icon-btn" data-action="delete-exercise" data-id="${exo.id}" title="Supprimer">${ICONS.trash}</button>
          </div>
        </div>
      `).join('');

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Mes Séances Types</span>
      <button type="button" class="btn btn-primary btn-sm" data-action="create-template">+ Nouvelle séance</button>
    </div>
    ${tplListHtml}

    <div class="section-header" style="margin-top:28px;">
      <span class="section-title">Mes Exercices (${state.exercises.length})</span>
    </div>

    <!-- Ultra-Fast Inline Exercise Adder -->
    <form id="quick-add-exo-form" class="quick-add-exo-bar">
      <div class="quick-add-top">
        <input type="text" id="quick-exo-name" class="quick-add-input" placeholder="Nom du nouvel exercice (ex: Développé couché)..." required />
      </div>
      <div class="quick-add-bottom">
        <button type="button" id="quick-exo-uni-btn" class="uni-pill-toggle ${state.ui.quickAddUni ? 'is-uni' : ''}">
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
      findOrCreateExerciseByName(name, state.ui.quickAddUni, 90);
      state.ui.quickAddUni = false;
      saveState();
      renderTemplatesTab();
      showToast(`"${name}" ajouté !`);
    });
  }
}

/* ==========================================================================
   Tab 3: Smooth Progression Curves & KPI Bento
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
      <div class="card" style="text-align:center; padding:32px 20px;">
        <div style="font-weight:800; font-size:1.05rem; margin-bottom:6px;">Aucun exercice pour l'instant</div>
        <p style="font-size:0.84rem; color:var(--text-secondary);">Crée tes exercices dans l'onglet <strong>Programmes</strong> et valide ta première séance pour suivre tes statistiques !</p>
      </div>
    `;
    return;
  }

  const optionsHtml = state.exercises.map((e) => `
    <option value="${e.id}" ${e.id === currentExo.id ? 'selected' : ''}>
      ${escapeHtml(e.name)} ${e.unilateral ? '• Unilatéral' : ''}
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
    const setsPills = s.sets.map((st) => {
      if (s.unilateral) {
        return `<span class="soft-pill"><strong>${st.weight}kg</strong> G:${st.repsLeft} • D:${st.repsRight}</span>`;
      }
      return `<span class="soft-pill"><strong>${st.weight}kg</strong> × ${st.reps}</span>`;
    }).join('');

    return `
      <div class="card" style="padding:16px 18px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-weight:800; font-size:0.92rem;">${formatDateShort(s.date)}</span>
          <span style="font-size:0.8rem; color:var(--volt); font-weight:700;">${s.bestSetDesc} • 1RM ${s.best1RM}kg</span>
        </div>
        <div class="pill-cloud">${setsPills}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="form-group">
      <select id="stats-exo-select" class="form-select">
        ${optionsHtml}
      </select>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">RECORD CHARGE</div>
        <div class="kpi-value" style="color:var(--volt);">${allTimeMaxWeight} <span style="font-size:0.85rem;">kg</span></div>
        <div class="kpi-sub">${currentExo.unilateral ? 'Par côté' : 'Barre / Paire'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">1RM ESTIMÉ</div>
        <div class="kpi-value">${allTimeBest1RM} <span style="font-size:0.85rem;">kg</span></div>
        <div class="kpi-sub">Potentiel max</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">VOLUME MAX</div>
        <div class="kpi-value">${allTimeMaxVol} <span style="font-size:0.85rem;">kg</span></div>
        <div class="kpi-sub">Sur une séance</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${currentExo.unilateral ? 'SYMÉTRIE G / D' : 'SÉANCES'}</div>
        <div class="kpi-value" style="font-size:1.25rem;">
          ${currentExo.unilateral && totalUniReps > 0 ? `${leftPct}% / ${rightPct}%` : `${sessions.length}`}
        </div>
        <div class="kpi-sub">${currentExo.unilateral ? `${sumLeft} G vs ${sumRight} D` : 'Complétées'}</div>
      </div>
    </div>

    <div class="card">
      <div class="chart-tabs">
        <button type="button" class="chart-tab ${metric === 'maxWeight' ? 'active' : ''}" data-action="set-stat-metric" data-metric="maxWeight">Charge Max</button>
        <button type="button" class="chart-tab ${metric === 'e1rm' ? 'active' : ''}" data-action="set-stat-metric" data-metric="e1rm">1RM Estimé</button>
        <button type="button" class="chart-tab ${metric === 'volume' ? 'active' : ''}" data-action="set-stat-metric" data-metric="volume">Volume</button>
        ${currentExo.unilateral ? `<button type="button" class="chart-tab ${metric === 'asymmetry' ? 'active' : ''}" data-action="set-stat-metric" data-metric="asymmetry">Gauche vs Droite</button>` : ''}
      </div>
      <div class="chart-box">
        ${buildSmoothSvgChart(sessions, metric)}
      </div>
    </div>

    <div class="section-header">
      <span class="section-title">Historique (${sessions.length})</span>
    </div>
    ${sessions.length ? sessionRowsHtml : '<div class="card" style="color:var(--text-secondary);">Valide une séance avec cet exercice pour débloquer sa courbe.</div>'}
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
    return `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-tertiary); font-size:0.86rem;">Pas encore de données.</div>`;
  }

  const w = 500;
  const h = 195;
  const padL = 34;
  const padR = 24;
  const padT = 26;
  const padB = 30;
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

    const dotsL = ptsL.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#38bdf8" stroke="#111113" stroke-width="2"/>`).join('');
    const dotsR = ptsR.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#c084fc" stroke="#111113" stroke-width="2"/>`).join('');
    const labelsX = sessions.map((s, i) => `<text x="${getX(i)}" y="${h - 6}" fill="#63636e" font-size="11" font-weight="600" text-anchor="middle">${formatDateShort(s.date)}</text>`).join('');

    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
        <path d="${pathL}" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" />
        <path d="${pathR}" fill="none" stroke="#c084fc" stroke-width="3.5" stroke-dasharray="6,5" stroke-linecap="round" />
        ${dotsL}
        ${dotsR}
        ${labelsX}
        <text x="${padL}" y="14" fill="#38bdf8" font-size="11" font-weight="800">● GAUCHE</text>
        <text x="${padL + 82}" y="14" fill="#c084fc" font-size="11" font-weight="800">● DROITE</text>
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
    <circle cx="${p.x}" cy="${p.y}" r="5.5" fill="#d0fd3e" stroke="#111113" stroke-width="2.5" />
    <text x="${p.x}" y="${p.y - 11}" fill="#ffffff" font-size="11" font-weight="800" text-anchor="middle">${p.v}</text>
    <text x="${p.x}" y="${h - 6}" fill="#63636e" font-size="11" font-weight="600" text-anchor="middle">${formatDateShort(sessions[i].date)}</text>
  `).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
      <defs>
        <linearGradient id="voltGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d0fd3e" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#d0fd3e" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${pts.length > 1 ? `<path d="${areaPath}" fill="url(#voltGrad)" />` : ''}
      ${pts.length > 1 ? `<path d="${curvePath}" fill="none" stroke="#d0fd3e" stroke-width="3.5" stroke-linecap="round" />` : ''}
      ${nodes}
    </svg>
  `;
}

/* ==========================================================================
   Tab 4: Apple Watch & Cloud Sync
   ========================================================================== */

function renderSettingsTab() {
  const container = document.getElementById('settings-container');
  const notifStatus = ('Notification' in window) ? Notification.permission : 'unsupported';

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Apple Watch & Chrono</span>
    </div>
    <div class="card">
      <div class="toggle-row" style="margin-bottom:10px;">
        <div>
          <div style="font-weight:800; font-size:0.92rem;">Notifications iOS / Watch</div>
          <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:2px;">Vibre sur la montre quand l'iPhone est verrouillé</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="request-notif-perm">
          ${notifStatus === 'granted' ? 'Activé' : 'Activer'}
        </button>
      </div>

      <div class="toggle-row" style="margin-bottom:12px;">
        <div>
          <div style="font-weight:800; font-size:0.92rem;">Relais Minuteur Natif Watch</div>
          <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:2px;">Lance le minuteur Apple Watch à chaque série validée</div>
        </div>
        <input type="checkbox" id="toggle-watch-shortcut" ${state.settings.watchShortcutAuto ? 'checked' : ''} style="width:22px; height:22px; accent-color:var(--volt);" />
      </div>

      <button type="button" class="btn btn-ghost btn-block" data-action="open-watch-guide">
        Configurer le Raccourci iOS en 20s →
      </button>
    </div>

    <div class="section-header">
      <span class="section-title">Synchronisation Cloud Gratuite</span>
    </div>
    <div class="card">
      <div class="form-group">
        <label class="form-label">URL Firebase Realtime DB (optionnel)</label>
        <input type="text" id="cloud-url-input" class="form-input" placeholder="https://mon-projet-default-rtdb.europe-west1.firebasedatabase.app" value="${escapeAttr(state.settings.cloudUrl || '')}" />
      </div>
      ${state.settings.lastCloudSync ? `<div style="font-size:0.76rem; color:var(--volt); margin-bottom:12px; font-weight:700;">Dernière synchro : ${new Date(state.settings.lastCloudSync).toLocaleString('fr-FR')}</div>` : ''}
      <div class="form-row">
        <button type="button" class="btn btn-primary btn-sm" data-action="cloud-push">Sauvegarder</button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="cloud-pull">Restaurer</button>
      </div>
    </div>

    <div class="section-header">
      <span class="section-title">Fichier de secours (iCloud Drive)</span>
    </div>
    <div class="card">
      <div class="form-row">
        <button type="button" class="btn btn-secondary btn-sm" data-action="export-json">Exporter .json</button>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
          Importer .json
          <input type="file" id="import-json-input" accept=".json,application/json" style="display:none;" />
        </label>
      </div>
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
   Modals (Ultra-Fast Programme Builder with Direct Exercise Typing)
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
    <form id="exo-form">
      <div class="form-group">
        <label class="form-label">Nom de l'exercice</label>
        <input type="text" name="name" class="form-input" required placeholder="Ex: Développé couché haltères" value="${escapeAttr(existing ? existing.name : '')}" />
      </div>
      <div class="form-group">
        <div class="toggle-row">
          <div>
            <div style="font-weight:800; font-size:0.9rem;">Unilatéral (Gauche / Droite séparés)</div>
            <div style="font-size:0.74rem; color:var(--text-secondary);">Active les colonnes G et D pour chaque série</div>
          </div>
          <input type="checkbox" name="unilateral" ${existing && existing.unilateral ? 'checked' : ''} style="width:22px; height:22px; accent-color:var(--volt);" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Repos par défaut (sec)</label>
          <input type="number" name="defaultRest" class="form-input" value="${existing ? existing.defaultRest : 90}" />
        </div>
        <div class="form-group">
          <label class="form-label">Note de réglage</label>
          <input type="text" name="note" class="form-input" placeholder="Siège 4, poulie 2..." value="${escapeAttr(existing ? existing.note || '' : '')}" />
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Enregistrer</button>
    </form>
  `);

  document.getElementById('exo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    if (!name) return;

    if (existing) {
      existing.name = name;
      existing.defaultRest = parseInt(fd.get('defaultRest')) || 90;
      existing.unilateral = fd.get('unilateral') === 'on';
      existing.note = fd.get('note').trim();
    } else {
      const newExo = {
        id: uid('ex'),
        name,
        muscle: 'Général',
        defaultRest: parseInt(fd.get('defaultRest')) || 90,
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

// Frictionless Programme Builder: type any exercise name directly on each line!
function openTemplateModal(templateId = null) {
  const existing = templateId ? state.templates.find((t) => t.id === templateId) : null;
  let draftName = existing ? existing.name : '';

  // Each item holds exoName & unilateral directly so you can type new exercises on the fly!
  let draftItems = existing
    ? existing.items.map((it) => {
        const ex = getExercise(it.exerciseId);
        return {
          exoName: ex ? ex.name : '',
          unilateral: ex ? !!ex.unilateral : false,
          setsCount: it.setsCount || 3,
          targetReps: it.targetReps || '8-12',
          restSeconds: it.restSeconds || 90
        };
      })
    : [
        { exoName: '', unilateral: false, setsCount: 3, targetReps: '8-10', restSeconds: 90 }
      ];

  function renderModalContent(focusIndex = null) {
    const datalistOptions = state.exercises.map(
      (ex) => `<option value="${escapeAttr(ex.name)}"></option>`
    ).join('');

    const itemsHtml = draftItems.map((it, idx) => `
      <div style="background:var(--surface-2); border-radius:22px; padding:14px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-weight:800; font-size:0.74rem; color:var(--volt);">EXERCICE 0${idx + 1}</span>
          <div style="display:flex; gap:5px; align-items:center;">
            <button type="button" class="uni-pill-toggle tpl-toggle-uni ${it.unilateral ? 'is-uni' : ''}" data-idx="${idx}" style="padding:5px 10px; font-size:0.7rem; background:var(--surface-3);">
              ${it.unilateral ? '🦿 Unilatéral G/D' : '🏋️ Bilatéral'}
            </button>
            ${idx > 0 ? `<button type="button" class="circle-icon-btn tpl-move-up" style="width:28px; height:28px;" data-idx="${idx}">↑</button>` : ''}
            ${idx < draftItems.length - 1 ? `<button type="button" class="circle-icon-btn tpl-move-down" style="width:28px; height:28px;" data-idx="${idx}">↓</button>` : ''}
            ${draftItems.length > 1 ? `<button type="button" class="circle-icon-btn tpl-remove-item" style="width:28px; height:28px;" data-idx="${idx}">${ICONS.close}</button>` : ''}
          </div>
        </div>

        <div class="form-group" style="margin-bottom:10px;">
          <input
            type="text"
            list="existing-exos-datalist"
            class="form-input tpl-exo-name-input"
            data-idx="${idx}"
            placeholder="Tape le nom de l'exercice (ex: Tirage vertical)..."
            value="${escapeAttr(it.exoName)}"
            style="background:var(--surface-3); padding:12px 14px;"
          />
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
          <div>
            <label class="form-label" style="font-size:0.68rem;">Séries</label>
            <input type="number" class="form-input tpl-sets-input" style="background:var(--surface-3); padding:10px;" data-idx="${idx}" value="${it.setsCount}" min="1" max="15" />
          </div>
          <div>
            <label class="form-label" style="font-size:0.68rem;">Reps cible</label>
            <input type="text" class="form-input tpl-reps-input" style="background:var(--surface-3); padding:10px;" data-idx="${idx}" value="${escapeAttr(it.targetReps)}" placeholder="8-12" />
          </div>
          <div>
            <label class="form-label" style="font-size:0.68rem;">Repos (s)</label>
            <input type="number" class="form-input tpl-rest-input" style="background:var(--surface-3); padding:10px;" data-idx="${idx}" value="${it.restSeconds || 90}" step="15" />
          </div>
        </div>
      </div>
    `).join('');

    openModal(existing ? 'Modifier la séance' : 'Créer une séance', `
      <datalist id="existing-exos-datalist">${datalistOptions}</datalist>
      <div class="form-group">
        <label class="form-label">Nom de la séance (ex: Push, Pull, Legs...)</label>
        <input type="text" id="tpl-name-input" class="form-input" placeholder="Ex: Séance Push" value="${escapeAttr(draftName)}" />
      </div>
      <div id="tpl-items-wrap">${itemsHtml}</div>
      <button type="button" class="btn btn-secondary btn-block" id="tpl-add-exo-btn" style="margin-bottom:12px;">
        + Ajouter un exercice à la séance
      </button>
      <button type="button" class="btn btn-primary btn-block" id="tpl-save-btn">
        Enregistrer la séance
      </button>
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
        // If matches an existing exercise, auto-adopt its unilateral & rest setting
        const match = state.exercises.find((ex) => ex.name.toLowerCase() === val.trim().toLowerCase());
        if (match) {
          draftItems[i].unilateral = !!match.unilateral;
          draftItems[i].restSeconds = match.defaultRest || 90;
        }
      });

      // Press Enter in exercise name to immediately add a new exercise line!
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          draftItems.push({ exoName: '', unilateral: false, setsCount: 3, targetReps: '8-12', restSeconds: 90 });
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
      el.addEventListener('input', (e) => { draftItems[parseInt(e.target.dataset.idx)].restSeconds = parseInt(e.target.value) || 90; });
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
        targetReps: '8-12',
        restSeconds: 90
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
            targetReps: it.targetReps || '8-12',
            restSeconds: parseInt(it.restSeconds) || 90
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
      showToast('Séance et exercices enregistrés !');
    });
  }

  renderModalContent(0);
}

function openWatchGuideModal() {
  openModal('Relais Apple Watch', `
    <div style="font-size:0.88rem; line-height:1.55; color:var(--text-secondary);">
      <p style="margin-bottom:14px;">
        Pour déclencher le vrai minuteur natif de ton Apple Watch automatiquement depuis l'appli :
      </p>
      <div style="background:var(--surface-2); border-radius:22px; padding:16px; color:#fff;">
        <strong>1.</strong> Ouvre l'app <strong>Raccourcis</strong> sur ton iPhone.<br/><br/>
        <strong>2.</strong> Crée un raccourci nommé exactement :<br/>
        <span style="color:var(--volt); font-weight:800;">IronPulse Timer</span><br/><br/>
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
          startRestTimer(wExo.restSeconds || 90, exoObj ? exoObj.name : 'Exercice');
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
      const val = prompt('Temps de repos (secondes) :', wExo.restSeconds || 90);
      if (val !== null) {
        wExo.restSeconds = Math.max(15, parseInt(val) || 90);
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
      <button type="button" class="card pick-live-exo-btn" data-id="${ex.id}" style="width:100%; text-align:left; padding:14px 16px; margin-bottom:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:var(--surface-2);">
        <div style="font-weight:800;">${escapeHtml(ex.name)}</div>
        <span class="badge ${ex.unilateral ? 'badge-unilateral' : 'badge-bilateral'}">${ex.unilateral ? 'Unilatéral G/D' : 'Bilatéral'}</span>
      </button>
    `).join('');

    openModal(replaceIdx !== null ? 'Remplacer l’exercice' : 'Ajouter un exercice', `
      <form id="modal-instant-exo-form" class="quick-add-exo-bar" style="background:var(--surface-2); margin-bottom:16px;">
        <input type="text" id="modal-instant-exo-name" class="quick-add-input" style="background:var(--surface-3);" placeholder="Créer et ajouter direct (ex: Curl incliné)..." required />
        <div class="quick-add-bottom">
          <button type="button" id="modal-instant-uni" class="uni-pill-toggle ${modalUni ? 'is-uni' : ''}" style="background:var(--surface-3);">
            ${modalUni ? '🦿 Unilatéral G/D' : '🏋️ Bilatéral'}
          </button>
          <button type="submit" class="btn btn-primary btn-sm">+ Créer & Choisir</button>
        </div>
      </form>
      ${state.exercises.length > 0 ? `<div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:8px; padding-left:4px;">OU CHOISIR DANS TES EXOS :</div>` : ''}
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
      const created = findOrCreateExerciseByName(name, modalUni, 90);
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
    targetReps: '8-12',
    restSeconds: exo.defaultRest || 90,
    unilateral: isUni,
    sets: newSets
  };

  if (replaceIdx !== null) {
    state.activeWorkout.exercises[replaceIdx] = block;
  } else {
    state.activeWorkout.exercises.push(block);
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
      return `<div style="font-size:0.84rem; padding:5px 0; color:var(--text-secondary);">Série ${s.tag || (i + 1)} — <strong style="color:#fff;">${perf}</strong></div>`;
    }).join('');

    return `
      <div style="background:var(--surface-2); border-radius:20px; padding:14px; margin-bottom:10px;">
        <div style="font-weight:800; margin-bottom:6px;">${escapeHtml(exoObj ? exoObj.name : 'Exercice')}</div>
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
    templates: 'PROGRAMMATION',
    stats: 'ANALYTIQUE',
    settings: 'SYSTÈME'
  };
  const titles = {
    workout: state.activeWorkout ? 'Séance active' : 'Entraînement',
    templates: 'Programmes',
    stats: 'Progrès & PR',
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
