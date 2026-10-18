(() => {
  const config = window.VYRN_SUPABASE_CONFIG || {};

  const request = async (action, payload = {}) => {
    if (!config.url || config.url.includes('YOUR_PROJECT_REF') || !config.anonKey || config.anonKey.includes('YOUR_SUPABASE')) {
      throw new Error('Добавьте URL проекта и anon key в supabase-client-config.js.');
    }
    const initData = window.Telegram?.WebApp?.initData;
    const browserDemo = !initData && config.browserDemo === true;
    if (!initData && !browserDemo) throw new Error('Откройте VYRN через Telegram или включите браузерный демо-профиль.');

    if (browserDemo) {
      if (action === 'my_nfts') {
        const query = new URLSearchParams({
          select: 'item_id,external_id,attributes,acquired_at,model_id,model_slug,model_name,preview_url,animation_url,collection_name,collection_slug,listing_id,listing_price,listing_currency,listing_status',
          order: 'acquired_at.desc'
        });
        const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/browser_demo_nfts?${query}`, {
          headers: { apikey: config.anonKey }
        });
        const rows = await response.json().catch(() => []);
        if (!response.ok) {
          if (rows.code === 'PGRST205' || rows.message?.includes('browser_demo_nfts')) {
            throw new Error('Supabase ещё не обновлён для чтения NFT. Повторно выполните supabase/browser-demo-read.sql в SQL Editor.');
          }
          throw new Error(rows.message || rows.msg || `Ошибка Supabase (${response.status}).`);
        }
        return {
          items: rows.map((row) => ({
            id: row.item_id,
            external_id: row.external_id,
            attributes: row.attributes,
            acquired_at: row.acquired_at,
            nft_models: {
              id: row.model_id,
              slug: row.model_slug,
              name: row.model_name,
              preview_url: row.preview_url,
              animation_url: row.animation_url,
              nft_collections: { name: row.collection_name, slug: row.collection_slug }
            },
            market_listings: row.listing_id ? [{
              id: row.listing_id,
              price: row.listing_price,
              currency: row.listing_currency,
              status: row.listing_status
            }] : []
          }))
        };
      }
      if (action !== 'me') throw new Error('В браузерном демо доступен только просмотр профиля и пустой инвентарь NFT.');
      const query = new URLSearchParams({
        select: 'id,telegram_id,nickname,username,first_name,last_name,avatar_url,bio,stars_balance',
        limit: '1'
      });
      const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/browser_demo_profile?${query}`, {
        headers: { apikey: config.anonKey }
      });
      const profiles = await response.json().catch(() => []);
      if (!response.ok) {
        if (profiles.code === 'PGRST205' || profiles.code === 'PGRST204' || profiles.message?.includes('browser_demo_profile') || profiles.message?.includes('stars_balance')) {
          throw new Error('Обновите SQL view demo-профиля: повторно выполните supabase/browser-demo-read.sql в Supabase SQL Editor.');
        }
        throw new Error(profiles.message || profiles.msg || `Ошибка Supabase (${response.status}).`);
      }
      if (!profiles.length) throw new Error('В profiles нет записи с telegram_id = 0.');
      return {
        profile: profiles[0],
        wallets: [{ currency: 'stars', balance: profiles[0].stars_balance ?? 0 }]
      };
    }

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
    if (!response.ok) throw new Error(result.error || result.message || `Ошибка сервера (${response.status}).`);
    return result;
  };

  window.VyrnApi = {
    isConfigured: Boolean(config.url && !config.url.includes('YOUR_PROJECT_REF') && config.anonKey && !config.anonKey.includes('YOUR_SUPABASE')),
    browserDemo: config.browserDemo === true,
    me: () => request('me'),
    updateProfile: (profile) => request('update_profile', profile),
    myNfts: () => request('my_nfts'),
    createChat: (nickname) => request('create_chat', { nickname }),
    market: (mode = 'all') => request('market', { mode }),
    createListing: (nftItemId, price, currency) => request('create_listing', { nft_item_id: nftItemId, price, currency }),
    cancelListing: (listingId) => request('cancel_listing', { listing_id: listingId }),
    buyListing: (listingId) => request('buy_listing', { listing_id: listingId }),
    chats: () => request('chats'),
    messages: (chatId) => request('messages', { chat_id: chatId }),
    sendMessage: (chatId, body) => request('send_message', { chat_id: chatId, body }),
    deleteMessage: (messageId) => request('delete_message', { message_id: messageId })
  };
})();
