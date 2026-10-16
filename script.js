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

const nftGrid = document.querySelector('.profile-nft-grid');
if (nftGrid) {
	const nftCells = [...nftGrid.children];
	for (let index = nftCells.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		const currentCell = nftCells[index];
		nftCells[index] = nftCells[swapIndex];
		nftCells[swapIndex] = currentCell;
	}

	nftCells.forEach((cell) => nftGrid.append(cell));
}

const nftModal = document.querySelector('.nft-modal');
const nftModalImage = document.querySelector('.nft-modal-image');
const nftModalBackdrop = document.querySelector('.nft-modal-backdrop');
const nftModalArt = document.querySelector('.nft-modal-art');
if (nftGrid && nftModal && nftModalImage && nftModalBackdrop && nftModalArt) {
	const nftModalTitle = document.querySelector('#nft-modal-title');
	const nftModalModel = document.querySelector('.nft-modal-model');
	const nftModalFile = document.querySelector('.nft-modal-file');

	nftGrid.addEventListener('click', (event) => {
		const nftCard = event.target.closest('.profile-nft-cell');
		if (!nftCard) {
			return;
		}

		nftModalTitle.textContent = nftCard.dataset.nftTitle;
		nftModalModel.textContent = nftCard.dataset.nftModel;
		nftModalFile.textContent = nftCard.dataset.nftFile;
		nftModalBackdrop.src = nftCard.querySelector('.profile-nft-image').src;
		nftModalImage.src = nftCard.dataset.nftSrc;
		nftModalImage.alt = nftCard.dataset.nftTitle;
		nftModalArt.classList.remove('has-nft-backdrop');
		void nftModalArt.offsetWidth;
		nftModalArt.classList.add('has-nft-backdrop');
		nftModal.showModal();
			nftModal.querySelector('.nft-modal-close').focus();
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
	nftModal.addEventListener('close', () => {
		nftModalImage.removeAttribute('src');
		nftModalBackdrop.removeAttribute('src');
		nftModalArt.classList.remove('has-nft-backdrop');
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
