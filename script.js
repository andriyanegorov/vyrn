const navItems = [...document.querySelectorAll('.nav-button')];
const navButtons = navItems.filter((item) => item.tagName === 'BUTTON');
const bottomNav = document.querySelector('.bottom-nav');
const navIndicator = document.querySelector('.nav-indicator');
let activeItem = document.querySelector('.nav-button.is-active');

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
	const profileEditorPhotoFallback = profileEditorForm?.querySelector('.profile-editor-avatar span');
const profileEditorError = profileEditorForm?.querySelector('.profile-editor-error');
const profileEditorBirthdayValue = profileEditorForm?.querySelector('.profile-editor-birthday-value');
const profileAvatarImage = profileAvatar?.querySelector('.profile-avatar-image');
const profileAvatarFallback = profileAvatar?.querySelector('span');
const profileDetailValues = profileContent ? [...profileContent.querySelectorAll('.profile-detail-value')] : [];

if (profileEditButton && profileEditorDialog && profileEditorForm && profileAvatar && profileName && profileDetailValues.length >= 2) {
	const storedName = profileName.textContent.trim().split(/\s+/);
	const defaultProfile = {
		firstName: storedName.shift() || '',
		lastName: storedName.join(' '),
		about: profileDetailValues[1].textContent.trim(),
		username: profileDetailValues[0].textContent.trim(),
		birthday: '',
		phone: '',
		avatar: ''
	};
	let profileData = defaultProfile;
	try {
		const storedProfile = JSON.parse(localStorage.getItem('vyrn.profile.editor.v1'));
		if (storedProfile && typeof storedProfile === 'object') {
			profileData = { ...defaultProfile, ...storedProfile };
		}
	} catch {
		profileData = defaultProfile;
	}

	const setAvatarImage = (image, fallback, source) => {
		if (source) {
			image.src = source;
			image.hidden = false;
			fallback.hidden = true;
		} else {
			image.removeAttribute('src');
			image.hidden = true;
			fallback.hidden = false;
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
		profileName.textContent = [profileData.firstName, profileData.lastName].filter(Boolean).join(' ') || 'vyrn';
		profileDetailValues[0].textContent = profileData.username || '';
		profileDetailValues[1].textContent = profileData.about || '';
		setAvatarImage(profileAvatarImage, profileAvatarFallback, profileData.avatar);
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
		setAvatarImage(profileEditorPhotoImage, profileEditorPhotoFallback, profileData.avatar);
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
		const nextProfile = {
			firstName: profileEditorForm.elements.namedItem('firstName').value.trim(),
			lastName: profileEditorForm.elements.namedItem('lastName').value.trim(),
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
	{ slug: 'algorithmcup', id: 64, name: 'Algorithm Cups' },
	{ slug: 'artisanbrick', id: 5821, name: 'Artisan Bricks' },
	{ slug: 'astralshard', id: 5129, name: 'Astral Shards' },
	{ slug: 'bdaycandle', id: 220304, name: 'B-Day Candles' },
	{ slug: 'berrybox', id: 444, name: 'Berry Boxes' },
	{ slug: 'bigyear', id: 11599, name: 'Big Years' },
	{ slug: 'blingbinky', id: 1234, name: 'Bling Binkies' },
	{ slug: 'bondedring', id: 1001, name: 'Bonded Rings' },
	{ slug: 'bowtie', id: 31485, name: 'Bow Ties' },
	{ slug: 'bunnymuffin', id: 38, name: 'Bunny Muffins' },
	{ slug: 'candycane', id: 49040, name: 'Candy Canes' },
	{ slug: 'chillflame', id: 113221, name: 'Chill Flames' },
	{ slug: 'cloverpin', id: 888, name: 'Clover Pins' },
	{ slug: 'cookieheart', id: 28888, name: 'Cookie Hearts' },
	{ slug: 'crystalball', id: 7446, name: 'Crystal Balls' },
	{ slug: 'cupidcharm', id: 3396, name: 'Cupid Charms' },
	{ slug: 'deskcalendar', id: 111216, name: 'Desk Calendars' },
	{ slug: 'diamondring', id: 27070, name: 'Diamond Rings' },
	{ slug: 'durovscap', id: 1142, name: 'Durov’s Caps' },
	{ slug: 'durovsglasses', id: 1305, name: 'Durov’s Glasses' },
	{ slug: 'easteregg', id: 103928, name: 'Easter Eggs' },
	{ slug: 'electricskull', id: 8193, name: 'Electric Skulls' },
	{ slug: 'eternalcandle', id: 6666, name: 'Eternal Candles' },
	{ slug: 'eternalrose', id: 28435, name: 'Eternal Roses' },
	{ slug: 'evileye', id: 7777, name: 'Evil Eyes' },
	{ slug: 'faithamulet', id: 9494, name: 'Faith Amulets' },
	{ slug: 'finepen', id: 33333, name: 'Fine Pens' },
	{ slug: 'flyingbroom', id: 22528, name: 'Flying Brooms' },
	{ slug: 'freshsocks', id: 141858, name: 'Fresh Socks' },
	{ slug: 'gemsignet', id: 76, name: 'Gem Signets' }
];

const getNftPreviewUrl = (slug, id) => `https://nft.fragment.com/gift/${slug}-${id}.webp?fresh=${Date.now()}`;
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
	const startedMarketPrices = new WeakSet();
	let marketMode = 'all';

	nftCollection.forEach((gift) => {
		const title = `${gift.name} #${gift.id}`;
		const card = document.createElement('article');
		card.className = 'market-card';
		card.dataset.marketName = title.toLocaleLowerCase('ru-RU');
		card.dataset.marketCollection = gift.name;
		card.dataset.marketPrice = '';

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
		price.textContent = 'Загрузка цены';
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
		updateVisibleMarketPrices();
	};

	const loadMarketPrice = async (card) => {
		const title = card.dataset.marketName;
		const gift = nftCollection.find((item) => title === `${item.name} #${item.id}`.toLocaleLowerCase('ru-RU'));
		if (!gift) {
			return;
		}

		const priceElement = card.querySelector('.market-card-price');
		try {
			const response = await fetch(`/api/fragment/${gift.slug}-${gift.id}`, { cache: 'no-store' });
			if (!response.ok) {
				throw new Error(`Fragment request failed: ${response.status}`);
			}

			const fragmentPage = new DOMParser().parseFromString(await response.text(), 'text/html');
			const statusText = fragmentPage.querySelector('.tm-section-header-status')?.textContent.trim();
			const priceText = fragmentPage.querySelector('.table-cell-value.icon-ton')?.textContent.trim();
			const priceTon = priceText ? Number(priceText.replace(/,/g, '')) : Number.NaN;
			if (!Number.isFinite(priceTon)) {
				throw new Error('Fragment price unavailable.');
			}

			const priceStars = Math.round(priceTon * 100);
			card.dataset.marketPrice = String(priceStars);
			priceElement.replaceChildren();
			const label = document.createElement('span');
			label.className = 'market-card-price-label';
			label.textContent = /for sale/i.test(statusText || '') ? 'Цена' : 'Последняя продажа';
			const value = document.createElement('span');
			value.className = 'market-card-price-value';
			value.textContent = priceStars.toLocaleString('ru-RU');
			const icon = document.createElement('img');
			icon.src = 'stars.png';
			icon.alt = '';
			icon.setAttribute('aria-hidden', 'true');
			priceElement.append(label, value, icon);
		} catch {
			priceElement.textContent = 'Цена недоступна';
		}
		renderMarketList();
	};

	function updateVisibleMarketPrices() {
		const viewportHeight = window.innerHeight;
		marketCards.forEach((card) => {
			if (startedMarketPrices.has(card) || !card.isConnected) {
				return;
			}
			const rect = card.getBoundingClientRect();
			if (rect.bottom >= -120 && rect.top <= viewportHeight + 180) {
				startedMarketPrices.add(card);
			loadMarketPrice(card);
			}
		});
	}

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
	window.addEventListener('scroll', updateVisibleMarketPrices, { passive: true });
	window.addEventListener('resize', updateVisibleMarketPrices);
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
		const source = `/api/tgs/${file}`;
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
	let priceRequestId = 0;

	const clearNftAnimation = () => {
		animationRequestId++;
		priceRequestId++;
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

	const loadNftPrice = async (fileName) => {
		const requestId = ++priceRequestId;
		const giftId = fileName.replace(/\.tgs$/, '');
		nftModalPrice.textContent = 'Загрузка...';
		try {
			const response = await fetch(`/api/fragment/${giftId}`, { cache: 'no-store' });
			if (!response.ok) {
				throw new Error(`Fragment price request failed: ${response.status}`);
			}

			const fragmentPage = new DOMParser().parseFromString(await response.text(), 'text/html');
			const priceText = fragmentPage.querySelector('.table-cell-value.icon-ton')?.textContent.trim();
			const priceTon = priceText ? Number(priceText.replace(/,/g, '')) : Number.NaN;
			if (requestId !== priceRequestId || !nftModal.open) {
				return;
			}

			if (Number.isFinite(priceTon)) {
				const priceValue = document.createElement('span');
				priceValue.textContent = Math.round(priceTon * 100).toLocaleString('ru-RU');
				const currencyIcon = document.createElement('img');
				currencyIcon.className = 'nft-modal-price-icon';
				currencyIcon.src = 'stars.png';
				currencyIcon.alt = '';
				currencyIcon.setAttribute('aria-hidden', 'true');
				nftModalPrice.replaceChildren(priceValue, currencyIcon);
			} else {
				nftModalPrice.textContent = 'Нет данных';
			}
		} catch {
			if (requestId === priceRequestId && nftModal.open) {
				nftModalPrice.textContent = 'Нет данных';
			}
		}
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
if (chatRows.length && conversationDialog) {
	const conversationScreen = conversationDialog.querySelector('.conversation-screen');
	const conversationProfile = conversationDialog.querySelector('.conversation-profile');
	const conversationMessages = conversationDialog.querySelector('.conversation-messages');
	const conversationMessageList = conversationDialog.querySelector('.conversation-message-list');
	const conversationPeerName = conversationDialog.querySelector('.conversation-peer-name');
	const conversationAvatarSlot = conversationDialog.querySelector('.conversation-avatar-slot');
	const playerProfileName = conversationProfile.querySelector('.profile-name');
	const playerProfileStatus = conversationProfile.querySelector('.profile-status');
	const playerProfileUsername = conversationProfile.querySelector('.player-profile-username');
	const playerProfileBio = conversationProfile.querySelector('.player-profile-bio');
	const playerProfileNftGrid = conversationProfile.querySelector('.player-profile-nft-grid');
	const conversationInput = conversationDialog.querySelector('.conversation-input');
	const conversationForm = conversationDialog.querySelector('.conversation-composer');
	const playerProfiles = [
		{ username: '@anya_v', status: 'в сети', bio: 'Коллекционирую подарки и люблю путешествия' },
		{ username: '@whoosh_support', status: 'бот', bio: 'Поддержка Whoosh. Помогаем с поездками каждый день' },
		{ username: '@apple_sale', status: 'был(а) недавно', bio: 'Техника Apple, проверка при встрече' },
		{ username: '@fennel', status: 'был(а) недавно', bio: 'Мемы, музыка и немного хаоса' },
		{ username: '@radar_chuvashia', status: 'в сети', bio: 'Новости региона без паники' },
		{ username: '@vyrn_team', status: 'в сети', bio: 'Создаём игровой NFT-проект VYRN' },
		{ username: '@masha_k', status: 'была недавно', bio: 'Фотографии, музыка и путешествия' },
		{ username: '@green_home', status: 'был(а) недавно', bio: 'Растения и всё о домашнем уюте' },
		{ username: '@parcel_news', status: 'бот', bio: 'Обновления заказов и доставки' },
		{ username: '@denis_orlov', status: 'в сети', bio: 'Велосипед, игры и хороший кофе' },
		{ username: '@pizza_near', status: 'бот', bio: 'Пицца и доставка по городу' },
		{ username: '@house_12', status: 'был(а) недавно', bio: 'Соседи, дом 12' },
		{ username: '@tech_today', status: 'в сети', bio: 'Новости технологий каждый день' },
		{ username: '@travel_together', status: 'был(а) недавно', bio: 'Путешествия и планы' },
		{ username: '@coffee_corner', status: 'в сети', bio: 'Кофе, десерты и завтраки' }
	];
	const playerNftAnimations = new Set();
	const conversationThreads = [
		[
			{ text: 'Ты уже дома?', time: '14:10' },
			{ text: 'Да, всё хорошо ❤️', outgoing: true, time: '14:12' },
			{ text: 'спокойной ночи, любимый', time: '14:15' }
		],
		[
			{ text: 'Добрый день! Где можно посмотреть тарифы?', outgoing: true, time: '14:02' },
			{ text: 'Все тарифы есть в приложении Whoosh', time: '14:18' },
			{ text: 'Новые поездки уже доступны в приложении', time: '14:27' }
		],
		[
			{ text: 'Добрый день, объявление ещё актуально?', outgoing: true, time: '14:02' },
			{ text: 'Да, телефон в отличном состоянии', time: '14:12' },
			{ text: 'ПРОДАЖА: iPhone 16 Pro, отличное состояние', time: '14:20' }
		],
		[
			{ text: 'Ты видел, что там произошло?', time: '14:06' },
			{ text: 'ещё нет, сейчас гляну', outgoing: true, time: '14:09' },
			{ text: 'ща ща, всё будет', time: '14:13' }
		],
		[
			{ text: 'Есть обновления по ситуации?', outgoing: true, time: '13:58' },
			{ text: 'Пока всё спокойно', time: '14:03' },
			{ text: 'Обстановка спокойная, новых сообщений нет', time: '14:10' }
		],
		[
			{ text: 'Подвинул карточки и проверил мобилку', outgoing: true, time: '13:51' },
			{ text: 'Класс, стало заметно лучше', time: '13:54' },
			{ text: 'Вы: отправил новый макет профиля', outgoing: true, time: '13:58' }
		],
		[
			{ text: 'Я уже почти у дома', outgoing: true, time: '13:34' },
			{ text: 'Окей, сейчас спущусь', time: '13:39' },
			{ text: 'голосовое сообщение', time: '13:42' }
		],
		[
			{ text: 'Кто-нибудь знает, что это за растение?', time: '13:11' },
			{ text: 'Похоже на монстеру', time: '13:20' },
			{ text: 'вот так выглядит после пересадки', time: '13:26' }
		],
		[
			{ text: 'Подскажите, посылка уже приехала?', outgoing: true, time: '12:52' },
			{ text: 'Да, можно забрать до закрытия', time: '12:57' },
			{ text: 'Заказ готов к получению до 21:00', time: '13:04' }
		],
		[
			{ text: 'Смотри, что нашёл', time: '12:43' },
			{ text: 'О, выглядит интересно', outgoing: true, time: '12:47' },
			{ text: 'кинул тебе ссылку, посмотри', time: '12:51' }
		],
		[
			{ text: 'Спасибо, заказ приняли', outgoing: true, time: '12:22' },
			{ text: 'Готовим и скоро передадим курьеру', time: '12:28' },
			{ text: 'Ваш заказ уже у курьера', time: '12:35' }
		],
		[
			{ text: 'Кто забрал пакет у двери?', time: '12:03' },
			{ text: 'Я занесла к себе, напишите в личку', time: '12:10' },
			{ text: 'спасибо, забрали посылку', time: '12:18' }
		],
		[
			{ text: 'Какие новинки сегодня обсуждаем?', outgoing: true, time: '11:42' },
			{ text: 'Собрали главное за неделю', time: '11:49' },
			{ text: 'Что показали на презентации этой недели', time: '11:56' }
		],
		[
			{ text: 'Билеты уже купили?', outgoing: true, time: '11:19' },
			{ text: 'Да, отправил всем детали', time: '11:25' },
			{ text: 'Сбор в аэропорту в 06:30', time: '11:32' }
		],
		[
			{ text: 'У вас сегодня работает летняя веранда?', outgoing: true, time: '10:34' },
			{ text: 'Да, ждём вас до 22:00', time: '10:41' },
			{ text: 'Сегодня новый сезонный напиток', time: '10:47' }
		]
	].map((thread) => thread.map((message) => ({ ...message })));
	let activeChatIndex = -1;

	const renderConversationMessages = () => {
		conversationMessageList.replaceChildren();
		conversationThreads[activeChatIndex].forEach((message) => {
			const row = document.createElement('article');
			row.className = `conversation-message${message.outgoing ? ' is-outgoing' : ' is-incoming'}`;

			const bubble = document.createElement('div');
			bubble.className = 'conversation-bubble';
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
		conversationMessages.scrollTop = conversationMessages.scrollHeight;
	};

	const showConversationProfile = (showProfile) => {
		conversationScreen.hidden = showProfile;
		conversationProfile.hidden = !showProfile;
	};

	const clearPlayerNfts = () => {
		playerNftAnimations.forEach((animation) => animation.destroy());
		playerNftAnimations.clear();
		playerProfileNftGrid.replaceChildren();
	};

	const renderPlayerNfts = (playerIndex) => {
		clearPlayerNfts();
		Array.from({ length: 6 }, (_, offset) => nftCollection[(playerIndex * 3 + offset) % nftCollection.length])
			.forEach((gift) => {
				const file = `${gift.slug}-${gift.id}.tgs`;
				const source = `/api/tgs/${file}`;
				const card = document.createElement('button');
				card.className = 'profile-nft-cell';
				card.type = 'button';
				card.dataset.nftSrc = source;
				card.dataset.nftLink = `https://fragment.com/gift/${gift.slug}-${gift.id}`;
				card.dataset.nftPreview = getNftPreviewUrl(gift.slug, gift.id);
				card.dataset.nftTitle = `${gift.name} #${gift.id}`;
				card.dataset.nftModel = gift.name;
				card.dataset.nftFile = file;
				card.setAttribute('aria-label', `${gift.name} #${gift.id}`);

				const host = document.createElement('div');
				host.className = 'profile-nft-animation is-loading';
				host.setAttribute('aria-hidden', 'true');
				card.append(host);
				playerProfileNftGrid.append(card);

				createTgsPreview(host, source).then((animation) => {
					host.classList.remove('is-loading');
					if (animation && host.isConnected) {
						playerNftAnimations.add(animation);
					} else {
						animation?.destroy();
					}
				}).catch(() => {
					host.classList.remove('is-loading');
					host.classList.add('has-nft-preview');
					host.replaceChildren(createNftPreviewImage(
						card.dataset.nftPreview,
						card.dataset.nftTitle,
						'profile-nft-preview'
					));
				});
			});
	};

	chatRows.forEach((chatRow, index) => {
		chatRow.addEventListener('click', () => {
			activeChatIndex = index;
			const name = chatRow.querySelector('.chat-name').textContent.replace(/\s+/g, ' ').trim();
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
			conversationPeerName.textContent = name;
			playerProfileName.textContent = name;
			playerProfileStatus.textContent = playerProfiles[index].status;
			playerProfileUsername.textContent = playerProfiles[index].username;
			playerProfileBio.textContent = playerProfiles[index].bio;
			conversationDialog.setAttribute('aria-label', `Переписка: ${name}`);
			renderPlayerNfts(index);
			showConversationProfile(false);
			renderConversationMessages();
			conversationDialog.showModal();
			conversationDialog.querySelector('.conversation-back').focus();
		});
	});

	conversationDialog.querySelector('.conversation-back').addEventListener('click', () => conversationDialog.close());
	conversationDialog.querySelector('.conversation-peer').addEventListener('click', () => showConversationProfile(true));
	conversationDialog.querySelector('.player-profile-back').addEventListener('click', () => showConversationProfile(false));
	conversationForm.addEventListener('submit', (event) => {
		event.preventDefault();
		const text = conversationInput.value.trim();
		if (!text || activeChatIndex < 0) {
			return;
		}

		const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date());
		conversationThreads[activeChatIndex].push({ text, outgoing: true, time });
		chatRows[activeChatIndex].querySelector('.chat-message').textContent = `Вы: ${text}`;
		conversationInput.value = '';
		renderConversationMessages();
		conversationInput.focus();
	});
	conversationDialog.addEventListener('close', () => {
		showConversationProfile(false);
		clearPlayerNfts();
		conversationInput.value = '';
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
