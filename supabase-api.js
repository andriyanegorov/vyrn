(() => {
  const config = window.VYRN_SUPABASE_CONFIG || {};

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

  window.VyrnApi = {
    isConfigured: Boolean(config.url && !config.url.includes('YOUR_PROJECT_REF') && config.anonKey && !config.anonKey.includes('YOUR_SUPABASE')),
    browserDemo: config.browserDemo === true,
    me: () => request('me'),
    wallet: () => request('wallet'),
    updateProfile: (profile) => request('update_profile', profile),
    myNfts: () => request('my_nfts'),
    craftNfts: (nftItemIds) => request('craft_nfts', { nft_item_ids: nftItemIds }),
    refreshNftPrice: (nftItemId) => request('refresh_nft_price', { nft_item_id: nftItemId }),
    updateNftPrice: (nftItemId, priceStars) => request('update_nft_price', { nft_item_id: nftItemId, price_stars: priceStars }),
    profileNfts: (profileId) => request('profile_nfts', { profile_id: profileId }),
    createChat: (nickname) => request('create_chat', { nickname }),
    market: (mode = 'all') => request('market', { mode }),
    createListing: (nftItemId, price, currency) => request('create_listing', { nft_item_id: nftItemId, price, currency }),
    cancelListing: (listingId) => request('cancel_listing', { listing_id: listingId }),
    buyListing: (listingId) => request('buy_listing', { listing_id: listingId }),
    chats: () => request('chats'),
    messages: (chatId) => request('messages', { chat_id: chatId }),
    sendMessage: (chatId, body) => request('send_message', { chat_id: chatId, body }),
    sendNftGift: (chatId, nftItemId, priceStars) => request('send_nft_gift', { chat_id: chatId, nft_item_id: nftItemId, price_stars: priceStars }),
    acceptNftGift: (giftId) => request('accept_nft_gift', { gift_id: giftId }),
    declineNftGift: (giftId) => request('decline_nft_gift', { gift_id: giftId }),
    deleteMessage: (messageId) => request('delete_message', { message_id: messageId })
  };
})();
