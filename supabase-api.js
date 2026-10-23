(() => {
  const config = window.VYRN_SUPABASE_CONFIG || {};
  const CACHE_VERSION = 'v1';
  const CACHE_PREFIX = `vyrn:${CACHE_VERSION}:`;
  const CACHE_TTL = {
    my_nfts: 120_000,
    profile_nfts: 120_000,
    market: 60_000,
    chats: 30_000
  };
  const cacheRefreshes = new Map();
  const cacheGenerations = new Map();

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
        if (!cached || typeof cached.savedAt !== 'number' || !('result' in cached)) {
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

  const mutate = async (action, payload = {}) => {
    const scope = getCacheScope();
    if (scope) cacheGenerations.set(scope, (cacheGenerations.get(scope) || 0) + 1);
    const result = await request(action, payload);
    if (scope) removeUserCache(scope);
    return result;
  };

  window.VyrnApi = {
    isConfigured: Boolean(config.url && !config.url.includes('YOUR_PROJECT_REF') && config.anonKey && !config.anonKey.includes('YOUR_SUPABASE')),
    browserDemo: config.browserDemo === true,
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
    me: () => request('me'),
    wallet: () => request('wallet'),
    createStarInvoice: (amount) => request('create_star_invoice', { amount }),
    createPremiumInvoice: (durationMonths) => request('create_premium_invoice', { duration_months: durationMonths }),
    updateProfile: (profile) => mutate('update_profile', profile),
    myNfts: () => cachedRequest('my_nfts'),
    upgradeNft: (nftItemId) => mutate('upgrade_nft', { nft_item_id: nftItemId }),
    upgradeRoulettePool: () => mutate('upgrade_roulette_pool'),
    craftNfts: (nftItemIds) => mutate('craft_nfts', { nft_item_ids: nftItemIds }),
    refreshNftPrice: (nftItemId) => mutate('refresh_nft_price', { nft_item_id: nftItemId }),
    updateNftPrice: (nftItemId, priceStars) => mutate('update_nft_price', { nft_item_id: nftItemId, price_stars: priceStars }),
    profileNfts: (profileId) => cachedRequest('profile_nfts', { profile_id: profileId }),
    createChat: (nickname) => mutate('create_chat', { nickname }),
    market: (mode = 'all') => cachedRequest('market', { mode }),
    createListing: (nftItemId, price, currency) => mutate('create_listing', { nft_item_id: nftItemId, price, currency }),
    cancelListing: (listingId) => mutate('cancel_listing', { listing_id: listingId }),
    buyListing: (listingId) => mutate('buy_listing', { listing_id: listingId }),
    chats: () => cachedRequest('chats'),
    messages: (chatId) => request('messages', { chat_id: chatId }),
    sendMessage: (chatId, body) => mutate('send_message', { chat_id: chatId, body }),
    sendNftGift: (chatId, nftItemId, priceStars) => mutate('send_nft_gift', { chat_id: chatId, nft_item_id: nftItemId, price_stars: priceStars }),
    acceptNftGift: (giftId) => mutate('accept_nft_gift', { gift_id: giftId }),
    declineNftGift: (giftId) => mutate('decline_nft_gift', { gift_id: giftId }),
    deleteMessage: (messageId) => mutate('delete_message', { message_id: messageId })
  };
})();
