(() => {
  'use strict';
  const { APERTURES, CIRCLES, calculate } = window.Hyperfocal;
  const $ = id => document.getElementById(id);
  const storageKey = 'x-half-hyperfocale:settings:v1';
  const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
  const distance = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let aperture = 5.6;
  let circle = 0.011;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && APERTURES.includes(saved.aperture)) aperture = saved.aperture;
    if (saved && CIRCLES.includes(saved.circle)) circle = saved.circle;
  } catch { /* Corrupt or unavailable storage must not prevent calculations. */ }

  function render() {
    const result = calculate(aperture, circle);
    const h = distance.format(result.hyperfocalM);
    const near = distance.format(result.nearM);
    $('hyperfocal').textContent = h;
    $('near-limit').textContent = `${near} m`;
    $('result-settings').textContent = `f/${decimal.format(aperture)} · cercle ${decimal.format(circle)} mm`;
    $('diagram-near').textContent = `${near} m`;
    $('diagram-focus').textContent = `${h} m`;
    document.querySelector(`input[name="aperture"][value="${aperture}"]`).checked = true;
    document.querySelector(`input[name="coc"][value="${circle}"]`).checked = true;
    $('coc-description').textContent = {
      '0.011': 'Un repère courant pour une image regardée dans son ensemble. Le rendu dépend aussi du format d’affichage.',
      '0.008': 'Un seuil de flou plus petit pour examiner davantage les détails. La mise au point doit se faire plus loin.',
      '0.005': 'Le critère le plus strict proposé. Il ne garantit pas une netteté parfaite à chaque pixel.'
    }[circle];
    $('field-tip').textContent = aperture >= 8
      ? 'À f/8 et f/11, la profondeur de champ augmente, mais la diffraction peut réduire les détails fins.'
      : `Sur le X half, réglez f/${decimal.format(aperture)} puis faites le point vers ${h} m. Vérifiez la netteté sur une photo.`;
    $('table-caption').textContent = `Cercle de confusion : ${decimal.format(circle)} mm · distances en mètres`;
    $('distance-table').replaceChildren(...APERTURES.map(value => {
      const row = document.createElement('tr');
      if (value === aperture) row.className = 'selected';
      const values = calculate(value, circle);
      [`f/${decimal.format(value)}`, distance.format(values.hyperfocalM), distance.format(values.nearM)].forEach((text, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        if (index === 0) cell.scope = 'row';
        cell.textContent = text;
        row.append(cell);
      });
      return row;
    }));
  }
  document.querySelectorAll('input[name="aperture"], input[name="coc"]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.name === 'aperture') aperture = Number(input.value);
      else circle = Number(input.value);
      render();
      try {
        localStorage.setItem(storageKey, JSON.stringify({ aperture, circle }));
        $('storage-note').hidden = true;
      } catch { $('storage-note').hidden = false; }
    });
  });
  render();

  function openInstallHelp() {
    $('installation').open = true;
  }
  document.querySelector('.help-link').addEventListener('click', openInstallHelp);
  if (location.hash === '#installation') openInstallHelp();
  window.addEventListener('hashchange', () => { if (location.hash === '#installation') openInstallHelp(); });
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    document.querySelector('.help-link').textContent = 'Aide';
    document.querySelector('.help-link').setAttribute('aria-label', 'Aide et installation');
  }

  let registration;
  let cacheReady = false;
  let checkNumber = 0;
  let applyingUpdate = false;
  function setStatus(message, state) {
    $('offline-status').textContent = message;
    $('offline-status').dataset.state = state;
  }
  function renderReadyStatus() {
    if (cacheReady) setStatus(navigator.onLine ? 'Prêt hors ligne' : 'Mode hors ligne · prêt', 'ready');
  }
  function timeout(promise, ms) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Délai dépassé')), ms);
    })]).finally(() => clearTimeout(timer));
  }
  async function verifyCache() {
    const check = ++checkNumber;
    const worker = navigator.serviceWorker.controller;
    if (!worker) return;
    try {
      const ready = await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Pas de réponse')); }, 8000);
        channel.port1.onmessage = event => {
          clearTimeout(timer);
          channel.port1.close();
          resolve(event.data?.ready === true);
        };
        worker.postMessage({ type: 'CHECK_CACHE' }, [channel.port2]);
      });
      if (check !== checkNumber) return;
      cacheReady = ready;
      if (!ready) throw new Error('Fichiers absents');
      $('retry-offline').hidden = true;
      renderReadyStatus();
    } catch {
      if (check !== checkNumber) return;
      cacheReady = false;
      setStatus('Mode hors ligne non prêt. Reconnectez-vous et réessayez.', 'error');
      $('retry-offline').hidden = false;
    }
  }
  function showUpdate() {
    if (registration?.waiting && navigator.serviceWorker.controller) $('update-box').hidden = false;
  }
  async function setupOffline() {
    $('retry-offline').hidden = true;
    if (!('serviceWorker' in navigator) || !window.isSecureContext || !/^https?:$/.test(location.protocol)) {
      setStatus('Calcul disponible · installation hors ligne via une adresse HTTPS.', 'error');
      return;
    }
    try {
      if (!cacheReady) setStatus('Préparation du mode hors ligne…', 'pending');
      registration = await timeout(navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }), 15000);
      showUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') showUpdate();
        });
      });
      await timeout(navigator.serviceWorker.ready, 15000);
      if (navigator.serviceWorker.controller) await verifyCache();
      // First installation claims the page in sw.js; controllerchange verifies it.
    } catch {
      if (navigator.serviceWorker.controller) await verifyCache();
      else {
        setStatus('Téléchargement incomplet. Vérifiez la connexion et l’hébergement.', 'error');
        $('retry-offline').hidden = false;
      }
    }
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Reload all open clients when a user activates an update, keeping HTML and assets coherent.
    if (cacheReady || applyingUpdate) location.reload();
    else verifyCache();
  });
  $('retry-offline').addEventListener('click', async () => {
    if (navigator.serviceWorker?.controller) {
      setStatus('Téléchargement des fichiers…', 'pending');
      const channel = new MessageChannel();
      channel.port1.onmessage = () => { channel.port1.close(); verifyCache(); };
      navigator.serviceWorker.controller.postMessage({ type: 'REPAIR_CACHE' }, [channel.port2]);
      setTimeout(() => { channel.port1.close(); verifyCache(); }, 15000);
    } else await setupOffline();
  });
  $('apply-update').addEventListener('click', () => {
    if (registration?.waiting) {
      applyingUpdate = true;
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
  window.addEventListener('offline', () => {
    if (cacheReady) renderReadyStatus();
    else setStatus('Sans connexion · mode hors ligne non confirmé.', 'error');
  });
  window.addEventListener('online', () => {
    if (navigator.serviceWorker?.controller) verifyCache();
    else setupOffline();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.serviceWorker?.controller) verifyCache();
  });
  setupOffline();
})();
