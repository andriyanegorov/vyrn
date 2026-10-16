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
	const nftModalTitle = nftModal.querySelector('#nft-modal-title');
	const nftModalModel = nftModal.querySelector('.nft-modal-model');
	const nftModalFile = nftModal.querySelector('.nft-modal-file');
	let activeNftAnimation;
	let activeNftBackdrop;
	let animationRequestId = 0;

	const clearNftAnimation = () => {
		animationRequestId++;
		activeNftAnimation?.destroy();
		activeNftAnimation = null;
		activeNftBackdrop?.destroy();
		activeNftBackdrop = null;
		nftModalAnimation.replaceChildren();
		nftModalAnimation.hidden = true;
		nftModalBackdrop.replaceChildren();
		nftModalBackdrop.hidden = true;
	};

	const loadModalAnimation = async (source, preview, title) => {
		const requestId = animationRequestId;
		nftModalAnimation.hidden = false;
		nftModalAnimation.textContent = 'Загрузка NFT...';
		try {
			const animationData = await loadTgsData(source);
			if (requestId !== animationRequestId || !nftModal.open) {
				return;
			}

			nftModalBackdrop.replaceChildren();
			nftModalBackdrop.hidden = false;
			activeNftBackdrop = window.lottie.loadAnimation({
				container: nftModalBackdrop,
				renderer: 'svg',
				loop: false,
				autoplay: false,
				animationData
			});
			activeNftBackdrop.goToAndStop(0, true);
			activeNftBackdrop.addEventListener('DOMLoaded', () => activeNftBackdrop?.goToAndStop(0, true));

			nftModalAnimation.replaceChildren();
			activeNftAnimation = window.lottie.loadAnimation({
				container: nftModalAnimation,
				renderer: 'svg',
				loop: true,
				autoplay: true,
				animationData
			});
		} catch {
			if (requestId === animationRequestId) {
				nftModalAnimation.replaceChildren(createNftPreviewImage(preview, title, 'nft-modal-preview'));
				nftModalBackdrop.replaceChildren(createNftPreviewImage(preview, title, 'nft-modal-backdrop-preview'));
				nftModalBackdrop.hidden = false;
			}
		}
	};

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
			nftModalModel.textContent = nftCard.dataset.nftModel;
			nftModalFile.href = nftCard.dataset.nftLink || nftCard.dataset.nftSrc;
			nftModalFile.textContent = nftCard.dataset.nftFile;
			clearNftAnimation();
			nftModal.showModal();
			nftModal.querySelector('.nft-modal-close').focus();
			loadModalAnimation(nftCard.dataset.nftSrc, nftCard.dataset.nftPreview, nftCard.dataset.nftTitle);
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
				checks.className = 'conversation-message-checks';
				checks.setAttribute('aria-label', 'Прочитано');
				checks.textContent = '✓✓';
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
	let isExpanded = false;
	let dragState = null;
	let settleTimeout;
	let suppressAvatarClick = false;
	let suppressClickTimeout;

	const setAvatarSize = (size) => {
		const maxSize = Math.max(baseAvatarSize, document.documentElement.clientWidth);
		const progress = Math.min(1, Math.max(0, (size - baseAvatarSize) / (maxSize - baseAvatarSize || 1)));
		const contentWidth = profileContent.clientWidth;
		const summaryWidth = contentWidth + (maxSize - contentWidth) * progress;

		profileSummary.style.setProperty('--profile-viewport-width', `${maxSize}px`);
		profileSummary.style.width = `${summaryWidth}px`;
		profileSummary.style.marginLeft = `${(contentWidth - summaryWidth) / 2}px`;
		profileAvatar.style.width = `${size}px`;
		profileAvatar.style.height = `${size}px`;
		profileAvatar.style.borderRadius = `${50 * (1 - progress)}%`;
		profileAvatar.style.marginTop = `${-56 * progress}px`;
		profileSummary.classList.toggle('is-pulling', progress > 0.02);

		profileName.style.removeProperty('transform');
		profileStatus.style.removeProperty('transform');
		if (dragState) {
			const avatarRect = profileAvatar.getBoundingClientRect();
			const moveLabel = (label, bottomOffset) => {
				const rect = label.getBoundingClientRect();
				const offsetX = (24 - rect.left) * progress;
				const targetTop = avatarRect.bottom - bottomOffset - rect.height;
				const offsetY = (targetTop - rect.top) * progress;
				label.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
			};

			moveLabel(profileName, 44);
			moveLabel(profileStatus, 18);
		}
	};

	const canStartDrag = (target) => {
		if (target.closest('button:not(.profile-avatar), a, input, textarea, select')) {
			return;
		}

		return true;
	};

	const startAvatarDrag = (pointerId, startY, input, target) => {
		const avatarSize = profileAvatar.getBoundingClientRect().width;
		dragState = {
			pointerId,
			input,
			startY,
			startSize: avatarSize,
			wasExpanded: isExpanded,
			size: avatarSize,
			lastY: startY,
			startedOnAvatar: Boolean(target.closest('.profile-avatar'))
		};

		clearTimeout(settleTimeout);
		profileSummary.classList.add('is-dragging');
	};

	const resizeAvatarDuringDrag = (currentY) => {
		const maxSize = Math.max(baseAvatarSize, document.documentElement.clientWidth);
		const nextSize = Math.min(maxSize, Math.max(baseAvatarSize, dragState.startSize + currentY - dragState.startY));
		dragState.size = nextSize;
		setAvatarSize(nextSize);
	};

	profileContent.addEventListener('pointerdown', (event) => {
		if (!event.isPrimary || event.pointerType === 'touch' || (event.pointerType === 'mouse' && event.button !== 0)) {
			return;
		}

		if (!canStartDrag(event.target)) {
			return;
		}

		startAvatarDrag(event.pointerId, event.clientY, 'pointer', event.target);
		const captureTarget = dragState.startedOnAvatar ? profileAvatar : profileContent;
		captureTarget.setPointerCapture(event.pointerId);
	});

	profileContent.addEventListener('pointermove', (event) => {
		if (!dragState || dragState.input !== 'pointer' || event.pointerId !== dragState.pointerId) {
			return;
		}

		dragState.lastY = event.clientY;
		resizeAvatarDuringDrag(event.clientY);
		event.preventDefault();
	});

	const finishAvatarDrag = (pointerId, input) => {
		if (!dragState || dragState.input !== input || pointerId !== dragState.pointerId) {
			return;
		}

		const currentDrag = dragState;
		const verticalMovement = Math.abs(currentDrag.lastY - currentDrag.startY);
		if (currentDrag.startedOnAvatar && verticalMovement > 8) {
			suppressAvatarClick = true;
			clearTimeout(suppressClickTimeout);
			suppressClickTimeout = setTimeout(() => {
				suppressAvatarClick = false;
			}, 350);
		}

		const maxSize = Math.max(baseAvatarSize, document.documentElement.clientWidth);
		const threshold = Math.min(120, (maxSize - baseAvatarSize) * 0.32);
		isExpanded = currentDrag.wasExpanded
			? maxSize - currentDrag.size < threshold
			: currentDrag.size - baseAvatarSize >= threshold;
		const finalSize = isExpanded ? maxSize : baseAvatarSize;

		profileSummary.classList.remove('is-dragging');
		profileSummary.classList.toggle('is-expanded', isExpanded);
		profileAvatar.setAttribute('aria-expanded', String(isExpanded));
		profileAvatar.setAttribute('aria-label', isExpanded ? 'Свернуть аватар' : 'Увеличить аватар');
		dragState = null;
		setAvatarSize(finalSize);

		if (!isExpanded) {
			settleTimeout = setTimeout(() => {
				if (!isExpanded && !dragState) {
					profileAvatar.style.removeProperty('width');
					profileAvatar.style.removeProperty('height');
					profileAvatar.style.removeProperty('border-radius');
					profileAvatar.style.removeProperty('margin-top');
					profileSummary.style.removeProperty('--profile-viewport-width');
					profileSummary.style.removeProperty('width');
					profileSummary.style.removeProperty('margin-left');
				}
			}, 400);
		}
	};

	profileAvatar.addEventListener('click', () => {
		if (suppressAvatarClick) {
			suppressAvatarClick = false;
			clearTimeout(suppressClickTimeout);
			return;
		}

		isExpanded = !isExpanded;
		profileSummary.classList.toggle('is-expanded', isExpanded);
		profileAvatar.setAttribute('aria-expanded', String(isExpanded));
		profileAvatar.setAttribute('aria-label', isExpanded ? 'Свернуть аватар' : 'Увеличить аватар');
		clearTimeout(settleTimeout);
		setAvatarSize(isExpanded ? Math.max(baseAvatarSize, document.documentElement.clientWidth) : baseAvatarSize);

		if (!isExpanded) {
			settleTimeout = setTimeout(() => {
				if (!isExpanded && !dragState) {
					profileAvatar.style.removeProperty('width');
					profileAvatar.style.removeProperty('height');
					profileAvatar.style.removeProperty('border-radius');
					profileAvatar.style.removeProperty('margin-top');
					profileSummary.style.removeProperty('--profile-viewport-width');
					profileSummary.style.removeProperty('width');
					profileSummary.style.removeProperty('margin-left');
				}
			}, 400);
		}
	});

	profileAvatar.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			profileAvatar.click();
		}
	});

	profileContent.addEventListener('pointerup', (event) => finishAvatarDrag(event.pointerId, 'pointer'));
	profileContent.addEventListener('pointercancel', (event) => finishAvatarDrag(event.pointerId, 'pointer'));

	profileContent.addEventListener('touchstart', (event) => {
		if (event.touches.length !== 1 || !canStartDrag(event.target)) {
			return;
		}

		startAvatarDrag(event.touches[0].identifier, event.touches[0].clientY, 'touch', event.target);
	}, { passive: true });

	profileContent.addEventListener('touchmove', (event) => {
		if (!dragState || dragState.input !== 'touch') {
			return;
		}

		const touch = [...event.changedTouches].find((item) => item.identifier === dragState.pointerId);
		if (!touch) {
			return;
		}

		dragState.lastY = touch.clientY;
		const deltaY = touch.clientY - dragState.startY;
		const isExpandGesture = !dragState.wasExpanded && deltaY > 0;
		const isCollapseGesture = dragState.wasExpanded && deltaY < 0;
		if (!isExpandGesture && !isCollapseGesture) {
			return;
		}

		event.preventDefault();
		resizeAvatarDuringDrag(touch.clientY);
	}, { passive: false });

	profileContent.addEventListener('touchend', (event) => {
		if (dragState?.input === 'touch') {
			finishAvatarDrag(dragState.pointerId, 'touch');
		}
	});

	profileContent.addEventListener('touchcancel', (event) => {
		if (dragState?.input === 'touch') {
			finishAvatarDrag(dragState.pointerId, 'touch');
		}
	});

	window.addEventListener('resize', () => {
		if (isExpanded && !dragState) {
			setAvatarSize(document.documentElement.clientWidth);
		}
	});
}
