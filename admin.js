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
  const deleteAllConfirmation = document.querySelector('.admin-delete-all-confirmation');
  const deleteAllButton = document.querySelector('.admin-delete-all-nfts-button');
  const deleteAllStatus = document.querySelector('.admin-delete-all-status');
  const randomMinPriceInput = document.querySelector('.admin-random-min-price');
  const randomMaxPriceInput = document.querySelector('.admin-random-max-price');
  const randomQuantityInput = document.querySelector('.admin-random-quantity');
  const randomFilterSelect = document.querySelector('.admin-random-filter');
  const randomCollectionSelect = document.querySelector('.admin-random-collection-select');
  const randomStatus = document.querySelector('.admin-random-status');
  const randomMarketButton = document.querySelector('.admin-random-market-button');
  const randomPlayerButton = document.querySelector('.admin-random-player-button');
  const taskForm = document.querySelector('.admin-task-form');
  const taskCountForm = document.querySelector('.admin-task-count-form');
  const taskResetButton = document.querySelector('.admin-task-reset-button');
  const taskList = document.querySelector('.admin-task-list');
  const taskStatus = document.querySelector('.admin-task-status');
  const taskRefreshButton = document.querySelector('.admin-task-refresh-button');
  const taskSettingsHint = document.querySelector('.admin-task-settings-hint');
  const promoForm = document.querySelector('.admin-promo-form');
  const promoRewardType = document.querySelector('.admin-promo-reward-type');
  const promoRewardValue = document.querySelector('.admin-promo-reward-value');
  const promoBrowserDemoOnly = document.querySelector('.admin-promo-browser-demo');
  const promoRewardValueLabel = document.querySelector('.admin-promo-value-label');
  const promoStatus = document.querySelector('.admin-promo-status');
  const promoResult = document.querySelector('.admin-promo-result');
  const promoCodes = document.querySelector('.admin-promo-codes');
  const promoCopyButton = document.querySelector('.admin-promo-copy-button');
  const promoDownloadButton = document.querySelector('.admin-promo-download-button');
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

  const taskManagerRequest = async (payload) => {
    if (!config.url || !config.anonKey || config.url.includes('YOUR_PROJECT_REF') || config.anonKey.includes('YOUR_SUPABASE')) {
      throw new Error('Проверь URL и anon key в supabase-client-config.js.');
    }
    let response;
    try {
      response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/admin-tasks`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...payload, password: passwordInput.value })
      });
    } catch {
      throw new Error('Edge Function admin-tasks не опубликована или не отвечает.');
    }
    const data = await response.json().catch(() => null);
    if (response.status === 404) {
      throw new Error('Функция admin-tasks не опубликована в Supabase. Выполните deploy из README.');
    }
    if (!response.ok) throw new Error(data?.error || `Не удалось изменить задания (${response.status}).`);
    return data;
  };

  const promoCodeRequest = async (payload) => {
    if (!config.url || !config.anonKey || config.url.includes('YOUR_PROJECT_REF') || config.anonKey.includes('YOUR_SUPABASE')) {
      throw new Error('Проверь URL и anon key в supabase-client-config.js.');
    }
    let response;
    try {
      response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/admin-promocodes`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...payload, password: passwordInput.value })
      });
    } catch {
      throw new Error('Edge Function admin-promocodes не опубликована или не отвечает.');
    }
    const data = await response.json().catch(() => null);
    if (response.status === 404) {
      throw new Error('Функция admin-promocodes не опубликована в Supabase. Выполните deploy из README.');
    }
    if (!response.ok) throw new Error(data?.error || `Не удалось создать промокоды (${response.status}).`);
    return data;
  };

  const renderTaskDefinitions = (tasks) => {
    taskList.replaceChildren();
    if (!tasks.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty-result';
      empty.textContent = 'В пуле пока нет заданий.';
      taskList.append(empty);
      return;
    }
    tasks.forEach((task) => {
      const row = document.createElement('article');
      row.className = `admin-task-item${task.enabled ? '' : ' is-disabled'}`;
      const copy = document.createElement('div');
      copy.className = 'admin-task-copy';
      const title = document.createElement('strong');
      title.textContent = task.title;
      const details = document.createElement('span');
      details.textContent = `${task.period_type === 'daily' ? 'Ежедневное' : 'Еженедельное'} · ${task.reward} ⭐ · ${task.event_key} ${task.target > 1 ? `× ${task.target}` : ''}`;
      const description = document.createElement('small');
      description.textContent = task.description || 'Без описания';
      copy.append(title, details, description);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'admin-button admin-task-toggle';
      toggle.textContent = task.enabled ? 'Отключить' : 'Восстановить';
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        showStatus(taskStatus, task.enabled ? 'Отключаем задание…' : 'Восстанавливаем задание…');
        try {
          await taskManagerRequest({
            action: task.enabled ? 'delete' : 'restore',
            task_id: task.id
          });
          showStatus(taskStatus, task.enabled ? 'Задание отключено.' : 'Задание восстановлено.');
          await loadTaskDefinitions();
        } catch (error) {
          showStatus(taskStatus, error.message, true);
          toggle.disabled = false;
        }
      });
      row.append(copy, toggle);
      taskList.append(row);
    });
  };

  const loadTaskDefinitions = async () => {
    if (!passwordInput.value) {
      showStatus(taskStatus, 'Сначала введите пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    taskRefreshButton.disabled = true;
    showStatus(taskStatus, 'Загружаем задания…');
    try {
      const [result, settingsResult] = await Promise.all([
        taskManagerRequest({ action: 'list' }),
        taskManagerRequest({ action: 'get_settings' })
      ]);
      if (!Array.isArray(result.tasks)) throw new Error('Сервер вернул некорректный список заданий.');
      if (!settingsResult.settings || !settingsResult.enabled_pool) {
        throw new Error('Сервер вернул некорректные настройки количества заданий.');
      }
      taskCountForm.querySelector('.admin-daily-task-count').value = settingsResult.settings.daily_task_count;
      taskCountForm.querySelector('.admin-weekly-task-count').value = settingsResult.settings.weekly_task_count;
      taskSettingsHint.textContent = `В пуле активно: ${settingsResult.enabled_pool.daily} ежедневных и ${settingsResult.enabled_pool.weekly} еженедельных заданий. На период выпадет не больше заданного количества и доступных включённых заданий; сохранённые настройки применятся со следующего периода.`;
      renderTaskDefinitions(result.tasks);
      showStatus(taskStatus, `Загружено заданий: ${result.tasks.length}.`);
    } catch (error) {
      showStatus(taskStatus, error.message, true);
    } finally {
      taskRefreshButton.disabled = false;
    }
  };

  taskRefreshButton.addEventListener('click', loadTaskDefinitions);
  taskResetButton.addEventListener('click', async () => {
    if (!passwordInput.value) {
      showStatus(taskStatus, 'Сначала введите пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    const confirmed = window.confirm(
      'Сбросить ежедневные и еженедельные задания у ВСЕХ игроков? Текущий прогресс и отметки о наградах будут очищены, а списки обновлены. Начисленные Stars останутся на балансах.'
    );
    if (!confirmed) return;

    taskResetButton.disabled = true;
    showStatus(taskStatus, 'Сбрасываем задания у всех игроков…');
    try {
      const result = await taskManagerRequest({ action: 'reset_all_tasks' });
      if (!result.reset || !Number.isInteger(result.reset.daily_count) || !Number.isInteger(result.reset.weekly_count)) {
        throw new Error('Сервер вернул некорректный результат сброса.');
      }
      showStatus(
        taskStatus,
        `Сброс выполнен. Обновлены списки для всех игроков: ${result.reset.daily_count} ежедневных и ${result.reset.weekly_count} еженедельных заданий.`
      );
    } catch (error) {
      showStatus(taskStatus, error.message, true);
    } finally {
      taskResetButton.disabled = false;
    }
  });
  taskCountForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!passwordInput.value) {
      showStatus(taskStatus, 'Сначала введите пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    const button = taskCountForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus(taskStatus, 'Сохраняем количество заданий…');
    try {
      const result = await taskManagerRequest({
        action: 'update_settings',
        daily_task_count: Number(taskCountForm.querySelector('.admin-daily-task-count').value),
        weekly_task_count: Number(taskCountForm.querySelector('.admin-weekly-task-count').value)
      });
      taskSettingsHint.textContent = `В пуле активно: ${result.enabled_pool.daily} ежедневных и ${result.enabled_pool.weekly} еженедельных заданий. Новые значения применятся со следующего периода.`;
      showStatus(taskStatus, 'Количество заданий сохранено.');
    } catch (error) {
      showStatus(taskStatus, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  taskForm.querySelector('.admin-task-period').addEventListener('change', (event) => {
    const rewardInput = taskForm.querySelector('.admin-task-reward');
    const minimumReward = event.currentTarget.value === 'weekly' ? 2 : 1;
    rewardInput.min = String(minimumReward);
    rewardInput.max = event.currentTarget.value === 'weekly' ? '5' : '3';
    if (Number(rewardInput.value) < minimumReward) rewardInput.value = String(minimumReward);
    if (Number(rewardInput.value) > Number(rewardInput.max)) rewardInput.value = rewardInput.max;
  });
  taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!passwordInput.value) {
      showStatus(taskStatus, 'Сначала введите пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    const button = taskForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus(taskStatus, 'Добавляем задание…');
    try {
      await taskManagerRequest({
        action: 'create',
        period_type: taskForm.querySelector('.admin-task-period').value,
        title: taskForm.querySelector('.admin-task-title').value,
        description: taskForm.querySelector('.admin-task-description').value,
        event_key: taskForm.querySelector('.admin-task-event').value,
        target: Number(taskForm.querySelector('.admin-task-target').value),
        reward: Number(taskForm.querySelector('.admin-task-reward').value)
      });
      taskForm.reset();
      taskForm.querySelector('.admin-task-period').dispatchEvent(new Event('change'));
      showStatus(taskStatus, 'Задание добавлено в пул.');
      await loadTaskDefinitions();
    } catch (error) {
      showStatus(taskStatus, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  promoRewardType.addEventListener('change', () => {
    const isPremium = promoRewardType.value === 'premium';
    promoRewardValueLabel.textContent = isPremium ? 'Количество месяцев Premium' : 'Количество Stars';
    promoRewardValue.min = '1';
    promoRewardValue.max = isPremium ? '12' : '1000000';
    promoRewardValue.value = isPremium ? '1' : '100';
  });
  promoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!passwordInput.value) {
      showStatus(promoStatus, 'Сначала введите пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    if (!promoForm.reportValidity()) return;
    if (!promoResult.hidden && promoCodes.value
      && !window.confirm('Новая генерация заменит ранее показанные промокоды. Вы уже сохранили предыдущие коды?')) return;
    const button = promoForm.querySelector('button[type="submit"]');
    button.disabled = true;
    showStatus(promoStatus, 'Создаём промокоды…');
    try {
      const result = await promoCodeRequest({
        action: 'generate',
        reward_type: promoRewardType.value,
        reward_value: Number(promoRewardValue.value),
        browser_demo_only: promoBrowserDemoOnly.checked,
        count: Number(promoForm.querySelector('.admin-promo-count').value)
      });
      if (!Array.isArray(result.codes) || result.codes.length !== Number(promoForm.querySelector('.admin-promo-count').value)
        || result.codes.some((code) => typeof code !== 'string' || !/^VYRN-[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/.test(code))) {
        throw new Error('Сервер вернул некорректный список промокодов.');
      }
      promoCodes.value = result.codes.join('\n');
      promoResult.hidden = false;
      showStatus(promoStatus, `Создано кодов: ${result.codes.length}. Скопируйте или скачайте их сейчас.`);
    } catch (error) {
      showStatus(promoStatus, error.message, true);
    } finally {
      button.disabled = false;
    }
  });
  promoCopyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(promoCodes.value);
      showStatus(promoStatus, 'Промокоды скопированы в буфер обмена.');
    } catch (error) {
      showStatus(promoStatus, `Не удалось скопировать коды: ${error.message || 'доступ к буферу обмена запрещён.'}`, true);
    }
  });
  promoDownloadButton.addEventListener('click', () => {
    const file = new Blob([`${promoCodes.value}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vyrn-promo-codes.txt';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

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

  const randomFragmentRequest = async (payload) => {
    if (!config.url || !config.anonKey || config.url.includes('YOUR_PROJECT_REF') || config.anonKey.includes('YOUR_SUPABASE')) {
      throw new Error('Проверь URL и anon key в supabase-client-config.js.');
    }
    let response;
    try {
      response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/admin-random-gifts`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch {
      throw new Error('Edge Function admin-random-gifts не опубликована или не отвечает.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || `Не удалось выполнить массовую операцию (${response.status}).`);
    if (!Array.isArray(data?.items)) throw new Error('Сервер вернул некорректный результат массовой операции.');
    return data;
  };

  const mergeCollections = (additionalCollections) => {
    const bySlug = new Map(collections.map((collection) => [collection.slug, collection]));
    additionalCollections.forEach((collection) => {
      if (typeof collection?.slug !== 'string' || typeof collection?.name !== 'string') return;
      bySlug.set(collection.slug, { slug: collection.slug, name: collection.name });
    });
    collections = [...bySlug.values()].sort((first, second) => first.name.localeCompare(second.name, 'en'));
    renderRandomCollections();
  };

  const renderRandomCollections = () => {
    const currentSlug = randomCollectionSelect.value;
    randomCollectionSelect.replaceChildren(new Option('Все коллекции', ''));
    collections.forEach((collection) => {
      randomCollectionSelect.add(new Option(`${collection.name} · ${collection.slug}`, collection.slug));
    });
    if (collections.some((collection) => collection.slug === currentSlug)) randomCollectionSelect.value = currentSlug;
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
        randomPlayerButton.disabled = false;
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
          randomPlayerButton.disabled = true;
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
  deleteAllButton.addEventListener('click', async () => {
    const confirmation = 'УДАЛИТЬ ВСЕ NFT';
    if (!passwordInput.value) {
      showStatus(deleteAllStatus, 'Сначала введи пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    if (deleteAllConfirmation.value.trim() !== confirmation) {
      showStatus(deleteAllStatus, `Для продолжения точно введи «${confirmation}».`, true);
      deleteAllConfirmation.focus();
      return;
    }
    if (!window.confirm('Это удалит все NFT проекта и связанную с ними историю рынка и передач. Отменить операцию будет невозможно. Продолжить?')) return;

    deleteAllButton.disabled = true;
    showStatus(deleteAllStatus, 'Удаляем все NFT и связанные записи…');
    try {
      const deletedCount = await rpc('admin_remove_all_nfts', {
        p_password: passwordInput.value,
        p_confirmation: confirmation
      });
      deleteAllConfirmation.value = '';
      showStatus(deleteAllStatus, `Удалено NFT: ${Number(deletedCount).toLocaleString('ru-RU')}.`);
      await loadInventory();
    } catch (error) {
      showStatus(deleteAllStatus, error.message, true);
    } finally {
      deleteAllButton.disabled = false;
    }
  });
  const runRandomGiftAction = async (mode) => {
    if (!passwordInput.value) {
      showStatus(randomStatus, 'Сначала введи пароль администратора.', true);
      passwordInput.focus();
      return;
    }
    if (mode === 'player' && !selectedPlayer) {
      showStatus(randomStatus, 'Сначала найди и выбери игрока в разделе «Игрок».', true);
      playerQuery.focus();
      return;
    }
    const minPrice = Number(randomMinPriceInput.value);
    const maxPrice = Number(randomMaxPriceInput.value);
    const quantity = Number(randomQuantityInput.value);
    if (!Number.isSafeInteger(minPrice) || minPrice < 1
      || !Number.isSafeInteger(maxPrice) || maxPrice < minPrice
      || !Number.isInteger(quantity) || quantity < 1 || quantity > 30) {
      showStatus(randomStatus, 'Укажи корректный диапазон Stars и количество от 1 до 30 NFT.', true);
      return;
    }
    const collection = collections.find((item) => item.slug === randomCollectionSelect.value);
    if (randomCollectionSelect.value && !collection) {
      showStatus(randomStatus, 'Выбранная коллекция недоступна. Обнови список коллекций.', true);
      return;
    }
    const destination = mode === 'market'
      ? 'Выставить случайные NFT на маркет от профиля @vyrn'
      : `Выдать ${quantity} случайных NFT игроку ${selectedPlayer.nickname}`;
    if (!window.confirm(`${destination} в диапазоне ${minPrice}–${maxPrice} Stars?`)) return;

    randomMarketButton.disabled = true;
    randomPlayerButton.disabled = true;
    showStatus(randomStatus, 'Ищем NFT и проверяем цены Fragment. Это может занять минуту…');
    try {
      const result = await randomFragmentRequest({
        password: passwordInput.value,
        mode,
        profile_id: mode === 'player' ? selectedPlayer.profile_id : null,
        min_stars: minPrice,
        max_stars: maxPrice,
        quantity,
        fragment_filter: randomFilterSelect.value,
        collection_slug: collection?.slug || null
      });
      const listed = result.items.map((item) => `${item.collection_name} #${item.gift_number} · ${item.price_stars} Stars`);
      const action = mode === 'market' ? 'выставлено на маркет' : 'выдано игроку';
      const listingWarning = result.listing_failures?.length
        ? `\nНе удалось загрузить один из фильтров Fragment: ${result.listing_failures.join('; ')}`
        : '';
      const summary = `${result.items.length} NFT ${action}${mode === 'player' ? ` ${selectedPlayer.nickname}` : ' от VYRN'}:\n${listed.join('\n')}${listingWarning}`;
      showStatus(randomStatus, summary);
      if (mode === 'player') await refreshPlayers();
    } catch (error) {
      showStatus(randomStatus, error.message, true);
    } finally {
      randomMarketButton.disabled = false;
      randomPlayerButton.disabled = !selectedPlayer;
    }
  };
  randomMarketButton.addEventListener('click', () => runRandomGiftAction('market'));
  randomPlayerButton.addEventListener('click', () => runRandomGiftAction('player'));
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
    showStatus(randomStatus, '');
    showStatus(deleteAllStatus, '');
    showStatus(taskStatus, '');
  });

  renderCollections();
  renderRandomCollections();
  randomPlayerButton.disabled = true;
  fragmentCatalogRequest({ action: 'list' }).then((savedCollections) => {
    mergeCollections(savedCollections);
    renderCollections();
  }).catch((error) => {
    showStatus(catalogStatus, `Сохранённый список из базы недоступен: ${error.message}`, true);
  });
})();
