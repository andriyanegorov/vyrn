const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const secureEquals = (first: string, second: string) => {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index++) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
};

const telegramApiRequest = async (botToken: string, method: string, payload: Record<string, unknown>) => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  return { ok: response.ok && result?.ok === true, result, status: response.status };
};

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

const hmac = async (keyBytes: Uint8Array, message: string) => {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
};

const matchesTelegramHash = async (params: URLSearchParams, botToken: string, receivedHash: string) => {
  const buildCheckString = (includeSignature: boolean) => [...params.entries()]
    .filter(([key]) => includeSignature || key !== 'signature')
    .sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), botToken);
  const signingKey = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  for (const includeSignature of [true, false]) {
    const expectedHash = hex(await crypto.subtle.sign(
      'HMAC',
      signingKey,
      new TextEncoder().encode(buildCheckString(includeSignature)),
    ));
    if (expectedHash.length === receivedHash.length) {
      let difference = 0;
      for (let index = 0; index < expectedHash.length; index++) {
        difference |= expectedHash.charCodeAt(index) ^ receivedHash.charCodeAt(index);
      }
      if (difference === 0) return true;
    }
  }
  return false;
};

const verifyTelegramInitData = async (initData: string, botToken: string) => {
  if (initData.length > 8192) return { user: null, reason: 'initData-too-long' };
  botToken = botToken.trim();
  if (!botToken || !/^\d+:[A-Za-z0-9_-]+$/.test(botToken)) return { user: null, reason: 'bot-token-invalid' };
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash')?.toLowerCase();
  const authDate = Number(params.get('auth_date'));
  const userValue = params.get('user');
  if (!receivedHash) return { user: null, reason: 'hash-missing' };
  if (!userValue) return { user: null, reason: 'user-missing' };
  if (!Number.isInteger(authDate)) return { user: null, reason: 'auth-date-invalid' };
  if (Math.abs(Date.now() / 1000 - authDate) > 86400) return { user: null, reason: 'auth-date-expired' };

  params.delete('hash');
  if (!await matchesTelegramHash(params, botToken, receivedHash)) {
    return {
      user: null,
      reason: `hash-mismatch-${params.has('signature') ? 'with-signature' : 'without-signature'}-${await getTelegramBotStatus(botToken)}`
    };
  }

  try {
    const user = JSON.parse(userValue);
    return Number.isSafeInteger(user.id) && user.id > 0
      ? { user, reason: null }
      : { user: null, reason: 'telegram-user-invalid' };
  } catch {
    return { user: null, reason: 'user-json-invalid' };
  }
};

const generateNickname = () => `player${(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).toString().padStart(6, '0')}`;

const getTelegramBotStatus = async (botToken: string) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const result = await response.json().catch(() => null);
    if (result?.ok !== true) return 'bot-token-rejected';
    return `bot-token-valid-${result.result?.username || result.result?.id || 'unknown'}`;
  } catch {
    return 'bot-token-check-failed';
  }
};

const readUnverifiedTelegramUser = (initData: string) => {
  try {
    const userValue = new URLSearchParams(initData).get('user');
    if (!userValue) return null;
    const user = JSON.parse(userValue);
    return Number.isSafeInteger(user.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
};

const readFragmentGiftNumbers = (html: string, collectionSlug: string) => {
  const numbers = new Set<string>();
  const pattern = new RegExp(`<a\\b[^>]*href=["']\\/gift\\/${collectionSlug}-(\\d+)(?:[?#][^"']*)?["']`, 'gi');
  for (const match of html.matchAll(pattern)) {
    if (/^\d{1,12}$/.test(match[1]) && Number(match[1]) > 0) numbers.add(match[1]);
  }
  return [...numbers];
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VYRN_SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500);
  let createClient: any;
  try {
    ({ createClient } = await import('https://esm.sh/@supabase/supabase-js@2'));
  } catch {
    return json({ error: 'Supabase SDK could not be loaded' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const preCheckoutQuery = input.pre_checkout_query as {
    id?: unknown;
    from?: { id?: unknown };
    currency?: unknown;
    total_amount?: unknown;
    invoice_payload?: unknown;
  } | undefined;
  const preCheckoutPayload = typeof preCheckoutQuery?.invoice_payload === 'string'
    ? preCheckoutQuery.invoice_payload
    : '';
  const successfulPaymentMessage = (input.message as {
    from?: { id?: unknown };
    successful_payment?: {
      currency?: unknown;
      total_amount?: unknown;
      invoice_payload?: unknown;
      telegram_payment_charge_id?: unknown;
    };
  } | undefined);
  const successfulPayment = successfulPaymentMessage?.successful_payment;
  const successfulPaymentPayload = typeof successfulPayment?.invoice_payload === 'string'
    ? successfulPayment.invoice_payload
    : '';
  const isTelegramWebhook = Number.isSafeInteger(input.update_id);
  if (isTelegramWebhook) {
    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')?.trim();
    const receivedSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
    if (!webhookSecret || !secureEquals(receivedSecret, webhookSecret)) {
      return json({ error: 'Unauthorized Telegram webhook' }, 401);
    }
    if (!botToken) return json({ error: 'Telegram bot is not configured' }, 500);

    if (preCheckoutQuery) {
      const validQuery = typeof preCheckoutQuery.id === 'string'
        && Number.isSafeInteger(preCheckoutQuery.from?.id)
        && Number.isSafeInteger(preCheckoutQuery.total_amount)
        && typeof preCheckoutQuery.invoice_payload === 'string'
        && typeof preCheckoutQuery.currency === 'string';
      let orderIsValid = false;
      if (validQuery) {
        const validation = preCheckoutPayload.startsWith('vyrn-premium:')
          ? await supabase.rpc('validate_telegram_premium_order', {
            p_invoice_payload: preCheckoutQuery.invoice_payload as string,
            p_telegram_user_id: preCheckoutQuery.from!.id as number,
            p_telegram_stars_amount: preCheckoutQuery.total_amount as number,
            p_currency: preCheckoutQuery.currency as string,
          })
          : await supabase.rpc('validate_telegram_star_topup', {
            p_invoice_payload: preCheckoutQuery.invoice_payload as string,
            p_telegram_user_id: preCheckoutQuery.from!.id as number,
            p_telegram_stars_amount: preCheckoutQuery.total_amount as number,
            p_currency: preCheckoutQuery.currency as string,
          });
        orderIsValid = !validation.error && validation.data === true;
      }
      const answer = await telegramApiRequest(botToken, 'answerPreCheckoutQuery', {
        pre_checkout_query_id: preCheckoutQuery.id,
        ok: orderIsValid,
        ...(!orderIsValid ? { error_message: 'Не удалось проверить заказ. Создайте новый счёт и попробуйте ещё раз.' } : {}),
      });
      return answer.ok
        ? json({ ok: true })
        : json({ error: 'Could not answer Telegram pre-checkout query', status: answer.status }, 502);
    }

    if (successfulPayment && successfulPaymentMessage?.from) {
      const validPayment = Number.isSafeInteger(successfulPaymentMessage.from.id)
        && Number.isSafeInteger(successfulPayment.total_amount)
        && typeof successfulPayment.invoice_payload === 'string'
        && typeof successfulPayment.currency === 'string'
        && typeof successfulPayment.telegram_payment_charge_id === 'string';
      if (!validPayment) return json({ error: 'Invalid successful payment update' }, 400);
      if (successfulPaymentPayload.startsWith('vyrn-premium:')) {
        const completion = await supabase.rpc('complete_telegram_premium_order', {
          p_invoice_payload: successfulPaymentPayload,
          p_telegram_user_id: successfulPaymentMessage.from.id as number,
          p_telegram_stars_amount: successfulPayment.total_amount as number,
          p_currency: successfulPayment.currency as string,
          p_telegram_payment_charge_id: successfulPayment.telegram_payment_charge_id as string,
        });
        if (completion.error) {
          console.error('Could not activate Telegram Premium payment:', completion.error.message);
          return json({ error: 'Could not activate Telegram Premium payment' }, 500);
        }
      } else {
        const completion = await supabase.rpc('complete_telegram_star_topup', {
          p_invoice_payload: successfulPaymentPayload,
          p_telegram_user_id: successfulPaymentMessage.from.id as number,
          p_telegram_stars_amount: successfulPayment.total_amount as number,
          p_currency: successfulPayment.currency as string,
          p_telegram_payment_charge_id: successfulPayment.telegram_payment_charge_id as string,
        });
        if (completion.error) return json({ error: 'Could not credit Telegram Stars payment' }, 500);
      }
      return json({ ok: true });
    }
    return json({ ok: true });
  }
  const browserDemoRequested = typeof input.initData !== 'string' && input.browserDemo === true;
  const isBrowserDemo = browserDemoRequested;
  let telegramUser: Record<string, unknown> | null = null;
  if (!isBrowserDemo) {
    if (typeof input.initData !== 'string') return json({ error: 'Telegram initData is missing' }, 401);
    telegramUser = readUnverifiedTelegramUser(input.initData);
    if (!telegramUser) return json({ error: 'Telegram user data is missing' }, 401);
  }

  const telegramId = isBrowserDemo ? '0' : String(telegramUser!.id);
  const telegramUsername = !isBrowserDemo && typeof telegramUser!.username === 'string' ? telegramUser!.username as string : null;
  const avatarUrl = !isBrowserDemo && typeof telegramUser!.photo_url === 'string' ? telegramUser!.photo_url as string : null;
  const baseProfile = {
    telegram_id: telegramId,
    first_name: isBrowserDemo ? 'Browser' : typeof telegramUser!.first_name === 'string' ? telegramUser!.first_name as string : '',
    last_name: isBrowserDemo ? 'Player' : typeof telegramUser!.last_name === 'string' ? telegramUser!.last_name as string : '',
    telegram_first_name: isBrowserDemo ? 'Browser' : typeof telegramUser!.first_name === 'string' ? telegramUser!.first_name as string : '',
    telegram_last_name: isBrowserDemo ? 'Player' : typeof telegramUser!.last_name === 'string' ? telegramUser!.last_name as string : '',
    telegram_username: telegramUsername,
    avatar_url: avatarUrl,
  };

  let { data: profile, error } = await supabase
    .from('profiles').select('*').eq('telegram_id', telegramId).maybeSingle();
  if (error) return json({ error: error.message }, 500);

  if (!profile) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const inserted = await supabase.from('profiles').insert({
        ...baseProfile,
        nickname: isBrowserDemo ? 'browser000000' : generateNickname(),
        username: telegramUsername,
      }).select('*').single();
      if (!inserted.error) {
        profile = inserted.data;
        break;
      }
      if (inserted.error.code === '23505') {
        const existing = await supabase.from('profiles').select('*').eq('telegram_id', telegramId).maybeSingle();
        if (existing.data) {
          profile = existing.data;
          break;
        }
        if (isBrowserDemo) return json({ error: 'Nickname browser000000 is already used by another profile' }, 409);
        continue;
      }
      return json({ error: inserted.error.message }, 500);
    }
    if (!profile) return json({ error: 'Could not create a unique player nickname' }, 500);
  }

  if (!isBrowserDemo) {
    const profileUpdate = await supabase.from('profiles').update({
      telegram_first_name: baseProfile.telegram_first_name,
      telegram_last_name: baseProfile.telegram_last_name,
      telegram_username: telegramUsername,
      avatar_url: avatarUrl,
    }).eq('id', profile.id).select('*').single();
    if (profileUpdate.error) return json({ error: profileUpdate.error.message }, 500);
    profile = profileUpdate.data;
  }
  const walletRows = ['stars', 'ton'].map((currency) => ({ profile_id: profile.id, currency, balance: 0 }));
  const walletResult = await supabase.from('wallets').upsert(walletRows, {
    onConflict: 'profile_id,currency',
    ignoreDuplicates: true,
  });
  if (walletResult.error) return json({ error: walletResult.error.message }, 500);
  const savedChat = await supabase.rpc('ensure_saved_chat', { p_profile_id: profile.id });
  if (savedChat.error) return json({ error: savedChat.error.message }, 500);

  const attachGiftResponses = async (messages: any[]) => {
    const offerIds = messages.map((message) => message.gift_offer?.id).filter(Boolean);
    if (!offerIds.length) return messages;
    let responses;
    try {
      responses = await supabase.from('nft_gift_responses')
        .select('original_offer_id,status').in('original_offer_id', offerIds);
    } catch (error) {
      console.warn('Gift response records are unavailable:', error);
      return messages;
    }
    if (responses.error) {
      console.warn('Gift response records are unavailable:', responses.error.message);
      return messages;
    }
    const responseByOfferId = new Map<string, { original_offer_id: string; status: string }>();
    responses.data.forEach((response: { original_offer_id: string; status: string }) => {
      responseByOfferId.set(response.original_offer_id, response);
    });
    return messages.map((message) => {
      const response = responseByOfferId.get(message.gift_offer?.id);
      return response ? { ...message, gift_offer: { ...message.gift_offer, response } } : message;
    });
  };

  const action = input.action;
  if (action === 'create_premium_invoice') {
    if (isBrowserDemo || typeof input.initData !== 'string' || !botToken) {
      return json({ error: 'Open VYRN inside Telegram to buy Premium' }, 401);
    }
    const verified = await verifyTelegramInitData(input.initData, botToken);
    if (!verified.user) {
      console.warn('Premium invoice rejected: Telegram initData verification failed', {
        reason: verified.reason,
      });
      return json({ error: 'Telegram authorization could not be verified. Reopen the Mini App and try again.' }, 401);
    }
    if (String(verified.user.id) !== String(profile.telegram_id)) {
      return json({ error: 'The loaded profile does not match the Telegram account. Reopen the Mini App and try again.' }, 401);
    }
    const durationMonths = input.duration_months;
    if (![1, 12, 24].includes(durationMonths as number)) {
      return json({ error: 'Choose a valid Premium subscription duration' }, 400);
    }
    const telegramStarsAmount = durationMonths === 1 ? 99 : durationMonths === 12 ? 890 : 1590;
    const invoicePayload = `vyrn-premium:${crypto.randomUUID()}`;
    const order = await supabase.from('telegram_premium_orders').insert({
      profile_id: profile.id,
      telegram_user_id: verified.user.id,
      duration_months: durationMonths,
      telegram_stars_amount: telegramStarsAmount,
      invoice_payload: invoicePayload,
    }).select('id').single();
    if (order.error) return json({ error: 'Could not create a pending Premium order' }, 500);

    const invoice = await telegramApiRequest(botToken, 'createInvoiceLink', {
      title: 'VYRN Премиум',
      description: `Подписка VYRN Премиум на ${durationMonths} мес.`,
      payload: invoicePayload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: `VYRN Премиум на ${durationMonths} мес.`, amount: telegramStarsAmount }],
    });
    if (!invoice.ok || typeof invoice.result?.result !== 'string') {
      const failedOrder = await supabase.from('telegram_premium_orders')
        .update({ status: 'failed' }).eq('id', order.data.id);
      if (failedOrder.error) {
        return json({ error: 'Telegram invoice creation failed and the pending Premium order could not be closed' }, 500);
      }
      return json({ error: invoice.result?.description || 'Telegram could not create the Premium payment invoice' }, 502);
    }
    return json({ invoice_url: invoice.result.result });
  }
  if (action === 'create_star_invoice') {
    if (isBrowserDemo || typeof input.initData !== 'string' || !botToken) {
      return json({ error: 'Open VYRN inside Telegram to buy Stars' }, 401);
    }
    const verified = await verifyTelegramInitData(input.initData, botToken);
    if (!verified.user) {
      console.warn('Star invoice rejected: Telegram initData verification failed', {
        reason: verified.reason,
      });
      return json({ error: 'Telegram authorization could not be verified. Reopen the Mini App and try again.' }, 401);
    }
    if (String(verified.user.id) !== String(profile.telegram_id)) {
      console.warn('Star invoice rejected: Telegram user does not match the loaded profile');
      return json({ error: 'The loaded profile does not match the Telegram account. Reopen the Mini App and try again.' }, 401);
    }
    const amount = input.amount;
    if (!Number.isSafeInteger(amount) || Number(amount) < 1 || Number(amount) > 100000) {
      return json({ error: 'Star amount must be a whole number from 1 to 100,000' }, 400);
    }
    const invoicePayload = `vyrn-stars:${crypto.randomUUID()}`;
    const topup = await supabase.from('telegram_star_topups').insert({
      profile_id: profile.id,
      telegram_user_id: verified.user.id,
      vyrn_stars_amount: amount,
      telegram_stars_amount: amount,
      invoice_payload: invoicePayload,
    }).select('id').single();
    if (topup.error) return json({ error: 'Could not create a pending top-up order' }, 500);

    const invoice = await telegramApiRequest(botToken, 'createInvoiceLink', {
      title: 'Пополнение VYRN',
      description: `Пополнение баланса на ${amount} Stars`,
      payload: invoicePayload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: `${amount} VYRN Stars`, amount }],
    });
    if (!invoice.ok || typeof invoice.result?.result !== 'string') {
      const failedOrder = await supabase.from('telegram_star_topups')
        .update({ status: 'failed' }).eq('id', topup.data.id);
      if (failedOrder.error) {
        return json({ error: 'Telegram invoice creation failed and the pending order could not be closed' }, 500);
      }
      return json({ error: invoice.result?.description || 'Telegram could not create the payment invoice' }, 502);
    }
    return json({ invoice_url: invoice.result.result });
  }
  if (action === 'me' || !action) {
    const { data: wallets, error: walletError } = await supabase.from('wallets').select('currency,balance').eq('profile_id', profile.id);
    if (walletError) return json({ error: walletError.message }, 500);
    return json({ profile, wallets });
  }

  if (action === 'wallet') {
    const { data: wallets, error: walletError } = await supabase.from('wallets')
      .select('id,currency,balance').eq('profile_id', profile.id);
    if (walletError) return json({ error: walletError.message }, 500);
    const walletIds = wallets.map((wallet: { id: string }) => wallet.id);
    if (!walletIds.length) return json({ profile, wallets, transactions: [] });
    const { data: transactions, error: transactionError } = await supabase.from('wallet_transactions')
      .select('id,wallet_id,amount,reason,reference_id,created_at')
      .in('wallet_id', walletIds).order('created_at', { ascending: false }).limit(50);
    if (transactionError) return json({ error: transactionError.message }, 500);
    return json({ profile, wallets, transactions });
  }

  if (action === 'leaderboard') {
    if (!isBrowserDemo) {
      if (typeof input.initData !== 'string' || !botToken) {
        return json({ error: 'Open VYRN inside Telegram to load the player leaderboard' }, 401);
      }
      const verified = await verifyTelegramInitData(input.initData, botToken);
      if (!verified.user || String(verified.user.id) !== telegramId) {
        return json({ error: 'Telegram identity could not be verified' }, 401);
      }
    }
    const result = await supabase.rpc('get_player_leaderboard', { p_profile_id: profile.id });
    if (result.error) {
      console.error('Could not load the player leaderboard:', result.error.message);
      return json({ error: 'Could not load the player leaderboard' }, 500);
    }
    return json(result.data);
  }

  if (action === 'update_profile') {
    const allowed = ['nickname', 'username', 'first_name', 'last_name', 'bio', 'birthday', 'phone'];
    const changes: Record<string, unknown> = {};
    for (const field of allowed) {
      if (Object.hasOwn(input, field)) changes[field] = input[field];
    }
    if (Object.hasOwn(input, 'banner_color')) {
      const status = String(profile.status || '').trim().toLowerCase();
      const premiumUntil = Date.parse(profile.premium_until || '');
      const isPremium = Number.isFinite(premiumUntil) && premiumUntil > Date.now();
      if (!isPremium && status !== 'verified' && status !== 'verfied') {
        return json({ error: 'Banner colors are available only to active Premium or verified profiles' }, 403);
      }
      if (input.banner_color !== null
        && (typeof input.banner_color !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.banner_color))) {
        return json({ error: 'Invalid banner color' }, 400);
      }
      changes.banner_color = typeof input.banner_color === 'string' ? input.banner_color.toLowerCase() : null;
    }
    if (Object.hasOwn(input, 'banner_gradient')) {
      const status = String(profile.status || '').trim().toLowerCase();
      const premiumUntil = Date.parse(profile.premium_until || '');
      const isPremium = Number.isFinite(premiumUntil) && premiumUntil > Date.now();
      if (!isPremium && status !== 'verified' && status !== 'verfied') {
        return json({ error: 'Banner gradients are available only to active Premium or verified profiles' }, 403);
      }
      if (typeof input.banner_gradient !== 'boolean') return json({ error: 'Invalid banner gradient setting' }, 400);
      changes.banner_gradient = input.banner_gradient;
    }
    if (typeof changes.nickname === 'string' && !/^[a-zA-Z0-9_]{1,32}$/.test(changes.nickname)) return json({ error: 'Invalid nickname' }, 400);
    if (typeof changes.bio === 'string' && changes.bio.length > 160) return json({ error: 'Bio is too long' }, 400);
    if (typeof changes.username === 'string') changes.username = changes.username.replace(/^@+/, '') || null;
    const result = await supabase.from('profiles').update(changes).eq('id', profile.id).select('*').single();
    if (result.error) return json({ error: result.error.code === '23505' ? 'Nickname or username is already in use' : result.error.message }, result.error.code === '23505' ? 409 : 500);
    return json({ profile: result.data });
  }

  if (action === 'refresh_nft_price') {
    const itemId = typeof input.nft_item_id === 'string' ? input.nft_item_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ error: 'Invalid NFT ID' }, 400);

    const ownedItem = await supabase.from('nft_items')
      .select('id,external_id,attributes,nft_models(nft_collections(slug))')
      .eq('id', itemId).eq('owner_profile_id', profile.id).maybeSingle();
    if (ownedItem.error) return json({ error: ownedItem.error.message }, 500);
    if (!ownedItem.data?.external_id) return json({ error: 'NFT not found or has no Fragment serial number' }, 404);

    const collectionSlug = ownedItem.data.nft_models?.nft_collections?.slug;
    const fragmentGiftNumber = ownedItem.data.attributes?.crafting?.visual_external_id || ownedItem.data.external_id;
    if (!/^[a-z0-9]+$/.test(collectionSlug || '') || !/^\d{1,12}$/.test(fragmentGiftNumber)) {
      return json({ error: 'NFT has invalid Fragment collection data' }, 400);
    }

    let priceResponse: Response;
    try {
      priceResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/fragment-price`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection_slug: collectionSlug,
          gift_number: fragmentGiftNumber,
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return json({ error: 'Не удалось получить цену и характеристики NFT с Fragment.' }, 502);
    }

    const fragmentData = await priceResponse.json().catch(() => null);
    if (!priceResponse.ok || !fragmentData || typeof fragmentData.grams !== 'number'
      || typeof fragmentData.stars !== 'number' || !fragmentData.traits) {
      return json({
        error: fragmentData?.error || 'Fragment не вернул цену и характеристики этого NFT.',
      }, priceResponse.ok ? 502 : priceResponse.status);
    }

    const attributes = {
      ...(ownedItem.data.attributes || {}),
      fragment_price_grams: fragmentData.grams,
      fragment_price_fragment_stars: fragmentData.stars,
      fragment_price_stars: ownedItem.data.attributes?.fragment_price_manual === true
        || ownedItem.data.attributes?.fragment_price_crafted_total === true
        ? ownedItem.data.attributes.fragment_price_stars
        : fragmentData.stars,
      fragment_traits: fragmentData.traits,
      fragment_traits_updated_at: new Date().toISOString(),
    };
    const savedItem = await supabase.from('nft_items').update({ attributes })
      .eq('id', itemId).eq('owner_profile_id', profile.id)
      .select('id,attributes').maybeSingle();
    if (savedItem.error) return json({ error: savedItem.error.message }, 500);
    if (!savedItem.data) return json({ error: 'NFT ownership changed before its price could be saved' }, 409);
    return json({ item: savedItem.data });
  }

  if (action === 'update_nft_price') {
    const itemId = typeof input.nft_item_id === 'string' ? input.nft_item_id : '';
    const priceStars = Number(input.price_stars);
    if (!/^[0-9a-f-]{36}$/i.test(itemId)
      || !Number.isFinite(priceStars)
      || priceStars < 0.01
      || Math.abs(priceStars * 100 - Math.round(priceStars * 100)) > 0.000001) {
      return json({ error: 'Укажите цену не ниже 0,01 ★ и не более двух знаков после запятой.' }, 400);
    }
    const ownedItem = await supabase.from('nft_items')
      .select('attributes').eq('id', itemId).eq('owner_profile_id', profile.id).maybeSingle();
    if (ownedItem.error) return json({ error: ownedItem.error.message }, 500);
    if (!ownedItem.data) return json({ error: 'NFT not found or no longer owned by this player' }, 404);
    const maxPrice = Math.max(1_000_000_000_000, Number(ownedItem.data.attributes?.fragment_price_stars) || 0);
    if (priceStars > maxPrice) {
      return json({ error: `Укажите цену не выше ${maxPrice.toLocaleString('ru-RU')} ★.` }, 400);
    }

    const savedItem = await supabase.from('nft_items').update({
      attributes: {
        ...(ownedItem.data.attributes || {}),
        fragment_price_stars: priceStars,
        fragment_price_manual: true,
        fragment_price_crafted_total: false,
      },
    }).eq('id', itemId).eq('owner_profile_id', profile.id).select('id,attributes').maybeSingle();
    if (savedItem.error) return json({ error: savedItem.error.message }, 500);
    if (!savedItem.data) return json({ error: 'NFT ownership changed before its price could be saved' }, 409);
    return json({ item: savedItem.data });
  }

  if (action === 'my_nfts') {
    const result = await supabase.from('nft_items')
      .select('id,external_id,attributes,acquired_at,nft_models(id,slug,name,preview_url,animation_url,nft_collections(name,slug)),market_listings(id,price,currency,status)')
      .eq('owner_profile_id', profile.id).order('acquired_at', { ascending: false });
    return result.error ? json({ error: result.error.message }, 500) : json({ items: result.data });
  }

  if (action === 'upgrade_roulette_pool') {
    const collectionResult = await supabase.from('nft_collections').select('slug').limit(200);
    if (collectionResult.error) return json({ error: collectionResult.error.message }, 500);
    const collectionSlugs = collectionResult.data
      .map((collection: { slug: string }) => collection.slug)
      .filter((slug: string) => /^[a-z0-9]+$/.test(slug));
    for (let index = collectionSlugs.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [collectionSlugs[index], collectionSlugs[swapIndex]] = [
        collectionSlugs[swapIndex],
        collectionSlugs[index],
      ];
    }
    const selectedCollections = collectionSlugs.slice(0, 8);
    const visualPools = await Promise.all(selectedCollections.map(async (collectionSlug) => {
      try {
        const response = await fetch(`https://fragment.com/gifts/${collectionSlug}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 VYRN Fragment visual reader' },
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) return [];
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > 8_000_000) return [];
        const html = await response.text();
        if (html.length > 8_000_000) return [];
        const giftNumbers = readFragmentGiftNumbers(html, collectionSlug);
        for (let index = giftNumbers.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [giftNumbers[index], giftNumbers[swapIndex]] = [
            giftNumbers[swapIndex],
            giftNumbers[index],
          ];
        }
        return giftNumbers.slice(0, 2).map((giftNumber) => ({
          collection_slug: collectionSlug,
          gift_number: giftNumber,
        }));
      } catch {
        return [];
      }
    }));
    return json({ roulette_visuals: visualPools.flat() });
  }

  if (action === 'upgrade_nft') {
    const itemId = typeof input.nft_item_id === 'string' ? input.nft_item_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) return json({ error: 'Invalid NFT ID' }, 400);

    const ownedItem = await supabase.from('nft_items')
      .select('id,external_id,attributes,nft_models!inner(id,name,nft_collections!inner(id,name,slug))')
      .eq('id', itemId)
      .eq('owner_profile_id', profile.id)
      .maybeSingle();
    if (ownedItem.error) return json({ error: ownedItem.error.message }, 500);
    if (!ownedItem.data) return json({ error: 'NFT not found or no longer owned by this player' }, 404);

    const model = Array.isArray(ownedItem.data.nft_models)
      ? ownedItem.data.nft_models[0]
      : ownedItem.data.nft_models;
    const collection = Array.isArray(model?.nft_collections)
      ? model.nft_collections[0]
      : model?.nft_collections;
    const collectionSlug = collection?.slug;
    if (typeof collectionSlug !== 'string'
      || !/^[a-z0-9]+$/.test(collectionSlug)
      || !/^\d{1,12}$/.test(ownedItem.data.external_id || '')) {
      return json({ error: 'NFT has invalid Fragment collection data' }, 409);
    }

    const activeListing = await supabase.from('market_listings')
      .select('id').eq('nft_item_id', itemId).eq('status', 'active').maybeSingle();
    if (activeListing.error) return json({ error: activeListing.error.message }, 500);
    if (activeListing.data) return json({ error: 'Сначала снимите NFT с продажи.' }, 409);

    const ownedCollectionItems = await supabase.from('nft_items')
      .select('external_id,attributes,nft_models!inner(nft_collections!inner(slug))')
      .eq('owner_profile_id', profile.id)
      .eq('nft_models.nft_collections.slug', collectionSlug);
    if (ownedCollectionItems.error) {
      return json({ error: ownedCollectionItems.error.message }, 500);
    }
    const usedVisualIds = new Set(ownedCollectionItems.data.flatMap((item: any) => [
      String(item.attributes?.crafting?.visual_external_id || item.external_id || ''),
      String(item.external_id || ''),
    ]));

    let collectionResponse: Response;
    try {
      collectionResponse = await fetch(`https://fragment.com/gifts/${collectionSlug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 VYRN Fragment catalog reader' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return json({ error: 'Не удалось загрузить список подарков этой коллекции с Fragment.' }, 502);
    }
    if (!collectionResponse.ok) {
      return json({ error: `Fragment вернул HTTP ${collectionResponse.status} для этой коллекции.` }, 502);
    }
    const contentLength = Number(collectionResponse.headers.get('content-length') || 0);
    if (contentLength > 8_000_000) return json({ error: 'Ответ Fragment слишком большой.' }, 502);
    const collectionHtml = await collectionResponse.text();
    if (collectionHtml.length > 8_000_000) return json({ error: 'Ответ Fragment слишком большой.' }, 502);
    const availableVisualIds = readFragmentGiftNumbers(collectionHtml, collectionSlug)
      .filter((giftNumber) => !usedVisualIds.has(giftNumber));
    if (!availableVisualIds.length) {
      return json({ error: 'Fragment не вернул другой подарок для этой коллекции. NFT не изменена.' }, 502);
    }
    const outputVisualExternalId = availableVisualIds[Math.floor(Math.random() * availableVisualIds.length)];

    const rouletteGiftNumbers = availableVisualIds.filter((giftNumber) => giftNumber !== outputVisualExternalId);
    for (let index = rouletteGiftNumbers.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [rouletteGiftNumbers[index], rouletteGiftNumbers[swapIndex]] = [
        rouletteGiftNumbers[swapIndex],
        rouletteGiftNumbers[index],
      ];
    }
    const rouletteGiftIds = [
      outputVisualExternalId,
      ...rouletteGiftNumbers.slice(0, 7),
    ].map((giftNumber) => ({
      collection_slug: collectionSlug,
      gift_number: giftNumber,
    }));
    const rouletteTraitsPromise = (async () => {
      try {
        const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/fragment-price`, {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ gifts: rouletteGiftIds }),
          signal: AbortSignal.timeout(18_000),
        });
        if (!response.ok) return [];
        const data = await response.json().catch(() => null);
        return Array.isArray(data?.items)
          ? data.items
            .filter((item: any) =>
              typeof item?.gift_number === 'string'
              && item.traits
              && typeof item.traits === 'object')
            .map((item: any) => ({
              gift_number: item.gift_number,
              traits: item.traits,
            }))
          : [];
      } catch {
        return [];
      }
    })();

    let outputFragmentResponse: Response;
    try {
      outputFragmentResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/fragment-price`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection_slug: collectionSlug,
          gift_number: outputVisualExternalId,
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return json({ error: 'Не удалось получить характеристики подарка с Fragment. NFT не изменена.' }, 502);
    }
    const outputFragmentData = await outputFragmentResponse.json().catch(() => null);
    if (!outputFragmentResponse.ok
      || !outputFragmentData
      || typeof outputFragmentData.grams !== 'number'
      || typeof outputFragmentData.stars !== 'number'
      || !outputFragmentData.traits
      || typeof outputFragmentData.traits !== 'object'
      || Array.isArray(outputFragmentData.traits)) {
      return json({
        error: outputFragmentData?.error || 'Fragment не вернул цену и характеристики подарка. NFT не изменена.',
      }, outputFragmentResponse.ok ? 502 : outputFragmentResponse.status);
    }

    const rouletteTraits = await rouletteTraitsPromise;
    const result = await supabase.rpc('upgrade_nft', {
      p_profile_id: profile.id,
      p_nft_item_id: itemId,
      p_output_visual_external_id: outputVisualExternalId,
      p_output_fragment_data: outputFragmentData,
    });
    if (result.error) {
      if (result.error.code === 'PGRST202' || result.error.code === '42883') {
        return json({
          error: 'Функция улучшения NFT не установлена. Примените supabase/upgrade-nft.sql в Supabase SQL Editor.',
          code: result.error.code,
        }, 503);
      }
      const status = /Insufficient Stars balance/i.test(result.error.message) ? 409 : 409;
      return json({ error: result.error.message, code: result.error.code }, status);
    }
    return json({
      ...result.data,
      roulette_gifts: rouletteTraits.length
        ? rouletteTraits
        : [{ gift_number: outputVisualExternalId, traits: outputFragmentData.traits }],
    });
  }

  if (action === 'craft_nfts') {
    if (!Array.isArray(input.nft_item_ids)
      || input.nft_item_ids.length < 1
      || input.nft_item_ids.length > 4
      || input.nft_item_ids.some((itemId) => typeof itemId !== 'string')) {
      return json({ error: 'Select between 1 and 4 NFTs' }, 400);
    }
    if (new Set(input.nft_item_ids).size !== input.nft_item_ids.length) {
      return json({ error: 'Duplicate NFTs are not allowed' }, 400);
    }

    const selectedItems = await supabase.from('nft_items')
      .select('id,external_id,attributes,nft_models!inner(nft_collections!inner(slug))')
      .in('id', input.nft_item_ids).eq('owner_profile_id', profile.id);
    if (selectedItems.error) {
      return json({ error: selectedItems.error.message, code: selectedItems.error.code }, 409);
    }
    if (selectedItems.data.length !== input.nft_item_ids.length) {
      return json({ error: 'One or more NFTs are no longer owned by this player' }, 409);
    }
    const collectionSlugs = new Set(selectedItems.data.map((item: any) => item.nft_models?.nft_collections?.slug));
    if (collectionSlugs.size !== 1) return json({ error: 'Crafting is only allowed within one collection' }, 409);
    const collectionSlug = [...collectionSlugs][0];
    if (typeof collectionSlug !== 'string' || !/^[a-z0-9]+$/.test(collectionSlug)) {
      return json({ error: 'NFT has invalid Fragment collection data' }, 409);
    }
    const selectedVisualIds = new Set(selectedItems.data.map((item: any) =>
      String(item.attributes?.crafting?.visual_external_id || item.external_id || '')
    ));

    let collectionResponse: Response;
    try {
      collectionResponse = await fetch(`https://fragment.com/gifts/${collectionSlug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 VYRN Fragment catalog reader' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return json({ error: 'Не удалось загрузить список подарков этой коллекции с Fragment.' }, 502);
    }
    if (!collectionResponse.ok) {
      return json({ error: `Fragment вернул HTTP ${collectionResponse.status} для этой коллекции.` }, 502);
    }
    const contentLength = Number(collectionResponse.headers.get('content-length') || 0);
    if (contentLength > 8_000_000) return json({ error: 'Ответ Fragment слишком большой.' }, 502);
    const collectionHtml = await collectionResponse.text();
    if (collectionHtml.length > 8_000_000) return json({ error: 'Ответ Fragment слишком большой.' }, 502);
    const availableVisualIds = readFragmentGiftNumbers(collectionHtml, collectionSlug)
      .filter((giftNumber) => !selectedVisualIds.has(giftNumber));
    if (!availableVisualIds.length) {
      return json({ error: 'Fragment не вернул другой подарок для этой коллекции. Список NFT не изменён.' }, 502);
    }
    const outputVisualExternalId = availableVisualIds[Math.floor(Math.random() * availableVisualIds.length)];
    let outputFragmentResponse: Response;
    try {
      outputFragmentResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/fragment-price`, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collection_slug: collectionSlug,
          gift_number: outputVisualExternalId,
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return json({ error: 'Не удалось получить характеристики выбранного подарка с Fragment. NFT не изменены.' }, 502);
    }
    const outputFragmentData = await outputFragmentResponse.json().catch(() => null);
    if (!outputFragmentResponse.ok
      || !outputFragmentData
      || typeof outputFragmentData.grams !== 'number'
      || typeof outputFragmentData.stars !== 'number'
      || !outputFragmentData.traits
      || typeof outputFragmentData.traits !== 'object'
      || Array.isArray(outputFragmentData.traits)) {
      return json({
        error: outputFragmentData?.error || 'Fragment не вернул цену и характеристики выбранного подарка. NFT не изменены.',
      }, outputFragmentResponse.ok ? 502 : outputFragmentResponse.status);
    }

    const result = await supabase.rpc('craft_nfts', {
      p_profile_id: profile.id,
      p_nft_item_ids: input.nft_item_ids,
      p_output_visual_external_id: outputVisualExternalId,
      p_output_fragment_data: outputFragmentData,
    });
    if (result.error) {
      if (result.error.code === 'PGRST202' || result.error.code === '42883') {
        return json({
          error: 'Функция крафта в базе данных не обновлена. Примените supabase/crafting.sql в Supabase SQL Editor, затем повторите попытку.',
          code: result.error.code,
        }, 503);
      }
      return json({
        error: result.error.message,
        code: result.error.code,
      }, 409);
    }
    return json(result.data);
  }

  if (action === 'profile_nfts') {
    const profileId = typeof input.profile_id === 'string' ? input.profile_id : '';
    if (!profileId) return json({ error: 'Profile ID is required' }, 400);
    const profileResult = await supabase.from('profiles')
      .select('id,nickname,username,first_name,last_name,avatar_url,bio,status,premium_until,banner_color,banner_gradient')
      .eq('id', profileId).maybeSingle();
    if (profileResult.error) return json({ error: profileResult.error.message }, 500);
    if (!profileResult.data) return json({ error: 'Player not found' }, 404);
    const result = await supabase.from('nft_items')
      .select('id,external_id,attributes,acquired_at,nft_models(id,slug,name,preview_url,animation_url,nft_collections(name,slug)),market_listings(id,price,currency,status)')
      .eq('owner_profile_id', profileId).order('acquired_at', { ascending: false });
    return result.error ? json({ error: result.error.message }, 500) : json({
      profile: profileResult.data,
      status: profileResult.data.status,
      items: result.data,
    });
  }

  if (action === 'create_chat') {
    const nickname = typeof input.nickname === 'string' ? input.nickname.trim().replace(/^@+/, '') : '';
    if (!nickname || nickname.length > 32) return json({ error: 'Enter a valid player nickname' }, 400);
    let target = await supabase.from('profiles').select('id,nickname,username,first_name,last_name,avatar_url,status,premium_until,banner_color,banner_gradient').eq('nickname', nickname).maybeSingle();
    if (!target.data) target = await supabase.from('profiles').select('id,nickname,username,first_name,last_name,avatar_url,status,premium_until,banner_color,banner_gradient').eq('username', nickname).maybeSingle();
    if (!target.data) target = await supabase.from('profiles').select('id,nickname,username,first_name,last_name,avatar_url,status,premium_until,banner_color,banner_gradient').ilike('first_name', `%${nickname}%`).limit(1).maybeSingle();
    if (!target.data) target = await supabase.from('profiles').select('id,nickname,username,first_name,last_name,avatar_url,status,premium_until,banner_color,banner_gradient').ilike('last_name', `%${nickname}%`).limit(1).maybeSingle();
    if (target.error) return json({ error: target.error.message }, 500);
    if (!target.data) return json({ error: 'Player not found' }, 404);
    if (target.data.id === profile.id) return json({ error: 'You cannot start a chat with yourself' }, 400);
    const result = await supabase.rpc('get_or_create_direct_chat', {
      p_first_profile_id: profile.id,
      p_second_profile_id: target.data.id,
    });
    return result.error ? json({ error: result.error.message }, 500) : json({ chat_id: result.data, peer: target.data });
  }

  if (action === 'market') {
    const pageSize = 1000;
    if (input.mode === 'purchases') {
      const purchases = [];
      for (let offset = 0; ; offset += pageSize) {
        const page = await supabase.from('market_transactions')
          .select('id,nft_item_id,buyer_profile_id,seller_profile_id,price,currency,created_at,seller:profiles!market_transactions_seller_profile_id_fkey(nickname,username,first_name,last_name),nft_items(id,external_id,attributes,nft_models(slug,name,preview_url,animation_url,nft_collections(name,slug)))')
          .eq('buyer_profile_id', profile.id).order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (page.error) return json({ error: page.error.message }, 500);
        purchases.push(...page.data);
        if (page.data.length < pageSize) break;
      }
      return json({ items: purchases, current_profile_id: profile.id, current_profile_status: profile.status });
    }

    const listings = [];
    for (let offset = 0; ; offset += pageSize) {
      let query = supabase.from('market_listings')
        .select('id,nft_item_id,seller_profile_id,price,currency,created_at,seller:profiles!market_listings_seller_profile_id_fkey(id,nickname,username,first_name,last_name,avatar_url,bio,status,premium_until,banner_color,banner_gradient),nft_items(id,external_id,attributes,nft_models(slug,name,preview_url,animation_url,nft_collections(name,slug)))')
        .eq('status', 'active').order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (input.mode === 'sales') query = query.eq('seller_profile_id', profile.id);
      const page = await query;
      if (page.error) return json({ error: page.error.message }, 500);
      listings.push(...page.data);
      if (page.data.length < pageSize) break;
    }
    return json({ items: listings, current_profile_id: profile.id, current_profile_status: profile.status });
  }

  if (action === 'create_listing') {
    const itemId = typeof input.nft_item_id === 'string' ? input.nft_item_id : '';
    const price = Number(input.price);
    const currency = input.currency === 'ton' ? 'ton' : input.currency === 'stars' ? 'stars' : null;
    if (!itemId || !Number.isSafeInteger(price) || price <= 0 || !currency) return json({ error: 'Invalid listing details' }, 400);
    const created = await supabase.rpc('create_market_listing', {
      p_nft_item_id: itemId,
      p_seller_profile_id: profile.id,
      p_price: price,
      p_currency: currency,
    });
    if (created.error) return json({ error: created.error.message }, 409);
    const listing = await supabase.from('market_listings').select('*').eq('id', created.data).single();
    return listing.error ? json({ error: listing.error.message }, 500) : json({ listing: listing.data });
  }

  if (action === 'cancel_listing') {
    const result = await supabase.from('market_listings').update({ status: 'cancelled', closed_at: new Date().toISOString() })
      .eq('id', input.listing_id).eq('seller_profile_id', profile.id).eq('status', 'active').select('id').maybeSingle();
    return result.error ? json({ error: result.error.message }, 500) : result.data ? json({ ok: true }) : json({ error: 'Active listing not found' }, 404);
  }

  if (action === 'buy_listing') {
    if (typeof input.listing_id !== 'string') return json({ error: 'Listing ID is required' }, 400);
    const result = await supabase.rpc('purchase_market_listing', { p_listing_id: input.listing_id, p_buyer_profile_id: profile.id });
    return result.error ? json({ error: result.error.message }, 400) : json({ transaction_id: result.data });
  }

  if (action === 'chats') {
    const result = await supabase.from('chat_members').select('chat_id,last_read_at,chats!inner(id,chat_type,title,created_at)')
      .eq('profile_id', profile.id).order('joined_at', { ascending: false });
    if (result.error) return json({ error: result.error.message }, 500);
    const chats = await Promise.all(result.data.map(async (member) => {
      if (member.chats.chat_type !== 'direct') return member;
      const [peerResult, latestMessage, unreadMessages] = await Promise.all([
        supabase.from('chat_members')
          .select('profiles!inner(id,nickname,username,first_name,last_name,avatar_url,bio,status,premium_until,banner_color,banner_gradient)')
          .eq('chat_id', member.chat_id).neq('profile_id', profile.id).maybeSingle(),
        supabase.from('messages').select('body,created_at,sender_profile_id')
          .eq('chat_id', member.chat_id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        (() => {
          let query = supabase.from('messages').select('id', { count: 'exact', head: true })
            .eq('chat_id', member.chat_id).neq('sender_profile_id', profile.id).is('deleted_at', null);
          if (member.last_read_at) query = query.gt('created_at', member.last_read_at);
          return query;
        })(),
      ]);
      return {
        ...member,
        peer: peerResult.data?.profiles || null,
        last_message: latestMessage.data || null,
        unread_count: unreadMessages.count || 0,
      };
    }));
    return json({ chats, current_profile_id: profile.id });
  }

  if (action === 'messages') {
    if (typeof input.chat_id !== 'string') return json({ error: 'Chat ID is required' }, 400);
    const membership = await supabase.from('chat_members').select('chat_id').eq('chat_id', input.chat_id).eq('profile_id', profile.id).maybeSingle();
    if (!membership.data) return json({ error: 'Chat not found' }, 404);
    const readAt = new Date().toISOString();
    const markedRead = await supabase.from('chat_members').update({ last_read_at: readAt })
      .eq('chat_id', input.chat_id).eq('profile_id', profile.id);
    if (markedRead.error) return json({ error: markedRead.error.message }, 500);
    const result = await supabase.from('messages').select('id,sender_profile_id,body,kind,created_at,gift_offer_id,profiles!messages_sender_profile_id_fkey(id,nickname,username,first_name,last_name,avatar_url,bio,status,premium_until,banner_color,banner_gradient),gift_offer:nft_gift_offers!messages_gift_offer_id_fkey(id,nft_item_id,sender_profile_id,recipient_profile_id,price_stars,status,nft_items(external_id,attributes,nft_models(name,slug,preview_url,animation_url,nft_collections(name,slug))))')
      .eq('chat_id', input.chat_id).is('deleted_at', null).order('created_at', { ascending: true }).limit(200);
    if (result.error) return json({ error: result.error.message }, 500);
    return json({ messages: await attachGiftResponses(result.data) });
  }

  if (action === 'send_nft_gift') {
    const chatId = typeof input.chat_id === 'string' ? input.chat_id : '';
    const nftItemId = typeof input.nft_item_id === 'string' ? input.nft_item_id : '';
    const priceStars = Number(input.price_stars);
    if (!chatId || !nftItemId || !Number.isSafeInteger(priceStars) || priceStars < 0) return json({ error: 'Invalid gift details' }, 400);
    const created = await supabase.rpc('send_chat_nft_gift', {
      p_chat_id: chatId,
      p_nft_item_id: nftItemId,
      p_sender_profile_id: profile.id,
      p_price_stars: priceStars,
    });
    if (created.error) return json({ error: created.error.message }, 400);
    const message = await supabase.from('messages')
      .select('id,sender_profile_id,body,kind,created_at,gift_offer_id,profiles!messages_sender_profile_id_fkey(id,nickname,username,first_name,last_name,avatar_url,bio,status,premium_until,banner_color,banner_gradient),gift_offer:nft_gift_offers!messages_gift_offer_id_fkey(id,nft_item_id,sender_profile_id,recipient_profile_id,price_stars,status,nft_items(external_id,attributes,nft_models(name,slug,preview_url,animation_url,nft_collections(name,slug))))')
      .eq('id', created.data).single();
    if (message.error) return json({ error: message.error.message }, 500);
    const [enrichedMessage] = await attachGiftResponses([message.data]);
    return json({ message: enrichedMessage });
  }

  if (action === 'accept_nft_gift') {
    if (typeof input.gift_id !== 'string') return json({ error: 'Gift ID is required' }, 400);
    const accepted = await supabase.rpc('accept_chat_nft_gift', {
      p_gift_id: input.gift_id,
      p_recipient_profile_id: profile.id,
    });
    return accepted.error ? json({ error: accepted.error.message }, 400) : json({ gift_id: accepted.data });
  }

  if (action === 'decline_nft_gift') {
    if (typeof input.gift_id !== 'string') return json({ error: 'Gift ID is required' }, 400);
    const declined = await supabase.rpc('decline_chat_nft_gift', {
      p_gift_id: input.gift_id,
      p_recipient_profile_id: profile.id,
    });
    return declined.error ? json({ error: declined.error.message }, 500) : declined.data
      ? json({ gift_id: input.gift_id, status: 'declined' })
      : json({ error: 'Gift offer is no longer available' }, 409);
  }

  if (action === 'send_message') {
    if (typeof input.chat_id !== 'string' || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 4096) return json({ error: 'Invalid message' }, 400);
    const membership = await supabase.from('chat_members').select('chat_id').eq('chat_id', input.chat_id).eq('profile_id', profile.id).maybeSingle();
    if (!membership.data) return json({ error: 'Chat not found' }, 404);
    const result = await supabase.from('messages').insert({ chat_id: input.chat_id, sender_profile_id: profile.id, body: input.body.trim() }).select('*').single();
    if (result.error) return json({ error: result.error.message }, 500);

    const recipient = await supabase.from('chat_members')
      .select('profiles!inner(telegram_id)')
      .eq('chat_id', input.chat_id)
      .neq('profile_id', profile.id)
      .maybeSingle();
    if (recipient.error) {
      console.warn('Could not find the recipient for a Telegram chat notification:', recipient.error.message);
      return json({ message: result.data, notification_sent: false });
    }

    const recipientTelegramId = Number(recipient.data?.profiles?.telegram_id);
    if (!recipient.data || !Number.isSafeInteger(recipientTelegramId) || recipientTelegramId <= 0) {
      return json({ message: result.data });
    }
    if (!botToken) {
      console.warn('Telegram chat notification skipped: TELEGRAM_BOT_TOKEN is not configured');
      return json({ message: result.data, notification_sent: false });
    }

    const configuredWebAppUrl = Deno.env.get('VYRN_WEB_APP_URL')?.trim();
    if (!configuredWebAppUrl) {
      console.warn('Telegram chat notification skipped: VYRN_WEB_APP_URL is not configured');
      return json({
        message: result.data,
        notification_sent: false,
        notification_reason: 'web_app_url_not_configured',
      });
    }

    let webAppUrl: URL;
    try {
      webAppUrl = new URL(configuredWebAppUrl);
    } catch {
      console.warn('Telegram chat notification skipped: VYRN_WEB_APP_URL is invalid');
      return json({
        message: result.data,
        notification_sent: false,
        notification_reason: 'web_app_url_invalid',
      });
    }
    if (webAppUrl.protocol !== 'https:') {
      console.warn('Telegram chat notification skipped: VYRN_WEB_APP_URL must use HTTPS');
      return json({
        message: result.data,
        notification_sent: false,
        notification_reason: 'web_app_url_invalid',
      });
    }
    if (!webAppUrl.pathname.endsWith('/chats.html')) {
      const basePath = webAppUrl.pathname.replace(/\/+$/, '').replace(/\/index\.html$/i, '');
      webAppUrl.pathname = `${basePath}/chats.html`;
    }
    webAppUrl.searchParams.set('chat_id', input.chat_id);

    try {
      const notification = await telegramApiRequest(botToken, 'sendMessage', {
        chat_id: recipientTelegramId,
        text: `Пользователь ${profile.first_name} направил вам личное сообщение. Чтобы ознакомиться с ним и ответить, пожалуйста, войдите в свой аккаунт на платформе VYRN. 📨`,
        reply_markup: {
          inline_keyboard: [[{
            text: 'Открыть чат',
            web_app: { url: webAppUrl.toString() },
          }]],
        },
      });
      if (!notification.ok) {
        console.warn('Telegram chat notification could not be delivered:', {
          status: notification.status,
          description: notification.result?.description,
        });
      }
      return json({ message: result.data, notification_sent: notification.ok });
    } catch (error) {
      console.warn('Telegram chat notification request failed:', error);
      return json({ message: result.data, notification_sent: false });
    }
  }

  if (action === 'delete_message') {
    if (typeof input.message_id !== 'string') return json({ error: 'Message ID is required' }, 400);
    const message = await supabase.from('messages').select('id,chat_id')
      .eq('id', input.message_id).eq('sender_profile_id', profile.id)
      .eq('kind', 'text').is('deleted_at', null).maybeSingle();
    if (message.error) return json({ error: message.error.message }, 500);
    if (!message.data) return json({ error: 'Message not found' }, 404);
    const membership = await supabase.from('chat_members').select('chat_id')
      .eq('chat_id', message.data.chat_id).eq('profile_id', profile.id).maybeSingle();
    if (membership.error) return json({ error: membership.error.message }, 500);
    if (!membership.data) return json({ error: 'Message not found' }, 404);
    const result = await supabase.from('messages').update({ deleted_at: new Date().toISOString() })
      .eq('id', message.data.id).eq('chat_id', message.data.chat_id).eq('sender_profile_id', profile.id)
      .eq('kind', 'text')
      .is('deleted_at', null).select('id').maybeSingle();
    return result.error ? json({ error: result.error.message }, 500) : result.data ? json({ ok: true }) : json({ error: 'Message not found' }, 404);
  }

  return json({ error: 'Unknown action' }, 400);
});
