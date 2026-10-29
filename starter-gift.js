// Окно стартового подарка: сервер выбирает предмет, а клиент показывает рулетку.
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
  const read = (storage, key) => {
    try { return storage.getItem(key); } catch { return null; }
  };
  const write = (storage, key, value) => {
    try { storage.setItem(key, value); } catch { /* хранилище недоступно: окно просто покажется снова */ }
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

  const CARD_WIDTH = 92;
  const CARD_GAP = 10;
  const CARD_STEP = CARD_WIDTH + CARD_GAP;
  const REEL_LENGTH = 36;
  const WINNER_INDEX = 30;
  const GIFT_BASE = 'https://nft.fragment.com/gift/';
  const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  let dialog = null;
  let state = 'idle';
  let claimedItem = null;

  const el = (selector) => dialog.querySelector(selector);

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
      <p class="starter-text">Крути рулетку: выпавший подарок сразу окажется в твоей коллекции.</p>
      <div class="starter-reel" aria-hidden="true">
        <div class="starter-viewport"><div class="starter-track"></div></div>
        <span class="starter-marker"></span>
      </div>
      <div class="starter-result" role="status" aria-live="polite" hidden>
        <strong class="starter-result-name"></strong>
        <span class="starter-result-meta"></span>
      </div>
      <p class="starter-error" role="alert" hidden></p>
      <button class="starter-action" type="button">Крутить рулетку</button>
    `;
    document.body.append(dialog);

    el('.starter-close').addEventListener('click', dismiss);
    el('.starter-action').addEventListener('click', onAction);
    dialog.addEventListener('cancel', (event) => {
      if (state === 'loading' || state === 'spinning') {
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
    renderBlankTrack(false);
  };

  const renderBlankTrack = (moving) => {
    const track = el('.starter-track');
    track.style.transition = 'none';
    track.style.transform = '';
    track.classList.toggle('is-moving', moving);
    track.replaceChildren(...Array.from({ length: moving ? 24 : 8 }, () => {
      const card = document.createElement('div');
      card.className = 'starter-card is-blank';
      return card;
    }));
  };

  const setState = (next) => {
    state = next;
    const busy = next === 'loading' || next === 'spinning';
    const action = el('.starter-action');
    const close = el('.starter-close');
    close.hidden = busy || next === 'done';
    action.disabled = busy;
    action.textContent = {
      idle: 'Крутить рулетку',
      loading: 'Крутим…',
      spinning: 'Крутим…',
      done: 'Забрать',
      error: 'Повторить'
    }[next];
    if (next !== 'error') el('.starter-error').hidden = true;
  };

  const showError = (error) => {
    const message = String(error?.message || '').replace(/\s*\[[^\]]*\]$/, '')
      || 'Не удалось получить подарок. Попробуйте ещё раз.';
    const box = el('.starter-error');
    box.textContent = message;
    box.hidden = false;
    renderBlankTrack(false);
    setState('error');
  };

  const giftUrl = (slug, number) => `${GIFT_BASE}${slug}-${number}.webp`;

  const imageCard = (url, isWinner) => {
    const card = document.createElement('div');
    card.className = 'starter-card';
    if (isWinner) card.classList.add('is-winner');
    const image = new Image();
    image.alt = '';
    image.decoding = 'async';
    image.src = url;
    card.append(image);
    return card;
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

  const waitForSlide = (track, duration) => new Promise((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      track.removeEventListener('transitionend', onEnd);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === track && event.propertyName === 'transform') done();
    };
    track.addEventListener('transitionend', onEnd);
    setTimeout(done, duration + 500);
  });

  const winnerUrlOf = (item) => {
    const preview = item?.nft_models?.preview_url;
    if (typeof preview === 'string' && preview.startsWith(GIFT_BASE)) return preview;
    const slug = item?.nft_models?.nft_collections?.slug;
    if (/^[a-z0-9]+$/.test(slug || '') && /^\d{1,12}$/.test(item?.external_id || '')) {
      return giftUrl(slug, item.external_id);
    }
    return null;
  };

  const spin = async (item, decoys) => {
    const winnerUrl = winnerUrlOf(item);
    if (!winnerUrl) return;
    const decoyUrls = (Array.isArray(decoys) ? decoys : [])
      .filter((gift) => /^[a-z0-9]+$/.test(gift?.collection_slug || '') && /^\d{1,12}$/.test(gift?.gift_number || ''))
      .map((gift) => giftUrl(gift.collection_slug, gift.gift_number))
      .filter((url) => url !== winnerUrl);
    if (!decoyUrls.length) decoyUrls.push(winnerUrl);

    await waitForImage(winnerUrl);

    const track = el('.starter-track');
    const viewport = el('.starter-viewport');
    track.classList.remove('is-moving');
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    track.replaceChildren(...Array.from({ length: REEL_LENGTH }, (_, index) => {
      if (index === WINNER_INDEX) return imageCard(winnerUrl, true);
      return imageCard(decoyUrls[Math.floor(Math.random() * decoyUrls.length)], false);
    }));
    void track.offsetWidth;

    // Небольшой сдвиг для живости; предмет всё равно остаётся внутри рамки.
    const jitter = (Math.random() - 0.5) * 8;
    const target = WINNER_INDEX * CARD_STEP + CARD_WIDTH / 2 - viewport.clientWidth / 2 + jitter;
    const duration = prefersReducedMotion() ? 600 : 5200;
    setState('spinning');
    track.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.72, 0.12, 1)`;
    track.style.transform = `translateX(${-target}px)`;
    await waitForSlide(track, duration);
  };

  const reveal = (item) => {
    const model = item?.nft_models;
    const name = [model?.name || model?.nft_collections?.name, item?.external_id ? `#${item.external_id}` : '']
      .filter(Boolean).join(' ');
    const price = Number(item?.attributes?.fragment_price_stars);
    el('#starter-title').textContent = 'Подарок твой';
    el('.starter-text').textContent = 'Он уже в твоей коллекции. Его можно улучшить, скрафтить или продать на рынке.';
    el('.starter-result-name').textContent = name || 'Новый подарок';
    el('.starter-result-meta').textContent = Number.isFinite(price) && price > 0
      ? `Оценка Fragment: ${price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} Stars`
      : '';
    el('.starter-result').hidden = false;
    el('.starter-reel').classList.add('is-finished');
    setState('done');
    try {
      tg?.HapticFeedback?.notificationOccurred?.('success');
    } catch { /* вибрация недоступна */ }
  };

  const claim = async () => {
    setState('loading');
    renderBlankTrack(!prefersReducedMotion());
    try {
      const result = await api.claimStarterGift(launchId);
      if (result?.already_claimed) {
        if (!isBrowserDemo) write(localStorage, DONE_KEY, '1');
        dialog.close();
        if (isBrowserDemo) refreshDemoCollection();
        return;
      }
      if (!result?.item) throw new Error('Сервер не вернул подарок. Попробуйте ещё раз.');
      // Сервер уже выдал предмет: запоминаем сразу, чтобы окно не вернулось после перезагрузки.
      claimedItem = result.item;
      if (!isBrowserDemo) write(localStorage, DONE_KEY, '1');
      try {
        await spin(result.item, result.roulette_visuals);
      } catch (error) {
        console.warn('Анимация рулетки не сработала:', error);
      }
      reveal(result.item);
    } catch (error) {
      showError(error);
    }
  };

  const onAction = () => {
    if (state === 'done') finish();
    else if (state === 'idle' || state === 'error') claim();
  };

  const dismiss = () => {
    if (state === 'loading' || state === 'spinning') return;
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
    // Обновляем главную, чтобы подарок появился в блоке «Моя коллекция».
    if (!claimedItem) return;
    if (isBrowserDemo) refreshDemoCollection();
    else window.location.reload();
  };

  const open = () => {
    if (dialog) return;
    buildDialog();
    setState('idle');
    dialog.showModal();
    // Фокус на окно, а не на кнопку «×»: иначе при открытии на ней горит рамка.
    dialog.focus();
  };

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
