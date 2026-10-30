(() => {
  const $ = (selector) => document.querySelector(selector);
  const grid = $('#grid');
  const balanceLabel = $('#bal span');
  const availableCount = $('#cnt');
  const sheet = $('#sh');
  const closeButton = $('#modal-close');
  const artAnimationContainer = $('#art-animation');
  const artPatternContainer = $('#art-pattern');
  const artBackdropContainer = $('#art-backdrop');
  const title = $('#tt');
  const subtitle = $('#st');
  const rows = $('#rows');
  const button = $('#cta');
  const hint = $('#hint');
  const loginStreakPromise = window.VyrnApi?.recordLoginStreak
    ? window.VyrnApi.recordLoginStreak().catch((error) => {
      console.error('Не удалось записать вход для серии:', error);
      return null;
    })
    : Promise.resolve(null);
  const deviceMemory = Number(navigator.deviceMemory) || Infinity;
  const hardwareConcurrency = Number(navigator.hardwareConcurrency) || 8;
  const lowPerformanceDevice = hardwareConcurrency <= 4
    || deviceMemory <= 4
    || navigator.connection?.saveData === true;
  document.documentElement.classList.toggle('low-performance', lowPerformanceDevice);
  const traitLabels = {
    model: 'Модель',
    backdrop: 'Фон',
    symbol: 'Символ'
  };
  const resetRouletteReel = (component, keepCurrent = false) => {
    const currentSvg = keepCurrent ? component.reel.firstElementChild?.querySelector('svg') : null;
    if (currentSvg && component.active >= 0) {
      const activeSlot = component.slots[component.active];
      component.animations[component.active]?.destroy();
      component.animations[component.active] = null;
      activeSlot.replaceChildren(currentSvg.cloneNode(true));
      activeSlot.hidden = false;
      activeSlot.style.transform = 'translateX(0)';
      activeSlot.style.opacity = '1';
    }
    component.reel.replaceChildren();
    component.reel.hidden = true;
    component.reel.style.transform = 'translateX(0)';
  };

  let items = [];
  let selectedId = null;
  let activeFilter = 'all';
  let upgrading = false;
  let artworkRequestId = 0;
  const artworkComponents = {
    model: { container: artAnimationContainer, layers: ['Gift'], trait: 'model', active: -1, revision: 0, animations: [] },
    symbol: { container: artPatternContainer, layers: ['Pattern', 'Color Icon'], trait: 'symbol', active: -1, revision: 0, animations: [] },
    backdrop: { container: artBackdropContainer, layers: ['Background'], trait: 'backdrop', active: -1, revision: 0, animations: [] }
  };
  let fallbackArtwork = null;
  const rouletteSvgCache = new WeakMap();
  Object.values(artworkComponents).forEach((component) => {
    component.slots = [document.createElement('div'), document.createElement('div')];
    component.slots.forEach((slot) => {
      slot.className = 'artwork-layer-slot';
      slot.hidden = true;
      component.container.appendChild(slot);
    });
    component.reel = document.createElement('div');
    component.reel.className = 'artwork-reel-track';
    component.reel.hidden = true;
    component.container.appendChild(component.reel);
  });

  const getRelated = (value) => Array.isArray(value) ? value[0] || {} : value || {};
  const getView = (item) => {
    const model = getRelated(item.nft_models);
    const collection = getRelated(model.nft_collections);
    const attributes = item.attributes || {};
    const visualId = attributes.crafting?.visual_external_id || item.external_id;
    const slug = collection.slug || '';
    const image = slug && visualId
      ? `https://nft.fragment.com/gift/${slug}-${visualId}.webp`
      : model.preview_url || '../assets/placeholder.png';
    const listings = Array.isArray(item.market_listings) ? item.market_listings : [];
    return {
      item,
      model,
      collection,
      attributes,
      visualId: String(visualId || ''),
      image,
      animation: slug && visualId
        ? `https://nft.fragment.com/gift/${slug}-${visualId}.tgs`
        : model.animation_url || '',
      name: model.name || collection.name || 'NFT',
      collectionName: collection.name || 'VYRN',
      isListed: listings.some((listing) => listing.status === 'active')
    };
  };
  const formatNumber = (value) => Number(value).toLocaleString('ru-RU', {
    maximumFractionDigits: 2
  });
  const getTraits = (attributes) => {
    const traits = attributes?.fragment_traits || {};
    return Object.entries(traits).filter(([, trait]) => trait && typeof trait === 'object');
  };
  const currentSelected = () => items.find((item) => item.id === selectedId) || null;
  const setBalance = (value) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
    balanceLabel.textContent = formatNumber(Number(value));
  };
  const getStarsBalance = (wallets) => {
    const wallet = Array.isArray(wallets)
      ? wallets.find((entry) => entry.currency === 'stars')
      : null;
    return wallet?.balance;
  };
  const createImage = (src, alt, className) => {
    const image = document.createElement('img');
    image.className = className;
    image.src = src;
    image.alt = alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      if (image.src.endsWith('/assets/placeholder.png')) return;
      image.src = '../assets/placeholder.png';
    }, { once: true });
    return image;
  };
  const clearArtwork = () => {
    artworkRequestId += 1;
    $('#hero').classList.remove('is-ready');
    fallbackArtwork?.remove();
    fallbackArtwork = null;
    Object.values(artworkComponents).forEach((component) => {
      component.revision += 1;
      component.container.classList.remove('is-ready');
      component.animations.forEach((animation) => animation?.destroy());
      component.animations = [];
      component.reel.replaceChildren();
      component.reel.hidden = true;
      component.reel.style.transform = 'translateX(0)';
      component.slots.forEach((slot) => {
        slot.replaceChildren();
        slot.hidden = true;
        slot.style.transform = 'translateX(0)';
        slot.style.opacity = '1';
      });
      component.active = -1;
      component.container.hidden = true;
    });
  };
  const loadTgsData = async (source) => {
    if (typeof DecompressionStream === 'undefined' || !window.lottie) {
      throw new Error('TGS-анимация не поддерживается в этом браузере.');
    }
    const response = await fetch(source, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Fragment вернул HTTP ${response.status}.`);
    return new Response(
      response.body.pipeThrough(new DecompressionStream('gzip'))
    ).json();
  };
  const setArtworkAspectRatio = (container) => {
    container.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  };
  const createComponentData = (source, component) => {
    const animationData = structuredClone(source);
    animationData.layers = animationData.layers.filter((layer) => component.layers.includes(layer.nm));
    if (component.layers.includes('Gift')) {
      const giftLayer = animationData.layers[0];
      const scaleData = giftLayer?.ks?.s?.k;
      const shrinkScale = (values) => {
        if (Array.isArray(values) && values.length >= 2) {
          values[0] *= 0.7;
          values[1] *= 0.7;
        }
      };
      if (Array.isArray(scaleData)) {
        if (typeof scaleData[0] === 'number') {
          shrinkScale(scaleData);
        } else {
          scaleData.forEach((keyframe) => {
            shrinkScale(keyframe.s);
            shrinkScale(keyframe.e);
          });
        }
      }
    }
    return animationData;
  };
  const slideComponent = async (component, oldSlot, newSlot, requestId, revision) => {
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : lowPerformanceDevice ? 125 : 105;
    if (oldSlot < 0 || typeof newSlot.animate !== 'function') {
      newSlot.style.transform = 'translateX(0)';
      newSlot.style.opacity = '1';
      return true;
    }
    const previousSlot = component.slots[oldSlot];
    previousSlot.style.willChange = 'transform, opacity';
    newSlot.style.willChange = 'transform, opacity';
    const oldAnimation = previousSlot.animate(
      [
        { transform: 'translateX(0)', opacity: 1 },
        { transform: 'translateX(-100%)', opacity: 0.65 }
      ],
      { duration, easing: 'cubic-bezier(.22,.72,.18,1)' }
    );
    const newAnimation = newSlot.animate(
      [
        { transform: 'translateX(100%)', opacity: 0.65 },
        { transform: 'translateX(0)', opacity: 1 }
      ],
      { duration, easing: 'cubic-bezier(.22,.72,.18,1)' }
    );
    try {
      await Promise.all([oldAnimation.finished, newAnimation.finished]);
    } catch {
      previousSlot.style.willChange = '';
      newSlot.style.willChange = '';
      return false;
    }
    if (requestId !== artworkRequestId || revision !== component.revision) {
      previousSlot.style.willChange = '';
      newSlot.style.willChange = '';
      return false;
    }
    newSlot.style.transform = 'translateX(0)';
    newSlot.style.opacity = '1';
    previousSlot.style.willChange = '';
    newSlot.style.willChange = '';
    oldAnimation.cancel();
    newAnimation.cancel();
    return true;
  };
  const getRouletteSvg = (artwork, key) => {
    let componentCache = rouletteSvgCache.get(artwork);
    if (!componentCache) {
      componentCache = new Map();
      rouletteSvgCache.set(artwork, componentCache);
    }
    if (componentCache.has(key)) return componentCache.get(key);
    const promise = new Promise((resolve) => {
      const component = artworkComponents[key];
      const animationData = createComponentData(artwork.animationData, component);
      if (!animationData.layers.length) {
        resolve(null);
        return;
      }
      const container = document.createElement('div');
      let animation;
      const finish = (svg) => {
        animation?.destroy();
        container.replaceChildren();
        resolve(svg);
      };
      animation = window.lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData
      });
      animation.addEventListener('data_failed', () => finish(null), { once: true });
      animation.addEventListener('DOMLoaded', () => {
        const svg = container.querySelector('svg');
        if (svg) {
          setArtworkAspectRatio(container);
          finish(svg.cloneNode(true));
        } else {
          finish(null);
        }
      }, { once: true });
    });
    componentCache.set(key, promise);
    return promise;
  };
  const showRouletteComponent = async (key, artwork, requestId) => {
    const component = artworkComponents[key];
    if (!component || requestId !== artworkRequestId) return false;
    const svg = await getRouletteSvg(artwork, key);
    if (!svg || requestId !== artworkRequestId) return false;
    const revision = ++component.revision;
    if (!component.reel.children.length) {
      const activeSlot = component.active >= 0 ? component.slots[component.active] : null;
      const currentSvg = activeSlot?.querySelector('svg');
      if (currentSvg) {
        const currentTile = document.createElement('div');
        currentTile.className = 'artwork-reel-item';
        currentTile.appendChild(currentSvg.cloneNode(true));
        component.reel.appendChild(currentTile);
      } else {
        const firstTile = document.createElement('div');
        firstTile.className = 'artwork-reel-item';
        firstTile.appendChild(svg.cloneNode(true));
        component.reel.appendChild(firstTile);
      }
      component.slots.forEach((slot) => { slot.hidden = true; });
    }
    const nextTile = document.createElement('div');
    nextTile.className = 'artwork-reel-item';
    nextTile.appendChild(svg.cloneNode(true));
    component.reel.insertBefore(nextTile, component.reel.firstChild);
    component.reel.hidden = false;
    component.reel.style.transform = 'translateX(-100%)';
    component.container.hidden = false;
    component.container.classList.add('is-ready');
    $('#hero').classList.add('is-ready');
    component.reel.style.willChange = 'transform';
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : lowPerformanceDevice ? 150 : 125;
    const reelAnimation = component.reel.animate(
      [
        { transform: 'translateX(-100%)' },
        { transform: 'translateX(0)' }
      ],
      { duration, easing: 'cubic-bezier(.22,.72,.18,1)' }
    );
    try {
      await reelAnimation.finished;
    } catch {
      component.reel.style.willChange = '';
      return false;
    }
    if (requestId !== artworkRequestId || revision !== component.revision) {
      component.reel.style.willChange = '';
      return false;
    }
    reelAnimation.cancel();
    component.reel.style.transform = 'translateX(0)';
    component.reel.style.willChange = '';
    component.reel.lastElementChild?.remove();
    if (component.active < 0) component.active = 0;
    const trait = artwork.traits?.[component.trait];
    if (trait?.name) await animateTraitValue(component.trait, trait.name, requestId);
    return true;
  };
  const renderComponentData = (key, source, requestId) => {
    const component = artworkComponents[key];
    if (!component || requestId !== artworkRequestId) return Promise.resolve(false);
    resetRouletteReel(component, true);
    const revision = ++component.revision;
    const previousIndex = component.active;
    const nextIndex = previousIndex === 0 ? 1 : 0;
    const oldSlot = previousIndex >= 0 ? component.slots[previousIndex] : null;
    const newSlot = component.slots[nextIndex];
    component.animations[nextIndex]?.destroy();
    component.animations[nextIndex] = null;
    newSlot.replaceChildren();
    newSlot.hidden = false;
    newSlot.style.transform = previousIndex < 0 ? 'translateX(0)' : 'translateX(8px)';
    newSlot.style.opacity = previousIndex < 0 ? '1' : '0';
    component.container.hidden = false;

    const animationData = createComponentData(source, component);
    if (!animationData.layers.length) {
      newSlot.hidden = true;
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      let settled = false;
      let animation = null;
      const fail = () => {
        if (settled) return;
        settled = true;
        if (component.animations[nextIndex] === animation) {
          animation?.destroy();
          component.animations[nextIndex] = null;
          newSlot.replaceChildren();
          newSlot.hidden = true;
        }
        resolve(false);
      };
      animation = window.lottie.loadAnimation({
        container: newSlot,
        renderer: 'svg',
        loop: false,
        autoplay: key === 'model',
        animationData
      });
      component.animations[nextIndex] = animation;
      animation.addEventListener('data_failed', fail);
      animation.addEventListener('DOMLoaded', async () => {
        if (settled) return;
        if (requestId !== artworkRequestId || revision !== component.revision) {
          animation.destroy();
          resolve(false);
          return;
        }
        settled = true;
        component.container.classList.add('is-ready');
        $('#hero').classList.add('is-ready');
        setArtworkAspectRatio(newSlot);
        if (key !== 'model') animation.goToAndStop(0, true);
        const didSlide = await slideComponent(
          component,
          previousIndex,
          newSlot,
          requestId,
          revision
        );
        if (!didSlide) {
          animation.destroy();
          resolve(false);
          return;
        }
        if (oldSlot) {
          const oldAnimation = component.animations[previousIndex];
          oldAnimation?.destroy();
          component.animations[previousIndex] = null;
          oldSlot.replaceChildren();
          oldSlot.hidden = true;
        }
        component.active = nextIndex;
        resolve(true);
      });
    });
  };
  const renderArtworkData = async (animationData, requestId) => {
    const components = await Promise.all(
      Object.keys(artworkComponents).map((key) => renderComponentData(key, animationData, requestId))
    );
    return components.every(Boolean);
  };
  const showArtworkFallback = (view) => {
    Object.values(artworkComponents).forEach((component) => {
      component.animations.forEach((animation) => animation?.destroy());
      component.animations = [];
      component.slots.forEach((slot) => {
        slot.replaceChildren();
        slot.hidden = true;
      });
      component.active = -1;
    });
    Object.values(artworkComponents).forEach((component) => {
      component.container.hidden = component !== artworkComponents.model;
    });
    const backdropPreview = createImage(
      view.image,
      `${view.name} #${view.visualId}`,
      'nft-modal-backdrop-preview'
    );
    artBackdropContainer.replaceChildren(backdropPreview);
    artBackdropContainer.hidden = false;
    artworkComponents.model.container.classList.add('is-ready');
    artworkComponents.backdrop.container.classList.add('is-ready');
    $('#hero').classList.add('is-ready');
    fallbackArtwork = createImage(view.image, `${view.name} #${view.visualId}`, 'nft-modal-preview');
    artAnimationContainer.appendChild(fallbackArtwork);
    artAnimationContainer.hidden = false;
  };
  const loadArtwork = async (view) => {
    clearArtwork();
    const requestId = artworkRequestId;
    if (!view.animation) {
      showArtworkFallback(view);
      return;
    }
    try {
      const animationData = await loadTgsData(view.animation);
      if (requestId !== artworkRequestId || selectedId !== view.item.id) return;
      const rendered = await renderArtworkData(animationData, requestId);
      if (!rendered && requestId === artworkRequestId) showArtworkFallback(view);
    } catch {
      if (requestId === artworkRequestId) showArtworkFallback(view);
    }
  };
  const updateArtworkComponent = async (key, source, traits, requestId) => {
    const rendered = await renderComponentData(key, source, requestId);
    if (!rendered || requestId !== artworkRequestId) return false;
    const traitKey = artworkComponents[key].trait;
    const trait = traits?.[traitKey];
    if (trait?.name) await animateTraitValue(traitKey, trait.name, requestId);
    return true;
  };
  const prepareRouletteArtworks = async (item, rouletteGifts, outputItem, onArtworkReady) => {
    if (!Array.isArray(rouletteGifts)) return [];
    const baseView = getView(item);
    const validGifts = rouletteGifts.filter((gift) =>
      /^\d{1,12}$/.test(String(gift?.gift_number || ''))
      && /^[a-z0-9]+$/.test(String(gift?.collection_slug || baseView.collection.slug)));
    const winningView = getView(outputItem);
    const winningGift = validGifts.find((gift) =>
      String(gift.gift_number) === winningView.visualId
      && String(gift.collection_slug || baseView.collection.slug) === winningView.collection.slug);
    const candidates = [
      ...validGifts.filter((gift) => gift !== winningGift).slice(0, 16),
      ...(winningGift ? [winningGift] : [])
    ];
    return Promise.all(candidates.map(async (gift) => {
      const visualId = String(gift.gift_number);
      const collectionSlug = String(gift.collection_slug || baseView.collection.slug);
      const view = {
        ...baseView,
        collection: { ...baseView.collection, slug: collectionSlug },
        visualId,
        image: `https://nft.fragment.com/gift/${collectionSlug}-${visualId}.webp`,
        animation: `https://nft.fragment.com/gift/${collectionSlug}-${visualId}.tgs`
      };
      try {
        const animationData = await loadTgsData(view.animation);
        const artwork = { view, animationData, traits: gift.traits || {} };
        onArtworkReady?.(artwork);
        return artwork;
      } catch {
        return null;
      }
    })).then((artworks) => artworks.filter(Boolean));
  };
  const getLocalRouletteGifts = (item) => {
    const seen = new Set();
    return items.flatMap((entry) => {
      const view = getView(entry);
      const key = `${view.collection.slug}:${view.visualId}`;
      if (!/^[a-z0-9]+$/.test(view.collection.slug)
        || !/^\d{1,12}$/.test(view.visualId)
        || seen.has(key)) {
        return [];
      }
      seen.add(key);
      return [{
        collection_slug: view.collection.slug,
        gift_number: view.visualId,
        traits: view.attributes.fragment_traits || {}
      }];
    }).slice(0, 24);
  };
  const spinArtworkUntilStopped = async (artworks, shouldStop) => {
    if (artworks.length < 2) return;
    const requestId = artworkRequestId;
    const previousByComponent = {};
    const componentKeys = Object.keys(artworkComponents);
    const queues = Object.fromEntries(componentKeys.map((key) => [key, []]));
    const shownByComponent = Object.fromEntries(componentKeys.map((key) => [key, new Set()]));
    let componentIndex = 0;
    const shuffle = (values) => {
      for (let index = values.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
      }
      return values;
    };
    const pickArtwork = (key) => {
      const queue = queues[key];
      const shown = shownByComponent[key];
      const newArtworks = artworks.filter((artwork) => !shown.has(artwork) && !queue.includes(artwork));
      queue.push(...shuffle(newArtworks));
      if (!queue.length) {
        shown.clear();
        if (previousByComponent[key]) shown.add(previousByComponent[key]);
        queue.push(...shuffle(artworks.filter((artwork) => artwork !== previousByComponent[key])));
      }
      const artwork = queue.shift();
      shown.add(artwork);
      previousByComponent[key] = artwork;
      return artwork;
    };
    while (!shouldStop() && requestId === artworkRequestId) {
      const key = componentKeys[componentIndex];
      componentIndex = (componentIndex + 1) % componentKeys.length;
      await showRouletteComponent(key, pickArtwork(key), requestId);
      if (shouldStop() || requestId !== artworkRequestId) break;
      await new Promise((resolve) => window.setTimeout(
        resolve,
        lowPerformanceDevice ? 35 : 25
      ));
    }
  };
  const spinArtwork = async (artworks, outputItem) => {
    const requestId = artworkRequestId;
    const finalView = getView(outputItem);
    let finalArtwork = artworks.find((artwork) =>
      artwork.view.visualId === finalView.visualId
      && artwork.view.collection.slug === finalView.collection.slug);
    if (!finalArtwork) {
      try {
        if (!finalView.animation) return false;
        const animationData = await loadTgsData(finalView.animation);
        finalArtwork = {
          view: finalView,
          animationData,
          traits: outputItem.attributes?.fragment_traits || {}
        };
        artworks.push(finalArtwork);
      } catch {
        finalArtwork = null;
      }
    }
    if (!finalArtwork) return false;
    const renderedComponents = await Promise.all(Object.keys(artworkComponents).map((key) =>
      updateArtworkComponent(
        key,
        finalArtwork.animationData,
        outputItem.attributes?.fragment_traits || finalArtwork.traits,
        requestId
      )
    ));
    return renderedComponents.every(Boolean);
  };

  function renderGrid() {
    grid.replaceChildren();
    grid.setAttribute('aria-busy', 'false');
    const filtered = items.filter((item) => {
      const listed = getView(item).isListed;
      return activeFilter === 'all' || !listed;
    });
    const available = items.filter((item) => !getView(item).isListed).length;
    availableCount.textContent = available ? `(${available})` : '';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = items.length
        ? 'Нет NFT, доступных для улучшения.'
        : 'У вас пока нет NFT.';
      grid.appendChild(empty);
      return;
    }

    filtered.forEach((item, index) => {
      const view = getView(item);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card reveal';
      card.style.transitionDelay = `${Math.min(index * 35, 280)}ms`;
      card.setAttribute('aria-label', `${view.name} #${view.visualId}`);
      card.append(
        createImage(view.image, `${view.name} #${view.visualId}`, 'nft-image')
      );
      const name = document.createElement('span');
      name.className = 'nm';
      name.textContent = view.name;
      card.appendChild(name);
      const number = document.createElement('span');
      number.className = 'num';
      number.textContent = `#${view.visualId || '—'}`;
      card.appendChild(number);
      if (view.isListed) {
        const listedLabel = document.createElement('span');
        listedLabel.className = 'listed';
        listedLabel.textContent = 'На продаже';
        card.appendChild(listedLabel);
      }
      card.addEventListener('click', () => openSheet(item.id));
      grid.appendChild(card);
      requestAnimationFrame(() => card.classList.add('in'));
    });
  }

  function renderTraits(item, loading = false) {
    rows.replaceChildren();
    const view = getView(item);
    const traits = getTraits(view.attributes);
    const traitMap = Object.fromEntries(traits);
    ['model', 'symbol', 'backdrop'].forEach((key) => {
      const trait = traitMap[key] || {};
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.traitKey = key;
      const label = document.createElement('dt');
      label.textContent = traitLabels[key] || key;
      const value = document.createElement('dd');
      value.className = 'win';
      const text = document.createElement('div');
      text.className = 'rl';
      const entry = document.createElement('div');
      entry.textContent = loading
        ? 'Ищем варианты…'
        : (trait.name || 'Не указано');
      text.appendChild(entry);
      value.appendChild(text);
      if (!loading && trait.rarity_percent !== null
        && trait.rarity_percent !== undefined
        && Number.isFinite(Number(trait.rarity_percent))) {
        const rarity = document.createElement('span');
        rarity.className = 'rar';
        rarity.textContent = `${formatNumber(trait.rarity_percent)}%`;
        value.appendChild(rarity);
      }
      row.append(label, value);
      rows.appendChild(row);
    });
  }

  async function animateTraitValue(key, name, requestId) {
    const row = rows.querySelector(`[data-trait-key="${key}"]`);
    const reel = row?.querySelector('.rl');
    const current = reel?.firstElementChild;
    if (!reel || !current || !name || current.textContent === name) return;

    const next = document.createElement('div');
    next.textContent = name;
    reel.appendChild(next);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 45;
    if (typeof reel.animate === 'function') {
      const animation = reel.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(calc(var(--row-h) * -1))' }],
        { duration, easing: 'cubic-bezier(.22,.72,.18,1)' }
      );
      try {
        await animation.finished;
      } catch {
        return;
      }
      if (requestId !== artworkRequestId) return;
      animation.cancel();
    }
    reel.replaceChildren(next);
    reel.style.transform = 'translateY(0)';
  }

  function renderSelected(item, loadArt = true) {
    const view = getView(item);
    if (loadArt) loadArtwork(view);
    title.textContent = `${view.name} #${view.visualId}`;
    subtitle.textContent = `Коллекция ${view.collectionName}`;
    renderTraits(item);
    button.disabled = upgrading || view.isListed;
    button.innerHTML = '';
    button.append('Улучшить за 25 ', createImage('../assets/stars.png', '', 'star-icon'));
    if (view.isListed) {
      button.disabled = true;
      hint.textContent = 'Сначала снимите NFT с продажи на маркете.';
    } else {
      hint.textContent = 'NFT останется у вас. Обновятся только модель и характеристики.';
    }
  }

  function openSheet(itemId) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item || sheet.open) return;
    selectedId = itemId;
    renderSelected(item);
    sheet.showModal();
    closeButton.focus();
  }

  function closeSheet() {
    if (upgrading || !sheet.open) return;
    sheet.close();
  }

  const resetSheet = () => {
    clearArtwork();
    selectedId = null;
  };

  async function upgradeSelected() {
    const item = currentSelected();
    if (!item || upgrading || getView(item).isListed) return;
    let shouldStopPreRoll = false;
    let preRollStarted = false;
    let resolvePreRoll;
    const preRollPromise = new Promise((resolve) => {
      resolvePreRoll = resolve;
    });
    const preRollArtworks = [];
    const addPreRollArtwork = (artwork) => {
      if (shouldStopPreRoll
        || preRollArtworks.some((entry) =>
          entry.view.visualId === artwork.view.visualId
          && entry.view.collection.slug === artwork.view.collection.slug)) {
        return;
      }
      preRollArtworks.push(artwork);
      if (!preRollStarted && preRollArtworks.length >= 2) {
        preRollStarted = true;
        spinArtworkUntilStopped(preRollArtworks, () => shouldStopPreRoll)
          .catch((error) => console.error('NFT roulette preview failed:', error))
          .finally(resolvePreRoll);
      }
    };
    const stopPreRoll = () => {
      shouldStopPreRoll = true;
      if (!preRollStarted) resolvePreRoll();
    };
    upgrading = true;
    button.disabled = true;
    closeButton.disabled = true;
    button.textContent = 'Улучшаем…';
    hint.textContent = 'Ищем новый вариант на Fragment и быстро прокручиваем NFT…';
    renderTraits(item, true);

    try {
      const localGiftNumbers = getLocalRouletteGifts(item);
      prepareRouletteArtworks(item, localGiftNumbers, item, addPreRollArtwork)
        .catch((error) => console.error('NFT preview preload failed:', error));
      const visualPoolPromise = window.VyrnApi.upgradeRoulettePool()
        .then((response) => prepareRouletteArtworks(
          item,
          response.roulette_visuals,
          item,
          addPreRollArtwork
        ))
        .catch((error) => {
          console.warn('Cross-collection NFT preview pool is unavailable:', error);
          return [];
        });
      const result = await window.VyrnApi.upgradeNft(item.id);
      if (!result?.item || typeof result.item.id !== 'string') {
        throw new Error('Сервер не вернул обновлённую NFT. Обновите список и проверьте баланс.');
      }
      const updatedItem = result.item;
      const rouletteGifts = Array.isArray(result.roulette_gifts)
        ? result.roulette_gifts
        : [];
      hint.textContent = 'Загружаем варианты Fragment, прокрутка продолжается…';
      const rouletteArtworks = await prepareRouletteArtworks(
        item,
        rouletteGifts,
        updatedItem,
        addPreRollArtwork
      );
      await Promise.race([
        visualPoolPromise,
        new Promise((resolve) => window.setTimeout(resolve, 900))
      ]);
      stopPreRoll();
      await preRollPromise;
      if (rouletteArtworks.length) {
        renderTraits(item);
        hint.textContent = 'По очереди прокручиваем модель, символ и фон…';
      } else {
        hint.textContent = 'Подготовлено превью результата. Показываем выпавшие характеристики…';
      }
      const outputArtworkDisplayed = await spinArtwork(rouletteArtworks, updatedItem);
      const index = items.findIndex((entry) => entry.id === updatedItem.id);
      if (index < 0) {
        items.unshift(updatedItem);
      } else {
        items[index] = { ...items[index], ...updatedItem };
      }
      setBalance(result.wallet_balance);
      renderSelected(updatedItem, false);
      renderGrid();

      let refreshErrorMessage = '';
      try {
        const [me, response] = await Promise.all([
          window.VyrnApi.me(),
          window.VyrnApi.myNfts()
        ]);
        setBalance(getStarsBalance(me.wallets));
        if (Array.isArray(response.items)) {
          const refreshed = response.items.find((entry) => entry.id === updatedItem.id);
          if (refreshed) {
            const refreshedIndex = items.findIndex((entry) => entry.id === refreshed.id);
            if (refreshedIndex >= 0) items[refreshedIndex] = refreshed;
            renderSelected(refreshed, false);
            renderGrid();
          }
        }
      } catch (refreshError) {
        refreshErrorMessage = refreshError instanceof Error
          ? refreshError.message
          : 'ошибка сервера';
      }
      hint.textContent = refreshErrorMessage
        ? `NFT улучшена, но список не удалось обновить: ${refreshErrorMessage}`
        : outputArtworkDisplayed
          ? 'Готово! NFT улучшена, списано 25 звёзд.'
          : 'NFT улучшена, но Fragment не загрузил один или несколько слоёв результата.';
    } catch (error) {
      stopPreRoll();
      renderSelected(item);
      hint.textContent = error instanceof Error
        ? error.message
        : 'Не удалось улучшить NFT. Попробуйте ещё раз.';
    } finally {
      stopPreRoll();
      upgrading = false;
      closeButton.disabled = false;
      const current = currentSelected();
      button.disabled = !current || getView(current).isListed;
      if (current && !getView(current).isListed) {
        button.replaceChildren('Улучшить за 25 ', createImage('../assets/stars.png', '', 'star-icon'));
      }
    }
  }

  async function load() {
    grid.setAttribute('aria-busy', 'true');
    $('#bal').classList.add('section-skeleton-block');
    $('#chips').classList.add('section-skeleton-block');
    grid.replaceChildren(...Array.from({ length: 9 }, () => {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton-card';
      skeleton.setAttribute('aria-hidden', 'true');
      return skeleton;
    }));
    if (!window.VyrnApi) {
      grid.replaceChildren();
      grid.setAttribute('aria-busy', 'false');
      $('#bal').classList.remove('section-skeleton-block');
      $('#chips').classList.remove('section-skeleton-block');
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = 'Не удалось подключить API. Перезагрузите страницу.';
      grid.appendChild(error);
      return;
    }
    try {
      await loginStreakPromise;
      const [me, response] = await Promise.all([
        window.VyrnApi.me(),
        window.VyrnApi.myNfts()
      ]);
      $('#bal').classList.remove('section-skeleton-block');
      $('#chips').classList.remove('section-skeleton-block');
      setBalance(getStarsBalance(me.wallets));
      if (!Array.isArray(response.items)) {
        throw new Error('Сервер вернул список NFT в неверном формате.');
      }
      items = response.items;
      renderGrid();
    } catch (error) {
      grid.replaceChildren();
      grid.setAttribute('aria-busy', 'false');
      $('#bal').classList.remove('section-skeleton-block');
      $('#chips').classList.remove('section-skeleton-block');
      const message = document.createElement('div');
      message.className = 'error';
      message.textContent = error instanceof Error
        ? error.message
        : 'Не удалось загрузить NFT.';
      grid.appendChild(message);
    }
  }

  $('#chips').addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    activeFilter = chip.dataset.filter || 'all';
    document.querySelectorAll('.chip').forEach((entry) => {
      entry.classList.toggle('on', entry === chip);
    });
    renderGrid();
  });
  $('#cta').addEventListener('click', upgradeSelected);
  closeButton.addEventListener('click', closeSheet);
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) closeSheet();
  });
  sheet.addEventListener('cancel', (event) => {
    if (upgrading) event.preventDefault();
  });
  sheet.addEventListener('close', resetSheet);
  window.addEventListener('scroll', () => {
    $('#hd').classList.toggle('sc', window.scrollY > 4);
  }, { passive: true });

  load();
})();
