import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

const hmac = async (keyBytes: Uint8Array, message: string) => {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
};

const verifyTelegramInitData = async (initData: string, botToken: string) => {
  if (initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  const userValue = params.get('user');
  if (!receivedHash || !userValue || !Number.isInteger(authDate)) return null;
  if (Math.abs(Date.now() / 1000 - authDate) > 86400) return null;

  params.delete('hash');
  params.delete('signature');
  const checkString = [...params.entries()]
    .sort(([first], [second]) => first < second ? -1 : first > second ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await hmac(new TextEncoder().encode(botToken), 'WebAppData');
  const expectedHash = hex(await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    new TextEncoder().encode(checkString),
  ));
  if (expectedHash.length !== receivedHash.length) return null;
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index++) {
    difference |= expectedHash.charCodeAt(index) ^ receivedHash.charCodeAt(index);
  }
  if (difference !== 0) return null;

  try {
    const user = JSON.parse(userValue);
    return Number.isSafeInteger(user.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
};

const generateNickname = () => `player${(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).toString().padStart(6, '0')}`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VYRN_SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const browserDemoRequested = typeof input.initData !== 'string' && input.browserDemo === true;
  if (browserDemoRequested && Deno.env.get('ALLOW_BROWSER_DEMO') !== 'true') {
    return json({ error: 'Browser demo is disabled. Set the ALLOW_BROWSER_DEMO=true Supabase Function secret.' }, 403);
  }
  const isBrowserDemo = browserDemoRequested;
  let telegramUser: Record<string, unknown> | null = null;
  if (!isBrowserDemo) {
    if (!botToken || typeof input.initData !== 'string') return json({ error: 'Telegram initData is required' }, 401);
    telegramUser = await verifyTelegramInitData(input.initData, botToken);
    if (!telegramUser) return json({ error: 'Telegram authorization is invalid or expired' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

  const action = input.action;
  if (action === 'me' || !action) {
    const { data: wallets, error: walletError } = await supabase.from('wallets').select('currency,balance').eq('profile_id', profile.id);
    if (walletError) return json({ error: walletError.message }, 500);
    return json({ profile, wallets });
  }

  if (action === 'update_profile') {
    const allowed = ['nickname', 'username', 'first_name', 'last_name', 'bio', 'birthday', 'phone'];
    const changes: Record<string, unknown> = {};
    for (const field of allowed) {
      if (Object.hasOwn(input, field)) changes[field] = input[field];
    }
    if (typeof changes.nickname === 'string' && !/^[a-zA-Z0-9_]{1,32}$/.test(changes.nickname)) return json({ error: 'Invalid nickname' }, 400);
    if (typeof changes.bio === 'string' && changes.bio.length > 160) return json({ error: 'Bio is too long' }, 400);
    if (typeof changes.username === 'string') changes.username = changes.username.replace(/^@+/, '') || null;
    const result = await supabase.from('profiles').update(changes).eq('id', profile.id).select('*').single();
    if (result.error) return json({ error: result.error.code === '23505' ? 'Nickname or username is already in use' : result.error.message }, result.error.code === '23505' ? 409 : 500);
    return json({ profile: result.data });
  }

  if (action === 'my_nfts') {
    const result = await supabase.from('nft_items')
      .select('id,external_id,attributes,acquired_at,nft_models(id,slug,name,preview_url,animation_url,nft_collections(name,slug)),market_listings(id,price,currency,status)')
      .eq('owner_profile_id', profile.id).order('acquired_at', { ascending: false });
    return result.error ? json({ error: result.error.message }, 500) : json({ items: result.data });
  }

  if (action === 'create_chat') {
    const nickname = typeof input.nickname === 'string' ? input.nickname.trim().replace(/^@+/, '') : '';
    if (!nickname || nickname.length > 32) return json({ error: 'Enter a valid player nickname' }, 400);
    let target = await supabase.from('profiles').select('id,nickname,username,avatar_url').eq('nickname', nickname).maybeSingle();
    if (!target.data) target = await supabase.from('profiles').select('id,nickname,username,avatar_url').eq('username', nickname).maybeSingle();
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
    let query = supabase.from('market_listings')
      .select('id,nft_item_id,seller_profile_id,price,currency,created_at,seller:profiles!market_listings_seller_profile_id_fkey(nickname,username,avatar_url),nft_items(id,external_id,attributes,nft_models(slug,name,preview_url,animation_url,nft_collections(name,slug)))')
      .eq('status', 'active').order('created_at', { ascending: false });
    if (input.mode === 'sales') query = query.eq('seller_profile_id', profile.id);
    const result = await query;
    if (result.error) return json({ error: result.error.message }, 500);
    if (input.mode === 'purchases') {
      const purchases = await supabase.from('market_transactions')
        .select('id,nft_item_id,buyer_profile_id,seller_profile_id,price,currency,created_at,seller:profiles!market_transactions_seller_profile_id_fkey(nickname,username),nft_items(id,external_id,attributes,nft_models(slug,name,preview_url,animation_url,nft_collections(name,slug)))')
        .eq('buyer_profile_id', profile.id).order('created_at', { ascending: false });
      return purchases.error ? json({ error: purchases.error.message }, 500) : json({ items: purchases.data, current_profile_id: profile.id });
    }
    return json({ items: result.data, current_profile_id: profile.id });
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
      const peerResult = await supabase.from('chat_members')
        .select('profiles!inner(id,nickname,username,avatar_url)')
        .eq('chat_id', member.chat_id).neq('profile_id', profile.id).maybeSingle();
      return { ...member, peer: peerResult.data?.profiles || null };
    }));
    return json({ chats, current_profile_id: profile.id });
  }

  if (action === 'messages') {
    if (typeof input.chat_id !== 'string') return json({ error: 'Chat ID is required' }, 400);
    const membership = await supabase.from('chat_members').select('chat_id').eq('chat_id', input.chat_id).eq('profile_id', profile.id).maybeSingle();
    if (!membership.data) return json({ error: 'Chat not found' }, 404);
    const result = await supabase.from('messages').select('id,sender_profile_id,body,kind,created_at,profiles!messages_sender_profile_id_fkey(nickname,username,avatar_url)')
      .eq('chat_id', input.chat_id).is('deleted_at', null).order('created_at', { ascending: true }).limit(200);
    return result.error ? json({ error: result.error.message }, 500) : json({ messages: result.data });
  }

  if (action === 'send_message') {
    if (typeof input.chat_id !== 'string' || typeof input.body !== 'string' || !input.body.trim() || input.body.length > 4096) return json({ error: 'Invalid message' }, 400);
    const membership = await supabase.from('chat_members').select('chat_id').eq('chat_id', input.chat_id).eq('profile_id', profile.id).maybeSingle();
    if (!membership.data) return json({ error: 'Chat not found' }, 404);
    const result = await supabase.from('messages').insert({ chat_id: input.chat_id, sender_profile_id: profile.id, body: input.body.trim() }).select('*').single();
    return result.error ? json({ error: result.error.message }, 500) : json({ message: result.data });
  }

  if (action === 'delete_message') {
    if (typeof input.message_id !== 'string') return json({ error: 'Message ID is required' }, 400);
    const savedChatId = savedChat.data;
    const result = await supabase.from('messages').update({ deleted_at: new Date().toISOString() })
      .eq('id', input.message_id).eq('chat_id', savedChatId).eq('sender_profile_id', profile.id)
      .is('deleted_at', null).select('id').maybeSingle();
    return result.error ? json({ error: result.error.message }, 500) : result.data ? json({ ok: true }) : json({ error: 'Message not found' }, 404);
  }

  return json({ error: 'Unknown action' }, 400);
});
