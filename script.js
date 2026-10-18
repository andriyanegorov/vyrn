const navItems = [...document.querySelectorAll('.nav-button')];
const keyboardFocusKeys = new Set(['Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ']);
document.addEventListener('pointerdown', () => {
	document.documentElement.classList.add('has-pointer-focus');
}, true);
document.addEventListener('keydown', (event) => {
	if (keyboardFocusKeys.has(event.key)) {
		document.documentElement.classList.remove('has-pointer-focus');
	}
}, true);

const navButtons = navItems.filter((item) => item.tagName === 'BUTTON');
const bottomNav = document.querySelector('.bottom-nav');
const navIndicator = document.querySelector('.nav-indicator');
let activeItem = document.querySelector('.nav-button.is-active');
const telegramWebApp = window.Telegram?.WebApp;
const telegramUserStorageKey = 'vyrn.telegram.user.v1';
const getTelegramUser = () => {
	let telegramUser = telegramWebApp?.initDataUnsafe?.user;
	if (!telegramUser) {
		try {
			const userData = new URLSearchParams(telegramWebApp?.initData || '').get('user');
			telegramUser = userData ? JSON.parse(userData) : null;
		} catch {
			telegramUser = null;
		}
	}
	if (telegramUser) {
		try {
			sessionStorage.setItem(telegramUserStorageKey, JSON.stringify(telegramUser));
		} catch {
		}
		return telegramUser;
	}
	try {
		const storedUser = JSON.parse(sessionStorage.getItem(telegramUserStorageKey) || 'null');
		return storedUser && typeof storedUser.first_name === 'string' ? storedUser : null;
	} catch {
		return null;
	}
};
telegramWebApp?.ready();
getTelegramUser();
const canUseSupabaseAccount = () => window.VyrnApi?.isConfigured
	&& (Boolean(getTelegramUser()) || window.VyrnApi.browserDemo);
const canLoadPlayerData = () => canUseSupabaseAccount()
	|| (window.VyrnApi?.isConfigured && window.VyrnApi.browserDemo);

const renderWalletBalance = (wallets = []) => {
	const stars = wallets.find((wallet) => wallet.currency === 'stars');
	if (!stars) return;
	document.querySelectorAll('.star-balance').forEach((balanceElement) => {
		const balanceLabel = balanceElement.querySelector('span');
		if (!balanceLabel) return;
		balanceLabel.textContent = Number(stars.balance).toLocaleString('ru-RU');
		balanceElement.setAttribute('aria-label', `Баланс: ${balanceLabel.textContent} звёзд`);
	});
};

window.refreshVyrnAccount = async () => {
	const result = await window.VyrnApi.me();
	renderWalletBalance(result.wallets);
	return result;
};
if (canUseSupabaseAccount() || (window.VyrnApi?.isConfigured && window.VyrnApi.browserDemo)) {
	window.VyrnAccountPromise = window.refreshVyrnAccount().catch((error) => {
		console.error('Не удалось загрузить аккаунт VYRN:', error);
		return null;
	});
}

{
	const profileEditButton = document.querySelector('.profile-page:not(.player-profile-page) .profile-edit-button');
const profileContentElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-content');
const profileAvatarElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-avatar');
const profileNameElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-name');
const profileEditorDialog = document.querySelector('.profile-editor-dialog');
const profileEditorForm = profileEditorDialog?.querySelector('.profile-editor-form');
const profileEditorPhotoImage = profileEditorForm?.querySelector('.profile-editor-avatar-image');
const profileEditorError = profileEditorForm?.querySelector('.profile-editor-error');
const profileEditorBirthdayValue = profileEditorForm?.querySelector('.profile-editor-birthday-value');
const profileAvatarImage = profileAvatarElement?.querySelector('.profile-avatar-image');
const profileDetailValues = profileContentElement ? [...profileContentElement.querySelectorAll('.profile-detail-value')] : [];

if (profileEditButton && profileEditorDialog && profileEditorForm && profileAvatarElement && profileNameElement && profileDetailValues.length >= 2) {
	const telegramUser = getTelegramUser();
	if (!telegramUser && window.VyrnApi?.browserDemo) {
		profileEditButton.disabled = true;
		profileEditButton.title = 'Браузерный демо-профиль доступен только для просмотра.';
	}
	const storedName = profileNameElement.textContent.trim().split(/\s+/);
	const defaultProfile = {
		firstName: telegramUser?.first_name || storedName[0] || '',
		lastName: telegramUser ? telegramUser.last_name || '' : storedName.slice(1).join(' '),
		about: profileDetailValues[1].textContent.trim(),
		username: telegramUser?.username ? `@${telegramUser.username}` : profileDetailValues[0].textContent.trim(),
		birthday: '',
		phone: '',
		avatar: telegramUser?.photo_url || ''
	};
	let profileData = defaultProfile;
	let storedProfile;
	try {
		storedProfile = JSON.parse(localStorage.getItem('vyrn.profile.editor.v1'));
		if (storedProfile && typeof storedProfile === 'object') {
			profileData = { ...defaultProfile, ...storedProfile };
		}
	} catch {
		profileData = defaultProfile;
	}
	const isLegacyPlaceholder = storedProfile?.nameIsCustom === true
		&& profileData.firstName.trim().toLocaleLowerCase('ru-RU') === 'vyrn'
		&& !profileData.lastName.trim();
	if (isLegacyPlaceholder) {
		profileData.firstName = defaultProfile.firstName;
		profileData.lastName = defaultProfile.lastName;
		profileData.avatar = defaultProfile.avatar;
		storedProfile = {
			...storedProfile,
			firstName: profileData.firstName,
			lastName: profileData.lastName,
			nameIsCustom: false,
			avatar: profileData.avatar
		};
		try {
			localStorage.setItem('vyrn.profile.editor.v1', JSON.stringify(storedProfile));
		} catch {
		}
	}
	if (telegramUser) {
		const hasCustomName = !isLegacyPlaceholder && (storedProfile?.nameIsCustom ?? (
			profileData.firstName !== defaultProfile.firstName
			|| profileData.lastName !== defaultProfile.lastName
		));
		if (!hasCustomName) {
			profileData.firstName = defaultProfile.firstName;
			profileData.lastName = defaultProfile.lastName;
		}
		if (!profileData.username || profileData.username === profileDetailValues[0].textContent.trim()) {
			profileData.username = defaultProfile.username;
		}
		profileData.avatar = telegramUser.photo_url || '';
	}

	const setAvatarImage = (image, source) => {
		if (source) {
			image.onerror = () => {
				image.hidden = true;
			};
			image.src = source;
			image.hidden = false;
		} else {
			image.onerror = null;
			image.removeAttribute('src');
			image.hidden = true;
		}
	};
	const formatBirthday = (value) => {
		if (!value) {
			return 'Добавить';
		}

		return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
			.format(new Date(`${value}T00:00:00`))
			.replace(/\.$/, '');
	};

	const renderProfile = () => {
		profileNameElement.textContent = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ');
		profileDetailValues[0].textContent = profileData.username || (profileData.nickname ? `@${profileData.nickname}` : '');
		profileDetailValues[1].textContent = profileData.about || '';
		setAvatarImage(profileAvatarImage, profileData.avatar);
	};
	const syncProfileFromServer = async () => {
		if (!window.VyrnApi || (!telegramUser && !window.VyrnApi.browserDemo)) return;
		try {
			const result = await (window.VyrnAccountPromise || window.refreshVyrnAccount());
			if (!result) throw new Error('Не удалось загрузить профиль с сервера.');
			const profile = result.profile;
			profileData = {
				...profileData,
				firstName: profile.first_name || profile.nickname || '',
				lastName: profile.last_name || '',
				username: profile.username ? `@${profile.username}` : '',
				nickname: profile.nickname,
				about: profile.bio || '',
				birthday: profile.birthday || '',
				phone: profile.phone || '',
				avatar: profile.avatar_url || ''
			};
			renderProfile();
		} catch (error) {
			profileEditorError.textContent = error.message;
		}
	};

	const loadProfileEditor = () => {
		for (const field of profileEditorForm.elements) {
			if (field.name && Object.hasOwn(profileData, field.name)) {
				if (field.type === 'checkbox') {
					field.checked = Boolean(profileData[field.name]);
				} else {
					field.value = String(profileData[field.name] ?? '');
				}
			}
		}
		profileEditorBirthdayValue.textContent = formatBirthday(profileData.birthday);
		profileEditorError.hidden = true;
		setAvatarImage(profileEditorPhotoImage, profileData.avatar);
	};

	renderProfile();
	syncProfileFromServer();
	profileEditButton.addEventListener('click', () => {
		loadProfileEditor();
		profileEditorDialog.showModal();
		profileEditorForm.elements.namedItem('firstName').focus();
	});
	profileEditorForm.querySelector('.profile-editor-cancel').addEventListener('click', () => profileEditorDialog.close());
	profileEditorForm.elements.namedItem('birthday').addEventListener('input', (event) => {
		profileEditorBirthdayValue.textContent = formatBirthday(event.target.value);
	});
	profileEditorForm.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (!profileEditorForm.reportValidity()) {
			return;
		}

		const username = profileEditorForm.elements.namedItem('username').value.trim().replace(/^@+/, '');
		const firstName = profileEditorForm.elements.namedItem('firstName').value.trim();
		const lastName = profileEditorForm.elements.namedItem('lastName').value.trim();
		const nextProfile = {
			firstName,
			lastName,
			nameIsCustom: telegramUser
				? firstName !== defaultProfile.firstName || lastName !== defaultProfile.lastName
				: firstName !== storedName[0] || lastName !== storedName.slice(1).join(' '),
			about: profileEditorForm.elements.namedItem('about').value.trim(),
			username: username ? `@${username}` : '',
			birthday: profileEditorForm.elements.namedItem('birthday').value,
			phone: profileEditorForm.elements.namedItem('phone').value.trim(),
			avatar: profileData.avatar
		};
		if (!window.VyrnApi) {
			profileEditorError.textContent = 'Supabase API не подключён.';
			profileEditorError.hidden = false;
			return;
		}
		try {
			const result = await window.VyrnApi.updateProfile({
				first_name: nextProfile.firstName,
				last_name: nextProfile.lastName,
				bio: nextProfile.about,
				username: username || null,
				birthday: nextProfile.birthday || null,
				phone: nextProfile.phone || null
			});
			nextProfile.nickname = result.profile.nickname;
		} catch (error) {
			profileEditorError.textContent = error.message;
			profileEditorError.hidden = false;
			return;
		}

		profileData = nextProfile;
		renderProfile();
		profileEditorDialog.close();
	});
}
}

const nftCollection = [
	{ slug: 'algorithmcup', id: 64, name: 'Algorithm Cups', lastSaleTon: 5000 },
	{ slug: 'artisanbrick', id: 5821, name: 'Artisan Bricks', lastSaleTon: 588 },
	{ slug: 'astralshard', id: 5129, name: 'Astral Shards', lastSaleTon: 3222 },
	{ slug: 'bdaycandle', id: 220304, name: 'B-Day Candles', lastSaleTon: 99 },
	{ slug: 'berrybox', id: 444, name: 'Berry Boxes', lastSaleTon: 111 },
	{ slug: 'bigyear', id: 11599, name: 'Big Years', lastSaleTon: 1000 },
	{ slug: 'blingbinky', id: 1234, name: 'Bling Binkies', lastSaleTon: 250 },
	{ slug: 'bondedring', id: 1001, name: 'Bonded Rings', lastSaleTon: 3000 },
	{ slug: 'bowtie', id: 31485, name: 'Bow Ties', lastSaleTon: 333 },
	{ slug: 'bunnymuffin', id: 38, name: 'Bunny Muffins', lastSaleTon: 500 },
	{ slug: 'candycane', id: 49040, name: 'Candy Canes', lastSaleTon: 200 },
	{ slug: 'chillflame', id: 113221, name: 'Chill Flames', lastSaleTon: 133 },
	{ slug: 'cloverpin', id: 888, name: 'Clover Pins', lastSaleTon: 3333 },
	{ slug: 'cookieheart', id: 28888, name: 'Cookie Hearts', lastSaleTon: 300 },
	{ slug: 'crystalball', id: 7446, name: 'Crystal Balls', lastSaleTon: 230 },
	{ slug: 'cupidcharm', id: 3396, name: 'Cupid Charms', lastSaleTon: 730 },
	{ slug: 'deskcalendar', id: 111216, name: 'Desk Calendars', lastSaleTon: 1049 },
	{ slug: 'diamondring', id: 27070, name: 'Diamond Rings', lastSaleTon: 1050 },
	{ slug: 'durovscap', id: 1142, name: 'Durov’s Caps', lastSaleTon: 6555 },
	{ slug: 'durovsglasses', id: 1305, name: 'Durov’s Glasses', lastSaleTon: 555 },
	{ slug: 'easteregg', id: 103928, name: 'Easter Eggs', lastSaleTon: 525 },
	{ slug: 'electricskull', id: 8193, name: 'Electric Skulls', lastSaleTon: 479 },
	{ slug: 'eternalcandle', id: 6666, name: 'Eternal Candles', lastSaleTon: 388 },
	{ slug: 'eternalrose', id: 28435, name: 'Eternal Roses', lastSaleTon: 380 },
	{ slug: 'evileye', id: 7777, name: 'Evil Eyes', lastSaleTon: 777 },
	{ slug: 'faithamulet', id: 9494, name: 'Faith Amulets', lastSaleTon: 1111 },
	{ slug: 'finepen', id: 33333, name: 'Fine Pens', lastSaleTon: 233 },
	{ slug: 'flyingbroom', id: 22528, name: 'Flying Brooms', lastSaleTon: 150 },
	{ slug: 'freshsocks', id: 141858, name: 'Fresh Socks', lastSaleTon: 500 },
	{ slug: 'gemsignet', id: 76, name: 'Gem Signets', lastSaleTon: 800 }
];

const getNftPreviewUrl = (slug, id) => `https://nft.fragment.com/gift/${slug}-${id}.webp?fresh=${Date.now()}`;
const getNftAnimationUrl = (fileName) => `https://nft.fragment.com/gift/${fileName}`;
const formatMarketPrice = (amount, currency) => {
	const value = Number(amount);
	return currency === 'ton'
		? (value / 1_000_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 9 })
		: value.toLocaleString('ru-RU');
};
const getProfileDisplayName = (profile) => [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.nickname || 'Игрок';
const mapOwnedNft = (item) => {
	const model = item.nft_models || {};
	const collection = model.nft_collections || {};
	const externalId = item.external_id || item.id.slice(0, 8);
	const collectionSlug = collection.slug || model.slug || '';
	return {
		itemId: item.id,
		slug: collectionSlug,
		id: externalId,
		name: model.name || collection.name || 'NFT',
		previewUrl: collectionSlug && item.external_id
			? getNftPreviewUrl(collectionSlug, externalId)
			: model.preview_url || '',
		animationUrl: collectionSlug && item.external_id
			? getNftAnimationUrl(`${collectionSlug}-${externalId}.tgs`)
			: model.animation_url || '',
		listingId: (item.market_listings || []).find((listing) => listing.status === 'active')?.id || '',
		isListed: (item.market_listings || []).some((listing) => listing.status === 'active')
	};
};
const createNftPreviewImage = (source, title, className) => {
	const image = document.createElement('img');
	image.className = className;
	image.src = source;
	image.alt = title;
	return image;
};

const collectionPreviewGrid = document.querySelector('.collection-preview-grid');
if (collectionPreviewGrid) {
	const collectionTotal = collectionPreviewGrid.closest('.collection-panel').querySelector('.collection-total');
	const renderCollectionPreview = (items) => {
		collectionTotal.textContent = `${items.length.toLocaleString('ru-RU')} NFT`;
		collectionPreviewGrid.replaceChildren();
		items.slice(0, 3).forEach((gift) => {
			const title = `${gift.name} #${gift.id}`;
			const imageSource = gift.previewUrl || getNftPreviewUrl(gift.slug, gift.id);
			const image = createNftPreviewImage(imageSource, title, 'collection-preview-image');
		image.loading = 'lazy';
		image.addEventListener('error', () => {
			image.src = './placeholder.png';
		}, { once: true });
		collectionPreviewGrid.append(image);
		});
	};
	if (canLoadPlayerData()) {
		window.VyrnApi.myNfts()
			.then(({ items }) => renderCollectionPreview(items.map(mapOwnedNft)))
			.catch(() => renderCollectionPreview([]));
	} else {
		renderCollectionPreview(nftCollection);
	}
}

const marketGrid = document.querySelector('.market-grid');
if (marketGrid) {
	const marketSearch = document.querySelector('.market-search-input');
	const marketCollectionFilter = document.querySelector('.market-collection-filter');
	const marketSort = document.querySelector('.market-sort');
	const marketEmpty = document.querySelector('.market-empty');
	const marketTradeButtons = [...document.querySelectorAll('.market-trade-button')];
	const marketTradeNav = document.querySelector('.market-trade-nav');
	const marketTradeIndicator = marketTradeNav.querySelector('.market-trade-indicator');
	const marketCards = [];
	let marketMode = 'all';
	const moveMarketIndicator = (button) => {
		const buttonBounds = button.getBoundingClientRect();
		const navBounds = marketTradeNav.getBoundingClientRect();
		marketTradeIndicator.style.left = `${buttonBounds.left - navBounds.left - marketTradeNav.clientLeft}px`;
		marketTradeIndicator.style.setProperty('--market-indicator-width', `${buttonBounds.width}px`);
	};
	moveMarketIndicator(marketTradeButtons.find((button) => button.classList.contains('is-active')));
	window.addEventListener('resize', () => moveMarketIndicator(marketTradeButtons.find((button) => button.classList.contains('is-active'))));

	nftCollection.forEach((gift) => {
		const title = `${gift.name} #${gift.id}`;
		const card = document.createElement('article');
		card.className = 'market-card';
		card.dataset.marketName = title.toLocaleLowerCase('ru-RU');
		card.dataset.marketCollection = gift.name;
		card.dataset.marketPrice = String(Math.round(gift.lastSaleTon * 100));
		card.dataset.marketAnimation = getNftAnimationUrl(`${gift.slug}-${gift.id}.tgs`);
		card.dataset.marketPreview = getNftPreviewUrl(gift.slug, gift.id);
		card.dataset.marketTitle = title;

		const imageFrame = document.createElement('div');
		imageFrame.className = 'market-card-image-frame';
		const image = createNftPreviewImage(getNftPreviewUrl(gift.slug, gift.id), title, 'market-card-image');
		image.loading = 'lazy';
		imageFrame.append(image);

		const content = document.createElement('div');
		content.className = 'market-card-content';
		const heading = document.createElement('div');
		heading.className = 'market-card-heading';
		const name = document.createElement('h2');
		name.className = 'market-card-name';
		name.textContent = title;
		heading.append(name);

		const price = document.createElement('div');
		price.className = 'market-card-price';
		const priceStars = Math.round(gift.lastSaleTon * 100);
		const label = document.createElement('span');
		label.className = 'market-card-price-label';
		label.textContent = 'Последняя продажа';
		const value = document.createElement('span');
		value.className = 'market-card-price-value';
		value.textContent = priceStars.toLocaleString('ru-RU');
		const icon = document.createElement('img');
		icon.src = 'stars.png';
		icon.alt = '';
		icon.setAttribute('aria-hidden', 'true');
		price.append(label, value, icon);
		content.append(heading, price);
		card.append(imageFrame, content);
		marketCards.push(card);
		marketCollectionFilter.add(new Option(gift.name, gift.name));
	});

	let marketRequestId = 0;
	const renderMarketList = async () => {
		if (canUseSupabaseAccount()) {
			const requestId = ++marketRequestId;
			try {
				const result = await window.VyrnApi.market(marketMode);
				if (requestId !== marketRequestId) return;
				const remoteCards = result.items.map((entry) => {
					const nft = entry.nft_items || {};
					const model = nft.nft_models || {};
					const collectionInfo = model.nft_collections || {};
					const itemId = nft.external_id || nft.id || entry.nft_item_id;
					const title = `${model.name || 'NFT'} #${itemId}`;
					const imageSource = collectionInfo.slug && nft.external_id
						? getNftPreviewUrl(collectionInfo.slug, nft.external_id)
						: model.preview_url || (model.slug && itemId ? getNftPreviewUrl(model.slug, itemId) : './placeholder.png');
					const card = document.createElement('article');
					card.className = 'market-card';
					card.dataset.marketName = title.toLocaleLowerCase('ru-RU');
					card.dataset.marketCollection = model.name || collectionInfo.name || '';
					card.dataset.marketPrice = String(entry.price || 0);
					card.dataset.marketAnimation = collectionInfo.slug && nft.external_id
						? getNftAnimationUrl(`${collectionInfo.slug}-${nft.external_id}.tgs`)
						: model.animation_url || '';
					card.dataset.marketPreview = imageSource;
					card.dataset.marketTitle = title;

					const imageFrame = document.createElement('div');
					imageFrame.className = 'market-card-image-frame';
					const image = createNftPreviewImage(imageSource, title, 'market-card-image');
					image.loading = 'lazy';
					image.addEventListener('error', () => { image.src = './placeholder.png'; }, { once: true });
					imageFrame.append(image);

					const content = document.createElement('div');
					content.className = 'market-card-content';
					const heading = document.createElement('div');
					heading.className = 'market-card-heading';
					const name = document.createElement('h2');
					name.className = 'market-card-name';
					name.textContent = title;
					heading.append(name);
					const price = document.createElement('div');
					price.className = 'market-card-price';
					const label = document.createElement('span');
					label.className = 'market-card-price-label';
					label.textContent = marketMode === 'purchases' ? 'Куплено' : 'Цена';
					const value = document.createElement('span');
					value.className = 'market-card-price-value';
					value.textContent = formatMarketPrice(entry.price || 0, entry.currency);
					const currency = document.createElement('span');
					currency.className = 'market-card-currency';
					currency.textContent = entry.currency === 'ton' ? 'TON' : '★';
					price.append(label, value, currency);
					content.append(heading, price);
					const seller = entry.seller;
					if (seller) {
						const sellerLabel = document.createElement('p');
						sellerLabel.className = 'market-card-seller';
						sellerLabel.textContent = `Продавец: ${getProfileDisplayName(seller)}`;
						content.append(sellerLabel);
					}

					if (marketMode !== 'purchases') {
						const action = document.createElement('button');
						action.className = 'market-listing-action';
						action.type = 'button';
						const ownListing = marketMode === 'sales' || entry.seller_profile_id === result.current_profile_id;
						action.textContent = ownListing ? 'Снять с продажи' : 'Купить';
						action.addEventListener('click', async () => {
							action.disabled = true;
							try {
								if (ownListing) {
									await window.VyrnApi.cancelListing(entry.id);
								} else {
									if (!window.confirm(`Купить ${title} за ${value.textContent} ${currency.textContent}?`)) return;
									await window.VyrnApi.buyListing(entry.id);
									await window.refreshVyrnAccount();
								}
								await renderMarketList();
							} catch (error) {
								window.alert(error.message);
							} finally {
								action.disabled = false;
							}
						});
						content.append(action);
					}
					card.append(imageFrame, content);
					return card;
				});
				const query = marketSearch.value.trim().toLocaleLowerCase('ru-RU');
				const collection = marketCollectionFilter.value;
				const visibleCards = remoteCards.filter((card) => {
					return (!query || card.dataset.marketName.includes(query))
						&& (!collection || card.dataset.marketCollection === collection);
				});
				if (marketSort.value === 'price-asc' || marketSort.value === 'price-desc') {
					const direction = marketSort.value === 'price-asc' ? 1 : -1;
					visibleCards.sort((first, second) => (Number(first.dataset.marketPrice) - Number(second.dataset.marketPrice)) * direction);
				} else {
					visibleCards.sort((first, second) => first.dataset.marketName.localeCompare(second.dataset.marketName, 'ru'));
				}
				marketGrid.replaceChildren(...visibleCards);
				marketEmpty.textContent = marketMode === 'sales'
					? 'У вас пока нет объявлений о продаже'
					: marketMode === 'purchases' ? 'Покупок пока нет' : 'Ничего не найдено';
				marketEmpty.hidden = visibleCards.length > 0;
				return;
			} catch (error) {
				if (requestId !== marketRequestId) return;
				marketGrid.replaceChildren();
				marketEmpty.textContent = error.message;
				marketEmpty.hidden = false;
				return;
			}
		}
		const query = marketSearch.value.trim().toLocaleLowerCase('ru-RU');
		const collection = marketCollectionFilter.value;
		const visibleCards = marketMode === 'all' ? marketCards.filter((card) => {
			const matchesQuery = !query || card.dataset.marketName.includes(query);
			const matchesCollection = !collection || card.dataset.marketCollection === collection;
			return matchesQuery && matchesCollection;
		}) : [];
		if (marketSort.value === 'price-asc' || marketSort.value === 'price-desc') {
			const direction = marketSort.value === 'price-asc' ? 1 : -1;
			visibleCards.sort((first, second) => {
				const firstPrice = Number(first.dataset.marketPrice) || Number.POSITIVE_INFINITY;
				const secondPrice = Number(second.dataset.marketPrice) || Number.POSITIVE_INFINITY;
				return (firstPrice - secondPrice) * direction;
			});
		} else {
			visibleCards.sort((first, second) => first.dataset.marketName.localeCompare(second.dataset.marketName, 'ru'));
		}

		marketGrid.replaceChildren(...visibleCards);
		marketEmpty.textContent = marketMode === 'sales'
			? 'У вас пока нет объявлений о продаже'
			: marketMode === 'purchases'
				? 'Покупок пока нет'
				: 'Ничего не найдено';
		marketEmpty.hidden = visibleCards.length > 0;
	};

	marketSearch.addEventListener('input', renderMarketList);
	marketCollectionFilter.addEventListener('change', renderMarketList);
	marketSort.addEventListener('change', renderMarketList);
	marketTradeButtons.forEach((button) => {
		button.addEventListener('click', () => {
			marketMode = button.dataset.marketMode;
			marketTradeButtons.forEach((item) => {
				const active = item === button;
				item.classList.toggle('is-active', active);
				item.setAttribute('aria-pressed', String(active));
			});
			moveMarketIndicator(button);
			renderMarketList();
		});
	});
	renderMarketList();
}

	const loadTgsData = async (source) => {
	const response = await fetch(source, { cache: 'no-store' });
	if (!response.ok) {
		throw new Error(`NFT request failed: ${response.status}`);
	}

	return new Response(
		response.body.pipeThrough(new DecompressionStream('gzip'))
	).json();
};

const createTgsPreview = async (container, source) => {
	if (!window.lottie || typeof DecompressionStream === 'undefined') {
		throw new Error('TGS animation is not supported in this browser.');
	}

	const animationData = await loadTgsData(source);
	if (!container.isConnected) {
		return;
	}

	const animation = window.lottie.loadAnimation({
		container,
		renderer: 'svg',
		loop: false,
		autoplay: false,
		animationData
	});
	animation.goToAndStop(0, true);
	animation.addEventListener('DOMLoaded', () => animation.goToAndStop(0, true));
	return animation;
};

if (marketGrid) {
	marketGrid.addEventListener('click', async (event) => {
		const card = event.target.closest('.market-card');
		if (!card || event.target.closest('.market-listing-action')) return;

		const source = card.dataset.marketAnimation;
		const frame = card.querySelector('.market-card-image-frame');
		if (!source || !frame || !window.lottie) return;

		const requestId = (card.marketAnimationRequestId || 0) + 1;
		card.marketAnimationRequestId = requestId;
		card.marketAnimation?.destroy();
		frame.querySelectorAll('.market-card-animation').forEach((animationHost) => animationHost.remove());
		const preview = frame.querySelector('.market-card-image');
		preview?.classList.remove('is-covered');
		const host = document.createElement('div');
		host.className = 'market-card-animation';
		frame.append(host);

		try {
			const animationData = await loadTgsData(source);
			if (requestId !== card.marketAnimationRequestId || !card.isConnected) {
				host.remove();
				return;
			}

			const animation = window.lottie.loadAnimation({
				container: host,
				renderer: 'svg',
				loop: false,
				autoplay: true,
				animationData
			});
			card.marketAnimation = animation;
			animation.addEventListener('DOMLoaded', () => {
				if (requestId !== card.marketAnimationRequestId) return;
				preview?.classList.add('is-covered');
				host.classList.add('is-ready');
			});
			animation.addEventListener('complete', () => {
				if (requestId !== card.marketAnimationRequestId) return;
				animation.destroy();
				card.marketAnimation = null;
				host.remove();
				preview?.classList.remove('is-covered');
			});
		} catch {
			if (requestId !== card.marketAnimationRequestId) return;
			host.remove();
			preview?.classList.remove('is-covered');
		}
	});
}

const nftGrid = document.querySelector('.profile-page:not(.player-profile-page) .profile-nft-grid');
let profileNftView = 'nft';
let filterProfileNftCards = () => {};
if (nftGrid) {
	const startedNftCards = new WeakSet();
	const renderNftCard = (gift) => {
		const title = `${gift.name} #${gift.id}`;
		const file = gift.slug ? `${gift.slug}-${gift.id}.tgs` : '';
		const source = gift.animationUrl || (file ? getNftAnimationUrl(file) : '');
		const card = document.createElement('button');
		card.className = 'profile-nft-cell';
		card.type = 'button';
		card.dataset.nftItemId = gift.itemId || '';
		card.dataset.nftListed = String(Boolean(gift.isListed));
		card.dataset.nftListingId = gift.listingId || '';
		card.dataset.nftSrc = source;
		card.dataset.nftLink = file ? `https://nft.fragment.com/gift/${file}` : '';
		card.dataset.nftPreview = gift.previewUrl || (gift.slug ? getNftPreviewUrl(gift.slug, gift.id) : './placeholder.png');
		card.dataset.nftTitle = title;
		card.dataset.nftModel = gift.name;
		card.dataset.nftFile = file;
		card.setAttribute('aria-label', `Открыть ${title}`);

		const animationHost = document.createElement('div');
		animationHost.className = 'profile-nft-animation is-loading';
		animationHost.setAttribute('aria-hidden', 'true');
		card.append(animationHost);
		nftGrid.append(card);
		return card;
	};

	const loadNftCard = async (card) => {
		const animationHost = card.querySelector('.profile-nft-animation');
		try {
			await createTgsPreview(animationHost, card.dataset.nftSrc);
			animationHost.classList.remove('is-loading');
		} catch {
			animationHost.classList.remove('is-loading');
			animationHost.classList.add('has-nft-preview');
			animationHost.replaceChildren(createNftPreviewImage(
				card.dataset.nftPreview,
				card.dataset.nftTitle,
				'profile-nft-preview'
			));
		}
	};
	let cards = [];
	filterProfileNftCards = () => {
		cards.forEach((card) => {
			card.hidden = profileNftView === 'sales' && card.dataset.nftListed !== 'true';
		});
	};
	const updateVisibleNftCards = () => {
		const viewportHeight = window.innerHeight;
		cards.forEach((card) => {
			const rect = card.getBoundingClientRect();
			const isNearViewport = rect.bottom >= -120 && rect.top <= viewportHeight + 120;
			if (isNearViewport && !startedNftCards.has(card)) {
				startedNftCards.add(card);
				loadNftCard(card);
			}
		});
	};

	window.addEventListener('scroll', updateVisibleNftCards, { passive: true });
	window.addEventListener('resize', updateVisibleNftCards);
	if (canLoadPlayerData()) {
		window.VyrnApi.myNfts().then(({ items }) => {
			nftGrid.replaceChildren();
			cards = items.map((item) => renderNftCard(mapOwnedNft(item)));
			filterProfileNftCards();
			updateVisibleNftCards();
		}).catch(() => {
			nftGrid.replaceChildren();
			cards = [];
		});
	}
	updateVisibleNftCards();
}

const profileNftTabs = document.querySelector('.profile-nft-tabs');
if (profileNftTabs) {
	const profileNftButtons = [...profileNftTabs.querySelectorAll('.profile-nft-button')];
	const profileNftIndicator = profileNftTabs.querySelector('.profile-nft-indicator');
	const moveProfileNftIndicator = (button) => {
		profileNftIndicator.style.left = `${button.offsetLeft}px`;
		profileNftIndicator.style.setProperty('--profile-nft-indicator-width', `${button.offsetWidth}px`);
	};
	moveProfileNftIndicator(profileNftButtons.find((button) => button.classList.contains('is-active')));
	profileNftButtons.forEach((button) => {
		button.addEventListener('click', () => {
			profileNftButtons.forEach((tab) => {
				const isActive = tab === button;
				tab.classList.toggle('is-active', isActive);
				tab.setAttribute('aria-pressed', String(isActive));
			});
			moveProfileNftIndicator(button);
			if (typeof filterProfileNftCards === 'function') {
				profileNftView = button.dataset.profileView;
				filterProfileNftCards();
			}
		});
	});
}

const nftGrids = [...document.querySelectorAll('.profile-nft-grid')];
const nftModal = document.querySelector('.nft-modal');
const nftModalAnimation = document.querySelector('.nft-modal-animation');
const nftModalBackdrop = document.querySelector('.nft-modal-backdrop');
if (nftGrids.length && nftModal && nftModalAnimation && nftModalBackdrop) {
	const nftModalArt = nftModal.querySelector('.nft-modal-art');
	const nftModalTitle = nftModal.querySelector('#nft-modal-title');
	const nftModalOwner = nftModal.querySelector('.nft-modal-owner');
	const nftModalModel = nftModal.querySelector('.nft-modal-model');
	const nftModalPrice = nftModal.querySelector('.nft-modal-price');
	const nftMarketControls = nftModal.querySelector('.nft-modal-market-controls');
	const nftListingPrice = nftModal.querySelector('.nft-modal-listing-price');
	const nftListingCurrency = nftModal.querySelector('.nft-modal-listing-currency');
	const nftListButton = nftModal.querySelector('.nft-modal-list-button');
	const nftUnlistButton = nftModal.querySelector('.nft-modal-unlist-button');
	let activeNftCard;
	let activeNftAnimation;
	let activeNftBackdrop;
	let animationRequestId = 0;

	const clearNftAnimation = () => {
		animationRequestId++;
		nftModalPrice.textContent = '—';
		activeNftAnimation?.destroy();
		activeNftAnimation = null;
		activeNftBackdrop?.destroy();
		activeNftBackdrop = null;
		nftModalAnimation.replaceChildren();
		nftModalAnimation.hidden = true;
		nftModalAnimation.classList.remove('is-ready');
		nftModalArt.classList.remove('is-ready');
		nftModalBackdrop.replaceChildren();
		nftModalBackdrop.hidden = true;
		nftModalBackdrop.classList.remove('is-ready');
	};

	const createNftGiftOverlayData = (animationData) => {
		const overlayData = structuredClone(animationData);
		const giftLayer = overlayData.layers.find((layer) => layer.nm === 'Gift');
		if (!giftLayer) {
			return overlayData;
		}

		const scaleData = giftLayer.ks?.s?.k;
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

		overlayData.layers = [giftLayer];
		return overlayData;
	};

	const loadNftPrice = (fileName = '') => {
		const giftId = fileName.replace(/\.tgs$/, '');
		const gift = nftCollection.find((item) => `${item.slug}-${item.id}` === giftId);
		if (!gift) {
			nftModalPrice.textContent = 'Нет данных';
			return;
		}

		const priceValue = document.createElement('span');
		priceValue.textContent = Math.round(gift.lastSaleTon * 100).toLocaleString('ru-RU');
		const currencyIcon = document.createElement('img');
		currencyIcon.className = 'nft-modal-price-icon';
		currencyIcon.src = 'stars.png';
		currencyIcon.alt = '';
		currencyIcon.setAttribute('aria-hidden', 'true');
		nftModalPrice.replaceChildren(priceValue, currencyIcon);
	};

	const createNftBackdropData = (animationData) => {
		const backdropData = structuredClone(animationData);
		backdropData.layers = backdropData.layers.filter((layer) => layer.nm !== 'Gift');
		return backdropData;
	};

	const setNftArtAspectRatio = (container) => {
		container.querySelector('svg')?.setAttribute('preserveAspectRatio', 'xMidYMid slice');
	};

	const loadModalAnimation = async (source, preview, title) => {
		const requestId = animationRequestId;
		nftModalAnimation.hidden = false;
		nftModalAnimation.replaceChildren();
		try {
			const animationData = await loadTgsData(source);
			if (requestId !== animationRequestId || !nftModal.open) {
				return;
			}

			let loadedLayers = 0;
			const revealAnimation = () => {
				loadedLayers++;
				if (loadedLayers === 2 && requestId === animationRequestId) {
					nftModalBackdrop.classList.add('is-ready');
					nftModalAnimation.classList.add('is-ready');
					nftModalArt.classList.add('is-ready');
				}
			};

			nftModalBackdrop.replaceChildren();
			nftModalBackdrop.hidden = false;
			activeNftBackdrop = window.lottie.loadAnimation({
				container: nftModalBackdrop,
				renderer: 'svg',
				loop: false,
				autoplay: false,
				animationData: createNftBackdropData(animationData)
			});
			activeNftBackdrop.goToAndStop(0, true);
			activeNftBackdrop.addEventListener('DOMLoaded', () => {
				setNftArtAspectRatio(nftModalBackdrop);
				activeNftBackdrop?.goToAndStop(0, true);
				revealAnimation();
			});

			nftModalAnimation.replaceChildren();
			activeNftAnimation = window.lottie.loadAnimation({
				container: nftModalAnimation,
				renderer: 'svg',
				loop: false,
				autoplay: true,
				animationData: createNftGiftOverlayData(animationData)
			});
			activeNftAnimation.addEventListener('DOMLoaded', () => {
				setNftArtAspectRatio(nftModalAnimation);
				revealAnimation();
			});
		} catch {
			if (requestId === animationRequestId) {
				nftModalAnimation.replaceChildren(createNftPreviewImage(preview, title, 'nft-modal-preview'));
				nftModalBackdrop.replaceChildren(createNftPreviewImage(preview, title, 'nft-modal-backdrop-preview'));
				nftModalBackdrop.hidden = false;
				nftModalBackdrop.classList.add('is-ready');
				nftModalAnimation.classList.add('is-ready');
				nftModalArt.classList.add('is-ready');
			}
		}
	};

	window.openVyrnNftModal = ({ card = null, title, model, source, preview, file = '', owner = '' }) => {
		nftModalTitle.textContent = title;
		activeNftCard = card;
		nftModalOwner.textContent = owner || card?.closest('.profile-page')?.querySelector('.profile-name')?.textContent.trim() || '';
		nftModalModel.textContent = model;
		if (nftMarketControls) {
			const hasOwnedItem = Boolean(card?.dataset.nftItemId);
			const isListed = card?.dataset.nftListed === 'true';
			nftMarketControls.hidden = !hasOwnedItem;
			if (nftListButton) nftListButton.hidden = isListed;
			if (nftUnlistButton) nftUnlistButton.hidden = !isListed;
		}
		clearNftAnimation();
		nftModal.showModal();
		nftModal.querySelector('.nft-modal-close').focus();
		loadModalAnimation(source, preview, title);
		loadNftPrice(file);
	};

	nftModalAnimation.addEventListener('click', (event) => {
		const target = event.target;
		const svg = target instanceof Element ? target.closest('svg') : null;
		if (svg && target !== svg) {
			activeNftAnimation?.goToAndPlay(0, true);
		}
	});

	nftGrids.forEach((grid) => {
		grid.addEventListener('click', (event) => {
			const nftCard = event.target.closest('.profile-nft-cell');
			if (!nftCard) {
				return;
			}

			if (nftCard.tagName === 'A') {
				event.preventDefault();
			}

			window.openVyrnNftModal({
				card: nftCard,
				title: nftCard.dataset.nftTitle,
				model: nftCard.dataset.nftModel,
				source: nftCard.dataset.nftSrc,
				preview: nftCard.dataset.nftPreview,
				file: nftCard.dataset.nftFile
			});
		});
	});

	if (nftMarketControls && nftListButton && nftUnlistButton) {
		nftListButton.addEventListener('click', async () => {
			const enteredPrice = Number(nftListingPrice.value);
			const price = nftListingCurrency.value === 'ton' ? Math.round(enteredPrice * 1_000_000_000) : enteredPrice;
			if (!activeNftCard?.dataset.nftItemId || !Number.isSafeInteger(price) || price <= 0) {
				nftListingPrice.focus();
				return;
			}
			nftListButton.disabled = true;
			try {
				const result = await window.VyrnApi.createListing(activeNftCard.dataset.nftItemId, price, nftListingCurrency.value);
				activeNftCard.dataset.nftListed = 'true';
				activeNftCard.dataset.nftListingId = result.listing.id;
				nftListButton.hidden = true;
				nftUnlistButton.hidden = false;
				filterProfileNftCards();
			} catch (error) {
				window.alert(error.message);
			} finally {
				nftListButton.disabled = false;
			}
		});
		nftUnlistButton.addEventListener('click', async () => {
			if (!activeNftCard?.dataset.nftListingId) return;
			nftUnlistButton.disabled = true;
			try {
				await window.VyrnApi.cancelListing(activeNftCard.dataset.nftListingId);
				activeNftCard.dataset.nftListed = 'false';
				activeNftCard.dataset.nftListingId = '';
				nftListButton.hidden = false;
				nftUnlistButton.hidden = true;
				filterProfileNftCards();
			} catch (error) {
				window.alert(error.message);
			} finally {
				nftUnlistButton.disabled = false;
			}
		});
	}

	const closeNftModal = () => nftModal.close();
	nftModal.querySelector('.nft-modal-close').addEventListener('click', closeNftModal);
	nftModal.querySelector('.nft-modal-confirm').addEventListener('click', closeNftModal);
	nftModal.addEventListener('click', (event) => {
		if (event.target === nftModal) {
			closeNftModal();
		}
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && nftModal.open) {
			event.preventDefault();
			closeNftModal();
		}
	});
	nftModal.addEventListener('close', () => {
		clearNftAnimation();
		activeNftCard = undefined;
	});
}

const moveIndicator = (button, animate) => {
	const buttonRect = button.getBoundingClientRect();
	const navRect = bottomNav.getBoundingClientRect();
	const inset = 4;
	const left = buttonRect.left - navRect.left - bottomNav.clientLeft + inset;
	navIndicator.style.left = `${left}px`;
	navIndicator.style.setProperty('--indicator-width', `${buttonRect.width - inset * 2}px`);

	if (animate) {
		navIndicator.classList.remove('is-moving');
		void navIndicator.offsetWidth;
		navIndicator.classList.add('is-moving');
	}
};

const activateNavItem = (item) => {
	navItems.forEach((navItem) => {
		const isActive = navItem === item;
		navItem.classList.toggle('is-active', isActive);

		if (navItem.tagName === 'BUTTON') {
			navItem.setAttribute('aria-pressed', String(isActive));
		} else if (isActive) {
			navItem.setAttribute('aria-current', 'page');
		} else {
			navItem.removeAttribute('aria-current');
		}
	});

	activeItem = item;
	moveIndicator(item, true);
};

bottomNav.classList.add('is-initializing');
moveIndicator(activeItem, false);
requestAnimationFrame(() => {
	requestAnimationFrame(() => bottomNav.classList.remove('is-initializing'));
});
window.addEventListener('resize', () => moveIndicator(activeItem, false));

navButtons.forEach((button) => {
	button.addEventListener('click', () => {
		if (button === activeItem) {
			return;
		}

		activateNavItem(button);
	});
});

navItems.filter((item) => item.tagName === 'A').forEach((link) => {
	link.addEventListener('click', (event) => {
		const destination = new URL(link.href, window.location.href);
		if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) {
			return;
		}

		event.preventDefault();
		activateNavItem(link);
		bottomNav.classList.add('is-route-transitioning');

		const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 240 : 320;
		window.setTimeout(() => window.location.assign(destination.href), duration);
	});
});

let chatRows = [...document.querySelectorAll('.chat-row')];
let addRemoteChatRow;
const conversationDialog = document.querySelector('.conversation-dialog');
const chatsPage = document.querySelector('.chats-page');
const chatsSearchInput = chatsPage?.querySelector('.chats-search-input');
const chatsProfileResults = chatsPage?.querySelector('.chats-profile-results');
const chatsProfileError = chatsPage?.querySelector('.chats-profile-error');
const chatsSearchClear = chatsPage?.querySelector('.chats-search-clear');
const chatsProfileResultList = chatsPage?.querySelector('.chats-profile-result-list');

if (chatsPage && chatsSearchInput) {
	let pullStart = null;
	const filterChats = () => {
		const query = chatsSearchInput.value.trim().toLocaleLowerCase('ru-RU');
		document.querySelectorAll('.chat-row').forEach((row) => {
			const searchableText = `${row.querySelector('.chat-name').textContent} ${row.querySelector('.chat-message').textContent}`;
			row.hidden = Boolean(query) && !searchableText.toLocaleLowerCase('ru-RU').includes(query);
		});
	};
	const searchProfiles = async () => {
		const query = chatsSearchInput.value.trim();
		if (!chatsProfileResults || !chatsProfileResultList || !window.VyrnApi || query.length < 2) {
			if (chatsProfileResults) chatsProfileResults.hidden = true;
			return;
		}
		try {
			if (chatsProfileError) chatsProfileError.hidden = true;
			const result = await window.VyrnApi.createChat(query);
			chatsProfileResultList.replaceChildren();
			const row = document.createElement('button');
			row.type = 'button';
			row.className = 'chat-profile-result';
			const avatar = document.createElement('span');
			avatar.className = 'chat-profile-result-avatar';
			if (result.peer.avatar_url) {
				const image = document.createElement('img');
				image.src = result.peer.avatar_url;
				image.alt = '';
				avatar.append(image);
			} else {
				avatar.textContent = getProfileDisplayName(result.peer).slice(0, 1).toUpperCase();
			}
			const copy = document.createElement('span');
			copy.className = 'chat-profile-result-copy';
			const name = document.createElement('strong');
			name.textContent = getProfileDisplayName(result.peer);
			const username = document.createElement('span');
			username.textContent = result.peer.username ? `@${result.peer.username}` : 'Профиль игрока';
			copy.append(name, username);
			row.append(avatar, copy);
			row.addEventListener('click', () => {
				const chatRow = [...document.querySelectorAll('.chat-row')].find((item) => item.dataset.chatId === result.chat_id)
					|| addRemoteChatRow?.(result.chat_id, result.peer);
				if (!chatRow) return;
				chatsProfileResults.hidden = true;
				chatsSearchInput.value = '';
				chatRows = [...document.querySelectorAll('.chat-row')];
				chatRow.click();
			});
			chatsProfileResultList.append(row);
			chatsProfileResults.hidden = false;
		} catch (error) {
			chatsProfileResults.hidden = true;
			if (chatsProfileError) {
				chatsProfileError.textContent = error.message;
				chatsProfileError.hidden = false;
			}
		}
	};

	let profileSearchTimer;
	chatsSearchInput.addEventListener('input', () => {
		chatsPage.classList.toggle('is-searching', chatsSearchInput.value.trim().length > 0);
		filterChats();
		if (chatsSearchClear) chatsSearchClear.hidden = chatsSearchInput.value.length === 0;
		clearTimeout(profileSearchTimer);
		profileSearchTimer = setTimeout(searchProfiles, 300);
	});
	chatsSearchClear?.addEventListener('click', () => {
		clearTimeout(profileSearchTimer);
		chatsSearchInput.value = '';
		chatsSearchClear.hidden = true;
		chatsPage.classList.remove('is-searching', 'is-search-open');
		if (chatsProfileError) chatsProfileError.hidden = true;
		document.querySelectorAll('.chat-row').forEach((row) => { row.hidden = false; });
		if (chatsProfileResults) chatsProfileResults.hidden = true;
		chatsSearchInput.focus();
	});
	chatsSearchInput.addEventListener('focus', () => {
		chatsPage.classList.add('is-search-open');
		chatsPage.classList.toggle('is-searching', chatsSearchInput.value.trim().length > 0);
	});
	chatsSearchInput.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			chatsSearchInput.value = '';
			chatsPage.classList.remove('is-searching', 'is-search-open');
			filterChats();
			chatsPage.classList.remove('is-search-open');
		}
	});

	chatsPage.addEventListener('touchstart', (event) => {
		if (event.touches.length !== 1 || event.target.closest('.chats-search')) {
			pullStart = null;
			return;
		}

		const touch = event.touches[0];
		pullStart = { x: touch.clientX, y: touch.clientY, atTop: window.scrollY <= 0 };
	}, { passive: true });

	chatsPage.addEventListener('touchmove', (event) => {
		if (!pullStart || !pullStart.atTop || window.scrollY > 0 || event.touches.length !== 1) {
			return;
		}

		const touch = event.touches[0];
		const deltaY = touch.clientY - pullStart.y;
		const deltaX = touch.clientX - pullStart.x;
		if (deltaY > 10 && deltaY > Math.abs(deltaX)) {
			event.preventDefault();
		}
		if (deltaY >= 58 && deltaY > Math.abs(deltaX)) {
			chatsPage.classList.add('is-search-open');
			pullStart = null;
		}
	}, { passive: false });

	chatsPage.addEventListener('touchend', () => { pullStart = null; }, { passive: true });
	chatsPage.addEventListener('touchcancel', () => { pullStart = null; }, { passive: true });
}

if (chatRows.length && conversationDialog) {
	const conversationScreen = conversationDialog.querySelector('.conversation-screen');
	const conversationProfile = conversationDialog.querySelector('.conversation-profile');
	const conversationMessages = conversationDialog.querySelector('.conversation-messages');
	const conversationMessageList = conversationDialog.querySelector('.conversation-message-list');
	const conversationPeerName = conversationDialog.querySelector('.conversation-peer-name');
	const conversationPeerStatus = conversationDialog.querySelector('.conversation-peer-status');
	const conversationAvatarSlot = conversationDialog.querySelector('.conversation-avatar-slot');
	const conversationActions = conversationDialog.querySelector('.conversation-actions');
	const conversationGiftOpen = conversationDialog.querySelector('.conversation-gift-open');
	const giftPickerDialog = document.querySelector('.gift-picker-dialog');
	const giftPickerForm = giftPickerDialog?.querySelector('.gift-picker-form');
	const giftPickerRecipient = giftPickerDialog?.querySelector('.gift-picker-recipient');
	const giftPickerGrid = giftPickerDialog?.querySelector('.gift-picker-grid');
	const giftPickerEmpty = giftPickerDialog?.querySelector('.gift-picker-empty');
	const giftPickerControls = giftPickerDialog?.querySelector('.gift-picker-controls');
	const giftPickerPrice = giftPickerDialog?.querySelector('#gift-picker-price');
	const giftPickerSend = giftPickerDialog?.querySelector('.gift-picker-send');
	const giftPickerError = giftPickerDialog?.querySelector('.gift-picker-error');
	const conversationComposer = conversationDialog.querySelector('.conversation-composer');
	const conversationReadonlyNotice = conversationDialog.querySelector('.conversation-readonly-notice');
	const conversationAttach = conversationDialog.querySelector('.conversation-attach');
	const conversationInputShell = conversationDialog.querySelector('.conversation-input-shell');
	const conversationInput = conversationDialog.querySelector('.conversation-input');
	const conversationSend = conversationDialog.querySelector('.conversation-send');
	const messageActionScrim = conversationDialog.querySelector('.message-action-scrim');
	const messageActionMenu = conversationDialog.querySelector('.message-action-menu');
	const messageDeleteAction = conversationDialog.querySelector('.message-delete-action');
	const favoritesChatIndex = chatRows.findIndex((row) => row.dataset.chatType === 'favorites');
	const favoritesStorageKey = 'vyrn.favorites.messages.v1';
	const playerProfileName = conversationProfile.querySelector('.profile-name');
	const playerProfileStatus = conversationProfile.querySelector('.profile-status');
	const playerProfileUsername = conversationProfile.querySelector('.player-profile-username');
	const playerProfileBio = conversationProfile.querySelector('.player-profile-bio');
	const playerProfileNftGrid = conversationProfile.querySelector('.player-profile-nft-grid');
	const playerProfiles = [
		{ username: 'Канал', status: 'официальный канал', headerStatus: 'официальный канал', bio: 'Новости и обновления проекта VYRN', notice: 'Канал доступен только для чтения' },
		{ username: 'Личное', status: 'только вы', headerStatus: 'Сохранённые сообщения', bio: 'Личное пространство для избранных сообщений.', notice: '', canSend: true }
	];
	let favoriteMessages = [];
	try {
		const savedMessages = JSON.parse(localStorage.getItem(favoritesStorageKey));
		if (Array.isArray(savedMessages)) {
			favoriteMessages = savedMessages
				.filter((message) => message && typeof message.text === 'string' && typeof message.time === 'string')
				.map((message) => ({ text: message.text.slice(0, 4096), time: message.time, outgoing: true }));
		}
	} catch {
		favoriteMessages = [];
	}
	let remoteSavedChatId;
	let remoteProfileId;
	let activeServerChatId;
	const conversationThreads = [
		[
			{ text: 'Добро пожаловать в VYRN — Портал. Здесь будут публиковаться новости и обновления проекта.', time: '12:00' }
		],
		favoriteMessages
	];
	let activeChatIndex = -1;
	let pendingDeleteIndex = -1;
	let activeMessageBubble;
	let activeMessageRow;
	let activeMessageClone;
	let messageRefreshTimer;
	let messageRefreshInFlight = false;
	let selectedGiftItem;
	let giftPickerRequestId = 0;
	const pendingRemoteMessages = new Map();
	const formatRemoteMessages = (messages) => messages.map((message) => ({
		id: message.id,
		text: message.body,
		time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at)),
		outgoing: message.sender_profile_id === remoteProfileId,
		senderName: message.profiles ? getProfileDisplayName(message.profiles) : '',
		senderAvatar: message.profiles?.avatar_url || '',
		gift: message.gift_offer || null
	}));
	const getMessageListKey = (messages) => JSON.stringify(messages.map((message) => ({
		id: message.id || null,
		text: message.text,
		time: message.time,
		outgoing: message.outgoing,
		senderName: message.senderName || '',
		senderAvatar: message.senderAvatar || '',
		giftId: message.gift?.id || null,
		giftStatus: message.gift?.status || null,
		giftPrice: message.gift?.price_stars ?? null
	})));
	const refreshActiveMessages = async () => {
		if (!activeServerChatId || activeChatIndex < 0 || !window.VyrnApi || messageRefreshInFlight) return;
		const chatId = activeServerChatId;
		messageRefreshInFlight = true;
		try {
			const result = await window.VyrnApi.messages(chatId);
			if (chatId !== activeServerChatId || activeChatIndex < 0) return;
			const serverMessages = formatRemoteMessages(result.messages);
			const serverMessageIds = new Set(serverMessages.map((message) => message.id));
			const pendingMessages = (pendingRemoteMessages.get(chatId) || [])
				.filter((message) => !message.id || !serverMessageIds.has(message.id));
			if (pendingMessages.length) {
				pendingRemoteMessages.set(chatId, pendingMessages);
			} else {
				pendingRemoteMessages.delete(chatId);
			}
			const nextMessages = [...serverMessages, ...pendingMessages];
			const currentMessages = conversationThreads[activeChatIndex];
			if (getMessageListKey(currentMessages) === getMessageListKey(nextMessages)) return;
			conversationThreads[activeChatIndex] = nextMessages;
			if (activeChatIndex === favoritesChatIndex) {
				favoritesPreview.textContent = nextMessages.at(-1)?.text || 'Ваши сохранённые сообщения';
			}
			renderConversationMessages();
		} finally {
			messageRefreshInFlight = false;
		}
	};
	const startMessageRefresh = () => {
		clearInterval(messageRefreshTimer);
		messageRefreshTimer = setInterval(() => refreshActiveMessages().catch(() => {}), 2500);
	};
	const favoritesPreview = chatRows[favoritesChatIndex]?.querySelector('.chat-message');
	if (favoritesPreview && favoriteMessages.length) {
		favoritesPreview.textContent = favoriteMessages.at(-1).text;
	}
	if (canUseSupabaseAccount()) {
		window.VyrnApi.chats().then(async (result) => {
			remoteProfileId = result.current_profile_id;
			const savedChat = result.chats.find((member) => member.chats?.chat_type === 'saved');
			if (savedChat) {
				remoteSavedChatId = savedChat.chat_id;
				if (activeChatIndex === favoritesChatIndex) activeServerChatId = remoteSavedChatId;
				const messages = await window.VyrnApi.messages(remoteSavedChatId);
				conversationThreads[favoritesChatIndex] = messages.messages.map((message) => ({
					id: message.id,
					text: message.body,
					time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at)),
					outgoing: message.sender_profile_id === remoteProfileId
				}));
				if (favoritesPreview) {
					favoritesPreview.textContent = conversationThreads[favoritesChatIndex].at(-1)?.text || 'Ваши сохранённые сообщения';
				}
				if (activeChatIndex === favoritesChatIndex) renderConversationMessages();
			}
			result.chats.filter((member) => member.chats?.chat_type === 'direct').forEach((member) => {
				if (member.peer) addRemoteChatRow(member.chat_id, member.peer);
			});
		}).catch((error) => {
			console.error('Не удалось загрузить избранные сообщения:', error);
		});
	}

	const renderConversationMessages = (animateLatest = false) => {
		conversationMessageList.replaceChildren();
		const messages = conversationThreads[activeChatIndex];
		let latestMessageRow;
		messages.forEach((message, index) => {
			const row = document.createElement('article');
			const isAnimatedMessage = animateLatest && index === messages.length - 1;
			row.className = `conversation-message${message.outgoing ? ' is-outgoing' : ' is-incoming'}${message.gift ? ' is-gift-message' : ''}${isAnimatedMessage ? ' is-appearance-pending' : ''}`;
			row.tabIndex = message.outgoing ? 0 : -1;
			if (message.outgoing) {
				row.setAttribute('aria-label', `Сообщение: ${message.text}`);
				row.setAttribute('aria-haspopup', 'menu');
			}
			if (isAnimatedMessage) {
				latestMessageRow = row;
			}

			const bubble = message.gift ? null : document.createElement('div');
			if (bubble) bubble.className = 'conversation-bubble';
			if (message.outgoing && bubble) {
				let holdTimer;
				let startPoint;
				let longPressTriggered = false;
				const cancelHold = () => {
					clearTimeout(holdTimer);
					holdTimer = undefined;
				};
				const requestDelete = () => {
					if (activeChatIndex !== favoritesChatIndex || !messageActionMenu.hidden) {
						return;
					}
					pendingDeleteIndex = index;
					activeMessageBubble = bubble;
					activeMessageRow = row;
					const bounds = bubble.getBoundingClientRect();
					bubble.style.visibility = 'hidden';
					row.classList.add('is-action-target');
					messageActionScrim.hidden = false;
					messageActionMenu.hidden = false;
					activeMessageClone = row.cloneNode(true);
					activeMessageClone.classList.remove('is-appearing', 'is-appearance-pending', 'is-action-target');
					activeMessageClone.classList.add('message-action-copy');
					activeMessageClone.setAttribute('aria-hidden', 'true');
					activeMessageClone.style.left = `${bounds.left}px`;
					activeMessageClone.style.top = `${bounds.top}px`;
					activeMessageClone.style.width = `${bounds.width}px`;
					activeMessageClone.style.height = `${bounds.height}px`;
					const clonedBubble = activeMessageClone.querySelector('.conversation-bubble');
					clonedBubble.style.removeProperty('visibility');
					clonedBubble.style.removeProperty('--message-origin-x');
					clonedBubble.style.removeProperty('--message-origin-y');
					conversationScreen.append(activeMessageClone);
					const menuBounds = messageActionMenu.getBoundingClientRect();
					const horizontalPadding = 12;
					const alignedLeft = bounds.right - menuBounds.width;
					const left = Math.min(Math.max(horizontalPadding, alignedLeft), window.innerWidth - menuBounds.width - horizontalPadding);
					const belowTop = bounds.bottom + 8;
					const top = belowTop + menuBounds.height <= window.innerHeight - horizontalPadding
						? belowTop
						: Math.max(horizontalPadding, bounds.top - menuBounds.height - 8);
					messageActionMenu.style.left = `${left}px`;
					messageActionMenu.style.top = `${top}px`;
					messageDeleteAction.focus();
				};
				bubble.addEventListener('pointerdown', (event) => {
					if (activeChatIndex !== favoritesChatIndex || event.button !== 0) {
						return;
					}
					startPoint = { x: event.clientX, y: event.clientY };
					longPressTriggered = false;
					holdTimer = setTimeout(() => {
						longPressTriggered = true;
						requestDelete();
					}, 500);
				});
				bubble.addEventListener('pointermove', (event) => {
					if (startPoint && (Math.abs(event.clientX - startPoint.x) > 12 || Math.abs(event.clientY - startPoint.y) > 12)) {
						cancelHold();
					}
				});
				bubble.addEventListener('pointerup', cancelHold);
				bubble.addEventListener('pointercancel', cancelHold);
				bubble.addEventListener('pointerleave', cancelHold);
				bubble.addEventListener('contextmenu', (event) => {
					event.preventDefault();
					longPressTriggered = true;
					requestDelete();
				});
				row.addEventListener('click', (event) => {
					if (longPressTriggered) {
						event.preventDefault();
						event.stopPropagation();
						longPressTriggered = false;
					}
				});
				row.addEventListener('keydown', (event) => {
					if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
						event.preventDefault();
						requestDelete();
					}
				});
			}
			if (message.gift) {
				const offer = message.gift;
				const nftItem = offer.nft_items || {};
				const nftModel = nftItem.nft_models || {};
				const nftCollection = nftModel.nft_collections || {};
				const nftId = nftItem.external_id || offer.nft_item_id.slice(0, 8);
				const nftTitle = `${nftModel.name || nftCollection.name || 'NFT'} #${nftId}`;
				const nftPreview = nftCollection.slug && nftItem.external_id
					? getNftPreviewUrl(nftCollection.slug, nftItem.external_id)
					: nftModel.preview_url || './placeholder.svg';
				const nftFile = nftCollection.slug && nftItem.external_id
					? `${nftCollection.slug}-${nftItem.external_id}.tgs`
					: '';
				const nftAnimation = nftCollection.slug && nftItem.external_id
					? getNftAnimationUrl(nftFile)
					: nftModel.animation_url || '';
				const senderName = message.senderName || (message.outgoing
					? getProfileDisplayName(getTelegramUser())
					: playerProfileName.textContent.trim()) || 'Игрок';
				const senderAvatar = message.senderAvatar || (message.outgoing ? getTelegramUser()?.photo_url : '');
				const giftCard = document.createElement('section');
				giftCard.className = 'gift-telegram-card';
				const notification = document.createElement('p');
				notification.className = 'gift-telegram-notification';
				notification.textContent = offer.status === 'declined'
					? 'Предложение о подарке отклонено'
					: offer.price_stars > 0
						? `${senderName} предложил вам приобрести NFT стоимостью ${Number(offer.price_stars).toLocaleString('ru-RU')} звёзд`
						: `${senderName} отправил вам подарок`;
				const giftScene = document.createElement('div');
				giftScene.className = 'gift-telegram-scene';
				const preview = createNftPreviewImage(nftPreview, nftTitle, 'gift-telegram-art');
				preview.addEventListener('error', () => { preview.src = './placeholder.svg'; }, { once: true });
				const giftTitle = document.createElement('h3');
				giftTitle.className = 'gift-telegram-title';
				const giftFrom = document.createElement('span');
				giftFrom.textContent = 'Подарок от';
				const senderAvatarElement = senderAvatar
					? createNftPreviewImage(senderAvatar, '', 'gift-telegram-sender-avatar')
					: Object.assign(document.createElement('span'), {
						className: 'gift-telegram-sender-avatar is-fallback',
						textContent: senderName.slice(0, 1).toLocaleUpperCase('ru-RU')
					});
				if (senderAvatar) {
					senderAvatarElement.addEventListener('error', () => {
						senderAvatarElement.replaceWith(Object.assign(document.createElement('span'), {
							className: 'gift-telegram-sender-avatar is-fallback',
							textContent: senderName.slice(0, 1).toLocaleUpperCase('ru-RU')
						}));
					}, { once: true });
				}
				const senderNameElement = document.createElement('span');
				senderNameElement.textContent = senderName;
				giftTitle.append(giftFrom, senderAvatarElement, senderNameElement);
				const giftSubtitle = document.createElement('p');
				giftSubtitle.className = 'gift-telegram-subtitle';
				giftSubtitle.textContent = nftTitle;
				const giftView = document.createElement('button');
				giftView.className = 'gift-telegram-view';
				giftView.type = 'button';
				giftView.textContent = 'Просмотр';
				giftView.addEventListener('click', () => {
					window.openVyrnNftModal({
						title: nftTitle,
						model: nftModel.name || nftCollection.name || 'NFT',
						source: nftAnimation,
						preview: nftPreview,
						file: nftFile,
						owner: senderName
					});
				});
				giftScene.append(preview, giftTitle, giftSubtitle, giftView);
				giftCard.append(notification, giftScene);
				row.append(giftCard);

				if (offer.status === 'pending' && offer.recipient_profile_id === remoteProfileId && !message.outgoing) {
					const offerActions = document.createElement('div');
					offerActions.className = 'gift-offer-actions';
					const acceptButton = document.createElement('button');
					acceptButton.type = 'button';
					acceptButton.textContent = `Купить за ${Number(offer.price_stars).toLocaleString('ru-RU')} ★`;
					acceptButton.addEventListener('click', async () => {
						acceptButton.disabled = true;
						declineButton.disabled = true;
						try {
							await window.VyrnApi.acceptNftGift(offer.id);
							await refreshActiveMessages();
							window.refreshVyrnAccount?.().catch(() => {});
						} catch (error) {
						acceptButton.disabled = false;
						declineButton.disabled = false;
						window.alert(error.message);
					}
					});
					const declineButton = document.createElement('button');
					declineButton.className = 'gift-offer-decline';
					declineButton.type = 'button';
					declineButton.textContent = 'Отклонить';
					declineButton.addEventListener('click', async () => {
						acceptButton.disabled = true;
						declineButton.disabled = true;
						try {
							await window.VyrnApi.declineNftGift(offer.id);
							await refreshActiveMessages();
						} catch (error) {
						acceptButton.disabled = false;
						declineButton.disabled = false;
						window.alert(error.message);
					}
					});
					offerActions.append(acceptButton, declineButton);
					giftScene.append(offerActions);
				}
			} else {
				const text = document.createElement('span');
				text.className = 'conversation-message-text';
				text.textContent = message.text;
				bubble.append(text);

				const meta = document.createElement('span');
				meta.className = 'conversation-message-meta';
				const time = document.createElement('time');
				time.textContent = message.time;
				meta.append(time);
				if (message.outgoing) {
					const checks = document.createElement('span');
					checks.className = 'tgico sending-status-is-read time-sending-status conversation-message-checks';
					checks.setAttribute('aria-hidden', 'true');
					checks.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></svg>';
					meta.append(checks);
				}

				bubble.append(meta);
				row.append(bubble);
			}
			conversationMessageList.append(row);
		});
		if (animateLatest) {
			conversationMessages.scrollTop = conversationMessages.scrollHeight;
			const bubble = latestMessageRow.querySelector('.conversation-bubble');
			const inputBounds = conversationInputShell.getBoundingClientRect();
			const bubbleBounds = bubble.getBoundingClientRect();
			const originX = inputBounds.left + inputBounds.width / 2 - (bubbleBounds.left + bubbleBounds.width / 2);
			const originY = inputBounds.top + inputBounds.height / 2 - (bubbleBounds.top + bubbleBounds.height / 2);
			bubble.style.setProperty('--message-origin-x', `${originX}px`);
			bubble.style.setProperty('--message-origin-y', `${originY}px`);
			requestAnimationFrame(() => {
				latestMessageRow.classList.remove('is-appearance-pending');
				latestMessageRow.classList.add('is-appearing');
			});
		} else {
			conversationMessages.scrollTop = conversationMessages.scrollHeight;
		}
	};

	const showConversationProfile = (showProfile) => {
		conversationScreen.hidden = showProfile;
		conversationProfile.hidden = !showProfile;
	};
	const updateGiftPriceLabel = () => {
		const price = Number(giftPickerPrice?.value);
		if (giftPickerSend) {
			giftPickerSend.textContent = price === 0 ? 'Отправить бесплатно' : `Предложить за ${price.toLocaleString('ru-RU')} ★`;
			giftPickerSend.disabled = !selectedGiftItem || !Number.isSafeInteger(price) || price < 0;
		}
	};

	conversationGiftOpen?.addEventListener('click', async () => {
		if (!giftPickerDialog || !giftPickerGrid || !window.VyrnApi || !activeServerChatId) return;
		const requestId = ++giftPickerRequestId;
		selectedGiftItem = undefined;
		giftPickerGrid.replaceChildren();
		giftPickerControls.hidden = true;
		giftPickerEmpty.hidden = true;
		giftPickerError.hidden = true;
		giftPickerPrice.value = '0';
		giftPickerRecipient.textContent = `Кому: ${conversationPeerName.textContent.trim()}`;
		giftPickerDialog.showModal();
		try {
			const { items } = await window.VyrnApi.myNfts();
			if (requestId !== giftPickerRequestId || !giftPickerDialog.open) return;
			const gifts = items.map(mapOwnedNft);
			giftPickerEmpty.hidden = gifts.length > 0;
			gifts.forEach((gift) => {
				const card = document.createElement('button');
				card.className = 'gift-picker-item';
				card.type = 'button';
				card.disabled = gift.isListed;
				card.title = gift.isListed ? 'Сначала снимите NFT с продажи' : `${gift.name} #${gift.id}`;
				const image = createNftPreviewImage(gift.previewUrl || './placeholder.svg', `${gift.name} #${gift.id}`, '');
				image.addEventListener('error', () => { image.src = './placeholder.svg'; }, { once: true });
				const title = document.createElement('span');
				title.textContent = `${gift.name} #${gift.id}`;
				card.append(image, title);
				card.addEventListener('click', () => {
					giftPickerGrid.querySelector('.is-selected')?.classList.remove('is-selected');
					card.classList.add('is-selected');
					selectedGiftItem = gift;
					giftPickerControls.hidden = false;
					updateGiftPriceLabel();
				});
				giftPickerGrid.append(card);
			});
		} catch (error) {
			if (requestId === giftPickerRequestId) {
				giftPickerError.textContent = error.message;
				giftPickerError.hidden = false;
			}
		}
	});

	giftPickerPrice?.addEventListener('input', updateGiftPriceLabel);
	giftPickerDialog?.querySelector('.gift-picker-close').addEventListener('click', () => giftPickerDialog.close());
	giftPickerDialog?.addEventListener('click', (event) => {
		if (event.target === giftPickerDialog) giftPickerDialog.close();
	});
	giftPickerForm?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const priceStars = Number(giftPickerPrice.value);
		if (!selectedGiftItem || !activeServerChatId || !Number.isSafeInteger(priceStars) || priceStars < 0) return;
		giftPickerSend.disabled = true;
		giftPickerError.hidden = true;
		try {
			await window.VyrnApi.sendNftGift(activeServerChatId, selectedGiftItem.itemId, priceStars);
			giftPickerDialog.close();
			await refreshActiveMessages();
			window.refreshVyrnAccount?.().catch(() => {});
		} catch (error) {
			giftPickerError.textContent = error.message;
			giftPickerError.hidden = false;
		} finally {
			updateGiftPriceLabel();
		}
	});

	const bindChatRow = (chatRow, index) => {
		chatRow.addEventListener('click', () => {
			activeChatIndex = index;
			activeServerChatId = chatRow.dataset.chatId || (index === favoritesChatIndex ? remoteSavedChatId : undefined);
			const name = chatRow.querySelector('.chat-name').textContent.replace(/\s+/g, ' ').trim();
			const channelBadge = chatRow.querySelector('.channel-verified');
			const avatar = chatRow.querySelector('.chat-avatar').cloneNode(true);
			const headerAvatar = avatar.cloneNode(true);
			headerAvatar.classList.add('conversation-peer-avatar');
			headerAvatar.setAttribute('aria-hidden', 'true');
			conversationAvatarSlot.replaceChildren(headerAvatar);
			const profileAvatar = conversationProfile.querySelector('.profile-avatar');
			const profileAvatarArt = avatar.cloneNode(true);
			profileAvatarArt.classList.remove('chat-avatar');
			profileAvatarArt.classList.add('player-profile-avatar-art');
			profileAvatar.replaceChildren(profileAvatarArt);
			profileAvatar.setAttribute('aria-label', `Увеличить аватар ${name}`);
			profileAvatar.setAttribute('aria-expanded', 'false');
			conversationPeerName.replaceChildren(document.createTextNode(name));
			if (channelBadge) {
				conversationPeerName.append(channelBadge.cloneNode(true));
			}
			const profile = playerProfiles[index];
			conversationActions.hidden = !profile.profileId || !activeServerChatId;
			conversationPeerStatus.textContent = profile.headerStatus;
			playerProfileName.textContent = name;
			playerProfileStatus.textContent = profile.status;
			playerProfileUsername.textContent = profile.username;
			playerProfileBio.textContent = profile.bio;
			if (playerProfileNftGrid) playerProfileNftGrid.replaceChildren();
			if (profile.profileId && window.VyrnApi) {
				window.VyrnApi.profileNfts(profile.profileId).then(({ items }) => {
					if (activeChatIndex !== index || !playerProfileNftGrid) return;
					items.map(mapOwnedNft).forEach((gift) => {
						const title = `${gift.name} #${gift.id}`;
						const file = gift.slug ? `${gift.slug}-${gift.id}.tgs` : '';
						const card = document.createElement('button');
						card.className = 'profile-nft-cell';
						card.type = 'button';
						card.dataset.nftItemId = '';
						card.dataset.nftListed = 'false';
						card.dataset.nftListingId = '';
						card.dataset.nftSrc = gift.animationUrl || (file ? getNftAnimationUrl(file) : '');
						card.dataset.nftLink = file ? `https://nft.fragment.com/gift/${file}` : '';
						card.dataset.nftPreview = gift.previewUrl || (gift.slug ? getNftPreviewUrl(gift.slug, gift.id) : './placeholder.png');
						card.dataset.nftTitle = title;
						card.dataset.nftModel = gift.name;
						card.dataset.nftFile = file;
						card.setAttribute('aria-label', `Открыть ${title}`);
						card.append(createNftPreviewImage(card.dataset.nftPreview, title, 'profile-nft-preview'));
						playerProfileNftGrid.append(card);
					});
				}).catch(() => {});
			}
			conversationReadonlyNotice.querySelector('span').textContent = profile.notice;
			conversationReadonlyNotice.hidden = Boolean(profile.canSend);
			conversationComposer.classList.toggle('conversation-readonly', !profile.canSend);
			conversationAttach.hidden = !profile.canSend;
			conversationAttach.disabled = !profile.canSend;
			conversationInputShell.hidden = !profile.canSend;
			conversationInput.disabled = !profile.canSend;
			conversationSend.hidden = !profile.canSend;
			conversationSend.disabled = !profile.canSend;
			conversationDialog.setAttribute('aria-label', `Переписка: ${name}`);
			showConversationProfile(false);
			renderConversationMessages();
			conversationDialog.showModal();
			if (activeServerChatId && window.VyrnApi) {
				refreshActiveMessages().catch(() => {});
				startMessageRefresh();
			}
			requestAnimationFrame(() => {
				conversationMessages.scrollTop = conversationMessages.scrollHeight;
			});
			(profile.canSend ? conversationInput : conversationDialog.querySelector('.conversation-back')).focus();
		});
	};
	chatRows.forEach(bindChatRow);

	addRemoteChatRow = (chatId, peer) => {
		const existing = chatRows.find((row) => row.dataset.chatId === chatId);
		if (existing) return existing;
		const index = chatRows.length;
		const row = document.createElement('button');
		row.className = 'chat-row';
		row.type = 'button';
		row.dataset.chatType = 'direct';
		row.dataset.chatId = chatId;
		const avatar = document.createElement('span');
		avatar.className = 'chat-avatar';
		avatar.setAttribute('aria-hidden', 'true');
		if (peer.avatar_url) {
			const image = document.createElement('img');
			image.className = 'chat-avatar-image';
			image.src = peer.avatar_url;
			image.alt = '';
			avatar.append(image);
		} else {
			avatar.textContent = getProfileDisplayName(peer).slice(0, 1).toUpperCase();
		}
		const copy = document.createElement('span');
		copy.className = 'chat-copy';
		const heading = document.createElement('span');
		heading.className = 'chat-heading';
		const name = document.createElement('span');
		name.className = 'chat-name';
		name.textContent = getProfileDisplayName(peer);
		const type = document.createElement('span');
		type.className = 'chat-time';
		type.textContent = peer.username ? `@${peer.username}` : 'Игрок';
		heading.append(name, type);
		const preview = document.createElement('span');
		preview.className = 'chat-preview';
		const lastMessage = document.createElement('span');
		lastMessage.className = 'chat-message';
		lastMessage.textContent = 'Открыть переписку';
		preview.append(lastMessage);
		copy.append(heading, preview);
		row.append(avatar, copy);
		document.querySelector('.chat-list').append(row);
		chatRows.push(row);
		conversationThreads[index] = [];
		playerProfiles[index] = {
			profileId: peer.id,
			username: peer.username ? `@${peer.username}` : `@${peer.nickname}`,
			status: 'профиль игрока',
			headerStatus: 'в VYRN',
			bio: '',
			notice: '',
			canSend: true
		};
		bindChatRow(row, index);
		return row;
	};

	const newChatDialog = document.querySelector('.new-chat-dialog');
	const newChatButton = document.querySelector('.chats-new-button');
	const newChatForm = newChatDialog?.querySelector('.new-chat-form');
	if (newChatDialog && newChatButton && newChatForm) {
		const newChatError = newChatForm.querySelector('.new-chat-error');
		newChatButton.addEventListener('click', () => newChatDialog.showModal());
		newChatForm.querySelector('.new-chat-cancel').addEventListener('click', () => newChatDialog.close());
		newChatForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			newChatError.hidden = true;
			const submit = newChatForm.querySelector('.new-chat-submit');
			submit.disabled = true;
			try {
				const nickname = newChatForm.elements.namedItem('nickname').value.trim();
				const result = await window.VyrnApi.createChat(nickname);
				const row = addRemoteChatRow(result.chat_id, result.peer);
				newChatDialog.close();
				newChatForm.reset();
				row.click();
			} catch (error) {
				newChatError.textContent = error.message;
				newChatError.hidden = false;
			} finally {
				submit.disabled = false;
			}
		});
	}

	const sendFavoriteMessage = () => {
		const text = conversationInput.value.trim();
		const isSavedChat = activeChatIndex === favoritesChatIndex;
		if (!text || (!isSavedChat && !activeServerChatId)) {
			return;
		}
		if (canUseSupabaseAccount() && !activeServerChatId) {
			window.alert('Подключение к чату ещё выполняется. Повторите отправку через секунду.');
			return;
		}

		const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date());
		const chatId = activeServerChatId;
		const threadIndex = activeChatIndex;
		const thread = conversationThreads[threadIndex];
		const message = { text, time, outgoing: true };
		thread.push(message);
		if (chatId) {
			const pendingMessages = pendingRemoteMessages.get(chatId) || [];
			pendingMessages.push(message);
			pendingRemoteMessages.set(chatId, pendingMessages);
		} else {
			try {
				localStorage.setItem(favoritesStorageKey, JSON.stringify(thread));
			} catch {
			}
		}
		conversationInput.value = '';
		if (isSavedChat && favoritesPreview) {
			favoritesPreview.textContent = text;
		}
		renderConversationMessages(true);
		conversationInput.focus();
		if (chatId) {
			window.VyrnApi.sendMessage(chatId, text).then((result) => {
				message.id = result.message.id;
				if (activeServerChatId === chatId) {
					refreshActiveMessages().catch(() => {});
				}
			}).catch((error) => {
				const pendingMessages = (pendingRemoteMessages.get(chatId) || []).filter((pending) => pending !== message);
				if (pendingMessages.length) {
					pendingRemoteMessages.set(chatId, pendingMessages);
				} else {
					pendingRemoteMessages.delete(chatId);
				}
				const currentThread = conversationThreads[threadIndex];
				const messageIndex = currentThread.indexOf(message);
				if (messageIndex !== -1) currentThread.splice(messageIndex, 1);
				if (activeChatIndex === threadIndex) {
					conversationInput.value ||= text;
					renderConversationMessages();
					conversationInput.focus();
				}
				window.alert(error.message);
			});
		}
	};

	conversationSend.addEventListener('click', sendFavoriteMessage);
	const closeMessageActionMenu = (restoreFocus = false) => {
		messageActionScrim.hidden = true;
		messageActionMenu.hidden = true;
		activeMessageRow?.classList.remove('is-action-target');
		activeMessageBubble?.style.removeProperty('visibility');
		activeMessageClone?.remove();
		if (restoreFocus) {
			activeMessageRow?.focus();
		}
		activeMessageBubble = undefined;
		activeMessageRow = undefined;
		activeMessageClone = undefined;
		pendingDeleteIndex = -1;
	};
	messageActionScrim.addEventListener('click', () => closeMessageActionMenu(true));
	messageDeleteAction.addEventListener('click', async () => {
		if (pendingDeleteIndex < 0 || activeChatIndex !== favoritesChatIndex) {
			closeMessageActionMenu();
			return;
		}

		const message = conversationThreads[favoritesChatIndex][pendingDeleteIndex];
		if (remoteSavedChatId && message.id) {
			try {
				await window.VyrnApi.deleteMessage(message.id);
			} catch (error) {
				closeMessageActionMenu();
				window.alert(error.message);
				return;
			}
		} else {
			try {
				localStorage.setItem(favoritesStorageKey, JSON.stringify(conversationThreads[favoritesChatIndex].filter((_, index) => index !== pendingDeleteIndex)));
			} catch {
			}
		}
		conversationThreads[favoritesChatIndex].splice(pendingDeleteIndex, 1);
		if (favoritesPreview) {
			favoritesPreview.textContent = conversationThreads[favoritesChatIndex].at(-1)?.text || 'Ваши сохранённые сообщения';
		}
		closeMessageActionMenu();
		renderConversationMessages();
		conversationInput.focus();
	});
	messageActionMenu.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeMessageActionMenu(true);
		}
	});
	conversationInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			sendFavoriteMessage();
		}
	});

	conversationDialog.querySelector('.conversation-back').addEventListener('click', () => conversationDialog.close());
	conversationDialog.querySelector('.conversation-peer').addEventListener('click', () => showConversationProfile(true));
	conversationDialog.querySelector('.player-profile-back').addEventListener('click', () => showConversationProfile(false));
	conversationDialog.addEventListener('close', () => {
		clearInterval(messageRefreshTimer);
		if (giftPickerDialog?.open) giftPickerDialog.close();
		conversationActions.hidden = true;
		showConversationProfile(false);
		activeChatIndex = -1;
		activeServerChatId = undefined;
	});
}

const profileSummary = document.querySelector('.profile-summary');
const profileContent = document.querySelector('.profile-content');
const profileAvatar = document.querySelector('.profile-avatar');
const profileName = document.querySelector('.profile-name');
const profileStatus = document.querySelector('.profile-status');

if (profileSummary && profileContent && profileAvatar && profileName && profileStatus) {
	const baseAvatarSize = 112;
	const avatarTransitionDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 160 : 280;
	let isExpanded = false;
	let settleTimeout;
	let collapsedSummaryHeight;

	const setAvatarSize = (size) => {
		const maxSize = Math.max(baseAvatarSize, document.documentElement.clientWidth);
		const progress = Math.min(1, Math.max(0, (size - baseAvatarSize) / (maxSize - baseAvatarSize || 1)));
		const contentWidth = profileContent.clientWidth;
		const summaryWidth = contentWidth + (maxSize - contentWidth) * progress;
		const expandedSummaryHeight = size - 56 * progress;
		const contentShift = isExpanded
			? Math.max(0, expandedSummaryHeight - (collapsedSummaryHeight ?? profileSummary.offsetHeight))
			: 0;

		profileSummary.style.setProperty('--profile-viewport-width', `${maxSize}px`);
		profileSummary.style.width = `${summaryWidth}px`;
		profileSummary.style.marginLeft = `${(contentWidth - summaryWidth) / 2}px`;
		profileSummary.style.height = isExpanded ? `${collapsedSummaryHeight}px` : '';
		profileContent.style.setProperty('--profile-avatar-content-shift', `${contentShift}px`);
		profileAvatar.style.transform = `translateY(${-56 * progress}px) scale(${size / baseAvatarSize})`;
		profileAvatar.style.borderRadius = `${50 * (1 - progress)}%`;
	};

	profileAvatar.addEventListener('click', () => {
		clearTimeout(settleTimeout);
		const currentSummaryHeight = profileSummary.getBoundingClientRect().height;
		if (!isExpanded) {
			collapsedSummaryHeight = currentSummaryHeight;
		}
		profileSummary.style.height = `${currentSummaryHeight}px`;
		isExpanded = !isExpanded;
		profileSummary.classList.toggle('is-expanded', isExpanded);
		profileAvatar.setAttribute('aria-expanded', String(isExpanded));
		profileAvatar.setAttribute('aria-label', isExpanded ? 'Свернуть аватар' : 'Увеличить аватар');
		void profileSummary.offsetHeight;
		setAvatarSize(isExpanded ? Math.max(baseAvatarSize, document.documentElement.clientWidth) : baseAvatarSize);

		if (!isExpanded) {
			settleTimeout = setTimeout(() => {
				if (!isExpanded) {
					profileAvatar.style.removeProperty('transform');
					profileAvatar.style.removeProperty('border-radius');
					profileSummary.style.removeProperty('--profile-viewport-width');
					profileSummary.style.removeProperty('width');
					profileSummary.style.removeProperty('margin-left');
					profileSummary.style.removeProperty('height');
					profileContent.style.removeProperty('--profile-avatar-content-shift');
					collapsedSummaryHeight = undefined;
				}
			}, avatarTransitionDuration + 40);
		}
	});

	window.addEventListener('resize', () => {
		if (isExpanded) {
			setAvatarSize(document.documentElement.clientWidth);
		}
	});
}
