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
telegramWebApp?.ready();

const collectionCarousel = document.querySelector('.collection-carousel');
if (collectionCarousel) {
	const collectionSlides = [...collectionCarousel.querySelectorAll('.collection-slide')];
	const collectionPanel = collectionCarousel.closest('.collection-panel');
	const collectionDots = [...collectionPanel.querySelectorAll('.collection-dot')];

	collectionDots.forEach((dot, activeIndex) => {
		dot.addEventListener('click', () => {
			collectionSlides.forEach((slide, index) => {
				slide.hidden = index !== activeIndex;
			});

			collectionDots.forEach((item, index) => {
				const isActive = index === activeIndex;
				item.classList.toggle('is-active', isActive);
				item.setAttribute('aria-pressed', String(isActive));
			});
		});
	});
}

requestAnimationFrame(() => {
	const profileEditButton = document.querySelector('.profile-page:not(.player-profile-page) .profile-edit-button');
const profileEditorDialog = document.querySelector('.profile-editor-dialog');
const profileEditorForm = profileEditorDialog?.querySelector('.profile-editor-form');
const profileEditorPhotoImage = profileEditorForm?.querySelector('.profile-editor-avatar-image');
const profileEditorError = profileEditorForm?.querySelector('.profile-editor-error');
const profileEditorBirthdayValue = profileEditorForm?.querySelector('.profile-editor-birthday-value');
const profileAvatarImage = profileAvatar?.querySelector('.profile-avatar-image');
const profileDetailValues = profileContent ? [...profileContent.querySelectorAll('.profile-detail-value')] : [];

if (profileEditButton && profileEditorDialog && profileEditorForm && profileAvatar && profileName && profileDetailValues.length >= 2) {
	const telegramUser = telegramWebApp?.initDataUnsafe?.user;
	const storedName = profileName.textContent.trim().split(/\s+/);
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
		profileName.textContent = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ');
		profileDetailValues[0].textContent = profileData.username || '';
		profileDetailValues[1].textContent = profileData.about || '';
		setAvatarImage(profileAvatarImage, profileData.avatar);
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
	profileEditButton.addEventListener('click', () => {
		loadProfileEditor();
		profileEditorDialog.showModal();
		profileEditorForm.elements.namedItem('firstName').focus();
	});
	profileEditorForm.querySelector('.profile-editor-cancel').addEventListener('click', () => profileEditorDialog.close());
	profileEditorForm.elements.namedItem('birthday').addEventListener('input', (event) => {
		profileEditorBirthdayValue.textContent = formatBirthday(event.target.value);
	});
	profileEditorForm.addEventListener('submit', (event) => {
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
		try {
			localStorage.setItem('vyrn.profile.editor.v1', JSON.stringify(nextProfile));
		} catch {
			profileEditorError.textContent = 'Не удалось сохранить изменения.';
			profileEditorError.hidden = false;
			return;
		}

		profileData = nextProfile;
		renderProfile();
		profileEditorDialog.close();
	});
}
});

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
const createNftPreviewImage = (source, title, className) => {
	const image = document.createElement('img');
	image.className = className;
	image.src = source;
	image.alt = title;
	return image;
};

const marketGrid = document.querySelector('.market-grid');
if (marketGrid) {
	const marketSearch = document.querySelector('.market-search-input');
	const marketCollectionFilter = document.querySelector('.market-collection-filter');
	const marketSort = document.querySelector('.market-sort');
	const marketEmpty = document.querySelector('.market-empty');
	const marketTradeButtons = [...document.querySelectorAll('.market-trade-button')];
	const marketCards = [];
	let marketMode = 'all';

	nftCollection.forEach((gift) => {
		const title = `${gift.name} #${gift.id}`;
		const card = document.createElement('article');
		card.className = 'market-card';
		card.dataset.marketName = title.toLocaleLowerCase('ru-RU');
		card.dataset.marketCollection = gift.name;
		card.dataset.marketPrice = String(Math.round(gift.lastSaleTon * 100));

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

	const renderMarketList = () => {
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

const nftGrid = document.querySelector('.profile-page:not(.player-profile-page) .profile-nft-grid');
if (nftGrid) {
	const startedNftCards = new WeakSet();
	const renderNftCard = (gift) => {
		const title = `${gift.name} #${gift.id}`;
		const file = `${gift.slug}-${gift.id}.tgs`;
		const source = getNftAnimationUrl(file);
		const card = document.createElement('button');
		card.className = 'profile-nft-cell';
		card.type = 'button';
		card.dataset.nftSrc = source;
		card.dataset.nftLink = `https://nft.fragment.com/gift/${file}`;
		card.dataset.nftPreview = getNftPreviewUrl(gift.slug, gift.id);
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

	const cards = nftCollection.map(renderNftCard);
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
	updateVisibleNftCards();
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

	const loadNftPrice = (fileName) => {
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

			nftModalTitle.textContent = nftCard.dataset.nftTitle;
			nftModalOwner.textContent = nftCard.closest('.profile-page')?.querySelector('.profile-name')?.textContent.trim() || '';
			nftModalModel.textContent = nftCard.dataset.nftModel;
			clearNftAnimation();
			nftModal.showModal();
			nftModal.querySelector('.nft-modal-close').focus();
			loadModalAnimation(nftCard.dataset.nftSrc, nftCard.dataset.nftPreview, nftCard.dataset.nftTitle);
			loadNftPrice(nftCard.dataset.nftFile);
		});
	});

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
	nftModal.addEventListener('close', clearNftAnimation);
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

const chatRows = [...document.querySelectorAll('.chat-row')];
const conversationDialog = document.querySelector('.conversation-dialog');
const chatsPage = document.querySelector('.chats-page');
const chatsSearchInput = chatsPage?.querySelector('.chats-search-input');

if (chatsPage && chatsSearchInput) {
	let pullStart = null;
	const filterChats = () => {
		const query = chatsSearchInput.value.trim().toLocaleLowerCase('ru-RU');
		chatRows.forEach((row) => {
			const searchableText = `${row.querySelector('.chat-name').textContent} ${row.querySelector('.chat-message').textContent}`;
			row.hidden = !searchableText.toLocaleLowerCase('ru-RU').includes(query);
		});
	};

	chatsSearchInput.addEventListener('input', filterChats);
	chatsSearchInput.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			chatsSearchInput.value = '';
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
	const favoritesPreview = chatRows[favoritesChatIndex]?.querySelector('.chat-message');
	if (favoritesPreview && favoriteMessages.length) {
		favoritesPreview.textContent = favoriteMessages.at(-1).text;
	}

	const renderConversationMessages = (animateLatest = false) => {
		conversationMessageList.replaceChildren();
		const messages = conversationThreads[activeChatIndex];
		let latestMessageRow;
		messages.forEach((message, index) => {
			const row = document.createElement('article');
			const isAnimatedMessage = animateLatest && index === messages.length - 1;
			row.className = `conversation-message${message.outgoing ? ' is-outgoing' : ' is-incoming'}${isAnimatedMessage ? ' is-appearance-pending' : ''}`;
			row.tabIndex = message.outgoing ? 0 : -1;
			if (message.outgoing) {
				row.setAttribute('aria-label', `Сообщение: ${message.text}`);
				row.setAttribute('aria-haspopup', 'menu');
			}
			if (isAnimatedMessage) {
				latestMessageRow = row;
			}

			const bubble = document.createElement('div');
			bubble.className = 'conversation-bubble';
			if (message.outgoing) {
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
					row.classList.add('is-action-target');
					messageActionScrim.hidden = false;
					messageActionMenu.hidden = false;
					const bounds = bubble.getBoundingClientRect();
					const menuBounds = messageActionMenu.getBoundingClientRect();
					const horizontalPadding = 12;
					const centeredLeft = bounds.left + (bounds.width - menuBounds.width) / 2;
					const left = Math.min(Math.max(horizontalPadding, centeredLeft), window.innerWidth - menuBounds.width - horizontalPadding);
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
			const text = document.createElement('span');
			text.className = 'conversation-message-text';
			text.textContent = message.text;

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

			bubble.append(text, meta);
			row.append(bubble);
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

	chatRows.forEach((chatRow, index) => {
		chatRow.addEventListener('click', () => {
			activeChatIndex = index;
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
			conversationPeerStatus.textContent = profile.headerStatus;
			playerProfileName.textContent = name;
			playerProfileStatus.textContent = profile.status;
			playerProfileUsername.textContent = profile.username;
			playerProfileBio.textContent = profile.bio;
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
			requestAnimationFrame(() => {
				conversationMessages.scrollTop = conversationMessages.scrollHeight;
			});
			(profile.canSend ? conversationInput : conversationDialog.querySelector('.conversation-back')).focus();
		});
	});

	const sendFavoriteMessage = () => {
		const text = conversationInput.value.trim();
		if (!text || activeChatIndex !== favoritesChatIndex) {
			return;
		}

		const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date());
		const message = { text, time, outgoing: true };
		conversationThreads[favoritesChatIndex].push(message);
		try {
			localStorage.setItem(favoritesStorageKey, JSON.stringify(conversationThreads[favoritesChatIndex]));
		} catch {
		}
		conversationInput.value = '';
		if (favoritesPreview) {
			favoritesPreview.textContent = text;
		}
		renderConversationMessages(true);
		conversationInput.focus();
	};

	conversationSend.addEventListener('click', sendFavoriteMessage);
	const closeMessageActionMenu = (restoreFocus = false) => {
		messageActionScrim.hidden = true;
		messageActionMenu.hidden = true;
		activeMessageRow?.classList.remove('is-action-target');
		if (restoreFocus) {
			activeMessageRow?.focus();
		}
		activeMessageBubble = undefined;
		activeMessageRow = undefined;
		pendingDeleteIndex = -1;
	};
	messageActionScrim.addEventListener('click', () => closeMessageActionMenu(true));
	messageDeleteAction.addEventListener('click', () => {
		if (pendingDeleteIndex < 0 || activeChatIndex !== favoritesChatIndex) {
			closeMessageActionMenu();
			return;
		}

		conversationThreads[favoritesChatIndex].splice(pendingDeleteIndex, 1);
		try {
			localStorage.setItem(favoritesStorageKey, JSON.stringify(conversationThreads[favoritesChatIndex]));
		} catch {
		}
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
		showConversationProfile(false);
		activeChatIndex = -1;
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
