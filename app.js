const DB_NAME = 'execute-escape-db';
const DB_VERSION = 1;
const STORE_NAME = 'daily';
const HOLD_MS = 1000;
const DELETE_HOLD_MS = 5000;

let db;
let holdTimer = null;
let holdStart = 0;
let holdButton = null;
let holdCompleted = false;
let toastTimer = null;

const $ = (id) => document.getElementById(id);

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'date' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getDay(date = todayKey()) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(date);
    req.onsuccess = () => resolve(req.result || { date, execute: 0, escape: 0 });
    req.onerror = () => reject(req.error);
  });
}

function putDay(day) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(day);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getAllDays() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function deleteAllDays() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function increment(type) {
  const day = await getDay();
  day[type] += 1;
  await putDay(day);
  await render();
  showToast(type === 'execute' ? 'EXECUTE +1' : 'ESCAPE +1');
  if (navigator.vibrate) navigator.vibrate(18);
}

async function decrement(type) {
  const day = await getDay();
  if (day[type] <= 0) {
    showToast('ALREADY 0');
    return;
  }
  day[type] -= 1;
  await putDay(day);
  await render();
  showToast(type === 'execute' ? 'EXECUTE -1' : 'ESCAPE -1');
  if (navigator.vibrate) navigator.vibrate(12);
}

function startHold(button, duration, onComplete) {
  if (holdTimer) return;
  holdButton = button;
  holdCompleted = false;
  holdStart = performance.now();
  const progress = button.querySelector('.hold-progress');
  if (progress) {
    progress.style.transition = 'transform .04s linear';
    progress.style.transform = 'scaleX(0)';
  }

  const update = () => {
    if (!holdButton) return;
    const elapsed = performance.now() - holdStart;
    const ratio = Math.min(elapsed / duration, 1);
    if (progress) progress.style.transform = `scaleX(${ratio})`;
    if (ratio >= 1) {
      holdCompleted = true;
      clearHold();
      onComplete();
      return;
    }
    holdTimer = requestAnimationFrame(update);
  };
  holdTimer = requestAnimationFrame(update);
}

function clearHold() {
  if (holdTimer) cancelAnimationFrame(holdTimer);
  holdTimer = null;
  if (holdButton) {
    const progress = holdButton.querySelector('.hold-progress');
    if (progress) progress.style.transform = 'scaleX(0)';
  }
  holdButton = null;
  holdStart = 0;
}

function bindHold(button, duration, onComplete) {
  const begin = (event) => {
    event.preventDefault();
    if (holdButton && holdButton !== button) return;
    button.setPointerCapture?.(event.pointerId);
    startHold(button, duration, onComplete);
  };
  const end = (event) => {
    event.preventDefault();
    if (holdButton === button) clearHold();
  };
  button.addEventListener('pointerdown', begin);
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('pointerleave', (event) => {
    if (event.buttons === 0 && holdButton === button) clearHold();
  });
}

function showScreen(name) {
  ['homeScreen', 'countScreen', 'settingsScreen'].forEach((id) => $(id).classList.remove('active'));
  $(name).classList.add('active');
  const isHome = name === 'homeScreen';
  const isCount = name === 'countScreen';
  $('homeNav').classList.toggle('active', isHome);
  $('countNav').classList.toggle('active', isCount);
  $('settingsButton').style.visibility = name === 'settingsScreen' ? 'hidden' : 'visible';
  render();
}

async function render() {
  const day = await getDay();
  $('todayExecute').textContent = day.execute;
  $('todayEscape').textContent = day.escape;
  $('decrementExecute').disabled = day.execute <= 0;
  $('decrementEscape').disabled = day.escape <= 0;
  $('decrementExecute').style.opacity = day.execute <= 0 ? '.4' : '1';
  $('decrementEscape').style.opacity = day.escape <= 0 ? '.4' : '1';

  const days = await getAllDays();
  const totals = days.reduce((acc, item) => {
    acc.execute += Number(item.execute || 0);
    acc.escape += Number(item.escape || 0);
    return acc;
  }, { execute: 0, escape: 0 });
  $('totalExecute').textContent = totals.execute;
  $('totalEscape').textContent = totals.escape;
  const total = totals.execute + totals.escape;
  const executePct = total ? Math.round((totals.execute / total) * 100) : 0;
  const escapePct = total ? 100 - executePct : 0;
  $('executePercent').textContent = `${executePct}%`;
  $('escapePercent').textContent = `${escapePct}%`;
  $('executeBar').style.width = `${executePct}%`;
  $('escapeBar').style.width = `${escapePct}%`;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 900);
}

function openDeleteConfirm() { $('confirmOverlay').hidden = false; }
function closeDeleteConfirm() { $('confirmOverlay').hidden = true; }

async function deleteData() {
  await deleteAllDays();
  closeDeleteConfirm();
  await render();
  showToast('DATA DELETED');
}

function setup() {
  bindHold($('executeButton'), HOLD_MS, () => increment('execute'));
  bindHold($('escapeButton'), HOLD_MS, () => increment('escape'));
  bindHold($('decrementExecute'), HOLD_MS, () => decrement('execute'));
  bindHold($('decrementEscape'), HOLD_MS, () => decrement('escape'));
  bindHold($('deleteDataButton'), DELETE_HOLD_MS, openDeleteConfirm);

  $('decrementExecute').addEventListener('contextmenu', (e) => e.preventDefault());
  $('decrementEscape').addEventListener('contextmenu', (e) => e.preventDefault());
  $('deleteDataButton').addEventListener('contextmenu', (e) => e.preventDefault());

  $('homeNav').addEventListener('click', () => showScreen('homeScreen'));
  $('countNav').addEventListener('click', () => showScreen('countScreen'));
  $('settingsButton').addEventListener('click', () => showScreen('settingsScreen'));
  $('backButton').addEventListener('click', () => showScreen('homeScreen'));
  $('cancelDelete').addEventListener('click', closeDeleteConfirm);
  $('confirmDelete').addEventListener('click', deleteData);
  $('confirmOverlay').addEventListener('click', (e) => {
    if (e.target === $('confirmOverlay')) closeDeleteConfirm();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
}

(async function init() {
  try {
    db = await openDB();
    setup();
    await render();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  } catch (error) {
    console.error(error);
    showToast('STORAGE ERROR');
  }
})();
