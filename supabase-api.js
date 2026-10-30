(() => {
  const config = window.VYRN_SUPABASE_CONFIG || {};
  const CACHE_VERSION = 'v6';
  const apiScript = [...document.scripts].find((script) => script.src.includes('supabase-api.js'));
  const appBaseUrl = new URL('.', apiScript?.src || window.location.href);
  const CACHE_PREFIX = `vyrn:${CACHE_VERSION}:`;
  const ACCOUNT_CACHE_PREFIX = `${CACHE_PREFIX}account:`;
  const ACCOUNT_CACHE_TTL = 5 * 60 * 1000;
  const CACHE_TTL = {
    my_nfts: 120_000,
    profile_nfts: 120_000,
    market: 60_000,
    chats: 30_000
  };
  const cacheRefreshes = new Map();
  const cacheGenerations = new Map();
  const accountRequests = new Map();
  const isValidCachedResult = (action, result) =>
    action !== 'market' || Array.isArray(result?.items);

  const request = async (action, payload = {}) => {
    if (!config.url || config.url.includes('YOUR_PROJECT_REF') || !config.anonKey || config.anonKey.includes('YOUR_SUPABASE')) {
      throw new Error('Добавьте URL проекта и anon key в supabase-client-config.js.');
    }
    const initData = window.Telegram?.WebApp?.initData;
    const browserDemo = !initData && config.browserDemo === true;
    if (!initData && !browserDemo) throw new Error('Откройте VYRN через Telegram или включите браузерный демо-профиль.');

    const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/telegram-api`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...payload, action, ...(initData ? { initData } : { browserDemo: true }) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const gatewayMessage = String(result.message || result.msg || '');
      if (response.status === 404 && (
        result.code === 'NOT_FOUND'
        || /function.+not found|requested function was not found/i.test(gatewayMessage)
        || (!result.error && !result.message)
      )) {
        throw new Error(`Функция telegram-api не найдена в Supabase-проекте ${config.url.replace(/\/$/, '').split('.').shift().split('//').pop()}. Проверьте выбранный проект и разверните функцию telegram-api.`);
      }
      const details = result.error || result.message || `Ошибка сервера (${response.status}).`;
      throw new Error(`${details} [${result.code || result.reason || `HTTP ${response.status}`}]`);
    }
    return result;
  };

  const getCacheScope = () => {
    if (config.browserDemo === true && !window.Telegram?.WebApp?.initData) return 'demo';
    const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (telegramUser?.id) return String(telegramUser.id);
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) {
      try {
        const user = JSON.parse(new URLSearchParams(initData).get('user') || '{}');
        if (user.id) return String(user.id);
      } catch (error) {
        console.warn('Не удалось определить пользователя Telegram для локального кэша:', error);
      }
    }
    return null;
  };

  const getAccountCacheKey = (scope) => `${ACCOUNT_CACHE_PREFIX}${scope}`;
  const readCachedAccount = () => {
    const scope = getCacheScope();
    if (!scope) return null;
    try {
      const stored = sessionStorage.getItem(getAccountCacheKey(scope));
      if (!stored) return null;
      const cached = JSON.parse(stored);
      if (typeof cached?.savedAt !== 'number'
        || Date.now() - cached.savedAt >= ACCOUNT_CACHE_TTL
        || !cached.result?.profile
        || !Array.isArray(cached.result.wallets)) {
        sessionStorage.removeItem(getAccountCacheKey(scope));
        return null;
      }
      return cached.result;
    } catch (error) {
      console.warn('Не удалось прочитать кэш аккаунта VYRN:', error);
      return null;
    }
  };
  const writeCachedAccount = (result) => {
    const scope = getCacheScope();
    if (!scope || !result?.profile || !Array.isArray(result.wallets)) return;
    try {
      sessionStorage.setItem(getAccountCacheKey(scope), JSON.stringify({
        savedAt: Date.now(),
        result: { profile: result.profile, wallets: result.wallets }
      }));
    } catch (error) {
      console.warn('Не удалось сохранить кэш аккаунта VYRN:', error);
    }
  };

  const getCacheKey = (scope, action, payload) =>
    `${CACHE_PREFIX}${scope}:${action}:${JSON.stringify(payload)}`;

  const removeUserCache = (scope) => {
    const userPrefix = `${CACHE_PREFIX}${scope}:`;
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(userPrefix)) localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Не удалось очистить локальный кэш VYRN:', error);
    }
  };

  const cachedRequest = async (action, payload = {}) => {
    const ttl = CACHE_TTL[action];
    const scope = getCacheScope();
    if (!ttl || !scope) return request(action, payload);

    const key = getCacheKey(scope, action, payload);
    let cached;
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue) {
        cached = JSON.parse(storedValue);
        if (!cached || typeof cached.savedAt !== 'number' || !('result' in cached)
          || !isValidCachedResult(action, cached.result)) {
          localStorage.removeItem(key);
          cached = null;
        }
      }
    } catch (error) {
      console.warn('Не удалось прочитать локальный кэш VYRN:', error);
      try {
        localStorage.removeItem(key);
      } catch (removeError) {
        console.warn('Не удалось удалить повреждённую запись кэша VYRN:', removeError);
      }
    }

    const refresh = async () => {
      const generation = cacheGenerations.get(scope) || 0;
      const refreshed = await request(action, payload);
      if (!isValidCachedResult(action, refreshed)) {
        throw new Error(refreshed?.error || 'Сервер вернул некорректный список рынка. Попробуйте обновить страницу.');
      }
      if (generation !== (cacheGenerations.get(scope) || 0)) return refreshed;
      try {
        localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), result: refreshed }));
      } catch (error) {
        console.warn('Не удалось сохранить локальный кэш VYRN:', error);
      }
      window.dispatchEvent(new CustomEvent('vyrn:cache-refresh', {
        detail: { action, payload, result: refreshed }
      }));
      return refreshed;
    };

    if (!cached) return refresh();
    if (Date.now() - cached.savedAt >= ttl && !cacheRefreshes.has(key)) {
      const refreshPromise = refresh()
        .catch((error) => {
          console.warn(`Не удалось обновить кэш VYRN (${action}):`, error);
        })
        .finally(() => cacheRefreshes.delete(key));
      cacheRefreshes.set(key, refreshPromise);
    }
    return cached.result;
  };

  const openStarsTopup = () => {
    const url = new URL('wallet.html', appBaseUrl);
    url.searchParams.set('openTopup', '1');
    window.location.assign(url.href);
  };
  window.addEventListener('vyrn:insufficient-stars', openStarsTopup);

  const mutate = async (action, payload = {}, options = {}) => {
    const scope = getCacheScope();
    if (scope) cacheGenerations.set(scope, (cacheGenerations.get(scope) || 0) + 1);
    let result;
    try {
      result = await request(action, payload);
    } catch (error) {
      const message = String(error?.message || '');
      const explicitStarsShortage = /(?:not enough|insufficient)\s+stars|stars.{0,30}(?:not enough|insufficient)/i.test(message);
      const listingStarsShortage = action === 'buy_listing'
        && options.currency === 'stars'
        && /insufficient balance/i.test(message);
      if (explicitStarsShortage || listingStarsShortage) {
        window.dispatchEvent(new CustomEvent('vyrn:insufficient-stars', { detail: { action } }));
      }
      throw error;
    }
    if (scope) {
      removeUserCache(scope);
      try {
        sessionStorage.removeItem(getAccountCacheKey(scope));
      } catch (error) {
        console.warn('Не удалось очистить кэш аккаунта VYRN:', error);
      }
    }
    return result;
  };

  window.VyrnApi = {
    isConfigured: Boolean(config.url && !config.url.includes('YOUR_PROJECT_REF') && config.anonKey && !config.anonKey.includes('YOUR_SUPABASE')),
    browserDemo: config.browserDemo === true,
    botUsername: config.botUsername || '',
    fragmentPrices: async (gifts) => {
      if (!config.url || config.url.includes('YOUR_PROJECT_REF') || !config.anonKey || config.anonKey.includes('YOUR_SUPABASE')) {
        throw new Error('Добавьте URL проекта и anon key в supabase-client-config.js.');
      }
      const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/fragment-price`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gifts }),
        signal: AbortSignal.timeout(90_000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(result?.items)) {
        throw new Error(result?.error || `Не удалось загрузить атрибуты Fragment (${response.status}).`);
      }
      return result.items;
    },
    me: () => {
      const cached = readCachedAccount();
      if (cached) return Promise.resolve(cached);
      const scope = getCacheScope();
      if (scope && accountRequests.has(scope)) return accountRequests.get(scope);
      const generation = scope ? cacheGenerations.get(scope) || 0 : 0;
      const requestPromise = request('me').then((result) => {
        if (!scope || generation === (cacheGenerations.get(scope) || 0)) {
          writeCachedAccount(result);
        }
        return result;
      }).finally(() => {
        if (scope) accountRequests.delete(scope);
      });
      if (scope) accountRequests.set(scope, requestPromise);
      return requestPromise;
    },
    cachedAccount: readCachedAccount,
    updateCachedAccount: writeCachedAccount,
    wallet: () => request('wallet'),
    recordLoginStreak: async () => {
      const result = await request('record_login_streak');
      const scope = getCacheScope();
      if (scope) {
        try {
          sessionStorage.removeItem(getAccountCacheKey(scope));
        } catch (error) {
          console.warn('Не удалось обновить кэш аккаунта после начисления за вход:', error);
        }
      }
      return result;
    },
    leaderboard: () => request('leaderboard'),
    createStarInvoice: (amount) => request('create_star_invoice', { amount }),
    createPremiumInvoice: (durationMonths) => request('create_premium_invoice', { duration_months: durationMonths }),
    redeemPromoCode: (code) => mutate('redeem_promo_code', { code }),
    referralInfo: () => request('referral_info'),
    updateProfile: (profile) => mutate('update_profile', profile),
    anonymousNumbers: () => request('anonymous_numbers'),
    spinAnonymousNumber: () => mutate('spin_anonymous_number'),
    upgradeAnonymousNumber: (numberId, digitIndex) => mutate('upgrade_anonymous_number', {
      number_id: numberId,
      digit_index: digitIndex
    }),
    myNfts: () => cachedRequest('my_nfts'),
    upgradeNft: (nftItemId) => mutate('upgrade_nft', { nft_item_id: nftItemId }),
    upgradeRoulettePool: () => mutate('upgrade_roulette_pool'),
    starterGiftStatus: (launchId) => request('starter_gift_status', launchId ? { launch_id: launchId } : {}),
    claimStarterGift: (launchId) => mutate('claim_starter_gift', launchId ? { launch_id: launchId } : {}),
    craftNfts: (nftItemIds) => mutate('craft_nfts', { nft_item_ids: nftItemIds }),
    refreshNftPrice: (nftItemId) => mutate('refresh_nft_price', { nft_item_id: nftItemId }),
    updateNftPrice: (nftItemId, priceStars) => mutate('update_nft_price', { nft_item_id: nftItemId, price_stars: priceStars }),
    autoSellNft: (nftItemId) => mutate('auto_sell_nft', { nft_item_id: nftItemId }),
    profileNfts: (profileId) => cachedRequest('profile_nfts', { profile_id: profileId }),
    createChat: (nickname) => mutate('create_chat', { nickname }),
    market: (mode = 'all') => cachedRequest('market', { mode }),
    createListing: (nftItemId, price, currency) => mutate('create_listing', { nft_item_id: nftItemId, price, currency }),
    cancelListing: (listingId) => mutate('cancel_listing', { listing_id: listingId }),
    buyListing: (listingId, currency) => mutate('buy_listing', { listing_id: listingId }, { currency }),
    dailyTaskBoard: () => request('daily_task_board'),
    checkDailyTask: (assignmentId) => mutate('check_daily_task', { assignment_id: assignmentId }),
    recordDailyTaskEvent: (eventKey) => request('record_daily_task_event', { event_key: eventKey }),
    chats: () => cachedRequest('chats'),
    messages: (chatId) => request('messages', { chat_id: chatId }),
    sendMessage: (chatId, body) => mutate('send_message', { chat_id: chatId, body }),
    sendNftGift: (chatId, nftItemId, priceStars) => mutate('send_nft_gift', { chat_id: chatId, nft_item_id: nftItemId, price_stars: priceStars }),
    acceptNftGift: (giftId) => mutate('accept_nft_gift', { gift_id: giftId }),
    declineNftGift: (giftId) => mutate('decline_nft_gift', { gift_id: giftId }),
    deleteMessage: (messageId) => mutate('delete_message', { message_id: messageId })
  };
})();
