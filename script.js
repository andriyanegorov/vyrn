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

const tgsDataCache = new Map();
const loadTgsData = (source) => {
	if (!tgsDataCache.has(source)) {
		const request = fetch(source)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`NFT request failed: ${response.status}`);
				}

				return new Response(
					response.body.pipeThrough(new DecompressionStream('gzip'))
				).json();
			})
			.catch((error) => {
				tgsDataCache.delete(source);
				throw error;
			});
		tgsDataCache.set(source, request);
	}

	return tgsDataCache.get(source);
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

const nftGrid = document.querySelector('.profile-nft-grid');
if (nftGrid) {
	const startedNftCards = new WeakSet();
	const renderNftCard = (gift) => {
		const title = `${gift.name} #${gift.id}`;
		const source = `https://nft.fragment.com/gift/${gift.slug}-${gift.id}.tgs`;
		const card = document.createElement('button');
		card.className = 'profile-nft-cell';
		card.type = 'button';
		card.dataset.nftSrc = source;
		card.dataset.nftTitle = title;
		card.dataset.nftModel = gift.name;
		card.dataset.nftFile = `${gift.slug}-${gift.id}.tgs`;
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
			animationHost.classList.add('is-unavailable');
			animationHost.textContent = 'NFT недоступен';
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

const nftModal = document.querySelector('.nft-modal');
const nftModalAnimation = document.querySelector('.nft-modal-animation');
const nftModalBackdrop = document.querySelector('.nft-modal-backdrop');
if (nftGrid && nftModal && nftModalAnimation && nftModalBackdrop) {
	const nftModalTitle = document.querySelector('#nft-modal-title');
	const nftModalModel = document.querySelector('.nft-modal-model');
	const nftModalFile = document.querySelector('.nft-modal-file');
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

	const loadModalAnimation = async (source) => {
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
				nftModalAnimation.textContent = 'Анимация недоступна';
			}
		}
	};

	nftGrid.addEventListener('click', (event) => {
		const nftCard = event.target.closest('.profile-nft-cell');
		if (!nftCard) {
			return;
		}

		nftModalTitle.textContent = nftCard.dataset.nftTitle;
		nftModalModel.textContent = nftCard.dataset.nftModel;
		nftModalFile.href = nftCard.dataset.nftSrc;
		nftModalFile.textContent = nftCard.dataset.nftFile;
		clearNftAnimation();
		nftModal.showModal();
		nftModal.querySelector('.nft-modal-close').focus();
		loadModalAnimation(nftCard.dataset.nftSrc);
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
