(() => {
  const config = window.VYRN_SUPABASE_CONFIG || {};
  let collections = `
algorithmcup|Algorithm Cups
artisanbrick|Artisan Bricks
astralshard|Astral Shards
bdaycandle|B-Day Candles
berrybox|Berry Boxes
bigyear|Big Years
blingbinky|Bling Binkies
bondedring|Bonded Rings
bowtie|Bow Ties
bunnymuffin|Bunny Muffins
candycane|Candy Canes
chillflame|Chill Flames
cloverpin|Clover Pins
cookieheart|Cookie Hearts
crystalball|Crystal Balls
cupidcharm|Cupid Charms
deskcalendar|Desk Calendars
diamondring|Diamond Rings
durovscap|Durov’s Caps
durovsglasses|Durov’s Glasses
easteregg|Easter Eggs
electricskull|Electric Skulls
eternalcandle|Eternal Candles
eternalrose|Eternal Roses
evileye|Evil Eyes
faithamulet|Faith Amulets
finepen|Fine Pens
flyingbroom|Flying Brooms
freshsocks|Fresh Socks
gemsignet|Gem Signets
genielamp|Genie Lamps
gingercookie|Ginger Cookies
hangingstar|Hanging Stars
happybrownie|Happy Brownies
heartlocket|Heart Lockets
heroichelmet|Heroic Helmets
hexpot|Hex Pots
holidaydrink|Holiday Drinks
homemadecake|Homemade Cakes
hypnolollipop|Hypno Lollipops
icecream|Ice Creams
inputkey|Input Keys
instantramen|Instant Ramens
intelligencecup|Intelligence Cups
iongem|Ion Gems
ionicdryer|Ionic Dryers
jackinthebox|Jacks-in-the-Box
jellybunny|Jelly Bunnies
jesterhat|Jester Hats
jinglebells|Jingle Bells
jollychimp|Jolly Chimps
joyfulbundle|Joyful Bundles
khabibspapakha|Khabib’s Papakhas
kissedfrog|Kissed Frogs
libertyfigure|Liberty Figures
lightsword|Light Swords
lolpop|Lol Pops
lootbag|Loot Bags
lovecandle|Love Candles
lovepotion|Love Potions
lowrider|Low Riders
lunarsnake|Lunar Snakes
lushbouquet|Lush Bouquets
madpumpkin|Mad Pumpkins
magicpotion|Magic Potions
mightyarm|Mighty Arms
minioscar|Mini Oscars
moneypot|Money Pots
moodpack|Mood Packs
moonpendant|Moon Pendants
moussecake|Mousse Cakes
nailbracelet|Nail Bracelets
nekohelmet|Neko Helmets
partysparkler|Party Sparklers
perfumebottle|Perfume Bottles
petsnake|Pet Snakes
plushpepe|Plush Pepes
poolfloat|Pool Floats
preciouspeach|Precious Peaches
prettyposy|Pretty Posies
rarebird|Rare Birds
recordplayer|Record Players
restlessjar|Restless Jars
sakuraflower|Sakura Flowers
santahat|Santa Hats
scaredcat|Scared Cats
sharptongue|Sharp Tongues
signetring|Signet Rings
skullflower|Skull Flowers
skystilettos|Sky Stilettos
sleighbell|Sleigh Bells
snakebox|Snake Boxes
snoopcigar|Snoop Cigars
snoopdogg|Snoop Doggs
snowglobe|Snow Globes
snowmittens|Snow Mittens
spicedwine|Spiced Wines
springbasket|Spring Baskets
spyagaric|Spy Agarics
starnotepad|Star Notepads
stellarrocket|Stellar Rockets
surgeboard|Surge Boards
swagbag|Swag Bags
swisswatch|Swiss Watches
tamagadget|Tama Gadgets
timelessbook|Timeless Books
tophat|Top Hats
toybear|Toy Bears
trappedheart|Trapped Hearts
ufcstrike|UFC Strikes
valentinebox|Valentine Boxes
vicecream|Vice Creams
victorymedal|Victory Medals
vintagecigar|Vintage Cigars
voodoodoll|Voodoo Dolls
westsidesign|Westside Signs
whipcupcake|Whip Cupcakes
winterwreath|Winter Wreaths
witchhat|Witch Hats
xmasstocking|Xmas Stockings
`.trim().split('\n').map((line) => {
    const [slug, name] = line.split('|');
    return { slug, name };
  });

  const passwordInput = document.querySelector('.admin-password');
  const playerQuery = document.querySelector('.admin-player-query');
  const playerSearchForm = document.querySelector('.admin-player-search-form');
  const playerResults = document.querySelector('.admin-player-results');
  const selectedPlayerHost = document.querySelector('.admin-selected-player');
  const playerStatus = document.querySelector('.admin-player-status');
  const collectionQuery = document.querySelector('.admin-collection-query');
  const collectionSelect = document.querySelector('.admin-collection-select');
  const giftNumberInput = document.querySelector('.admin-gift-number');
  const giftPriceInput = document.querySelector('.admin-gift-price');
  const customSlugInput = document.querySelector('.admin-custom-slug');
  const customNameInput = document.querySelector('.admin-custom-name');
  const previewImage = document.querySelector('.admin-preview-image');
  const previewPlaceholder = document.querySelector('.admin-preview-placeholder');
  const previewTitle = document.querySelector('.admin-preview-title');
  const previewDescription = document.querySelector('.admin-preview-description');
  const previewLink = document.querySelector('.admin-preview-link');
  const grantButton = document.querySelector('.admin-grant-button');
  const removeButton = document.querySelector('.admin-remove-button');
  const grantStatus = document.querySelector('.admin-grant-status');
  const syncCatalogButton = document.querySelector('.admin-sync-catalog-button');
  const catalogStatus = document.querySelector('.admin-catalog-status');
  const loadInventoryButton = document.querySelector('.admin-load-inventory-button');
  const inventoryStatus = document.querySelector('.admin-inventory-status');
  const inventoryList = document.querySelector('.admin-inventory-list');
  let selectedPlayer = null;
  let giftPreviewUrl = '';
  let priceRequestId = 0;

  const refreshPlayers = async () => {
    const players = await rpc('admin_search_players', { p_password: passwordInput.value, p_query: playerQuery.value.trim() });
    renderPlayerResults(players);
  };

  const renderInventory = (items) => {
    inventoryList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty-result';
      empty.textContent = 'NFT у пользователей не найдены.';
      inventoryList.append(empty);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement('article');
      row.className = 'admin-inventory-item';
      const image = document.createElement('img');
      image.className = 'admin-inventory-image';
      image.src = item.preview_url || '';
      image.alt = '';
      const copy = document.createElement('div');
      copy.className = 'admin-inventory-copy';
      const title = document.createElement('strong');
      title.textContent = `${item.collection_name} #${item.gift_number}`;
      const owner = document.createElement('span');
      owner.textContent = `${item.nickname} · Telegram ID ${item.telegram_id}`;
      const id = document.createElement('small');
      id.textContent = `Получен ${new Date(item.acquired_at).toLocaleString('ru-RU')}`;
      copy.append(title, owner, id);
      const remove = document.createElement('button');
      remove.className = 'admin-button admin-remove-inventory-button';
      remove.type = 'button';
      remove.textContent = 'Удалить';
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Физически удалить ${item.collection_name} #${item.gift_number} у ${item.nickname}?`)) return;
        remove.disabled = true;
        showStatus(inventoryStatus, 'Удаляем NFT…');
        try {
          await rpc('admin_remove_nft', { p_password: passwordInput.value, p_nft_item_id: item.nft_item_id });
          showStatus(inventoryStatus, 'NFT удалён из базы.');
          await loadInventory();
        } catch (error) {
          showStatus(inventoryStatus, error.message, true);
          remove.disabled = false;
        }
      });
      row.append(image, copy, remove);
      inventoryList.append(row);
    });
  };

  const loadInventory = async () => {
    if (!passwordInput.value) {
      showStatus(inventoryStatus, 'Сначала введи пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    loadInventoryButton.disabled = true;
    showStatus(inventoryStatus, 'Загружаем список NFT…');
    try {
      const items = await rpc('admin_list_all_nfts', { p_password: passwordInput.value });
      renderInventory(items);
      showStatus(inventoryStatus, `${items.length} NFT загружено.`);
    } catch (error) {
      showStatus(inventoryStatus, error.message, true);
    } finally {
      loadInventoryButton.disabled = false;
    }
  };

  const getFragmentPrice = async (collection, giftNumber) => {
    if (!config.url || !config.anonKey) throw new Error('Проверь URL и anon key в supabase-client-config.js.');
    let response;
    try {
      response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/fragment-price`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ collection_slug: collection.slug, gift_number: giftNumber })
      });
    } catch {
      throw new Error('Edge Function fragment-price не опубликована или не отвечает. Выполните deploy функции в Supabase.');
    }
    const data = await response.json().catch(() => null);
    if (response.status === 404 && data?.message === 'Requested function was not found') {
      throw new Error('Функция fragment-price не опубликована в Supabase. Выполните deploy из README.');
    }
    if (!response.ok) throw new Error(data?.error || `Не удалось получить цену Fragment (${response.status}).`);
    return data;
  };

  const getSelectedCollection = () => {
    const customSlug = customSlugInput.value.trim().toLowerCase();
    if (customSlug) {
      const customName = customNameInput.value.trim();
      if (!/^[a-z0-9]+$/.test(customSlug) || !customName) return null;
      return { slug: customSlug, name: customName };
    }
    return collections.find((item) => item.slug === collectionSelect.value) || null;
  };

  const showStatus = (element, message, isError = false) => {
    element.textContent = message;
    element.hidden = !message;
    element.classList.toggle('is-error', isError);
    element.classList.toggle('is-success', Boolean(message) && !isError);
  };

  const rpc = async (functionName, parameters) => {
    if (!config.url || !config.anonKey || config.url.includes('YOUR_PROJECT_REF') || config.anonKey.includes('YOUR_SUPABASE')) {
      throw new Error('Проверь URL и anon key в supabase-client-config.js.');
    }
    const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(parameters)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.message || data?.details || data?.hint || `Ошибка Supabase (${response.status}).`;
      if (message.includes('Invalid administrator password')) throw new Error('Неверный пароль администратора.');
      throw new Error(message);
    }
    return data;
  };

  const fragmentCatalogRequest = async (payload) => {
    if (!config.url || !config.anonKey || config.url.includes('YOUR_PROJECT_REF') || config.anonKey.includes('YOUR_SUPABASE')) {
      throw new Error('Проверь URL и anon key в supabase-client-config.js.');
    }
    let response;
    try {
      response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/fragment-catalog`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error('Edge Function fragment-catalog не опубликована или не отвечает.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Не удалось загрузить каталог Fragment (${response.status}).`);
    if (!Array.isArray(data?.collections)) throw new Error('Сервер вернул некорректный каталог Fragment.');
    return data.collections;
  };

  const mergeCollections = (additionalCollections) => {
    const bySlug = new Map(collections.map((collection) => [collection.slug, collection]));
    additionalCollections.forEach((collection) => {
      if (typeof collection?.slug !== 'string' || typeof collection?.name !== 'string') return;
      bySlug.set(collection.slug, { slug: collection.slug, name: collection.name });
    });
    collections = [...bySlug.values()].sort((first, second) => first.name.localeCompare(second.name, 'en'));
  };

  const renderCollections = () => {
    const search = collectionQuery.value.trim().toLocaleLowerCase('ru-RU');
    const currentSlug = collectionSelect.value;
    const filtered = collections.filter((collection) => `${collection.name} ${collection.slug}`.toLocaleLowerCase('ru-RU').includes(search));
    collectionSelect.replaceChildren(new Option(filtered.length ? 'Выберите коллекцию' : 'Ничего не найдено', ''));
    filtered.forEach((collection) => collectionSelect.add(new Option(`${collection.name} · ${collection.slug}`, collection.slug)));
    if (filtered.some((collection) => collection.slug === currentSlug)) collectionSelect.value = currentSlug;
    updateGiftPreview();
  };

  const updateGiftPreview = () => {
    const collection = getSelectedCollection();
    const giftNumber = giftNumberInput.value.trim();
    const validNumber = /^\d{1,12}$/.test(giftNumber) && Number(giftNumber) > 0;
    giftPreviewUrl = collection && validNumber
      ? `https://nft.fragment.com/gift/${collection.slug}-${giftNumber}.webp`
      : '';
    previewImage.hidden = true;
    previewImage.removeAttribute('src');
    previewPlaceholder.hidden = false;
    previewPlaceholder.textContent = collection && validNumber ? 'Загружаем изображение Fragment…' : 'Выберите коллекцию и введите номер';
    previewTitle.textContent = collection && validNumber ? `${collection.name} #${giftNumber}` : 'Подарок не выбран';
    previewDescription.textContent = collection && validNumber
      ? `Экземпляр ${giftNumber} · ${collection.slug}`
      : 'Изображение загружается из публичного каталога Fragment.';
    previewLink.hidden = !giftPreviewUrl;
    previewLink.href = giftPreviewUrl ? `https://fragment.com/gift/${collection.slug}-${giftNumber}` : 'https://fragment.com/gifts';
    giftPriceInput.value = '';
    giftPriceInput.placeholder = giftPreviewUrl ? 'Загрузка цены Fragment…' : 'Сначала выберите подарок';
    grantButton.disabled = true;
    removeButton.disabled = !selectedPlayer || !giftPreviewUrl;
    if (!giftPreviewUrl) return;

    const requestId = ++priceRequestId;
    getFragmentPrice(collection, giftNumber).then((price) => {
      if (requestId !== priceRequestId) return;
      giftPriceInput.value = String(price.stars);
      giftPriceInput.dataset.source = 'fragment';
      grantButton.disabled = !selectedPlayer;
      previewDescription.textContent = `${giftNumber} · ${collection.slug} · ${price.grams} GRAM → ${price.stars} Stars`;
    }).catch((error) => {
      if (requestId !== priceRequestId) return;
      giftPriceInput.placeholder = error.message;
      giftPriceInput.dataset.source = '';
      showStatus(grantStatus, error.message, true);
    });

    previewImage.onload = () => {
      previewImage.hidden = false;
      previewPlaceholder.hidden = true;
    };
    previewImage.onerror = () => {
      previewImage.hidden = true;
      previewPlaceholder.hidden = false;
      previewPlaceholder.textContent = 'Превью не найдено. Проверь slug и номер, затем открой страницу Fragment для проверки.';
    };
    previewImage.src = giftPreviewUrl;
  };

  const renderPlayerResults = (players) => {
    const appendStatusBadge = (target, status) => {
      const normalizedStatus = String(status || '').trim().toLowerCase();
      if (normalizedStatus !== 'verfied' && normalizedStatus !== 'verified' && normalizedStatus !== 'premium') return;
      const badge = document.createElement('img');
      badge.className = `profile-status-badge ${normalizedStatus === 'premium' ? 'is-premium' : 'is-verified'}`;
      badge.src = normalizedStatus === 'premium' ? './assets/svg/premium.svg' : './assets/svg/verified.svg';
      badge.alt = '';
      badge.setAttribute('aria-label', normalizedStatus === 'premium' ? 'Premium' : 'Подтверждённый профиль');
      target.append(badge);
    };
    playerResults.replaceChildren();
    if (!players.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty-result';
      empty.textContent = 'Игроки не найдены';
      playerResults.append(empty);
      return;
    }
    players.forEach((player) => {
      const button = document.createElement('button');
      button.className = 'admin-player-result';
      button.type = 'button';
      button.setAttribute('aria-pressed', String(selectedPlayer?.profile_id === player.profile_id));
      const avatar = document.createElement('span');
      avatar.className = 'admin-player-avatar';
      if (player.avatar_url) {
        const image = document.createElement('img');
        image.src = player.avatar_url;
        image.alt = '';
        avatar.append(image);
      } else {
        avatar.textContent = (player.nickname || '?').slice(0, 1).toUpperCase();
      }
      const copy = document.createElement('span');
      copy.className = 'admin-player-copy';
      const name = document.createElement('strong');
      name.textContent = player.nickname;
      appendStatusBadge(name, player.status);
      const meta = document.createElement('span');
      meta.textContent = `${player.username ? `@${player.username} · ` : ''}Telegram ID ${player.telegram_id}`;
      copy.append(name, meta);
      const count = document.createElement('span');
      count.className = 'admin-player-nft-count';
      count.textContent = `${player.nft_count} NFT`;
      button.append(avatar, copy, count);
      button.addEventListener('click', () => {
        selectedPlayer = player;
        selectedPlayerHost.replaceChildren();
        const summary = document.createElement('div');
        summary.className = 'admin-selected-summary';
        const label = document.createElement('span');
        label.textContent = 'Получатель';
        const value = document.createElement('strong');
        const selectedName = document.createElement('span');
        selectedName.textContent = player.nickname;
        appendStatusBadge(selectedName, player.status);
        value.append(selectedName, document.createTextNode(` · Telegram ID ${player.telegram_id}`));
        summary.append(label, value);
        const clear = document.createElement('button');
        clear.className = 'admin-clear-selection';
        clear.type = 'button';
        clear.textContent = 'Сменить';
        clear.addEventListener('click', () => {
          selectedPlayer = null;
          selectedPlayerHost.hidden = true;
          playerResults.querySelectorAll('.admin-player-result').forEach((item) => item.setAttribute('aria-pressed', 'false'));
          updateGiftPreview();
        });
        selectedPlayerHost.append(summary, clear);
        selectedPlayerHost.hidden = false;
        playerResults.querySelectorAll('.admin-player-result').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        updateGiftPreview();
        showStatus(playerStatus, 'Игрок выбран. Теперь выберите Fragment-подарок.');
      });
      playerResults.append(button);
    });
  };

  playerSearchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = passwordInput.value;
    if (!password) {
      showStatus(playerStatus, 'Сначала введи пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    const query = playerQuery.value.trim();
    const button = playerSearchForm.querySelector('.admin-search-button');
    button.disabled = true;
    showStatus(playerStatus, 'Ищем игроков…');
    playerResults.replaceChildren();
    try {
      const players = await rpc('admin_search_players', { p_password: password, p_query: query });
      renderPlayerResults(players);
      showStatus(playerStatus, `${players.length} игроков найдено.`);
    } catch (error) {
      showStatus(playerStatus, error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  grantButton.addEventListener('click', async () => {
    const collection = getSelectedCollection();
    const giftNumber = giftNumberInput.value.trim();
    const priceStars = Number(giftPriceInput.value);
    if (!selectedPlayer || !collection || !/^\d{1,12}$/.test(giftNumber) || !Number.isSafeInteger(priceStars) || priceStars <= 0 || !passwordInput.value) return;
    grantButton.disabled = true;
    showStatus(grantStatus, 'Выдаём NFT…');
    try {
      await rpc('admin_grant_fragment_gift', {
        p_password: passwordInput.value,
        p_profile_id: selectedPlayer.profile_id,
        p_collection_slug: collection.slug,
        p_collection_name: collection.name,
        p_gift_number: giftNumber,
        p_price_stars: priceStars
      });
      showStatus(grantStatus, `${collection.name} #${giftNumber} выдан игроку ${selectedPlayer.nickname}.`);
      const query = playerQuery.value.trim();
      await refreshPlayers();
    } catch (error) {
      showStatus(grantStatus, error.message, true);
    } finally {
      grantButton.disabled = false;
    }
  });

  removeButton.addEventListener('click', async () => {
    const collection = getSelectedCollection();
    const giftNumber = giftNumberInput.value.trim();
    if (!selectedPlayer || !collection || !/^\d{1,12}$/.test(giftNumber) || !passwordInput.value) return;
    if (!window.confirm(`Удалить ${collection.name} #${giftNumber} с профиля ${selectedPlayer.nickname}?`)) return;
    removeButton.disabled = true;
    grantButton.disabled = true;
    showStatus(grantStatus, 'Удаляем NFT…');
    try {
      await rpc('admin_remove_fragment_gift', {
        p_password: passwordInput.value,
        p_profile_id: selectedPlayer.profile_id,
        p_collection_slug: collection.slug,
        p_gift_number: giftNumber
      });
      showStatus(grantStatus, `${collection.name} #${giftNumber} удалён с профиля ${selectedPlayer.nickname}.`);
      await refreshPlayers();
    } catch (error) {
      showStatus(grantStatus, error.message, true);
    } finally {
      updateGiftPreview();
    }
  });

  collectionQuery.addEventListener('input', renderCollections);
  collectionSelect.addEventListener('change', updateGiftPreview);
  giftNumberInput.addEventListener('input', updateGiftPreview);
  customSlugInput.addEventListener('input', updateGiftPreview);
  customNameInput.addEventListener('input', updateGiftPreview);
  loadInventoryButton.addEventListener('click', loadInventory);
  syncCatalogButton.addEventListener('click', async () => {
    if (!passwordInput.value) {
      showStatus(catalogStatus, 'Сначала введи пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    syncCatalogButton.disabled = true;
    showStatus(catalogStatus, 'Загружаем каталог Fragment…');
    try {
      const syncedCollections = await fragmentCatalogRequest({
        action: 'sync',
        password: passwordInput.value
      });
      mergeCollections(syncedCollections);
      renderCollections();
      showStatus(catalogStatus, `Каталог обновлён: ${collections.length} коллекций доступно в списке.`);
    } catch (error) {
      showStatus(catalogStatus, error.message, true);
    } finally {
      syncCatalogButton.disabled = false;
    }
  });
  giftPriceInput.addEventListener('input', () => {
    giftPriceInput.dataset.source = 'manual';
    grantButton.disabled = !selectedPlayer || !giftPreviewUrl || !Number.isSafeInteger(Number(giftPriceInput.value)) || Number(giftPriceInput.value) <= 0;
  });
  passwordInput.addEventListener('input', () => {
    showStatus(playerStatus, '');
    showStatus(grantStatus, '');
    showStatus(catalogStatus, '');
  });

  renderCollections();
  fragmentCatalogRequest({ action: 'list' }).then((savedCollections) => {
    mergeCollections(savedCollections);
    renderCollections();
  }).catch((error) => {
    showStatus(catalogStatus, `Сохранённый список из базы недоступен: ${error.message}`, true);
  });
})();
