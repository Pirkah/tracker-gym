/* ==========================================================================
   IronPulse — iOS Gym Tracker PWA
   ========================================================================== */

const STORAGE_KEY = 'ironpulse_data_v1';
const IDB_NAME = 'IronPulseDB';
const IDB_STORE = 'state';

// Default Exercises & Sample Templates (with realistic history so Stats & Previous values work out of the box)
const DEFAULT_EXERCISES = [
  { id: 'ex_bench_db', name: 'Développé Couché Haltères', muscle: 'Pectoraux', unilateral: false, defaultRest: 120, note: 'Banc à plat, omoplates serrées' },
  { id: 'ex_incline_machine', name: 'Développé Incliné Convergent', muscle: 'Pectoraux', unilateral: true, defaultRest: 120, note: 'Siège cran 4, poids indiqué par côté' },
  { id: 'ex_lat_raise_cable', name: 'Élévations Latérales Poulie', muscle: 'Épaules', unilateral: true, defaultRest: 75, note: 'Poulie hauteur poignet (cran 2)' },
  { id: 'ex_triceps_rope', name: 'Extension Triceps Poulie Haute', muscle: 'Triceps', unilateral: false, defaultRest: 90, note: 'Coudes fixes le long du corps' },
  { id: 'ex_lat_pulldown', name: 'Tirage Vertical Poitrine', muscle: 'Dos', unilateral: false, defaultRest: 120, note: 'Boudins cuisses cran 3, prise large' },
  { id: 'ex_row_uni', name: 'Rowing Haltère / Machine 1 Bras', muscle: 'Dos', unilateral: true, defaultRest: 90, note: 'Tirer vers la hanche, commencer par le bras gauche' },
  { id: 'ex_curl_incline', name: 'Curl Incliné Haltères', muscle: 'Biceps', unilateral: true, defaultRest: 90, note: 'Banc à 45°, supination complète' },
  { id: 'ex_hack_squat', name: 'Hack Squat / Presse à cuisses', muscle: 'Quadriceps', unilateral: false, defaultRest: 150, note: 'Pieds bas du plateau, descente contrôlée' },
  { id: 'ex_leg_ext', name: 'Leg Extension Unilatéral', muscle: 'Quadriceps', unilateral: true, defaultRest: 90, note: 'Dossier cran 3, boudin bas tibia' },
  { id: 'ex_leg_curl', name: 'Leg Curl Assis', muscle: 'Ischios', unilateral: false, defaultRest: 90, note: 'Boudin au-dessus des chevilles, 1s contraction' },
  { id: 'ex_bulgarian', name: 'Fentes Bulgares Haltères', muscle: 'Fessiers / Quadris', unilateral: true, defaultRest: 120, note: 'Buste légèrement penché en avant' }
];

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_push',
    name: 'Push — Pecs, Épaules, Triceps',
    items: [
      { exerciseId: 'ex_bench_db', setsCount: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex_incline_machine', setsCount: 3, targetReps: '8-12', restSeconds: 120 },
      { exerciseId: 'ex_lat_raise_cable', setsCount: 4, targetReps: '12-15', restSeconds: 75 },
      { exerciseId: 'ex_triceps_rope', setsCount: 3, targetReps: '10-12', restSeconds: 90 }
    ]
  },
  {
    id: 'tpl_pull',
    name: 'Pull — Dos, Biceps',
    items: [
      { exerciseId: 'ex_lat_pulldown', setsCount: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex_row_uni', setsCount: 3, targetReps: '8-12', restSeconds: 90 },
      { exerciseId: 'ex_curl_incline', setsCount: 3, targetReps: '10-12', restSeconds: 90 }
    ]
  },
  {
    id: 'tpl_legs',
    name: 'Legs — Jambes Complètes',
    items: [
      { exerciseId: 'ex_hack_squat', setsCount: 3, targetReps: '6-10', restSeconds: 150 },
      { exerciseId: 'ex_bulgarian', setsCount: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: 'ex_leg_ext', setsCount: 3, targetReps: '12-15', restSeconds: 90 },
      { exerciseId: 'ex_leg_curl', setsCount: 3, targetReps: '10-12', restSeconds: 90 }
    ]
  }
];

function createSampleHistory() {
  const now = Date.now();
  const day = 86400000;
  return [
    {
      id: 'wk_demo_1',
      templateId: 'tpl_push',
      name: 'Push — Pecs, Épaules, Triceps',
      date: new Date(now - 7 * day).toISOString(),
      durationSec: 3420,
      exercises: [
        {
          exerciseId: 'ex_bench_db',
          unilateral: false,
          sets: [
            { tag: 'W', weight: 20, reps: 12, rir: '3+', done: true },
            { tag: '1', weight: 32, reps: 10, rir: '1', done: true },
            { tag: '2', weight: 32, reps: 9, rir: '0', done: true }
          ]
        },
        {
          exerciseId: 'ex_incline_machine',
          unilateral: true,
          sets: [
            { tag: '1', weight: 35, repsLeft: 10, repsRight: 10, rir: '1', done: true },
            { tag: '2', weight: 37.5, repsLeft: 8, repsRight: 9, rir: '0', done: true },
            { tag: '3', weight: 37.5, repsLeft: 8, repsRight: 8, rir: '0', done: true }
          ]
        },
        {
          exerciseId: 'ex_lat_raise_cable',
          unilateral: true,
          sets: [
            { tag: '1', weight: 7.5, repsLeft: 14, repsRight: 15, rir: '1', done: true },
            { tag: '2', weight: 7.5, repsLeft: 13, repsRight: 14, rir: '0', done: true },
            { tag: '3', weight: 7.5, repsLeft: 12, repsRight: 12, rir: 'F', done: true }
          ]
        }
      ]
    },
    {
      id: 'wk_demo_2',
      templateId: 'tpl_push',
      name: 'Push — Pecs, Épaules, Triceps',
      date: new Date(now - 3 * day).toISOString(),
      durationSec: 3600,
      exercises: [
        {
          exerciseId: 'ex_bench_db',
          unilateral: false,
          sets: [
            { tag: 'W', weight: 22, reps: 10, rir: '3+', done: true },
            { tag: '1', weight: 34, reps: 9, rir: '1', done: true },
            { tag: '2', weight: 34, reps: 8, rir: '0', done: true },
            { tag: '3', weight: 32, reps: 10, rir: '0', done: true }
          ]
        },
        {
          exerciseId: 'ex_incline_machine',
          unilateral: true,
          sets: [
            { tag: '1', weight: 40, repsLeft: 9, repsRight: 10, rir: '1', done: true },
            { tag: '2', weight: 40, repsLeft: 8, repsRight: 9, rir: '0', done: true },
            { tag: '3', weight: 40, repsLeft: 7, repsRight: 8, rir: '0', done: true }
          ]
        },
        {
          exerciseId: 'ex_lat_raise_cable',
          unilateral: true,
          sets: [
            { tag: '1', weight: 8.75, repsLeft: 13, repsRight: 13, rir: '1', done: true },
            { tag: '2', weight: 8.75, repsLeft: 12, repsRight: 13, rir: '0', done: true },
            { tag: '3', weight: 8.75, repsLeft: 11, repsRight: 12, rir: '0', done: true }
          ]
        },
        {
          exerciseId: 'ex_triceps_rope',
          unilateral: false,
          sets: [
            { tag: '1', weight: 25, reps: 12, rir: '1', done: true },
            { tag: '2', weight: 27.5, reps: 10, rir: '0', done: true },
            { tag: '3', weight: 27.5, reps: 9, rir: '0', done: true }
          ]
        }
      ]
    }
  ];
}

// Application State
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
    selectedStatExoId: 'ex_bench_db',
    statMetric: 'maxWeight', // 'maxWeight' | 'e1rm' | 'volume' | 'asymmetry'
    editingTemplateId: null
  }
};

// Rest Timer Runtime State
let restTimer = {
  active: false,
  totalSec: 90,
  endTime: 0,
  exoName: '',
  intervalId: null
};

let workoutClockInterval = null;

/* ==========================================================================
   Persistence Layer (localStorage + IndexedDB + Free Cloud Sync)
   ========================================================================== */

function openIDB() {
  return new Promise((resolve, reject) => {
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
  } catch (e) {
    // Fallback silent
  }
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
        } else {
          resolve(null);
        }
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
  } catch (err) {
    console.error('Erreur localStorage', err);
  }
  saveToIDB(payload);
  updateLiveWorkoutIndicators();

  if (triggerCloud && state.settings.cloudUrl) {
    syncToCloud(true);
  }
}

async function loadState() {
  let raw = localStorage.getItem(STORAGE_KEY);
  let parsed = null;
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }
  if (!parsed) {
    parsed = await loadFromIDB();
  }

  if (parsed && Array.isArray(parsed.exercises) && parsed.exercises.length > 0) {
    state.exercises = parsed.exercises;
    state.templates = parsed.templates || DEFAULT_TEMPLATES;
    state.history = parsed.history || [];
    state.activeWorkout = parsed.activeWorkout || null;
    state.settings = { ...state.settings, ...(parsed.settings || {}) };
  } else {
    state.exercises = JSON.parse(JSON.stringify(DEFAULT_EXERCISES));
    state.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    state.history = createSampleHistory();
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
    if (!silent) showToast('Configure une URL Cloud (ex: Firebase) d’abord.');
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
      showToast('☁️ Sauvegarde Cloud réussie !');
      renderSettingsTab();
    }
  } catch (err) {
    if (!silent) showToast('⚠️ Erreur Cloud : vérifie ton URL.');
  }
}

async function restoreFromCloud() {
  const url = (state.settings.cloudUrl || '').trim();
  if (!url) {
    showToast('Renseigne ton URL Cloud d’abord.');
    return;
  }
  try {
    const endpoint = normalizeCloudUrl(url);
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.exercises)) {
      showToast('Aucune sauvegarde trouvée sur ce Cloud.');
      return;
    }
    state.exercises = data.exercises;
    state.templates = data.templates || [];
    state.history = data.history || [];
    state.settings.lastCloudSync = new Date().toISOString();
    saveState(false);
    renderAll();
    showToast('✅ Données restaurées depuis le Cloud !');
  } catch (err) {
    showToast('⚠️ Impossible de récupérer les données Cloud.');
  }
}

function normalizeCloudUrl(url) {
  let clean = url.replace(/\/+$/, '');
  if (clean.includes('firebaseio.com') || clean.includes('firebasedatabase.app')) {
    if (!clean.endsWith('.json')) {
      clean += '/ironpulse_backup.json';
    }
  }
  return clean;
}

/* ==========================================================================
   Helpers & Exercise Lookup
   ========================================================================== */

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getExercise(id) {
  return state.exercises.find((e) => e.id === id) || null;
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
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
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
  }, 3000);
}

// Get previous session performance for a given exercise
function getPreviousExercisePerf(exerciseId) {
  // Search history from newest to oldest
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

// Check if a newly completed set is a Personal Record (PR)
function checkSetPR(exerciseId, setObj, isUnilateral) {
  if (setObj.tag === 'W') return null; // Ignore warmup sets for PRs
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
   Audio & Apple Watch Rest Timer Engine
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
  } catch (e) {
    // Ignore audio context block
  }
}

function triggerWatchShortcut(seconds) {
  const shortcutName = encodeURIComponent(state.settings.watchShortcutName || 'IronPulse Timer');
  const url = `shortcuts://run-shortcut?name=${shortcutName}&input=text&text=${encodeURIComponent(String(seconds))}`;
  window.location.href = url;
}

function startRestTimer(seconds, exoName = 'Repos') {
  const dur = Math.max(15, parseInt(seconds) || 90);
  restTimer.active = true;
  restTimer.totalSec = dur;
  restTimer.endTime = Date.now() + dur * 1000;
  restTimer.exoName = exoName;

  const bar = document.getElementById('rest-timer-bar');
  bar.classList.remove('hidden');
  document.getElementById('rest-timer-exo-name').textContent = `Repos • ${exoName}`;

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
  const pct = Math.max(0, Math.min(100, (remainingMs / (restTimer.totalSec * 1000)) * 100));
  document.getElementById('rest-timer-progress').style.width = `${pct}%`;
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
  showToast(`⏱️ Repos terminé (${exoName}) — À toi de jouer !`, true);

  // Trigger iOS Web Notification if granted (makes Apple Watch vibrate when iPhone screen is locked)
  if ('Notification' in window && Notification.permission === 'granted') {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification('⏱️ Repos terminé !', {
          body: `C'est l'heure de ta prochaine série sur ${exoName}.`,
          icon: 'icon.svg',
          tag: 'ironpulse-rest-timer',
          renotify: true
        });
      });
    }
  }
}

/* ==========================================================================
   Active Workout Engine (Tab 1)
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
      const prevSet = prev && prev.sets[i] ? prev.sets[i] : (prev && prev.sets.length ? prev.sets[prev.sets.length - 1] : null);
      sets.push({
        id: uid('set'),
        tag: String(i + 1), // '1', '2', 'W', 'D', 'F'
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
  showToast(`🔥 Séance "${tpl.name}" lancée !`);
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
    <span class="badge badge-bilateral" style="font-size:0.8rem; padding:5px 10px;">
      ⏱️ ${formatDuration(elapsedSec)}
    </span>
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
  const templatesHtml = state.templates.map((tpl) => {
    const pills = tpl.items.map((it) => {
      const exo = getExercise(it.exerciseId);
      if (!exo) return '';
      return `<span class="template-exo-pill">${exo.name} (${it.setsCount}×${it.targetReps}) ${exo.unilateral ? '• 1 bras/côté' : ''}</span>`;
    }).join('');

    return `
      <div class="template-launch-card">
        <div class="template-launch-header">
          <div>
            <div class="template-launch-title">${escapeHtml(tpl.name)}</div>
            <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
              ${tpl.items.length} exercices pré-configurés
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-action="start-template" data-id="${tpl.id}">
            Démarrer ▶
          </button>
        </div>
        <div class="template-exo-preview">${pills}</div>
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
          <div class="card" style="padding:12px 14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:700; font-size:0.95rem;">${escapeHtml(wk.name)}</div>
              <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:3px;">
                📅 ${formatDateShort(wk.date)} • ${ (wk.exercises || []).length } exos • ${totalSets} séries validées
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button type="button" class="icon-btn" data-action="view-history-wk" data-id="${wk.id}" title="Détails">👁️</button>
              <button type="button" class="icon-btn" data-action="delete-history-wk" data-id="${wk.id}" title="Supprimer">🗑️</button>
            </div>
          </div>
        `;
      }).join('');

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Choisir ma séance du jour</span>
      <button type="button" class="btn btn-ghost" data-action="start-empty-workout">+ Séance libre</button>
    </div>
    <div class="template-grid">
      ${templatesHtml}
    </div>

    <div class="section-header" style="margin-top:24px;">
      <span class="section-title">Dernières séances effectuées</span>
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
      muscle: 'Autre',
      unilateral: wExo.unilateral,
      note: ''
    };
    const isUni = !!wExo.unilateral;
    const prevPerf = getPreviousExercisePerf(wExo.exerciseId);

    const gridClass = isUni ? 'sets-grid-unilateral' : 'sets-grid-bilateral';
    const headerRow = isUni
      ? `
        <div class="sets-header ${gridClass}">
          <span>Série</span>
          <span>Dernière fois</span>
          <span>Kg/Côté</span>
          <span style="color:#93c5fd;">Reps G</span>
          <span style="color:#d8b4fe;">Reps D</span>
          <span>RIR</span>
          <span>✓</span>
        </div>
      `
      : `
        <div class="sets-header ${gridClass}">
          <span>Série</span>
          <span>Dernière fois</span>
          <span>Poids</span>
          <span>Reps</span>
          <span>RIR</span>
          <span>✓</span>
        </div>
      `;

    let normalCounter = 0;
    const setsHtml = wExo.sets.map((s, setIdx) => {
      if (!['W', 'D', 'F'].includes(s.tag)) {
        normalCounter++;
      }
      const displayTag = ['W', 'D', 'F'].includes(s.tag) ? s.tag : String(normalCounter);
      const tagClass = ['W', 'D', 'F'].includes(s.tag) ? `set-tag-${s.tag}` : '';

      // Lookup matching previous set
      const prevSet = prevPerf && prevPerf.sets[setIdx]
        ? prevPerf.sets[setIdx]
        : (prevPerf && prevPerf.sets.length ? prevPerf.sets[prevPerf.sets.length - 1] : null);

      let prevLabelMain = '—';
      let prevLabelSub = 'Tap = copier';
      if (prevSet) {
        if (prevPerf.unilateral || (prevSet.repsLeft !== undefined && prevSet.repsLeft !== '')) {
          prevLabelMain = `${prevSet.weight}kg • G:${prevSet.repsLeft || 0} D:${prevSet.repsRight || 0}`;
        } else {
          prevLabelMain = `${prevSet.weight} kg × ${prevSet.reps}`;
        }
        if (prevSet.rir) prevLabelSub = `RIR ${prevSet.rir}`;
      } else {
        prevLabelSub = '1ère fois';
      }

      const rirDisplay = s.rir ? `@${s.rir}` : 'RIR';

      if (isUni) {
        return `
          <div class="set-row ${gridClass} ${s.done ? 'completed' : ''}" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
            <button type="button" class="set-tag-btn ${tagClass}" data-action="cycle-set-tag" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" title="Changer type (Normal / Échauffement W / Drop D / Échec F)">
              ${displayTag}
            </button>
            <button type="button" class="prev-perf-btn" data-action="copy-prev-set" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              <span class="prev-perf-main">${prevLabelMain}</span>
              <span class="prev-perf-sub">${ s.prBadge ? `🏆 ${s.prBadge}` : prevLabelSub }</span>
            </button>
            <input type="number" step="0.5" inputmode="decimal" class="gym-input" placeholder="kg" value="${escapeAttr(s.weight)}" data-input="weight" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
            <input type="number" inputmode="numeric" class="gym-input gym-input-left" placeholder="G" value="${escapeAttr(s.repsLeft)}" data-input="repsLeft" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
            <input type="number" inputmode="numeric" class="gym-input gym-input-right" placeholder="D" value="${escapeAttr(s.repsRight)}" data-input="repsRight" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
            <button type="button" class="rir-btn ${s.rir ? 'has-rir' : ''}" data-action="cycle-rir" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              ${rirDisplay}
            </button>
            <button type="button" class="check-set-btn ${s.done ? 'checked' : ''}" data-action="toggle-set-done" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              ✓
            </button>
          </div>
        `;
      } else {
        return `
          <div class="set-row ${gridClass} ${s.done ? 'completed' : ''}" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
            <button type="button" class="set-tag-btn ${tagClass}" data-action="cycle-set-tag" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              ${displayTag}
            </button>
            <button type="button" class="prev-perf-btn" data-action="copy-prev-set" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              <span class="prev-perf-main">${prevLabelMain}</span>
              <span class="prev-perf-sub">${ s.prBadge ? `🏆 ${s.prBadge}` : prevLabelSub }</span>
            </button>
            <input type="number" step="0.5" inputmode="decimal" class="gym-input" placeholder="kg" value="${escapeAttr(s.weight)}" data-input="weight" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
            <input type="number" inputmode="numeric" class="gym-input" placeholder="reps" value="${escapeAttr(s.reps)}" data-input="reps" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}" />
            <button type="button" class="rir-btn ${s.rir ? 'has-rir' : ''}" data-action="cycle-rir" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              ${rirDisplay}
            </button>
            <button type="button" class="check-set-btn ${s.done ? 'checked' : ''}" data-action="toggle-set-done" data-exo-idx="${exoIdx}" data-set-idx="${setIdx}">
              ✓
            </button>
          </div>
        `;
      }
    }).join('');

    return `
      <div class="card card-active-exo">
        <div class="exo-header">
          <div class="exo-title-wrap">
            <div class="exo-title">
              <span>${escapeHtml(exo.name)}</span>
              <button type="button" class="badge ${isUni ? 'badge-unilateral' : 'badge-bilateral'}" data-action="toggle-live-unilateral" data-exo-idx="${exoIdx}" style="cursor:pointer;">
                ${isUni ? '🦿 Unilatéral (G/D)' : '🏋️ Bilatéral'}
              </button>
            </div>
            <div class="exo-submeta">
              <span>🎯 Cible : <strong>${escapeHtml(wExo.targetReps)} reps</strong></span>
              <span>•</span>
              <span style="cursor:pointer; text-decoration:underline;" data-action="edit-live-rest" data-exo-idx="${exoIdx}">
                ⏱️ Repos : ${wExo.restSeconds}s
              </span>
            </div>
          </div>
          <div class="exo-actions">
            <button type="button" class="icon-btn" data-action="open-exo-stats-quick" data-exo-id="${exo.id}" title="Voir les courbes de cet exo">📈</button>
            <button type="button" class="icon-btn" data-action="swap-live-exo" data-exo-idx="${exoIdx}" title="Remplacer l'exercice (machine prise)">🔄</button>
            <button type="button" class="icon-btn" data-action="remove-live-exo" data-exo-idx="${exoIdx}" title="Retirer de la séance">✕</button>
          </div>
        </div>

        <div class="exo-note-box">
          <span>📌</span>
          <input type="text" class="exo-note-input" placeholder="Note réglage (ex: Siège 4, poulie cran 2...)" value="${escapeAttr(exo.note || '')}" data-input="exo-note" data-exo-id="${exo.id}" />
        </div>

        ${headerRow}
        <div class="sets-list">
          ${setsHtml}
        </div>

        <div class="exo-footer-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-action="add-live-set" data-exo-idx="${exoIdx}">+ Série</button>
          ${wExo.sets.length > 1 ? `<button type="button" class="btn btn-ghost btn-sm" style="color:var(--text-muted);" data-action="remove-live-set" data-exo-idx="${exoIdx}">- Retirer dernière</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="live-workout-banner">
      <div class="live-workout-meta">
        <h2>${escapeHtml(wk.name)}</h2>
        <div class="live-workout-stats">
          <span>✅ ${completedSets} / ${totalSets} séries</span>
          <span>• Tap sur <strong>Série</strong> = W (Échauff.) / D (Drop) / F (Échec)</span>
        </div>
      </div>
      <button type="button" class="btn btn-success btn-sm" data-action="finish-workout">Terminer ✓</button>
    </div>

    ${blocksHtml}

    <div style="display:flex; flex-direction:column; gap:10px; margin-top:16px;">
      <button type="button" class="btn btn-secondary btn-block" data-action="add-exo-to-live">+ Ajouter un exercice à la séance</button>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button type="button" class="btn btn-danger btn-block" data-action="cancel-workout">Annuler la séance</button>
        <button type="button" class="btn btn-success btn-block" data-action="finish-workout">Terminer & Sauvegarder</button>
      </div>
    </div>
  `;
}

/* ==========================================================================
   Templates & Exercises Management (Tab 2)
   ========================================================================== */

function renderTemplatesTab() {
  const container = document.getElementById('templates-container');

  const tplListHtml = state.templates.map((tpl) => {
    const exoLines = tpl.items.map((item, idx) => {
      const exo = getExercise(item.exerciseId);
      if (!exo) return '';
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.84rem;">
          <div>
            <strong>${idx + 1}. ${escapeHtml(exo.name)}</strong>
            <span class="badge ${exo.unilateral ? 'badge-unilateral' : 'badge-bilateral'}" style="margin-left:6px;">
              ${exo.unilateral ? 'Unilatéral G/D' : 'Bilatéral'}
            </span>
          </div>
          <span style="color:var(--text-secondary); font-weight:600;">${item.setsCount} × ${escapeHtml(item.targetReps)}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h3 style="font-size:1.05rem; font-weight:700;">${escapeHtml(tpl.name)}</h3>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit-template" data-id="${tpl.id}">✏️ Modifier</button>
            <button type="button" class="icon-btn" data-action="delete-template" data-id="${tpl.id}" title="Supprimer">🗑️</button>
          </div>
        </div>
        <div>${exoLines || '<span style="color:var(--text-muted); font-size:0.82rem;">Aucun exercice</span>'}</div>
      </div>
    `;
  }).join('');

  const exercisesHtml = state.exercises.map((exo) => `
    <div class="card" style="padding:12px 14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <div>
        <div style="font-weight:700; font-size:0.95rem; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span>${escapeHtml(exo.name)}</span>
          <span class="badge badge-muscle">${escapeHtml(exo.muscle)}</span>
          <span class="badge ${exo.unilateral ? 'badge-unilateral' : 'badge-bilateral'}">
            ${exo.unilateral ? '🦿 Unilatéral (G/D)' : '🏋️ Bilatéral'}
          </span>
        </div>
        ${exo.note ? `<div style="font-size:0.76rem; color:#fde68a; margin-top:4px;">📌 ${escapeHtml(exo.note)}</div>` : ''}
      </div>
      <div style="display:flex; gap:6px;">
        <button type="button" class="icon-btn" data-action="edit-exercise" data-id="${exo.id}">✏️</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Mes Séances Types (Programmes)</span>
      <button type="button" class="btn btn-primary btn-sm" data-action="create-template">+ Nouvelle séance</button>
    </div>
    ${tplListHtml}

    <div class="section-header" style="margin-top:26px;">
      <span class="section-title">Bibliothèque d'exercices (${state.exercises.length})</span>
      <button type="button" class="btn btn-secondary btn-sm" data-action="create-exercise">+ Nouvel exo</button>
    </div>
    ${exercisesHtml}
  `;
}

/* ==========================================================================
   Statistics & Progression Charts (Tab 3)
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
          bestSetDesc = `${w}kg × G:${rL}/D:${rR}`;
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
    container.innerHTML = `<div class="card">Ajoute un exercice d'abord.</div>`;
    return;
  }

  const optionsHtml = state.exercises.map((e) => `
    <option value="${e.id}" ${e.id === currentExo.id ? 'selected' : ''}>
      ${escapeHtml(e.name)} ${e.unilateral ? '(Unilatéral G/D)' : '(Bilatéral)'}
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
        return `<span class="template-exo-pill">${st.weight}kg • G:${st.repsLeft} / D:${st.repsRight} ${st.rir ? `(@${st.rir})` : ''}</span>`;
      }
      return `<span class="template-exo-pill">${st.weight}kg × ${st.reps} ${st.rir ? `(@${st.rir})` : ''}</span>`;
    }).join('');

    return `
      <div class="card" style="padding:12px 14px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-weight:700; font-size:0.9rem;">📅 ${formatDateShort(s.date)}</span>
          <span style="font-size:0.8rem; color:var(--primary); font-weight:700;">Max : ${s.bestSetDesc} (1RM ~${s.best1RM}kg)</span>
        </div>
        <div class="template-exo-preview">${setsPills}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="form-group">
      <label class="form-label">Sélectionner un exercice à analyser</label>
      <select id="stats-exo-select" class="form-select">
        ${optionsHtml}
      </select>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">🏆 Record Poids</div>
        <div class="kpi-value">${allTimeMaxWeight} <span style="font-size:0.85rem; font-weight:500;">kg</span></div>
        <div class="kpi-sub">${currentExo.unilateral ? 'Poids par bras/jambe' : 'Charge totale'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">⚡ 1RM Estimé</div>
        <div class="kpi-value">${allTimeBest1RM} <span style="font-size:0.85rem; font-weight:500;">kg</span></div>
        <div class="kpi-sub">Formule d'Epley</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">📊 Volume Record</div>
        <div class="kpi-value">${allTimeMaxVol} <span style="font-size:0.85rem; font-weight:500;">kg</span></div>
        <div class="kpi-sub">Sur une séance</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">${currentExo.unilateral ? '⚖️ Équilibre G / D' : '🔥 Séances tracées'}</div>
        <div class="kpi-value" style="font-size:1.1rem;">
          ${currentExo.unilateral && totalUniReps > 0 ? `G:${leftPct}% / D:${rightPct}%` : `${sessions.length} séances`}
        </div>
        <div class="kpi-sub">${currentExo.unilateral ? `Total: ${sumLeft} reps G vs ${sumRight} D` : 'Historique complet'}</div>
      </div>
    </div>

    <div class="card">
      <div class="chart-tabs">
        <button type="button" class="chart-tab ${metric === 'maxWeight' ? 'active' : ''}" data-action="set-stat-metric" data-metric="maxWeight">Poids Max (kg)</button>
        <button type="button" class="chart-tab ${metric === 'e1rm' ? 'active' : ''}" data-action="set-stat-metric" data-metric="e1rm">1RM Estimé (kg)</button>
        <button type="button" class="chart-tab ${metric === 'volume' ? 'active' : ''}" data-action="set-stat-metric" data-metric="volume">Volume (kg)</button>
        ${currentExo.unilateral ? `<button type="button" class="chart-tab ${metric === 'asymmetry' ? 'active' : ''}" data-action="set-stat-metric" data-metric="asymmetry">Gauche vs Droite</button>` : ''}
      </div>
      <div class="chart-box" id="svg-chart-container">
        ${buildSvgChart(sessions, metric)}
      </div>
    </div>

    <div class="section-header">
      <span class="section-title">Historique séance par séance (${sessions.length})</span>
    </div>
    ${sessions.length ? sessionRowsHtml : '<div class="card" style="color:var(--text-secondary);">Valide au moins une séance avec cet exercice pour voir son historique détaillé.</div>'}
  `;

  const sel = document.getElementById('stats-exo-select');
  if (sel) {
    sel.addEventListener('change', (e) => {
      state.ui.selectedStatExoId = e.target.value;
      renderStatsTab();
    });
  }
}

function buildSvgChart(sessions, metric) {
  if (!sessions || sessions.length === 0) {
    return `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.86rem;">Pas encore de données pour afficher le graphique.</div>`;
  }

  const w = 520;
  const h = 195;
  const padL = 40;
  const padR = 20;
  const padT = 22;
  const padB = 30;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  if (metric === 'asymmetry') {
    // Dual line chart: Left Reps (Blue) vs Right Reps (Purple)
    const valsL = sessions.map((s) => s.totalRepsLeft);
    const valsR = sessions.map((s) => s.totalRepsRight);
    const allVals = [...valsL, ...valsR];
    const minV = Math.max(0, Math.min(...allVals) - 2);
    const maxV = Math.max(...allVals, minV + 4) + 2;

    const getX = (i) => sessions.length === 1 ? padL + plotW / 2 : padL + (i / (sessions.length - 1)) * plotW;
    const getY = (v) => padT + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;

    const pointsL = sessions.map((s, i) => `${getX(i)},${getY(s.totalRepsLeft)}`).join(' ');
    const pointsR = sessions.map((s, i) => `${getX(i)},${getY(s.totalRepsRight)}`).join(' ');

    const dotsL = sessions.map((s, i) => `<circle cx="${getX(i)}" cy="${getY(s.totalRepsLeft)}" r="4.5" fill="#3b82f6"/>`).join('');
    const dotsR = sessions.map((s, i) => `<circle cx="${getX(i)}" cy="${getY(s.totalRepsRight)}" r="4.5" fill="#a855f7"/>`).join('');
    const labelsX = sessions.map((s, i) => `<text x="${getX(i)}" y="${h - 8}" fill="#64748b" font-size="10" text-anchor="middle">${formatDateShort(s.date)}</text>`).join('');

    return `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
        <line x1="${padL}" y1="${padT}" x2="${w - padR}" y2="${padT}" stroke="rgba(255,255,255,0.06)" />
        <line x1="${padL}" y1="${padT + plotH / 2}" x2="${w - padR}" y2="${padT + plotH / 2}" stroke="rgba(255,255,255,0.06)" />
        <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.12)" />
        <polyline fill="none" stroke="#3b82f6" stroke-width="3" points="${pointsL}" />
        <polyline fill="none" stroke="#a855f7" stroke-width="3" stroke-dasharray="5,4" points="${pointsR}" />
        ${dotsL}
        ${dotsR}
        ${labelsX}
        <text x="${padL + 6}" y="${padT + 12}" fill="#60a5fa" font-size="11" font-weight="bold">● Reps Gauche</text>
        <text x="${padL + 110}" y="${padT + 12}" fill="#c084fc" font-size="11" font-weight="bold">● Reps Droite</text>
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
  const padRange = (maxVal - minVal) === 0 ? Math.max(5, maxVal * 0.1) : (maxVal - minVal) * 0.2;
  const low = Math.max(0, minVal - padRange);
  const high = maxVal + padRange;

  const getX = (i) => sessions.length === 1 ? padL + plotW / 2 : padL + (i / (sessions.length - 1)) * plotW;
  const getY = (v) => padT + plotH - ((v - low) / (high - low || 1)) * plotH;

  const pts = values.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
  const areaPts = `${getX(0)},${padT + plotH} ${pts} ${getX(values.length - 1)},${padT + plotH}`;

  const circles = values.map((v, i) => `
    <circle cx="${getX(i)}" cy="${getY(v)}" r="5" fill="#3b82f6" stroke="#09090b" stroke-width="2" />
    <text x="${getX(i)}" y="${getY(v) - 9}" fill="#e2e8f0" font-size="11" font-weight="700" text-anchor="middle">${v}</text>
    <text x="${getX(i)}" y="${h - 8}" fill="#64748b" font-size="10" text-anchor="middle">${formatDateShort(sessions[i].date)}</text>
  `).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.38"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <line x1="${padL}" y1="${padT}" x2="${w - padR}" y2="${padT}" stroke="rgba(255,255,255,0.06)" />
      <line x1="${padL}" y1="${padT + plotH / 2}" x2="${w - padR}" y2="${padT + plotH / 2}" stroke="rgba(255,255,255,0.06)" />
      <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.14)" />
      ${values.length > 1 ? `<polygon points="${areaPts}" fill="url(#chartGrad)" />` : ''}
      ${values.length > 1 ? `<polyline fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${pts}" />` : ''}
      ${circles}
    </svg>
  `;
}

/* ==========================================================================
   Settings, Apple Watch & Cloud Sync (Tab 4)
   ========================================================================== */

function renderSettingsTab() {
  const container = document.getElementById('settings-container');
  const notifStatus = ('Notification' in window) ? Notification.permission : 'unsupported';

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">⌚ Vibration Apple Watch & Chrono</span>
    </div>
    <div class="card">
      <p style="font-size:0.83rem; color:var(--text-secondary); line-height:1.45; margin-bottom:12px;">
        Pour faire vibrer ton <strong>Apple Watch</strong> à la fin de ton temps de repos, tu as <strong>2 méthodes complémentaires</strong> :
      </p>

      <div class="toggle-row" style="margin-bottom:10px;">
        <div>
          <div style="font-weight:700; font-size:0.9rem;">1. Notifications Web iOS (Écran verrouillé)</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Fait vibrer l'Apple Watch quand l'app est sur l'écran d'accueil et l'iPhone verrouillé.</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-action="request-notif-perm">
          ${notifStatus === 'granted' ? '✅ Activé' : 'Activer'}
        </button>
      </div>

      <div class="toggle-row" style="margin-bottom:10px;">
        <div>
          <div style="font-weight:700; font-size:0.9rem;">2. Relais Minuteur Natif Apple Watch</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Lance automatiquement le vrai minuteur iOS/Watch à chaque série validée (vibre même iPhone déverrouillé !).</div>
        </div>
        <input type="checkbox" id="toggle-watch-shortcut" ${state.settings.watchShortcutAuto ? 'checked' : ''} style="width:22px; height:22px;" />
      </div>

      <button type="button" class="btn btn-ghost btn-sm" data-action="open-watch-guide" style="padding-left:0;">
        📖 Comment créer le Raccourci iOS "IronPulse Timer" en 20 secondes →
      </button>
    </div>

    <div class="section-header">
      <span class="section-title">☁️ Sauvegarde Permanente & Cloud Gratuit</span>
    </div>
    <div class="card">
      <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; margin-bottom:12px;">
        Tes données sont sauvegardées en permanence dans la mémoire interne de ton iPhone (<strong>LocalStorage + IndexedDB</strong>).
        Tu peux aussi activer une synchronisation Cloud gratuite (Firebase Realtime DB) pour synchroniser plusieurs appareils automatiquement à chaque fin de séance.
      </p>
      <div class="form-group">
        <label class="form-label">URL Firebase Realtime Database (Gratuit) ou Webhook JSON</label>
        <input type="text" id="cloud-url-input" class="form-input" placeholder="https://mon-projet-default-rtdb.europe-west1.firebasedatabase.app" value="${escapeAttr(state.settings.cloudUrl || '')}" />
      </div>
      ${state.settings.lastCloudSync ? `<div style="font-size:0.76rem; color:var(--success); margin-bottom:10px;">✅ Dernière synchro Cloud : ${new Date(state.settings.lastCloudSync).toLocaleString('fr-FR')}</div>` : ''}
      <div class="form-row">
        <button type="button" class="btn btn-primary btn-sm" data-action="cloud-push">☁️ Envoyer vers Cloud</button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="cloud-pull">📥 Restaurer du Cloud</button>
      </div>
    </div>

    <div class="section-header">
      <span class="section-title">💾 Export / Import Fichier (iCloud Drive)</span>
    </div>
    <div class="card">
      <div class="form-row">
        <button type="button" class="btn btn-secondary btn-sm" data-action="export-json">📤 Exporter (.json)</button>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
          📂 Importer (.json)
          <input type="file" id="import-json-input" accept=".json,application/json" style="display:none;" />
        </label>
      </div>
    </div>

    <div class="section-header">
      <span class="section-title">📲 Installer sur ton iPhone (100% Gratuit)</span>
    </div>
    <div class="card" style="font-size:0.83rem; color:var(--text-secondary); line-height:1.5;">
      1. Ouvre ce lien dans <strong>Safari</strong> sur ton iPhone.<br/>
      2. Appuie sur le bouton <strong>Partager</strong> (carré avec flèche vers le haut en bas).<br/>
      3. Choisis <strong>"Sur l'écran d'accueil"</strong>.<br/>
      L'application sera installée en plein écran, fonctionnera même sans réseau au sous-sol de la salle, et n'expirera jamais !
    </div>
  `;

  const watchToggle = document.getElementById('toggle-watch-shortcut');
  if (watchToggle) {
    watchToggle.addEventListener('change', (e) => {
      state.settings.watchShortcutAuto = e.target.checked;
      saveState();
      showToast(e.target.checked ? '⌚ Relais Apple Watch activé' : 'Relais Apple Watch désactivé');
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
   Modals (Create/Edit Template, Create/Edit Exercise, Swap Exo, Watch Guide)
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
  const title = existing ? 'Modifier l’exercice' : 'Nouvel exercice';

  openModal(title, `
    <form id="exo-form">
      <div class="form-group">
        <label class="form-label">Nom de l'exercice</label>
        <input type="text" name="name" class="form-input" required placeholder="Ex: Curl Marteau Haltères" value="${escapeAttr(existing ? existing.name : '')}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Groupe musculaire</label>
          <select name="muscle" class="form-select">
            ${['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Quadriceps', 'Ischios', 'Fessiers / Quadris', 'Mollets', 'Abdos'].map((m) => `<option value="${m}" ${existing && existing.muscle === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Repos par défaut (sec)</label>
          <input type="number" name="defaultRest" class="form-input" value="${existing ? existing.defaultRest : 90}" />
        </div>
      </div>
      <div class="form-group">
        <div class="toggle-row">
          <div>
            <div style="font-weight:700; font-size:0.9rem;">🦿 Exercice Unilatéral (Gauche / Droite séparés)</div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">Active deux colonnes Reps Gauche et Reps Droite + suivi des déséquilibres.</div>
          </div>
          <input type="checkbox" name="unilateral" ${existing && existing.unilateral ? 'checked' : ''} style="width:22px; height:22px;" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">📌 Note épinglée (réglage siège, poulie...)</label>
        <input type="text" name="note" class="form-input" placeholder="Ex: Siège cran 4, poulie basse" value="${escapeAttr(existing ? existing.note || '' : '')}" />
      </div>
      <button type="submit" class="btn btn-primary btn-block">Enregistrer l'exercice</button>
    </form>
  `);

  document.getElementById('exo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    if (!name) return;

    if (existing) {
      existing.name = name;
      existing.muscle = fd.get('muscle');
      existing.defaultRest = parseInt(fd.get('defaultRest')) || 90;
      existing.unilateral = fd.get('unilateral') === 'on';
      existing.note = fd.get('note').trim();
    } else {
      const newExo = {
        id: uid('ex'),
        name,
        muscle: fd.get('muscle'),
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
    showToast('✅ Exercice enregistré !');
  });
}

function openTemplateModal(templateId = null) {
  const existing = templateId ? state.templates.find((t) => t.id === templateId) : null;
  let draftName = existing ? existing.name : '';
  let draftItems = existing ? JSON.parse(JSON.stringify(existing.items)) : [
    { exerciseId: state.exercises[0]?.id || '', setsCount: 3, targetReps: '8-12', restSeconds: 90 }
  ];

  function renderModalContent() {
    const itemsHtml = draftItems.map((it, idx) => {
      const opts = state.exercises.map((ex) => `
        <option value="${ex.id}" ${ex.id === it.exerciseId ? 'selected' : ''}>
          ${escapeHtml(ex.name)} ${ex.unilateral ? '(Unilatéral G/D)' : ''}
        </option>
      `).join('');

      return `
        <div class="card" style="padding:10px; margin-bottom:10px; background:var(--bg-elevated);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:6px;">
            <span style="font-weight:700; font-size:0.82rem; color:var(--primary);">Exo #${idx + 1}</span>
            <div style="display:flex; gap:4px;">
              ${idx > 0 ? `<button type="button" class="icon-btn tpl-move-up" data-idx="${idx}">↑</button>` : ''}
              ${idx < draftItems.length - 1 ? `<button type="button" class="icon-btn tpl-move-down" data-idx="${idx}">↓</button>` : ''}
              <button type="button" class="icon-btn tpl-remove-item" data-idx="${idx}">✕</button>
            </div>
          </div>
          <div class="form-group" style="margin-bottom:8px;">
            <select class="form-select tpl-exo-select" data-idx="${idx}">${opts}</select>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
            <div>
              <label class="form-label" style="font-size:0.7rem;">Séries</label>
              <input type="number" class="form-input tpl-sets-input" data-idx="${idx}" value="${it.setsCount}" min="1" max="15" />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Reps cible</label>
              <input type="text" class="form-input tpl-reps-input" data-idx="${idx}" value="${escapeAttr(it.targetReps)}" placeholder="8-12" />
            </div>
            <div>
              <label class="form-label" style="font-size:0.7rem;">Repos (s)</label>
              <input type="number" class="form-input tpl-rest-input" data-idx="${idx}" value="${it.restSeconds || 90}" step="15" />
            </div>
          </div>
        </div>
      `;
    }).join('');

    openModal(existing ? 'Modifier la séance' : 'Créer une séance type', `
      <div class="form-group">
        <label class="form-label">Nom de la séance (ex: Push, Upper A, Jambes...)</label>
        <input type="text" id="tpl-name-input" class="form-input" placeholder="Ex: Séance Push A" value="${escapeAttr(draftName)}" />
      </div>
      <div id="tpl-items-wrap">${itemsHtml}</div>
      <div style="display:flex; gap:8px; margin-bottom:14px;">
        <button type="button" class="btn btn-secondary btn-sm" id="tpl-add-exo-btn" style="flex:1;">+ Ajouter un exo à la liste</button>
        <button type="button" class="btn btn-ghost btn-sm" id="tpl-create-new-exo-btn">+ Créer un nouvel exo</button>
      </div>
      <button type="button" class="btn btn-primary btn-block" id="tpl-save-btn">Enregistrer la séance</button>
    `);

    document.getElementById('tpl-name-input').addEventListener('input', (e) => {
      draftName = e.target.value;
    });

    document.querySelectorAll('.tpl-exo-select').forEach((el) => {
      el.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.idx);
        const ex = getExercise(e.target.value);
        draftItems[i].exerciseId = e.target.value;
        if (ex) draftItems[i].restSeconds = ex.defaultRest || 90;
        renderModalContent();
      });
    });

    document.querySelectorAll('.tpl-sets-input').forEach((el) => {
      el.addEventListener('input', (e) => {
        draftItems[parseInt(e.target.dataset.idx)].setsCount = parseInt(e.target.value) || 3;
      });
    });

    document.querySelectorAll('.tpl-reps-input').forEach((el) => {
      el.addEventListener('input', (e) => {
        draftItems[parseInt(e.target.dataset.idx)].targetReps = e.target.value;
      });
    });

    document.querySelectorAll('.tpl-rest-input').forEach((el) => {
      el.addEventListener('input', (e) => {
        draftItems[parseInt(e.target.dataset.idx)].restSeconds = parseInt(e.target.value) || 90;
      });
    });

    document.querySelectorAll('.tpl-remove-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        draftItems.splice(i, 1);
        renderModalContent();
      });
    });

    document.querySelectorAll('.tpl-move-up').forEach((el) => {
      el.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        const tmp = draftItems[i - 1];
        draftItems[i - 1] = draftItems[i];
        draftItems[i] = tmp;
        renderModalContent();
      });
    });

    document.querySelectorAll('.tpl-move-down').forEach((el) => {
      el.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        const tmp = draftItems[i + 1];
        draftItems[i + 1] = draftItems[i];
        draftItems[i] = tmp;
        renderModalContent();
      });
    });

    document.getElementById('tpl-add-exo-btn').addEventListener('click', () => {
      const firstExo = state.exercises[0];
      draftItems.push({
        exerciseId: firstExo ? firstExo.id : '',
        setsCount: 3,
        targetReps: '8-12',
        restSeconds: firstExo ? firstExo.defaultRest : 90
      });
      renderModalContent();
    });

    document.getElementById('tpl-create-new-exo-btn').addEventListener('click', () => {
      openExerciseModal(null, (newExo) => {
        draftItems.push({
          exerciseId: newExo.id,
          setsCount: 3,
          targetReps: '8-12',
          restSeconds: newExo.defaultRest || 90
        });
        renderModalContent();
      });
    });

    document.getElementById('tpl-save-btn').addEventListener('click', () => {
      const finalName = draftName.trim() || 'Ma Séance';
      if (existing) {
        existing.name = finalName;
        existing.items = draftItems;
      } else {
        state.templates.push({
          id: uid('tpl'),
          name: finalName,
          items: draftItems
        });
      }
      saveState();
      closeModal();
      renderAll();
      showToast('✅ Séance enregistrée !');
    });
  }

  renderModalContent();
}

function openWatchGuideModal() {
  openModal('⌚ Faire vibrer ton Apple Watch', `
    <div style="font-size:0.86rem; line-height:1.55; color:var(--text-main);">
      <p style="margin-bottom:12px;">
        Sur iOS, l'Apple Watch vibre automatiquement pour le <strong>Minuteur natif d'Apple</strong>. Tu peux relier IronPulse au minuteur natif en créant un raccourci d'une seule action :
      </p>
      <div class="card" style="background:var(--bg-elevated); padding:12px;">
        <strong>Étape 1 :</strong> Ouvre l'application <strong>Raccourcis (Shortcuts)</strong> sur ton iPhone.<br/><br/>
        <strong>Étape 2 :</strong> Appuie sur <strong>+</strong> en haut à droite et renomme le raccourci exactement :<br/>
        <code style="color:#60a5fa; font-weight:700;">IronPulse Timer</code><br/><br/>
        <strong>Étape 3 :</strong> Ajoute l'action <strong>"Démarrer le minuteur" (Start Timer)</strong>.<br/><br/>
        <strong>Étape 4 :</strong> Appuie longtemps sur la durée, choisis <strong>"Entrée du raccourci" (Shortcut Input)</strong> et sélectionne <strong>Secondes</strong>.
      </div>
      <p style="color:var(--text-secondary); font-size:0.8rem; margin-top:10px;">
        Ensuite, utilise le bouton <strong>⌚</strong> sur la barre du chrono ou active l'option automatique : dès que tu coches une série, ton Apple Watch lance le compte à rebours et te fait vibrer le poignet à 00:00 !
      </p>
    </div>
  `);
}

/* ==========================================================================
   Event Delegation & Interactions
   ========================================================================== */

function setupEvents() {
  // Bottom Navigation
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Modal Close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // Rest Timer Controls
  document.getElementById('timer-minus-15').addEventListener('click', () => adjustRestTimer(-15));
  document.getElementById('timer-plus-15').addEventListener('click', () => adjustRestTimer(15));
  document.getElementById('timer-skip').addEventListener('click', stopRestTimer);
  document.getElementById('timer-watch-trigger').addEventListener('click', () => {
    const rem = Math.max(5, Math.ceil((restTimer.endTime - Date.now()) / 1000));
    triggerWatchShortcut(rem);
  });

  // Main Content Click Delegation
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
      const next = rirs[(rirs.indexOf(s.rir || '') + 1) % rirs.length];
      s.rir = next;
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
        showToast('📋 Charges de la dernière séance copiées !');
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
        if (pr) {
          showToast(`🏆 Nouveau Record Personnel (${pr}) !`, true);
        }
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
      const val = prompt('Temps de repos pour cet exercice (en secondes) :', wExo.restSeconds || 90);
      if (val !== null) {
        wExo.restSeconds = Math.max(15, parseInt(val) || 90);
        saveState();
        renderWorkoutTab();
      }
    } else if (action === 'swap-live-exo') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      openSwapOrAddExoModal(exoIdx);
    } else if (action === 'add-exo-to-live') {
      openSwapOrAddExoModal(null);
    } else if (action === 'remove-live-exo') {
      const exoIdx = parseInt(btn.dataset.exoIdx);
      state.activeWorkout.exercises.splice(exoIdx, 1);
      saveState();
      renderWorkoutTab();
    } else if (action === 'open-exo-stats-quick') {
      state.ui.selectedStatExoId = btn.dataset.exoId;
      switchTab('stats');
    } else if (action === 'finish-workout') {
      finishActiveWorkout();
    } else if (action === 'cancel-workout') {
      if (confirm('Abandonner la séance en cours sans l’enregistrer ?')) {
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
      if (confirm('Supprimer cette séance type ?')) {
        state.templates = state.templates.filter((t) => t.id !== btn.dataset.id);
        saveState();
        renderTemplatesTab();
      }
    } else if (action === 'create-exercise') {
      openExerciseModal(null);
    } else if (action === 'edit-exercise') {
      openExerciseModal(btn.dataset.id);
    } else if (action === 'set-stat-metric') {
      state.ui.statMetric = btn.dataset.metric;
      renderStatsTab();
    } else if (action === 'delete-history-wk') {
      if (confirm('Supprimer cette séance de ton historique ?')) {
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
        showToast('Installe l’application sur l’écran d’accueil iOS d’abord.');
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

  // Live Input Delegation (Weight, Reps, Left/Right Reps, Exercise Note)
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
  const listHtml = state.exercises.map((ex) => `
    <button type="button" class="card pick-live-exo-btn" data-id="${ex.id}" style="width:100%; text-align:left; padding:12px; margin-bottom:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-weight:700;">${escapeHtml(ex.name)}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(ex.muscle)}</div>
      </div>
      <span class="badge ${ex.unilateral ? 'badge-unilateral' : 'badge-bilateral'}">${ex.unilateral ? 'Unilatéral G/D' : 'Bilatéral'}</span>
    </button>
  `).join('');

  openModal(replaceIdx !== null ? '🔄 Remplacer l’exercice' : '+ Ajouter un exercice', `
    <div style="margin-bottom:12px;">
      <button type="button" class="btn btn-secondary btn-block btn-sm" id="modal-new-exo-inline">+ Créer un nouvel exercice</button>
    </div>
    <div>${listHtml}</div>
  `);

  document.getElementById('modal-new-exo-inline').addEventListener('click', () => {
    openExerciseModal(null, (created) => {
      applyLiveExerciseSelection(created.id, replaceIdx);
    });
  });

  document.querySelectorAll('.pick-live-exo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyLiveExerciseSelection(btn.dataset.id, replaceIdx);
      closeModal();
    });
  });
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

  // Mark sets that have weight & reps filled in as done if user forgot to tick them
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
    showToast('⚠️ Remplis ou valide au moins une série avant de terminer.');
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
  saveState(true); // Also auto-syncs to Cloud if configured!
  renderAll();
  showToast('🎉 Séance enregistrée dans tes statistiques !', true);
}

function openHistoryDetailModal(wkId) {
  const wk = state.history.find((h) => h.id === wkId);
  if (!wk) return;

  const html = (wk.exercises || []).map((ex) => {
    const exoObj = getExercise(ex.exerciseId);
    const setsLines = (ex.sets || []).filter((s) => s.done).map((s, i) => {
      const perf = ex.unilateral
        ? `${s.weight} kg/côté • Gauche: ${s.repsLeft} reps | Droite: ${s.repsRight} reps`
        : `${s.weight} kg × ${s.reps} reps`;
      return `<div style="font-size:0.82rem; padding:4px 0; color:var(--text-secondary);">Série ${s.tag || (i + 1)} : <strong style="color:#fff;">${perf}</strong> ${s.rir ? `(@RIR ${s.rir})` : ''}</div>`;
    }).join('');

    return `
      <div class="card" style="padding:12px; margin-bottom:10px;">
        <div style="font-weight:700; margin-bottom:6px;">${escapeHtml(exoObj ? exoObj.name : 'Exercice')}</div>
        ${setsLines}
      </div>
    `;
  }).join('');

  openModal(`${wk.name} (${formatDateShort(wk.date)})`, html);
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
  a.download = `ironpulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('💾 Fichier de sauvegarde téléchargé !');
}

function handleJsonImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!Array.isArray(parsed.exercises)) throw new Error('Invalid format');
      state.exercises = parsed.exercises;
      state.templates = parsed.templates || [];
      state.history = parsed.history || [];
      saveState();
      renderAll();
      showToast('✅ Sauvegarde importée avec succès !');
    } catch {
      showToast('⚠️ Fichier JSON invalide.');
    }
  };
  reader.readAsText(file);
}

/* ==========================================================================
   Navigation & Bootstrap
   ========================================================================== */

function switchTab(tabName) {
  state.ui.activeTab = tabName;
  document.querySelectorAll('.tab-view').forEach((sec) => sec.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });

  const titles = {
    workout: state.activeWorkout ? 'Séance en cours' : "S'entraîner",
    templates: 'Mes Séances & Exos',
    stats: 'Statistiques & PR',
    settings: 'Apple Watch & Cloud'
  };
  document.getElementById('page-title').textContent = titles[tabName] || 'IronPulse';
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
