(() => {
  const config = window.VYRN_SUPABASE_CONFIG || {};
  const grid = document.querySelector('[data-cases-grid]');
  const status = document.querySelector('[data-cases-status]');
  const opening = document.querySelector('[data-case-opening]');
  document.body.append(opening);
  const title = document.querySelector('[data-selected-case-title]');
  const description = document.querySelector('[data-selected-case-description]');
  const openButton = document.querySelector('[data-open-case]');
  const prizeList = document.querySelector('[data-prize-list]');
  const balance = document.querySelector('[data-cases-balance]');
  const ringFrame = document.querySelector('.case-ring-frame iframe');
  const closeButton = document.querySelector('[data-close-case]');
  let cases = [];
  let selectedCase = null;
  let openedPrize = null;
  let busy = false;
  let sellingPrize = false;
  let ringReady = false;
  let ringReadyPromise = null;
  let ringReadyResolve = null;
  const ringUrl = new URL(ringFrame.src, window.location.href);
  const ringOrigin = ringUrl.origin;
  const ringTargetOrigin = ringOrigin === 'null' ? '*' : ringOrigin;
  const sendRingMessage = (message) => ringFrame.contentWindow?.postMessage(message, ringTargetOrigin);

  const waitForRingReady = () => {
    if (ringReady) return Promise.resolve();
    if (ringReadyPromise) return ringReadyPromise;
    ringReadyPromise = new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.clearInterval(ping);
        ringReadyResolve = null;
        reject(new Error('Не удалось загрузить анимацию кейса. Обновите страницу.'));
      }, 5000);
      const finish = () => {
        window.clearTimeout(timeout);
        window.clearInterval(ping);
        ringReadyResolve = null;
        resolve();
      };
      ringReadyResolve = finish;
      const pingFrame = () => sendRingMessage({ type: 'ring:hello' });
      const ping = window.setInterval(pingFrame, 150);
      pingFrame();
    }).finally(() => {
      ringReadyPromise = null;
    });
    return ringReadyPromise;
  };

  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
    status.hidden = !message;
  };

  const makeElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const makeStarIcon = () => {
    const icon = document.createElement('img');
    icon.src = '../assets/stars.png';
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    icon.className = 'case-star-icon';
    return icon;
  };

  const makeStars = (amount) => {
    const label = makeElement('span', 'case-card-price');
    label.append(makeStarIcon(), document.createTextNode(`${Number(amount).toLocaleString('ru-RU')}`));
    return label;
  };

  const setOpenButtonPrice = (amount) => {
    openButton.replaceChildren(
      document.createTextNode('Открыть за  '),
      makeStarIcon(),
      document.createTextNode(`${Number(amount).toLocaleString('ru-RU')}`)
    );
  };

  const setNftImage = (image, url) => {
    image.src = url || '../assets/placeholder.png';
    image.alt = '';
    image.onerror = () => {
      image.onerror = null;
      image.src = '../assets/placeholder.png';
    };
  };

  const updateBalance = (amount) => {
    if (Number.isSafeInteger(Number(amount))) {
      balance.textContent = Number(amount).toLocaleString('ru-RU');
    }
  };

  const renderCases = () => {
    grid.replaceChildren();
    cases.forEach((item) => {
      const card = makeElement('button', 'case-card');
      card.type = 'button';
      card.setAttribute('aria-label', `${item.title}, ${Number(item.price_stars).toLocaleString('ru-RU')} Stars`);
      const art = makeElement('span', 'case-card-art');
      const image = document.createElement('img');
      image.className = 'case-cover-image';
      setNftImage(image, item.cover_url || item.prizes[0]?.preview_url);
      art.append(image);
      const copy = makeElement('span', 'case-card-copy');
      copy.append(
        makeElement('strong', '', item.title),
        makeStars(item.price_stars)
      );
      card.append(art, copy);
      card.addEventListener('click', () => selectCase(item));
      grid.append(card);
    });
    grid.setAttribute('aria-busy', 'false');
  };

  const makePrize = (prize, odds) => {
    const item = makeElement('article', 'case-prize');
    const art = makeElement('span', 'case-prize-art');
    const image = document.createElement('img');
    setNftImage(image, prize.preview_url);
    art.append(image);
    const copy = makeElement('span', 'case-prize-copy');
    const prizeValue = makeElement('span', 'case-prize-value');
    prizeValue.append(
      document.createTextNode(`${Number(prize.value_stars).toLocaleString('ru-RU')} `),
      makeStarIcon(),
      document.createTextNode(` · шанс ${odds}%`)
    );
    copy.append(
      makeElement('strong', '', prize.name),
      prizeValue
    );
    item.append(art, copy);
    return item;
  };

  const selectCase = (item) => {
    if (busy) return;
    selectedCase = item;
    title.textContent = item.title;
    description.textContent = item.description || 'Выбери подарок и открой кейс.';
    setOpenButtonPrice(item.price_stars);
    openButton.disabled = false;
    openedPrize = null;
    const totalWeight = item.prizes.reduce((sum, prize) => sum + Number(prize.weight), 0);
    prizeList.replaceChildren(...item.prizes.map((prize) =>
      makePrize(prize, (Number(prize.weight) / totalWeight * 100).toFixed(1))
    ));
    opening.classList.add('is-visible');
    opening.removeAttribute('hidden');
    document.body.classList.add('has-case-modal');
    sendRingMessage({ type: 'ring:preview', items: item.prizes });
  };

  const getCases = async () => {
    if (!config.url || !config.anonKey || config.url.includes('YOUR_PROJECT_REF')
      || config.anonKey.includes('YOUR_SUPABASE')) {
      throw new Error('Проверьте URL и публичный anon key в supabase-client-config.js.');
    }
    let response;
    try {
      response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/admin-cases`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'list' })
      });
    } catch (error) {
      throw new Error(`Не удалось загрузить каталог кейсов: ${error.message}`);
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || `Не удалось загрузить кейсы (${response.status}).`);
    }
    if (!Array.isArray(data?.cases)) throw new Error('Сервер вернул некорректный список кейсов.');
    return data.cases;
  };

  const openSelectedCase = async () => {
    if (!selectedCase || busy) return;
    if (!window.VyrnApi?.openCase) {
      setStatus('Не удалось подключить API VYRN. Обновите страницу.', true);
      return;
    }
    busy = true;
    openButton.disabled = true;
    openButton.textContent = 'Кольцо вращается…';
    setStatus('');
    openedPrize = null;
    const animationItems = selectedCase.prizes.map((prize) => ({ ...prize }));
    try {
      await waitForRingReady();
      sendRingMessage({ type: 'ring:start', items: animationItems });
      const opened = await window.VyrnApi.openCase(selectedCase.id);
      const prize = opened?.result;
      if (!prize?.item_id || !prize.prize_id || !/^\d{1,12}$/.test(String(prize.gift_number || ''))) {
        throw new Error('Сервер вернул неполные данные о подарке. Обновите страницу и проверьте коллекцию.');
      }
      openedPrize = prize;
      updateBalance(prize.balance);
      sendRingMessage({
        type: 'ring:stop',
        winnerId: prize.prize_id,
        giftNumber: String(prize.gift_number),
        result: {
          name: prize.name,
          valueStars: Number(prize.value_stars),
          itemId: prize.item_id
        }
      }, location.origin);
      await new Promise((resolve) => window.setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 180 : 4400));
    } catch (error) {
      openedPrize = null;
      sendRingMessage({ type: 'ring:preview', items: selectedCase.prizes });
      setStatus(error.message || 'Не удалось открыть кейс.', true);
    } finally {
      busy = false;
      openButton.disabled = false;
      setOpenButtonPrice(selectedCase.price_stars);
    }
  };

  const receiveRingMessage = async (event) => {
    if (event.origin !== ringOrigin || event.source !== ringFrame.contentWindow || !event.data) return;
    if (event.data.type === 'ring:ready') {
      const wasReady = ringReady;
      ringReady = true;
      ringReadyResolve?.();
      if (!wasReady && selectedCase && !busy) {
        sendRingMessage({ type: 'ring:preview', items: selectedCase.prizes });
      }
      return;
    }
    if (event.data.type === 'ring:save') {
      if (!openedPrize || String(event.data.itemId) !== String(openedPrize.item_id)) return;
      sendRingMessage({ type: 'ring:saved' });
      return;
    }
    if (event.data.type === 'ring:sell') {
      if (!openedPrize || sellingPrize || String(event.data.itemId) !== String(openedPrize.item_id)) return;
      sellingPrize = true;
      try {
        await window.VyrnApi.refreshNftPrice(openedPrize.item_id);
        const sold = await window.VyrnApi.autoSellNft(openedPrize.item_id);
        const sale = sold?.sale;
        if (!sale) throw new Error('Сервер не подтвердил продажу подарка.');
        updateBalance(sold.balance ?? sale.balance);
        sendRingMessage({
          type: 'ring:sold',
          amount: Number(sale.net_amount),
          commission: Number(sale.commission_amount)
        });
        openedPrize = null;
        window.dispatchEvent(new CustomEvent('vyrn:nft-auto-sold'));
        const refreshedAccount = window.refreshVyrnAccount?.();
        refreshedAccount?.catch((error) => {
          console.error('Не удалось обновить баланс после автопродажи NFT:', error);
        });
      } catch (error) {
        sendRingMessage({ type: 'ring:sell-error', message: error.message || 'Не удалось продать подарок.' });
        setStatus(error.message || 'Не удалось продать подарок.', true);
      } finally {
        sellingPrize = false;
      }
    }
  };

  window.addEventListener('message', receiveRingMessage);
  ringFrame.addEventListener('load', () => sendRingMessage({ type: 'ring:hello' }));
  closeButton.addEventListener('click', () => {
    if (busy) return;
    opening.classList.remove('is-visible');
    window.setTimeout(() => {
      opening.setAttribute('hidden', 'hidden');
      document.body.classList.remove('has-case-modal');
    }, 280);
    sendRingMessage({ type: 'ring:reset' });
  });
  openButton.addEventListener('click', openSelectedCase);

  Promise.all([
    getCases(),
    window.VyrnApi?.me ? window.VyrnApi.me() : Promise.reject(new Error('Не удалось подключить API VYRN.'))
  ]).then(([loadedCases, account]) => {
    cases = loadedCases.filter((item) => Array.isArray(item.prizes) && item.prizes.length >= 2);
    if (!cases.length) {
      setStatus('Пока нет доступных кейсов.');
      grid.setAttribute('aria-busy', 'false');
      return;
    }
    renderCases();
    const wallet = account.wallets?.find((item) => item.currency === 'stars');
    if (wallet) updateBalance(wallet.balance);
    setStatus('');
  }).catch((error) => {
    grid.setAttribute('aria-busy', 'false');
    setStatus(error.message || 'Не удалось загрузить кейсы.', true);
  });
})();
