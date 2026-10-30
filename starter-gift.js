// Стартовый подарок: сервер выбирает уникальный предмет, клиент показывает орбиту.
(() => {
  'use strict';

  const api = window.VyrnApi;
  const tg = window.Telegram?.WebApp;
  const isBrowserDemo = api?.browserDemo === true && !tg?.initData;
  if (!api?.isConfigured || (!tg?.initData && !isBrowserDemo)) return;

  const scope = isBrowserDemo ? 'demo' : String(tg.initDataUnsafe?.user?.id || '');
  if (!scope) return;

  const DONE_KEY = `vyrn:starter-gift-done:${scope}`;
  const NONE_KEY = `vyrn:starter-gift-none:${scope}`;
  const SKIP_KEY = `vyrn:starter-gift-skip:${scope}`;
  const GIFT_BASE = 'https://nft.fragment.com/gift/';
  const STAR_IMAGE = './assets/stars.png';
  const read = (storage, key) => {
    try { return storage.getItem(key); } catch { return null; }
  };
  const write = (storage, key, value) => {
    try { storage.setItem(key, value); } catch { /* Хранилище недоступно: окно покажется снова. */ }
  };
  const createLaunchId = () => {
    const bytes = new Uint8Array(16);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const launchId = isBrowserDemo ? createLaunchId() : null;
  const NONE_TTL = 12 * 60 * 60 * 1000;

  if ((!isBrowserDemo && read(localStorage, DONE_KEY) === '1')
    || (!isBrowserDemo && read(sessionStorage, SKIP_KEY) === '1')) return;
  const lastNone = Number(read(localStorage, NONE_KEY) || 0);
  if (!isBrowserDemo && lastNone && Date.now() - lastNone < NONE_TTL) return;

  const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const rarityOf = (price) => {
    if (price >= 1000) return { name: 'Легендарный', color: '#d99200' };
    if (price >= 150) return { name: 'Эпический', color: '#7c4dff' };
    if (price >= 40) return { name: 'Редкий', color: '#1683f4' };
    return { name: 'Обычный', color: '#758196' };
  };

  let dialog = null;
  let state = 'idle';
  let claimedItem = null;
  let animationFrame = 0;
  let lastFrame = 0;
  let angle = 0;
  let runStartedAt = 0;
  let orbitPhase = 'idle';
  let collapseStartSpeed = 0;
  let canvasContext = null;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let dust = [];
  let sparks = [];
  let orbitItems = [];
  let winnerElement = null;

  const el = (selector) => dialog.querySelector(selector);
  const isBusy = () => state === 'loading' || state === 'spinning';

  const buildDialog = () => {
    dialog = document.createElement('dialog');
    dialog.className = 'starter-dialog';
    dialog.setAttribute('aria-labelledby', 'starter-title');
    dialog.tabIndex = -1;
    dialog.innerHTML = `
      <div class="starter-header">
        <h2 id="starter-title">Твой первый подарок</h2>
        <button class="starter-close" type="button" aria-label="Закрыть">×</button>
      </div>
      <p class="starter-text">Запусти орбиту: выпавший подарок сразу окажется в твоей коллекции.</p>
      <div class="starter-stage" aria-hidden="true">
        <div class="starter-rays"></div>
        <div class="starter-core"></div>
        <div class="starter-marker"></div>
        <div class="starter-flash"></div>
        <div class="starter-shock"></div>
        <canvas class="starter-particles"></canvas>
      </div>
      <div class="starter-result" role="status" aria-live="polite" hidden>
        <strong class="starter-result-name"></strong>
        <span class="starter-result-meta"></span>
      </div>
      <p class="starter-error" role="alert" hidden></p>
      <button class="starter-action" type="button">Запустить орбиту</button>
    `;
    document.body.append(dialog);

    el('.starter-close').addEventListener('click', dismiss);
    el('.starter-action').addEventListener('click', onAction);
    dialog.addEventListener('cancel', (event) => {
      if (isBusy()) {
        event.preventDefault();
        return;
      }
      if (state === 'done') {
        event.preventDefault();
        finish();
        return;
      }
      if (!isBrowserDemo) write(sessionStorage, SKIP_KEY, '1');
    });
  };

  const resizeCanvas = () => {
    if (!dialog?.open) return;
    const canvas = el('.starter-particles');
    const stage = el('.starter-stage');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvasWidth = stage.clientWidth;
    canvasHeight = stage.clientHeight;
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    canvasContext = canvas.getContext('2d');
    canvasContext?.setTransform(dpr, 0, 0, dpr, 0, 0);
    dust = Array.from({ length: 34 }, () => ({
      x: Math.random() * canvasWidth,
      y: Math.random() * canvasHeight,
      radius: 0.6 + Math.random() * 1.4,
      speed: 4 + Math.random() * 10,
      phase: Math.random() * 6
    }));
  };

  const setupOrbit = () => {
    const stage = el('.starter-stage');
    stage.querySelectorAll('.starter-ring').forEach((ring) => ring.remove());
    [
      { rx: 122, ry: 36, tilt: -0.2 },
      { rx: 86, ry: 25, tilt: 0.28 }
    ].forEach(({ rx, ry, tilt }) => {
      const ring = document.createElement('div');
      ring.className = 'starter-ring';
      ring.style.width = `${rx * 2}px`;
      ring.style.height = `${ry * 2}px`;
      ring.style.margin = `${-ry}px 0 0 ${-rx}px`;
      ring.style.transform = `rotate(${tilt}rad)`;
      stage.insertBefore(ring, el('.starter-rays'));
    });
    resizeCanvas();
    sparks = [];
    orbitItems = [];
    winnerElement = null;
    orbitPhase = 'idle';
    collapseStartSpeed = 0;
    angle = 0;
    lastFrame = performance.now();
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(frame);
  };

  const giftUrl = (slug, number) => `${GIFT_BASE}${slug}-${number}.webp`;

  const winnerUrlOf = (item) => {
    const preview = item?.nft_models?.preview_url;
    if (typeof preview === 'string' && preview.startsWith(GIFT_BASE)) return preview;
    const slug = item?.nft_models?.nft_collections?.slug;
    if (/^[a-z0-9]+$/.test(slug || '') && /^\d{1,12}$/.test(String(item?.external_id || ''))) {
      return giftUrl(slug, item.external_id);
    }
    return './assets/placeholder.png';
  };

  const addOrbitItem = (url, isWinner = false) => {
    const item = document.createElement('div');
    item.className = `starter-orbit-item${isWinner ? ' is-winner' : ''}`;
    if (isWinner) {
      const price = Number(claimedItem?.attributes?.fragment_price_stars);
      item.style.setProperty('--starter-winner-color', rarityOf(price).color);
    }
    const image = new Image();
    image.alt = '';
    image.decoding = 'async';
    image.src = url;
    image.addEventListener('error', () => {
      if (image.dataset.fallbackApplied) return;
      image.dataset.fallbackApplied = 'true';
      image.src = './assets/placeholder.png';
    });
    item.append(image);
    el('.starter-stage').append(item);
    return item;
  };

  const waitForImage = (url) => new Promise((resolve) => {
    const probe = new Image();
    const timer = setTimeout(resolve, 4000);
    probe.onload = probe.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    probe.src = url;
  });

  const setState = (next) => {
    state = next;
    const action = el('.starter-action');
    el('.starter-close').hidden = isBusy() || next === 'done';
    action.disabled = isBusy();
    action.textContent = {
      idle: 'Запустить орбиту',
      loading: 'Открываем…',
      spinning: 'Открываем…',
      done: 'Забрать',
      error: 'Повторить'
    }[next];
    if (next !== 'error') el('.starter-error').hidden = true;
  };

  const createParticles = () => {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const colors = [
      winnerElement?.style.getPropertyValue('--starter-winner-color') || '#1683f4',
      '#1683f4',
      '#ffffff',
      '#f6c85a'
    ];
    for (let index = 0; index < 70; index += 1) {
      const direction = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 280;
      sparks.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        life: 1,
        duration: 0.6 + Math.random(),
        radius: 1 + Math.random() * 2.2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  };

  const frame = (timestamp) => {
    if (!dialog?.open) {
      animationFrame = 0;
      return;
    }
    animationFrame = requestAnimationFrame(frame);
    const context = canvasContext;
    if (!context) return;

    const delta = Math.min(0.05, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const reducedMotion = prefersReducedMotion();
    const phaseElapsed = orbitPhase === 'idle' ? 0 : timestamp - runStartedAt;
    const runDuration = reducedMotion ? 900 : 2800;
    const collapseDuration = reducedMotion ? 300 : 950;
    const isRunning = orbitPhase === 'run';
    const isCollapsing = orbitPhase === 'collapse';
    const collapseProgress = isCollapsing ? Math.min(1, phaseElapsed / collapseDuration) : 0;
    const collapse = collapseProgress * collapseProgress * (3 - 2 * collapseProgress);
    const radiusScale = 1 - collapse;
    const energy = isRunning
      ? Math.min(1, 0.2 + (phaseElapsed / runDuration) ** 2 * 0.8)
      : isCollapsing ? 1 - collapse * 0.65 : 0.2;
    const runSpeed = isRunning
      ? reducedMotion ? 6 + Math.min(40, phaseElapsed * 0.04) : 22 + Math.min(680, phaseElapsed * 0.24)
      : reducedMotion ? 6 : 22;
    const speed = isCollapsing ? collapseStartSpeed * (1 - collapse) : runSpeed;
    angle += speed * delta;
    const rings = [...el('.starter-stage').querySelectorAll('.starter-ring')];
    rings.forEach((ring, index) => {
      ring.style.opacity = String((0.7 + 0.3 * energy) * (1 - collapse));
      ring.style.transform = `rotate(${index === 0 ? -0.2 : 0.28}rad) scale(${radiusScale})`;
    });
    orbitItems.forEach((orbit, index) => {
      if (orbitPhase === 'reveal' || orbitPhase === 'done') return;
      const radius = index % 2 === 0 ? { rx: 122, ry: 36, tilt: -0.2, direction: 1 } : { rx: 86, ry: 25, tilt: 0.28, direction: -1 };
      const orbitIndex = Math.floor(index / 2);
      const orbitCount = Math.ceil(orbitItems.length / 2);
      const orbitAngle = (angle * radius.direction + orbitIndex * (360 / Math.max(orbitCount, 1))) * Math.PI / 180;
      const x0 = Math.cos(orbitAngle) * radius.rx;
      const y0 = Math.sin(orbitAngle) * radius.ry;
      const x = (x0 * Math.cos(radius.tilt) - y0 * Math.sin(radius.tilt)) * radiusScale;
      const y = (x0 * Math.sin(radius.tilt) + y0 * Math.cos(radius.tilt)
        + Math.sin(timestamp / 650 + index * 1.7) * 3) * radiusScale;
      const depth = Math.sin(orbitAngle);
      const scale = (0.66 + 0.46 * ((depth + 1) / 2)) * (1 - collapse * 0.75);
      orbit.element.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      orbit.element.style.opacity = String((0.6 + 0.4 * ((depth + 1) / 2)) * (1 - collapse));
      orbit.element.style.zIndex = depth > 0 ? '5' : '1';
      orbit.element.style.filter = `blur(${((1 - (depth + 1) / 2) * 1.4).toFixed(2)}px)`;
    });
    el('.starter-core').style.setProperty('--starter-energy', String(energy));
    el('.starter-core').style.setProperty('--starter-glow-blur', `${24 + energy * 40}px`);
    el('.starter-core').style.transform = `scale(${1 + energy * 0.35 + (isRunning ? Math.sin(timestamp / 220) * 0.04 : 0)})`;

    context.clearRect(0, 0, canvasWidth, canvasHeight);
    dust.forEach((particle) => {
      particle.y -= particle.speed * delta;
      particle.x += Math.sin(timestamp / 2000 + particle.phase) * 4 * delta;
      if (particle.y < -4) {
        particle.y = canvasHeight + 4;
        particle.x = Math.random() * canvasWidth;
      }
      context.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(timestamp / 1100 + particle.phase));
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    });
    sparks = sparks.filter((spark) => {
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
      spark.vx *= 0.97;
      spark.vy = spark.vy * 0.97 + 30 * delta;
      spark.life -= delta / spark.duration;
      if (spark.life <= 0) return false;
      context.globalAlpha = Math.max(0, spark.life);
      context.fillStyle = spark.color;
      context.beginPath();
      context.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
      context.fill();
      return true;
    });
    context.globalAlpha = 1;
  };

  const reveal = (item) => {
    const model = item?.nft_models;
    const number = String(item?.external_id || '');
    const name = [model?.name || model?.nft_collections?.name, number ? `#${number}` : '']
      .filter(Boolean).join(' ');
    const price = Number(item?.attributes?.fragment_price_stars);
    el('#starter-title').textContent = 'Подарок твой';
    el('.starter-text').textContent = 'Он уже в твоей коллекции. Его можно улучшить, скрафтить или продать на рынке.';
    el('.starter-result-name').textContent = name || 'Новый подарок';
    const meta = el('.starter-result-meta');
    meta.replaceChildren();
    if (Number.isFinite(price) && price > 0) {
      const icon = new Image();
      icon.src = STAR_IMAGE;
      icon.alt = '';
      meta.append(icon, document.createTextNode(
        `Оценка Fragment: ${price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} Stars`
      ));
    }
    const result = el('.starter-result');
    result.hidden = false;
    requestAnimationFrame(() => result.classList.add('is-visible'));
    el('.starter-marker').classList.add('is-visible');
    setState('done');
    try {
      tg?.HapticFeedback?.notificationOccurred?.('success');
    } catch { /* Вибрация недоступна. */ }
  };

  const spin = async (item, decoys) => {
    const winnerUrl = winnerUrlOf(item);
    const validDecoys = (Array.isArray(decoys) ? decoys : [])
      .filter((gift) => /^[a-z0-9]+$/.test(gift?.collection_slug || '')
        && /^\d{1,12}$/.test(String(gift?.gift_number || '')))
      .map((gift) => giftUrl(gift.collection_slug, gift.gift_number))
      .filter((url) => url !== winnerUrl)
      .slice(0, 16);

    await waitForImage(winnerUrl);
    validDecoys.forEach((url) => orbitItems.push({ element: addOrbitItem(url) }));
    winnerElement = addOrbitItem(winnerUrl, true);
    orbitItems.push({ element: winnerElement });
    setState('spinning');
    const reducedMotion = prefersReducedMotion();
    orbitPhase = 'run';
    runStartedAt = performance.now();
    await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 900 : 2800));

    collapseStartSpeed = reducedMotion ? 42 : 694;
    orbitPhase = 'collapse';
    runStartedAt = performance.now();
    await new Promise((resolve) => setTimeout(resolve, reducedMotion ? 300 : 950));

    orbitPhase = 'reveal';
    el('.starter-stage').classList.add('is-revealed');
    winnerElement.style.removeProperty('transform');
    winnerElement.style.removeProperty('opacity');
    winnerElement.style.removeProperty('z-index');
    winnerElement.style.removeProperty('filter');
    void winnerElement.offsetWidth;
    el('.starter-rays').style.setProperty(
      '--starter-ray',
      `${rarityOf(Number(item?.attributes?.fragment_price_stars)).color}99`
    );
    el('.starter-flash').style.transition = 'opacity 100ms';
    el('.starter-flash').style.opacity = '1';
    el('.starter-shock').classList.remove('is-active');
    void el('.starter-shock').offsetWidth;
    el('.starter-shock').classList.add('is-active');
    createParticles();
    await new Promise((resolve) => setTimeout(resolve, 130));
    el('.starter-flash').style.transition = 'opacity 800ms';
    el('.starter-flash').style.opacity = '0';
    winnerElement.classList.add('is-visible');
    el('.starter-marker').classList.add('is-visible');
    el('.starter-core').style.opacity = '0.15';
    orbitPhase = 'done';
    reveal(item);
  };

  const showError = (error) => {
    const message = String(error?.message || '').replace(/\s*\[[^\]]*\]$/, '')
      || 'Не удалось получить подарок. Попробуйте ещё раз.';
    const box = el('.starter-error');
    box.textContent = message;
    box.hidden = false;
    el('.starter-result').hidden = true;
    el('.starter-result').classList.remove('is-visible');
    el('.starter-marker').classList.remove('is-visible');
    el('.starter-stage').classList.remove('is-revealed');
    el('.starter-flash').style.opacity = '0';
    el('.starter-core').style.opacity = '';
    el('.starter-rays').style.removeProperty('--starter-ray');
    el('.starter-stage').querySelectorAll('.starter-orbit-item').forEach((item) => item.remove());
    orbitItems = [];
    winnerElement = null;
    sparks = [];
    orbitPhase = 'idle';
    setState('error');
  };

  const claim = async () => {
    setState('loading');
    try {
      const result = await api.claimStarterGift(launchId);
      if (result?.already_claimed) {
        if (!isBrowserDemo) write(localStorage, DONE_KEY, '1');
        dialog.close();
        if (isBrowserDemo) refreshDemoCollection();
        return;
      }
      if (!result?.item) throw new Error('Сервер не вернул подарок. Попробуйте ещё раз.');
      claimedItem = result.item;
      if (!isBrowserDemo) write(localStorage, DONE_KEY, '1');
      await spin(result.item, result.roulette_visuals);
    } catch (error) {
      showError(error);
    }
  };

  const onAction = () => {
    if (state === 'done') finish();
    else if (state === 'idle' || state === 'error') claim();
  };

  const dismiss = () => {
    if (isBusy()) return;
    if (!isBrowserDemo) write(sessionStorage, SKIP_KEY, '1');
    dialog.close();
  };

  const refreshDemoCollection = () => {
    api.myNfts().catch((error) => {
      console.warn('Не удалось обновить демо-коллекцию:', error);
    });
  };

  const refreshLegacyStarterGiftPrices = async () => {
    try {
      const { items } = await api.myNfts();
      const legacyGifts = items
        .filter((item) => item.attributes?.starter_gift === true
          && item.attributes?.fragment_price_version !== 2)
        .slice(0, 5);
      if (!legacyGifts.length) return;

      for (const item of legacyGifts) {
        await api.refreshNftPrice(item.id);
      }
      const result = await api.myNfts();
      window.dispatchEvent(new CustomEvent('vyrn:cache-refresh', {
        detail: { action: 'my_nfts', payload: {}, result }
      }));
    } catch (error) {
      console.warn('Не удалось обновить цену стартового подарка:', error);
    }
  };

  const finish = () => {
    dialog.close();
    if (!claimedItem) return;
    if (isBrowserDemo) refreshDemoCollection();
    else window.location.reload();
  };

  const open = () => {
    if (dialog) return;
    buildDialog();
    setState('idle');
    dialog.showModal();
    setupOrbit();
    dialog.focus();
  };

  window.addEventListener('resize', resizeCanvas);
  api.starterGiftStatus(launchId).then((status) => {
    if (status?.available === true) {
      open();
      if (isBrowserDemo) claim();
    } else if (status?.available === false && !isBrowserDemo) {
      write(localStorage, NONE_KEY, String(Date.now()));
    }
  }).catch((error) => {
    console.warn('Не удалось проверить стартовый подарок:', error);
  });
  refreshLegacyStarterGiftPrices();
})();
