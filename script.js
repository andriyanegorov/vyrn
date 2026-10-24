const navItems = [...document.querySelectorAll('.nav-button')];
const showSquareSkeletons = (container, count, className = '') => {
	if (!container) return;
	container.replaceChildren(...Array.from({ length: count }, () => {
		const skeleton = document.createElement('div');
		skeleton.className = `vyrn-skeleton ${className}`.trim();
		skeleton.setAttribute('aria-hidden', 'true');
		return skeleton;
	}));
	container.setAttribute('aria-busy', 'true');
};
const animateLoadedContent = (container) => {
	container.classList.remove('vyrn-content-enter');
	requestAnimationFrame(() => {
		if (container.getAttribute('aria-busy') === 'true') return;
		container.classList.add('vyrn-content-enter');
		window.setTimeout(() => container.classList.remove('vyrn-content-enter'), 400);
	});
};
const clearSkeletonState = (container) => {
	if (!container) return;
	const wasBusy = container.getAttribute('aria-busy') === 'true';
	container.setAttribute('aria-busy', 'false');
	if (wasBusy) animateLoadedContent(container);
};
const setBlockSkeleton = (container, loading) => {
	if (!container) return;
	const wasLoading = container.classList.contains('vyrn-skeleton-block');
	container.classList.toggle('vyrn-skeleton-block', loading);
	container.setAttribute('aria-busy', String(loading));
	if (loading) {
		container.classList.remove('vyrn-content-enter');
	} else if (wasLoading) {
		animateLoadedContent(container);
	}
};
const setProfilePageSkeleton = (profilePage, loading) => {
	if (!profilePage) return;
	const items = [
		profilePage.querySelector('.profile-avatar'),
		profilePage.querySelector('.profile-name'),
		profilePage.querySelector('.profile-status'),
		...profilePage.querySelectorAll('.profile-detail'),
		profilePage.querySelector('.profile-collection-value'),
		...profilePage.querySelectorAll('.profile-nft-button'),
		...profilePage.querySelectorAll('.profile-nft-cell')
	].filter(Boolean);
	items.forEach((element) => {
		const wasLoading = element.classList.contains('profile-skeleton-item');
		element.classList.toggle('profile-skeleton-item', loading);
		element.setAttribute('aria-busy', String(loading));
		if (!loading && wasLoading) {
			element.classList.remove('profile-content-fade-in');
			void element.offsetWidth;
			element.classList.add('profile-content-fade-in');
			window.setTimeout(() => element.classList.remove('profile-content-fade-in'), 400);
		} else if (loading) {
			element.classList.remove('profile-content-fade-in');
		}
	});
	const tabs = profilePage.querySelector('.profile-nft-tabs');
	if (tabs) tabs.classList.toggle('profile-skeleton-tabs', loading);
	const nftGrid = profilePage.querySelector('.profile-nft-grid');
	if (loading && nftGrid && !nftGrid.children.length) {
		showSquareSkeletons(nftGrid, 9, 'profile-nft-skeleton');
	} else if (nftGrid) {
		const wasBusy = nftGrid.getAttribute('aria-busy') === 'true';
		nftGrid.setAttribute('aria-busy', String(loading));
		if (!loading && wasBusy) animateLoadedContent(nftGrid);
	}
};
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
const profilePageLoadParts = { profile: false, nfts: false, value: false };
let profilePageLoadStarted = false;
let profilePageLoadCompleted = false;
const beginProfilePageLoad = () => {
	profilePageLoadStarted = true;
	setProfilePageSkeleton(document.querySelector('.profile-page:not(.player-profile-page)'), true);
};
const completeProfilePageLoadPart = (part) => {
	profilePageLoadParts[part] = true;
	if (!profilePageLoadStarted || profilePageLoadCompleted
		|| !Object.values(profilePageLoadParts).every(Boolean)) return;
	profilePageLoadCompleted = true;
	setProfilePageSkeleton(document.querySelector('.profile-page:not(.player-profile-page)'), false);
};
const isProfilePageLoading = () => profilePageLoadStarted && !profilePageLoadCompleted;

function createProfileStatusBadge(status) {
	const normalizedStatus = String(status || '').trim().toLowerCase();
	const isPremium = normalizedStatus === 'premium';
	if (!isPremium && normalizedStatus !== 'verfied' && normalizedStatus !== 'verified') return null;
	const badge = document.createElement('img');
	badge.className = `profile-status-badge ${isPremium ? 'is-premium' : 'is-verified'}`;
	badge.src = isPremium ? './assets/svg/premium.svg' : './assets/svg/verified.svg';
	badge.alt = '';
	badge.setAttribute('aria-label', isPremium ? 'Premium' : 'Подтверждённый профиль');
	return badge;
}

function getProfileStatus(profile) {
	const validStatuses = new Set(['premium', 'verified', 'verfied']);
	const premiumUntil = Date.parse(profile?.premium_until || '');
	if (Number.isFinite(premiumUntil) && premiumUntil > Date.now()) return 'premium';
	const status = [profile?.accountStatus, profile?.account_status, profile?.status]
		.map((value) => String(value || '').trim().toLowerCase())
		.find((value) => validStatuses.has(value) && !(value === 'premium' && profile?.premium_until));
	return status || '';
}

function renderProfileName(target, name, status) {
	target.replaceChildren(document.createTextNode(name || ''));
	const badge = createProfileStatusBadge(status);
	if (badge) target.append(badge);
}

function renderProfileBanner(page, profile) {
	const summary = page?.querySelector('.profile-summary');
	if (!summary) return;
	const color = /^#[0-9a-f]{6}$/i.test(profile?.banner_color || '') ? profile.banner_color : '';
	const useGradient = Boolean(color && profile.banner_gradient === true);
	summary.classList.toggle('has-custom-banner', Boolean(color));
	page.classList.toggle('has-full-banner-gradient', useGradient);
	if (color) {
		const [red, green, blue] = color.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16));
		const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
		page.style.setProperty('--profile-banner-gradient',
			`linear-gradient(to bottom, rgba(${red}, ${green}, ${blue}, 1) 0%, rgba(${red}, ${green}, ${blue}, 0.58) 48%, rgba(${red}, ${green}, ${blue}, 0) 100%)`);
		page.style.setProperty('--profile-banner-text', luminance > 0.58 ? '#17191f' : '#ffffff');
		summary.style.setProperty('--profile-banner-color', color);
		const pageBounds = page.getBoundingClientRect();
		const summaryBottom = summary.getBoundingClientRect().bottom - pageBounds.top + page.scrollTop;
		const bannerHeight = summaryBottom > 1 ? summaryBottom : page.closest('dialog') ? 360 : 1;
		page.style.setProperty('--profile-banner-height', `${Math.ceil(bannerHeight)}px`);
	} else {
		page.style.removeProperty('--profile-banner-gradient');
		page.style.removeProperty('--profile-banner-text');
		page.style.removeProperty('--profile-banner-height');
		summary.style.removeProperty('--profile-banner-color');
	}
}

const renderWalletBalance = (wallets = []) => {
	const stars = wallets.find((wallet) => wallet.currency === 'stars');
	if (!stars) {
		document.querySelectorAll('.star-balance:not(.wallet-topup-balance)').forEach((balanceElement) => setBlockSkeleton(balanceElement, false));
		return;
	}
	document.querySelectorAll('.star-balance:not(.wallet-topup-balance)').forEach((balanceElement) => {
		const balanceLabel = balanceElement.querySelector('span');
		if (!balanceLabel) return;
		balanceLabel.textContent = Number(stars.balance).toLocaleString('ru-RU');
		balanceElement.setAttribute('aria-label', `Баланс: ${balanceLabel.textContent} звёзд`);
		setBlockSkeleton(balanceElement, false);
	});
};
const cachedAccount = window.VyrnApi?.cachedAccount?.();
if (cachedAccount) {
	window.VyrnAccount = cachedAccount;
	renderWalletBalance(cachedAccount.wallets);
} else if (canUseSupabaseAccount()) {
	document.querySelectorAll('.star-balance:not(.wallet-topup-balance)').forEach((balanceElement) => setBlockSkeleton(balanceElement, true));
}

window.refreshVyrnAccount = async () => {
	const result = await window.VyrnApi.me();
	window.VyrnAccount = result;
	renderWalletBalance(result.wallets);
	return result;
};
if (!document.body.classList.contains('wallet-screen') && (canUseSupabaseAccount() || (window.VyrnApi?.isConfigured && window.VyrnApi.browserDemo))) {
	window.VyrnAccountPromise = window.refreshVyrnAccount().catch((error) => {
		console.error('Не удалось загрузить аккаунт VYRN:', error);
		document.querySelectorAll('.star-balance:not(.wallet-topup-balance)').forEach((balanceElement) => setBlockSkeleton(balanceElement, false));
		return null;
	});
}

if (document.body.classList.contains('wallet-screen')) {
	const walletBalanceElement = document.querySelector('[data-wallet-balance]');
	const walletStarsIcon = document.querySelector('[data-wallet-stars-icon]');
	const walletCurrencyLabel = document.querySelector('.wallet-currency');
	const walletOtherBalance = document.querySelector('[data-wallet-other-balance]');
	const walletAccount = document.querySelector('[data-wallet-account]');
	const walletTransactions = document.querySelector('[data-wallet-transactions]');
	const walletToast = document.querySelector('.wallet-toast');
	const walletMenu = document.querySelector('.wallet-more-menu');
	const walletMoreButton = document.querySelector('.wallet-header-button.is-more');
	const walletCurrencyToggle = document.querySelector('.wallet-currency-toggle');
	const walletCurrencyOptionsContainer = document.querySelector('#wallet-currency-options');
	const walletCurrencyOptions = [...document.querySelectorAll('.wallet-currency-option')];
	const walletCurrencyCurrent = document.querySelector('.wallet-menu-current');
	const walletTopupDialog = document.querySelector('#wallet-topup-dialog');
	const walletTopupOpenButton = document.querySelector('[data-wallet-topup-open]');
	const walletTopupCloseButtons = [...document.querySelectorAll('[data-wallet-topup-close]')];
	const walletTopupAmountInput = document.querySelector('#wallet-topup-custom');
	const walletTopupPackages = [...document.querySelectorAll('[data-wallet-topup-amount]')];
	const walletTopupForm = document.querySelector('[data-wallet-topup-form]');
	const walletTopupMoreButton = document.querySelector('[data-wallet-topup-more]');
	const walletTopupBalance = document.querySelector('[data-wallet-topup-balance]');
	const readWalletInteger = (value) => {
		try {
			return BigInt(value ?? 0);
		} catch {
			return 0n;
		}
	};
	const formatWalletInteger = (value) => value.toLocaleString('ru-RU');
	let walletBalances = new Map();
	let activeWalletCurrency = 'stars';
	const setTopupPaymentStatus = (message) => {
		walletToast.textContent = message;
		walletToast.hidden = false;
	};
	const startTelegramStarPayment = async (amount) => {
		if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) {
			setTopupPaymentStatus('Укажите целое количество от 1 до 100 000 Stars.');
			return;
		}
		if (!telegramWebApp?.initData || typeof telegramWebApp.openInvoice !== 'function') {
			setTopupPaymentStatus('Для оплаты откройте VYRN внутри Telegram.');
			return;
		}
		if (!window.VyrnApi?.isConfigured) {
			setTopupPaymentStatus('Платежный сервер не настроен. Попробуйте позже.');
			return;
		}
		const paymentControls = [...walletTopupPackages, walletTopupAmountInput, walletTopupForm.querySelector('[type="submit"]')];
		paymentControls.forEach((control) => { control.disabled = true; });
		try {
			const result = await window.VyrnApi.createStarInvoice(amount);
			if (typeof result.invoice_url !== 'string' || !result.invoice_url) {
				throw new Error('Сервер не вернул ссылку на оплату.');
			}
			const status = await new Promise((resolve, reject) => {
				try {
					telegramWebApp.openInvoice(result.invoice_url, resolve);
				} catch (error) {
					reject(error);
				}
			});
			if (status === 'paid') {
				setTopupPaymentStatus('Telegram подтвердил оплату. Проверяем зачисление Stars…');
				window.setTimeout(() => {
					loadWallet().catch((error) => {
						console.error('Не удалось обновить кошелёк после оплаты:', error);
						setTopupPaymentStatus('Оплата принята. Не удалось обновить баланс автоматически — перезагрузите страницу.');
					});
				}, 1500);
			} else if (status === 'pending') {
				setTopupPaymentStatus('Платёж обрабатывается. Баланс обновится после подтверждения Telegram.');
			} else if (status === 'cancelled') {
				setTopupPaymentStatus('Оплата отменена.');
			} else {
				setTopupPaymentStatus('Telegram не подтвердил оплату. Баланс не изменён.');
			}
		} catch (error) {
			setTopupPaymentStatus(error.message || 'Не удалось создать счёт на оплату.');
		} finally {
			paymentControls.forEach((control) => { control.disabled = false; });
		}
	};
	const closeWalletMenu = () => {
		walletMoreButton.setAttribute('aria-expanded', 'false');
		walletCurrencyToggle.setAttribute('aria-expanded', 'false');
		walletCurrencyOptionsContainer.hidden = true;
		walletMenu.hidden = true;
	};

	walletTopupOpenButton.addEventListener('click', () => {
		closeWalletMenu();
		walletTopupBalance.textContent = walletBalances.has('stars')
			? formatWalletInteger(readWalletInteger(walletBalances.get('stars')))
			: '—';
		walletTopupBalance.parentElement.setAttribute('aria-label', `Баланс: ${walletTopupBalance.textContent} звёзд`);
		walletTopupDialog.scrollTop = 0;
		walletTopupMoreButton.setAttribute('aria-expanded', 'false');
		walletTopupMoreButton.querySelector('span').textContent = 'Показать другие варианты';
		walletTopupForm.hidden = true;
		walletTopupAmountInput.value = '';
		walletTopupAmountInput.setCustomValidity('');
		walletTopupDialog.showModal();
	});
	walletTopupCloseButtons.forEach((button) => button.addEventListener('click', () => {
		walletTopupDialog.close();
	}));
	walletTopupPackages.forEach((button) => button.addEventListener('click', () => {
		startTelegramStarPayment(Number(button.dataset.walletTopupAmount));
	}));
	walletTopupAmountInput.addEventListener('input', () => {
		walletTopupAmountInput.setCustomValidity('');
	});
	walletTopupMoreButton.addEventListener('click', () => {
		const isExpanded = walletTopupMoreButton.getAttribute('aria-expanded') === 'true';
		walletTopupMoreButton.setAttribute('aria-expanded', String(!isExpanded));
		walletTopupForm.hidden = isExpanded;
		walletTopupMoreButton.querySelector('span').textContent = isExpanded
			? 'Показать другие варианты'
			: 'Скрыть дополнительные варианты';
		if (!isExpanded) walletTopupAmountInput.focus();
	});
	walletTopupForm.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!walletTopupAmountInput.reportValidity()) return;
		if (!/^\d+$/.test(walletTopupAmountInput.value)) {
			walletTopupAmountInput.setCustomValidity('Введите целое количество Stars.');
			walletTopupAmountInput.reportValidity();
			return;
		}
		startTelegramStarPayment(Number(walletTopupAmountInput.value));
	});

	const setWalletCurrency = (currency) => {
		if (!walletBalances.has(currency)) return;
		activeWalletCurrency = currency;
		const balance = readWalletInteger(walletBalances.get(currency));
		const otherCurrency = currency === 'stars' ? 'ton' : 'stars';
		walletBalanceElement.textContent = formatWalletInteger(balance);
		walletCurrencyLabel.textContent = currency.toUpperCase();
		walletStarsIcon.hidden = currency !== 'stars';
		walletOtherBalance.textContent = `${otherCurrency.toUpperCase()}: ${formatWalletInteger(readWalletInteger(walletBalances.get(otherCurrency)))}`;
		walletCurrencyCurrent.textContent = currency.toUpperCase();
		walletCurrencyOptions.forEach((option) => {
			const isSelected = option.dataset.walletCurrency === currency;
			option.classList.toggle('is-selected', isSelected);
			option.setAttribute('aria-pressed', String(isSelected));
		});
	};

	const renderWalletTransactions = (transactions, wallets) => {
		const currencyByWalletId = new Map(wallets.map((wallet) => [wallet.id, wallet.currency]));
		const descriptions = {
			market_purchase: ['Покупка NFT', 'Покупка на VYRN Market'],
			market_sale: ['Продажа NFT', 'Продажа на VYRN Market'],
			chat_gift_purchase: ['Покупка подарка', 'Покупка в чате'],
			chat_gift_sale: ['Продажа подарка', 'Продажа в чате']
		};
		walletTransactions.replaceChildren();
		clearSkeletonState(walletTransactions);
		if (!transactions.length) {
			const emptyState = document.createElement('p');
			emptyState.className = 'wallet-empty-state';
			emptyState.textContent = 'Операций пока нет';
			walletTransactions.append(emptyState);
			return;
		}

		transactions.forEach((transaction) => {
			const amount = readWalletInteger(transaction.amount);
			const currency = currencyByWalletId.get(transaction.wallet_id) || 'stars';
			const [title, subtitle] = descriptions[transaction.reason] || [
				String(transaction.reason || 'Операция').replaceAll('_', ' '),
				'Операция с кошельком'
			];
			const row = document.createElement('article');
			row.className = 'wallet-transaction';
			const copy = document.createElement('div');
			copy.className = 'wallet-transaction-copy';
			const heading = document.createElement('strong');
			heading.textContent = title;
			const detail = document.createElement('span');
			detail.textContent = subtitle;
			const time = document.createElement('time');
			const createdAt = new Date(transaction.created_at);
			if (!Number.isNaN(createdAt.getTime())) {
				time.dateTime = createdAt.toISOString();
				time.textContent = new Intl.DateTimeFormat('ru-RU', {
					day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
				}).format(createdAt);
			}
			copy.append(heading, detail, time);
			const amountElement = document.createElement('span');
			amountElement.className = `wallet-transaction-amount${amount > 0n ? ' is-positive' : ''}`;
			amountElement.append(`${amount > 0n ? '+' : '−'}${formatWalletInteger(amount < 0n ? -amount : amount)}`);
			if (currency === 'stars') {
				const icon = document.createElement('img');
				icon.src = './assets/stars.png';
				icon.alt = 'Stars';
				amountElement.append(icon);
			} else {
				const currencyLabel = document.createElement('span');
				currencyLabel.className = 'wallet-transaction-currency';
				currencyLabel.textContent = currency.toUpperCase();
				amountElement.append(currencyLabel);
			}
			row.append(copy, amountElement);
			walletTransactions.append(row);
		});
	};

	const loadWallet = async () => {
		if (!window.VyrnApi?.isConfigured) throw new Error('Supabase API не подключён.');
		if (!canUseSupabaseAccount()) throw new Error('Откройте кошелёк через Telegram.');
		const initialLoad = !walletTransactions.dataset.loaded;
		if (initialLoad) {
			[
				document.querySelector('.wallet-card-balance'),
				walletOtherBalance,
				walletAccount
			].forEach((element) => setBlockSkeleton(element, true));
			setBlockSkeleton(document.querySelector('.wallet-actions'), true);
			walletBalanceElement.textContent = '';
			walletBalanceElement.classList.add('vyrn-skeleton', 'wallet-balance-skeleton');
			walletTransactions.replaceChildren(...Array.from({ length: 4 }, () => {
				const row = document.createElement('div');
				row.className = 'wallet-transaction-skeleton';
				row.setAttribute('aria-hidden', 'true');
				const avatar = document.createElement('span');
				avatar.className = 'wallet-skeleton-avatar vyrn-skeleton';
				const copy = document.createElement('span');
				copy.className = 'wallet-skeleton-copy';
				const title = document.createElement('span');
				title.className = 'wallet-skeleton-line vyrn-skeleton';
				const subtitle = document.createElement('span');
				subtitle.className = 'wallet-skeleton-line is-short vyrn-skeleton';
				copy.append(title, subtitle);
				const amount = document.createElement('span');
				amount.className = 'wallet-skeleton-amount vyrn-skeleton';
				row.append(avatar, copy, amount);
				return row;
			}));
			walletTransactions.setAttribute('aria-busy', 'true');
			walletTransactions.classList.add('is-loading');
		}
		const result = await window.VyrnApi.wallet();
		const wallets = Array.isArray(result.wallets) ? result.wallets : [];
		window.VyrnApi.updateCachedAccount?.({ profile: result.profile, wallets });
		walletBalances = new Map(wallets.map((wallet) => [wallet.currency, wallet.balance]));
		if (!walletBalances.has('stars')) walletBalances.set('stars', 0);
		if (!walletBalances.has('ton')) walletBalances.set('ton', 0);
		walletTopupBalance.textContent = formatWalletInteger(readWalletInteger(walletBalances.get('stars')));
		walletTopupBalance.parentElement.setAttribute('aria-label', `Баланс: ${walletTopupBalance.textContent} звёзд`);
		walletAccount.textContent = result.profile?.username
			? `@${result.profile.username}`
			: result.profile?.nickname || '';
		renderProfileName(walletAccount, walletAccount.textContent, result.profile?.status);
		setWalletCurrency(activeWalletCurrency);
		renderWalletTransactions(Array.isArray(result.transactions) ? result.transactions : [], wallets);
		walletTransactions.setAttribute('aria-busy', 'false');
		walletTransactions.dataset.loaded = 'true';
		walletTransactions.classList.remove('is-loading');
		walletBalanceElement.classList.remove('vyrn-skeleton', 'wallet-balance-skeleton');
		[
			document.querySelector('.wallet-card-balance'),
			walletOtherBalance,
			walletAccount
		].forEach((element) => setBlockSkeleton(element, false));
		setBlockSkeleton(document.querySelector('.wallet-actions'), false);
	};

	walletMoreButton.addEventListener('click', () => {
		const isExpanded = walletMoreButton.getAttribute('aria-expanded') === 'true';
		walletMoreButton.setAttribute('aria-expanded', String(!isExpanded));
		walletMenu.hidden = isExpanded;
	});
	walletCurrencyToggle.addEventListener('click', () => {
		const isExpanded = walletCurrencyToggle.getAttribute('aria-expanded') === 'true';
		walletCurrencyToggle.setAttribute('aria-expanded', String(!isExpanded));
		walletCurrencyOptionsContainer.hidden = isExpanded;
	});
	walletCurrencyOptions.forEach((option) => option.addEventListener('click', () => {
		setWalletCurrency(option.dataset.walletCurrency);
		closeWalletMenu();
	}));
	document.addEventListener('click', (event) => {
		if (!walletMenu.contains(event.target) && !walletMoreButton.contains(event.target)) {
			closeWalletMenu();
		}
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeWalletMenu();
			if (walletTopupDialog.open) walletTopupDialog.close();
		}
	});

	loadWallet().catch((error) => {
		console.error('Не удалось загрузить кошелёк:', error);
		[
			document.querySelector('.wallet-card-balance'),
			walletOtherBalance,
			walletAccount
		].forEach((element) => setBlockSkeleton(element, false));
		setBlockSkeleton(document.querySelector('.wallet-actions'), false);
		walletBalanceElement.classList.remove('vyrn-skeleton', 'wallet-balance-skeleton');
		walletBalanceElement.textContent = '—';
		walletTransactions.replaceChildren();
		walletTransactions.classList.remove('is-loading');
		const errorState = document.createElement('p');
		errorState.className = 'wallet-empty-state';
		errorState.textContent = 'Не удалось загрузить операции';
		walletTransactions.append(errorState);
		walletTransactions.setAttribute('aria-busy', 'false');
		walletToast.textContent = error.message || 'Не удалось загрузить кошелёк';
		walletToast.hidden = false;
	});
}

{
	const profileEditButton = document.querySelector('.profile-page:not(.player-profile-page) .profile-edit-button');
const profileContentElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-content');
const profileAvatarElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-avatar');
const profileNameElement = document.querySelector('.profile-page:not(.player-profile-page) .profile-name');
const profileEditorDialog = document.querySelector('.profile-editor-dialog');
const profileEditorForm = profileEditorDialog?.querySelector('.profile-editor-form');
const profileSummaryElement = profileContentElement?.querySelector('.profile-summary');
const profileEditorPhotoImage = profileEditorForm?.querySelector('.profile-editor-avatar-image');
const profileEditorError = profileEditorForm?.querySelector('.profile-editor-error');
const profileEditorBirthdayValue = profileEditorForm?.querySelector('.profile-editor-birthday-value');
const profileEditorPremiumButton = profileEditorForm?.querySelector('.profile-editor-premium-button');
const profileEditorBannerButton = profileEditorForm?.querySelector('.profile-editor-banner-button');
const profileEditorBannerSwatch = profileEditorBannerButton?.querySelector('.profile-editor-banner-swatch');
const bannerColorDialog = document.querySelector('.banner-color-dialog');
const bannerColorForm = bannerColorDialog?.querySelector('.banner-color-form');
const bannerColorInput = bannerColorForm?.elements.namedItem('bannerColor');
const bannerGradientInput = bannerColorForm?.elements.namedItem('bannerGradient');
const bannerColorError = bannerColorForm?.querySelector('.banner-color-error');
const premiumDialog = document.querySelector('.premium-dialog');
const premiumDialogCloseButton = premiumDialog?.querySelector('.premium-dialog-close');
const premiumDialogSubmitButton = premiumDialog?.querySelector('.premium-dialog-submit');
const premiumDialogStatus = premiumDialog?.querySelector('.premium-dialog-status');
const premiumPlanOptions = premiumDialog ? [...premiumDialog.querySelectorAll('input[name="premium-plan"]')] : [];
const profileAvatarImage = profileAvatarElement?.querySelector('.profile-avatar-image');
const profileDetailValues = profileContentElement ? [...profileContentElement.querySelectorAll('.profile-detail-value')] : [];

if (profileEditButton && profileEditorDialog && profileEditorForm && profileAvatarElement && profileNameElement && profileDetailValues.length >= 2) {
	const telegramUser = getTelegramUser();
	if (canLoadPlayerData()) beginProfilePageLoad();
	const storedName = profileNameElement.textContent.trim().split(/\s+/);
	const defaultProfile = {
		firstName: telegramUser?.first_name || storedName[0] || '',
		lastName: telegramUser ? telegramUser.last_name || '' : storedName.slice(1).join(' '),
		about: profileDetailValues[1].textContent.trim(),
		username: telegramUser?.username ? `@${telegramUser.username}` : profileDetailValues[0].textContent.trim(),
		birthday: '',
		phone: '',
		avatar: telegramUser?.photo_url || '',
		status: '',
		banner_color: null,
		premium_until: null
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

	const canCustomizeBanner = (profile) => {
		const premiumUntil = Date.parse(profile.premium_until || '');
		const status = String(profile.status || '').trim().toLowerCase();
		return (Number.isFinite(premiumUntil) && premiumUntil > Date.now())
			|| status === 'verified'
			|| status === 'verfied';
	};
	const updateBannerGradientHeight = () => {
		if (!profileSummaryElement) return;
		const pageTop = profileContentElement.getBoundingClientRect().top + window.scrollY;
		const summaryBottom = profileSummaryElement.getBoundingClientRect().bottom + window.scrollY;
		profileContentElement.closest('.profile-page').style.setProperty(
			'--profile-banner-height',
			`${Math.max(1, Math.ceil(summaryBottom - pageTop + profileContentElement.offsetTop))}px`
		);
	};
	const renderBannerColor = () => {
		const color = /^#[0-9a-f]{6}$/i.test(profileData.banner_color || '') ? profileData.banner_color : '';
		renderProfileBanner(profileContentElement.closest('.profile-page'), profileData);
		updateBannerGradientHeight();
		if (profileEditorBannerButton) {
			profileEditorBannerButton.hidden = !canCustomizeBanner(profileData);
			if (profileEditorBannerSwatch) {
				profileEditorBannerSwatch.style.background = profileData.banner_gradient && color
					? `linear-gradient(to bottom, ${color}, transparent)`
					: color || '#f5f5f5';
			}
		}
	};
	const renderProfile = () => {
		renderProfileName(profileNameElement, [profileData.firstName, profileData.lastName].filter(Boolean).join(' '), getProfileStatus(profileData));
		profileDetailValues[0].textContent = profileData.username || (profileData.nickname ? `@${profileData.nickname}` : '');
		profileDetailValues[1].textContent = profileData.about || '';
		setAvatarImage(profileAvatarImage, profileData.avatar);
		renderBannerColor();
	};
	const syncProfileFromServer = async () => {
		if (!window.VyrnApi || (!telegramUser && !window.VyrnApi.browserDemo)) return;
		if (!isProfilePageLoading()) {
			setProfilePageSkeleton(profileContentElement.closest('.profile-page'), true);
		}
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
				avatar: profile.avatar_url || '',
				status: profile.status || '',
				premium_until: profile.premium_until || null,
				banner_color: profile.banner_color || null,
				banner_gradient: profile.banner_gradient === true
			};
			if (!telegramUser && window.VyrnApi.browserDemo && storedProfile) {
				profileData = { ...profileData, ...storedProfile };
			}
			renderProfile();
		} catch (error) {
			profileEditorError.textContent = error.message;
		} finally {
			if (isProfilePageLoading()) {
				completeProfilePageLoadPart('profile');
			} else {
				setProfilePageSkeleton(profileContentElement.closest('.profile-page'), false);
			}
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
	const bannerResizeObserver = new ResizeObserver(updateBannerGradientHeight);
	bannerResizeObserver.observe(profileSummaryElement);
	window.addEventListener('resize', updateBannerGradientHeight);
	if (profileEditorBannerButton && bannerColorDialog && bannerColorForm && bannerColorInput && bannerGradientInput) {
		const bannerColorOptions = [...bannerColorForm.querySelectorAll('.banner-color-option')];
		const setSelectedBannerColor = (color) => {
			bannerColorInput.value = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#f5f5f5';
			bannerColorOptions.forEach((option) => {
				const isSelected = option.dataset.bannerColor.toLowerCase() === bannerColorInput.value.toLowerCase();
				option.classList.toggle('is-selected', isSelected);
				option.setAttribute('aria-pressed', String(isSelected));
			});
		};
		profileEditorBannerButton.addEventListener('click', () => {
			setSelectedBannerColor(profileData.banner_color);
			bannerGradientInput.checked = profileData.banner_gradient === true;
			bannerColorError.hidden = true;
			bannerColorDialog.showModal();
		});
		bannerColorOptions.forEach((option) => option.addEventListener('click', () => {
			setSelectedBannerColor(option.dataset.bannerColor);
		}));
		bannerColorInput.addEventListener('input', () => setSelectedBannerColor(bannerColorInput.value));
		bannerColorForm.querySelector('.banner-color-cancel').addEventListener('click', () => bannerColorDialog.close());
		bannerColorDialog.addEventListener('click', (event) => {
			if (event.target === bannerColorDialog) bannerColorDialog.close();
		});
		bannerColorForm.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (!canCustomizeBanner(profileData)) {
				bannerColorError.textContent = 'Эта настройка доступна только с активным Premium или подтверждённым профилем.';
				bannerColorError.hidden = false;
				return;
			}
			bannerColorForm.querySelector('.banner-color-save').disabled = true;
			bannerColorError.hidden = true;
			try {
				const result = await window.VyrnApi.updateProfile({
					banner_color: bannerColorInput.value,
					banner_gradient: bannerGradientInput.checked
				});
				profileData.banner_color = result.profile.banner_color || null;
				profileData.banner_gradient = result.profile.banner_gradient === true;
				renderProfile();
				bannerColorDialog.close();
			} catch (error) {
				bannerColorError.textContent = error.message || 'Не удалось сохранить цвет баннера.';
				bannerColorError.hidden = false;
			} finally {
				bannerColorForm.querySelector('.banner-color-save').disabled = false;
			}
		});
	}
	if (profileEditorPremiumButton && premiumDialog && premiumDialogStatus && premiumDialogSubmitButton) {
		const updatePremiumPlan = () => {
			const selectedPlan = premiumPlanOptions.find((option) => option.checked);
			if (!selectedPlan) return;
			const formattedPrice = new Intl.NumberFormat('ru-RU').format(Number(selectedPlan.dataset.price));
			premiumDialogSubmitButton.querySelector('.premium-dialog-submit-amount').textContent = `Оформить подписку за ${formattedPrice}`;
			premiumPlanOptions.forEach((option) => {
				option.closest('.premium-plan')?.classList.toggle('is-selected', option === selectedPlan);
			});
		};
		premiumPlanOptions.forEach((option) => option.addEventListener('change', updatePremiumPlan));
		updatePremiumPlan();
		profileEditorPremiumButton.addEventListener('click', () => {
			premiumDialogStatus.hidden = true;
			premiumDialog.showModal();
		});
		premiumDialogCloseButton?.addEventListener('click', () => premiumDialog.close());
		premiumDialog.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				premiumDialog.close();
			}
		});
		premiumDialog.addEventListener('click', (event) => {
			if (event.target === premiumDialog) premiumDialog.close();
		});
		premiumDialogSubmitButton.addEventListener('click', async () => {
			if (!telegramWebApp?.initData || typeof telegramWebApp.openInvoice !== 'function') {
				premiumDialogStatus.textContent = 'Для тестовой оплаты откройте VYRN внутри Telegram.';
				premiumDialogStatus.hidden = false;
				return;
			}
			if (!window.VyrnApi?.isConfigured || typeof window.VyrnApi.createPremiumInvoice !== 'function') {
				premiumDialogStatus.textContent = 'Сервер оплаты не настроен. Попробуйте позже.';
				premiumDialogStatus.hidden = false;
				return;
			}
			const selectedPlan = premiumPlanOptions.find((option) => option.checked);
			if (!selectedPlan) {
				premiumDialogStatus.textContent = 'Выберите срок подписки.';
				premiumDialogStatus.hidden = false;
				return;
			}
			premiumDialogSubmitButton.disabled = true;
			premiumDialogStatus.hidden = true;
			try {
				const invoice = await window.VyrnApi.createPremiumInvoice(Number(selectedPlan.value));
				if (typeof invoice.invoice_url !== 'string' || !invoice.invoice_url) {
					throw new Error('Сервер не вернул ссылку на оплату.');
				}
				const paymentStatus = await new Promise((resolve, reject) => {
					try {
						telegramWebApp.openInvoice(invoice.invoice_url, resolve);
					} catch (error) {
						reject(error);
					}
				});
				if (paymentStatus === 'paid') {
					premiumDialogStatus.textContent = 'Оплата подтверждена Telegram. Активируем Premium…';
					window.setTimeout(async () => {
						try {
							const result = await window.refreshVyrnAccount();
							profileData.premium_until = result.profile.premium_until || null;
							profileData.status = result.profile.status || '';
							renderProfile();
							premiumDialogStatus.textContent = profileData.premium_until
								? 'VYRN Premium активирован.'
								: 'Telegram принял оплату. Активация ещё обрабатывается — обновите профиль позже.';
						} catch (error) {
							console.error('Не удалось обновить Premium после оплаты:', error);
							premiumDialogStatus.textContent = 'Оплата принята. Не удалось обновить профиль автоматически — откройте его заново.';
						}
					}, 1500);
				} else if (paymentStatus === 'pending') {
					premiumDialogStatus.textContent = 'Платёж обрабатывается. Premium активируется после подтверждения Telegram.';
				} else if (paymentStatus === 'cancelled') {
					premiumDialogStatus.textContent = 'Оплата отменена.';
				} else {
					premiumDialogStatus.textContent = 'Telegram не подтвердил оплату. Premium не активирован.';
				}
				premiumDialogStatus.hidden = false;
			} catch (error) {
				premiumDialogStatus.textContent = error.message || 'Не удалось создать счёт на оплату.';
				premiumDialogStatus.hidden = false;
			} finally {
				premiumDialogSubmitButton.disabled = false;
			}
		});
	}
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
			avatar: profileData.avatar,
			status: profileData.status,
			premium_until: profileData.premium_until,
			banner_color: profileData.banner_color,
			banner_gradient: profileData.banner_gradient
		};
		if (telegramUser) {
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
		} else if (window.VyrnApi?.browserDemo) {
			try {
				localStorage.setItem('vyrn.profile.editor.v1', JSON.stringify(nextProfile));
				storedProfile = nextProfile;
			} catch (error) {
				profileEditorError.textContent = `Не удалось сохранить профиль в этом браузере: ${error.message}`;
				profileEditorError.hidden = false;
				return;
			}
		} else {
			profileEditorError.textContent = 'Откройте профиль через Telegram, чтобы его изменить.';
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
	const visualId = item.attributes?.crafting?.visual_external_id || externalId;
	const collectionSlug = collection.slug || model.slug || '';
	return {
		itemId: item.id,
		slug: collectionSlug,
		id: externalId,
		name: model.name || collection.name || 'NFT',
		fragmentPriceStars: Number(model.attributes?.fragment_price_stars ?? item.attributes?.fragment_price_stars) || null,
		previewUrl: collectionSlug && item.external_id
			? getNftPreviewUrl(collectionSlug, visualId)
			: model.preview_url || '',
		animationUrl: collectionSlug && item.external_id
			? getNftAnimationUrl(`${collectionSlug}-${visualId}.tgs`)
			: model.animation_url || '',
		listingId: (item.market_listings || []).find((listing) => listing.status === 'active')?.id || '',
		isListed: (item.market_listings || []).some((listing) => listing.status === 'active')
	};
};
const collectionValueRequests = new WeakMap();
const getSavedFragmentValue = (item) => {
	const attributes = item.attributes || {};
	const value = attributes.fragment_price_fragment_stars
		?? (attributes.fragment_price_manual === true || attributes.fragment_price_crafted_total === true
			? null
			: attributes.fragment_price_stars);
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : null;
};
const renderProfileCollectionValue = async (container, items, { manageSkeleton = true } = {}) => {
	if (!container) return;
	if (manageSkeleton) setProfilePageSkeleton(container.closest('.profile-page'), true);
	const requestId = (collectionValueRequests.get(container) || 0) + 1;
	collectionValueRequests.set(container, requestId);
	const totalElement = container.querySelector('.profile-collection-value-total');
	const detailElement = container.querySelector('.profile-collection-value-detail');
	if (!totalElement || !detailElement) return;
	if (!items.length) {
		totalElement.textContent = '0';
		detailElement.textContent = 'В коллекции пока нет NFT';
		if (manageSkeleton) setProfilePageSkeleton(container.closest('.profile-page'), false);
		return;
	}

	const prices = new Map();
	const requests = [];
	items.forEach((item, index) => {
		const model = item.nft_models || {};
		const collection = model.nft_collections || {};
		const slug = collection.slug || model.slug || '';
		const giftNumber = item.attributes?.crafting?.visual_external_id || item.external_id;
		const savedPrice = getSavedFragmentValue(item);
		if (savedPrice !== null) prices.set(index, savedPrice);
		if (/^[a-z0-9]+$/.test(slug) && /^\d{1,12}$/.test(String(giftNumber || ''))) {
			requests.push({ index, collection_slug: slug, gift_number: String(giftNumber) });
		}
	});

	totalElement.textContent = 'Считаем…';
	detailElement.textContent = `${items.length.toLocaleString('ru-RU')} NFT · оценка по ценам`;
	const freshPrices = new Set();
	if (!window.VyrnApi?.fragmentPrices || requests.length === 0) {
		if (collectionValueRequests.get(container) !== requestId) return;
		renderTotal();
		return;
	}

	for (let offset = 0; offset < requests.length; offset += 40) {
		try {
			const batch = requests.slice(offset, offset + 40);
			const results = await window.VyrnApi.fragmentPrices(batch);
			const resultByKey = new Map(results.map((result) => [
				`${result.collection_slug}-${result.gift_number}`,
				result
			]));
			batch.forEach((gift) => {
				const result = resultByKey.get(`${gift.collection_slug}-${gift.gift_number}`);
				const stars = Number(result?.stars);
				if (Number.isFinite(stars) && stars > 0) {
					prices.set(gift.index, stars);
					freshPrices.add(gift.index);
				}
			});
		} catch (error) {
			console.warn('Не удалось оценить часть NFT по Fragment:', error);
		}
		if (collectionValueRequests.get(container) !== requestId) return;
	}

	function renderTotal() {
		const total = [...prices.values()].reduce((sum, price) => sum + price, 0);
		totalElement.replaceChildren(document.createTextNode(total.toLocaleString('ru-RU')));
		const icon = document.createElement('img');
		icon.src = './assets/stars.png';
		icon.alt = 'звёзд';
		icon.setAttribute('aria-hidden', 'true');
		totalElement.append(' ', icon);
		const valuedCount = prices.size;
		const unvaluedCount = items.length - valuedCount;
		const freshCount = freshPrices.size;
		if (unvaluedCount > 0) {
			detailElement.textContent = `Оценено ${valuedCount} из ${items.length} NFT · ${unvaluedCount} без данных`;
		} else if (freshCount === 0 && valuedCount > 0) {
			detailElement.textContent = '';
		} else if (freshCount < items.length) {
			detailElement.textContent = `Актуальные цены Fragment для ${freshCount} из ${items.length} NFT`;
		} else {
			detailElement.textContent = `Оценка всех ${items.length.toLocaleString('ru-RU')} NFT`;
		}
		if (manageSkeleton) setProfilePageSkeleton(container.closest('.profile-page'), false);
	}
	renderTotal();
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
		clearSkeletonState(collectionPreviewGrid);
		setBlockSkeleton(collectionPreviewGrid.closest('.collection-panel')?.querySelector('.collection-heading'), false);
		collectionTotal.textContent = `${items.length.toLocaleString('ru-RU')} NFT`;
		collectionPreviewGrid.replaceChildren();
		items.slice(0, 3).forEach((gift) => {
			const title = `${gift.name} #${gift.id}`;
			const imageSource = gift.previewUrl || getNftPreviewUrl(gift.slug, gift.id);
			const image = createNftPreviewImage(imageSource, title, 'collection-preview-image');
		image.loading = 'lazy';
		image.addEventListener('error', () => {
			image.src = './assets/placeholder.png';
		}, { once: true });
		collectionPreviewGrid.append(image);
		});
	};
	if (canLoadPlayerData()) {
		setBlockSkeleton(collectionPreviewGrid.closest('.collection-panel')?.querySelector('.collection-heading'), true);
		showSquareSkeletons(collectionPreviewGrid, 6, 'collection-preview-skeleton');
		window.VyrnApi.myNfts()
			.then(({ items }) => renderCollectionPreview(items.map(mapOwnedNft)))
			.catch(() => renderCollectionPreview([]));
	} else {
		renderCollectionPreview(nftCollection);
	}
	window.addEventListener('vyrn:cache-refresh', (event) => {
		if (event.detail?.action === 'my_nfts') {
			renderCollectionPreview((event.detail.result.items || []).map(mapOwnedNft));
		}
	});
}

const marketGrid = document.querySelector('.market-grid');
if (marketGrid) {
	const marketCollectionFilter = document.querySelector('.market-collection-filter');
	const marketModelFilter = document.querySelector('.market-model-filter');
	const marketBackdropFilter = document.querySelector('.market-backdrop-filter');
	const marketSymbolFilter = document.querySelector('.market-symbol-filter');
	const marketSort = document.querySelector('.market-sort');
	const marketFilterDialog = document.querySelector('.market-filter-dialog');
	const marketFilterForm = document.querySelector('.market-filter-panel');
	const marketFilterButton = document.querySelector('.market-filter-open');
	const marketFilterClose = document.querySelector('.market-filter-close');
	const marketFilterReset = document.querySelector('.market-filter-reset');
	const marketFilterStatus = document.querySelector('.market-filter-status');
	const marketEmpty = document.querySelector('.market-empty');
	const marketTradeButtons = [...document.querySelectorAll('.market-trade-button')];
	const marketTradeNav = document.querySelector('.market-trade-nav');
	const marketTradeIndicator = marketTradeNav.querySelector('.market-trade-indicator');
	const marketCards = [];
	let currentMarketCards = marketCards;
	let marketMode = 'all';
	const marketTraitCache = new Map();
	const marketTraitRequests = new Set();
	const selectedTraitFilters = { model: '', backdrop: '', symbol: '' };
	const marketFilters = [
		{ element: marketCollectionFilter, key: 'marketCollection', label: 'Все коллекции' },
		{ element: marketModelFilter, key: 'marketModel', label: 'Все модели' },
		{ element: marketBackdropFilter, key: 'marketBackdrop', label: 'Все фоны' },
		{ element: marketSymbolFilter, key: 'marketSymbol', label: 'Все символы' }
	];
	const updateMarketFilterOptions = (cards) => {
		marketFilters.forEach(({ element, key, label }) => {
			const selectedValue = element.value;
			const values = [...new Set(cards.map((card) => card.dataset[key]).filter(Boolean))]
				.sort((first, second) => first.localeCompare(second, 'ru'));
			element.replaceChildren(new Option(label, ''));
			values.forEach((value) => element.add(new Option(value, value)));
			element.value = values.includes(selectedValue) ? selectedValue : '';
		});
	};
	const getFragmentTrait = (attributes, traitName) => {
		const trait = attributes?.fragment_traits?.[traitName];
		return typeof trait?.name === 'string' ? trait.name.trim() : '';
	};
	const applyMarketTraits = (card, traits) => {
		if (!card.dataset.marketModel) card.dataset.marketModel = getFragmentTrait({ fragment_traits: traits }, 'model');
		if (!card.dataset.marketBackdrop) card.dataset.marketBackdrop = getFragmentTrait({ fragment_traits: traits }, 'backdrop');
		if (!card.dataset.marketSymbol) card.dataset.marketSymbol = getFragmentTrait({ fragment_traits: traits }, 'symbol');
	};
	const hasMarketTraits = (card) => Boolean(
		card.dataset.marketModel && card.dataset.marketBackdrop && card.dataset.marketSymbol,
	);
	const hydrateMarketTraits = (cards) => {
		currentMarketCards = cards;
		cards.forEach((card) => {
			const key = card.dataset.marketTraitKey;
			if (key && marketTraitCache.has(key)) applyMarketTraits(card, marketTraitCache.get(key));
		});
		updateMarketFilterOptions(cards);

		const pending = [...new Map(cards.filter((card) => card.dataset.marketTraitKey
			&& !hasMarketTraits(card)
			&& !marketTraitCache.has(card.dataset.marketTraitKey)
			&& !marketTraitRequests.has(card.dataset.marketTraitKey))
			.map((card) => [card.dataset.marketTraitKey, card])).values()];
		if (!pending.length) return;
		if (!window.VyrnApi?.isConfigured || typeof window.VyrnApi.fragmentPrices !== 'function') {
			marketFilterStatus.textContent = 'Подключите Supabase, чтобы загрузить атрибуты NFT с Fragment.';
			return;
		}

		marketFilterStatus.textContent = `Загружаем атрибуты Fragment: 0 из ${pending.length}…`;
		let failedCount = 0;
		let loadedCount = 0;
		pending.forEach((card) => marketTraitRequests.add(card.dataset.marketTraitKey));
		const batches = [];
		for (let index = 0; index < pending.length; index += 40) {
			batches.push(pending.slice(index, index + 40));
		}
		let nextBatch = 0;
		const worker = async () => {
			while (nextBatch < batches.length) {
				const batch = batches[nextBatch++];
				try {
					const results = await window.VyrnApi.fragmentPrices(batch.map((card) => ({
						collection_slug: card.dataset.marketSlug,
						gift_number: card.dataset.marketExternalId,
					})));
					const resultsByKey = new Map(results.map((result) => [
						`${result.collection_slug}-${result.gift_number}`,
						result,
					]));
					batch.forEach((card) => {
						const key = card.dataset.marketTraitKey;
						const result = resultsByKey.get(key);
						const traits = result?.traits && typeof result.traits === 'object' ? result.traits : {};
						const hasTraits = ['model', 'backdrop', 'symbol']
							.some((trait) => typeof traits[trait]?.name === 'string');
						marketTraitCache.set(key, traits);
						if (hasTraits) {
							currentMarketCards
								.filter((item) => item.dataset.marketTraitKey === key)
								.forEach((item) => applyMarketTraits(item, traits));
							loadedCount++;
						} else {
							failedCount++;
							console.warn(`Не удалось загрузить атрибуты Fragment для ${key}:`, result?.error || 'Атрибуты отсутствуют.');
						}
						marketTraitRequests.delete(key);
					});
					updateMarketFilterOptions(currentMarketCards);
				} catch (error) {
					batch.forEach((card) => {
						marketTraitCache.set(card.dataset.marketTraitKey, {});
						marketTraitRequests.delete(card.dataset.marketTraitKey);
					});
					failedCount += batch.length;
					console.warn('Не удалось загрузить пакет атрибутов Fragment:', error);
				}
				marketFilterStatus.textContent = `Загружаем атрибуты Fragment: ${loadedCount + failedCount} из ${pending.length}…`;
			}
		};
		Promise.all(Array.from({ length: Math.min(2, batches.length) }, worker)).then(() => {
			marketFilterStatus.textContent = failedCount
				? `Загружены атрибуты для ${loadedCount} NFT; для ${failedCount} NFT Fragment не вернул данные.`
				: `Загружены атрибуты для ${loadedCount} NFT.`;
		});
	};
	const syncFilterButton = () => {
		const selectedCount = Object.values(selectedTraitFilters).filter(Boolean).length;
		marketFilterButton.querySelector('span').textContent = selectedCount
			? `Фильтр · ${selectedCount}`
			: 'Фильтр';
	};
	const applyTraitFilters = () => {
		selectedTraitFilters.model = marketModelFilter.value;
		selectedTraitFilters.backdrop = marketBackdropFilter.value;
		selectedTraitFilters.symbol = marketSymbolFilter.value;
		syncFilterButton();
		renderMarketList();
	};
	const restoreTraitFilters = () => {
		marketModelFilter.value = selectedTraitFilters.model;
		marketBackdropFilter.value = selectedTraitFilters.backdrop;
		marketSymbolFilter.value = selectedTraitFilters.symbol;
	};
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
		card.dataset.marketSlug = gift.slug;
		card.dataset.marketExternalId = String(gift.id);
		card.dataset.marketTraitKey = `${gift.slug}-${gift.id}`;
		card.dataset.marketModel = '';
		card.dataset.marketBackdrop = '';
		card.dataset.marketSymbol = '';
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
		icon.src = './assets/stars.png';
		icon.alt = '';
		icon.setAttribute('aria-hidden', 'true');
		price.append(label, value, icon);
		content.append(heading, price);
		card.append(imageFrame, content);
		marketCards.push(card);
	});
	if (!canUseSupabaseAccount()) hydrateMarketTraits(marketCards);

	let marketRequestId = 0;
	const renderMarketList = async (refreshedResult = null, retryCount = 0) => {
		if (canUseSupabaseAccount()) {
			const requestId = ++marketRequestId;
			setBlockSkeleton(document.querySelector('.market-tools'), true);
			setBlockSkeleton(document.querySelector('.market-trade-nav'), true);
			marketGrid.setAttribute('aria-busy', 'true');
			marketEmpty.hidden = true;
			if (!refreshedResult) {
				marketGrid.replaceChildren(...Array.from({ length: 9 }, () => {
					const card = document.createElement('article');
					card.className = 'market-card market-skeleton-card';
					card.setAttribute('aria-hidden', 'true');
					const image = document.createElement('div');
					image.className = 'market-skeleton-image vyrn-skeleton';
					const content = document.createElement('div');
					content.className = 'market-skeleton-content';
					const title = document.createElement('span');
					title.className = 'market-skeleton-line vyrn-skeleton';
					const price = document.createElement('span');
					price.className = 'market-skeleton-line is-short vyrn-skeleton';
					content.append(title, price);
					card.append(image, content);
					return card;
				}));
			}
			try {
				const result = refreshedResult || await window.VyrnApi.market(marketMode);
				if (requestId !== marketRequestId) return;
				if (!Array.isArray(result?.items)) {
					throw new Error(result?.error || 'Не удалось загрузить список рынка. Попробуйте обновить страницу.');
				}
				const remoteCards = result.items.map((entry) => {
					const nft = entry.nft_items || {};
					const model = nft.nft_models || {};
					const collectionInfo = model.nft_collections || {};
					const itemId = nft.external_id || nft.id || entry.nft_item_id;
					const visualId = nft.attributes?.crafting?.visual_external_id || nft.external_id || itemId;
					const title = `${model.name || 'NFT'} #${itemId}`;
					const imageSource = collectionInfo.slug && nft.external_id
						? getNftPreviewUrl(collectionInfo.slug, visualId)
						: model.preview_url || (model.slug && itemId ? getNftPreviewUrl(model.slug, itemId) : './assets/placeholder.png');
					const card = document.createElement('article');
					card.className = 'market-card';
					card.dataset.marketCard = 'true';
					card.dataset.marketName = title.toLocaleLowerCase('ru-RU');
					card.dataset.marketCollection = model.name || collectionInfo.name || '';
					card.dataset.marketModel = getFragmentTrait(nft.attributes, 'model');
					card.dataset.marketBackdrop = getFragmentTrait(nft.attributes, 'backdrop');
					card.dataset.marketSymbol = getFragmentTrait(nft.attributes, 'symbol');
					card.dataset.marketSlug = collectionInfo.slug || '';
					card.dataset.marketExternalId = visualId || '';
					card.dataset.marketTraitKey = collectionInfo.slug && visualId
						? `${collectionInfo.slug}-${visualId}`
						: '';
					card.dataset.marketPrice = String(entry.price || 0);
					card.dataset.marketAnimation = collectionInfo.slug && nft.external_id
						? getNftAnimationUrl(`${collectionInfo.slug}-${visualId}.tgs`)
						: model.animation_url || '';
					card.dataset.marketPreview = imageSource;
					card.dataset.marketTitle = title;

					const imageFrame = document.createElement('div');
					imageFrame.className = 'market-card-image-frame';
					const image = createNftPreviewImage(imageSource, title, 'market-card-image');
					image.loading = 'lazy';
					image.addEventListener('error', () => { image.src = './assets/placeholder.png'; }, { once: true });
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
					if (entry.currency === 'ton') {
						currency.textContent = 'TON';
					} else {
						const currencyIcon = document.createElement('img');
						currencyIcon.className = 'stars-inline-icon';
						currencyIcon.src = './assets/stars.png';
						currencyIcon.alt = '';
						currencyIcon.setAttribute('aria-hidden', 'true');
						currency.append(currencyIcon);
					}
					price.append(label, value, currency);
					content.append(heading, price);
					const seller = entry.seller;
					const isPurchase = marketMode === 'purchases';
					const ownListing = !isPurchase && (marketMode === 'sales' || entry.seller_profile_id === result.current_profile_id);
					card.marketListing = {
						title,
						model: model.name || 'NFT',
						collection: collectionInfo.name || 'VYRN',
						owner: isPurchase || ownListing ? 'Вы' : getProfileDisplayName(seller),
						ownerAvatar: isPurchase || ownListing ? getTelegramUser()?.photo_url || '' : seller?.avatar_url || '',
						ownerProfile: {
							...(isPurchase || ownListing ? window.VyrnAccount?.profile || {} : seller || {}),
							id: isPurchase || ownListing ? result.current_profile_id : entry.seller_profile_id,
							status: isPurchase || ownListing ? result.current_profile_status : seller?.status
						},
						amount: entry.price || 0,
						currency: entry.currency || 'stars',
						actionLabel: isPurchase ? '' : ownListing ? 'Убрать с продажи' : 'Купить',
						action: isPurchase ? null : async () => {
							if (ownListing) {
								await window.VyrnApi.cancelListing(entry.id);
							} else {
								await window.VyrnApi.buyListing(entry.id);
								await window.refreshVyrnAccount();
							}
							await renderMarketList();
						}
					};
					card.append(imageFrame, content);
					return card;
				});
				hydrateMarketTraits(remoteCards);
				const visibleCards = remoteCards.filter((card) => {
					const matchesCollection = !marketCollectionFilter.value
						|| card.dataset.marketCollection === marketCollectionFilter.value;
					const matchesTraits = Object.entries(selectedTraitFilters).every(([trait, value]) =>
						!value || card.dataset[`market${trait[0].toUpperCase()}${trait.slice(1)}`] === value);
					return matchesCollection && matchesTraits;
				});
				visibleCards.forEach((card) => {
					card.setAttribute('role', 'button');
					card.tabIndex = 0;
					card.setAttribute('aria-haspopup', 'dialog');
				});
				if (marketSort.value === 'price-asc' || marketSort.value === 'price-desc') {
					const direction = marketSort.value === 'price-asc' ? 1 : -1;
					visibleCards.sort((first, second) => (Number(first.dataset.marketPrice) - Number(second.dataset.marketPrice)) * direction);
				} else {
					visibleCards.sort((first, second) => first.dataset.marketName.localeCompare(second.dataset.marketName, 'ru'));
				}
				marketGrid.replaceChildren(...visibleCards);
				marketGrid.setAttribute('aria-busy', 'false');
				setBlockSkeleton(document.querySelector('.market-tools'), false);
				setBlockSkeleton(document.querySelector('.market-trade-nav'), false);
				marketEmpty.hidden = visibleCards.length > 0;
				marketEmpty.textContent = marketMode === 'sales'
					? 'У вас пока нет объявлений о продаже'
					: marketMode === 'purchases' ? 'Покупок пока нет' : 'Ничего не найдено';
				marketEmpty.hidden = visibleCards.length > 0;
				return;
			} catch (error) {
				if (requestId !== marketRequestId) return;
				if (retryCount === 0) {
					marketEmpty.textContent = 'Загружаем рынок. Подождите...';
					marketEmpty.hidden = false;
					window.setTimeout(() => {
						if (requestId === marketRequestId) renderMarketList(null, 1);
					}, 700);
					return;
				}
				console.error('Не удалось загрузить список рынка:', error);
				marketGrid.replaceChildren();
				marketGrid.setAttribute('aria-busy', 'false');
				setBlockSkeleton(document.querySelector('.market-tools'), false);
				setBlockSkeleton(document.querySelector('.market-trade-nav'), false);
				marketEmpty.textContent = error.message;
				marketEmpty.hidden = false;
				return;
			}
		}
		updateMarketFilterOptions(marketCards);
		const visibleCards = marketMode === 'all' ? marketCards.filter((card) => {
			const matchesCollection = !marketCollectionFilter.value
				|| card.dataset.marketCollection === marketCollectionFilter.value;
			const matchesTraits = Object.entries(selectedTraitFilters).every(([trait, value]) =>
				!value || card.dataset[`market${trait[0].toUpperCase()}${trait.slice(1)}`] === value);
			return matchesCollection && matchesTraits;
		}) : [];
		visibleCards.forEach((card) => {
			card.setAttribute('role', 'button');
			card.tabIndex = 0;
			card.setAttribute('aria-haspopup', 'dialog');
		});
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

	window.addEventListener('vyrn:cache-refresh', (event) => {
		if (event.detail?.action === 'market' && event.detail.payload.mode === marketMode) {
			renderMarketList(event.detail.result);
		}
	});
	marketCollectionFilter.addEventListener('change', renderMarketList);
	marketSort.addEventListener('change', renderMarketList);
	marketFilterButton.addEventListener('click', () => {
		restoreTraitFilters();
		marketFilterDialog.showModal();
	});
	marketFilterClose.addEventListener('click', () => marketFilterDialog.close());
	marketFilterDialog.addEventListener('close', restoreTraitFilters);
	marketFilterReset.addEventListener('click', () => {
		marketModelFilter.value = '';
		marketBackdropFilter.value = '';
		marketSymbolFilter.value = '';
		applyTraitFilters();
		marketFilterDialog.close();
	});
	marketFilterForm.addEventListener('submit', (event) => {
		event.preventDefault();
		applyTraitFilters();
		marketFilterDialog.close();
	});
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
		if (!card) return;

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
		card.classList.toggle('is-listed', Boolean(gift.isListed));
		card.dataset.nftSrc = source;
		card.dataset.nftLink = file ? `https://nft.fragment.com/gift/${file}` : '';
		card.dataset.nftPreview = gift.previewUrl || (gift.slug ? getNftPreviewUrl(gift.slug, gift.id) : './assets/placeholder.png');
		card.dataset.nftTitle = title;
		card.dataset.nftModel = gift.name;
		card.dataset.nftFile = file;
		card.dataset.nftFragmentPriceStars = gift.fragmentPriceStars ? String(gift.fragmentPriceStars) : '';
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
	const renderOwnedNfts = (items) => {
		const coordinatedLoad = isProfilePageLoading();
		nftGrid.replaceChildren();
		if (!coordinatedLoad) clearSkeletonState(nftGrid);
		cards = items.map((item) => renderNftCard(mapOwnedNft(item)));
		const collectionValuePromise = renderProfileCollectionValue(
			document.querySelector('.profile-page:not(.player-profile-page) .profile-collection-value'),
			items,
			{ manageSkeleton: !coordinatedLoad }
		);
		if (coordinatedLoad) {
			setProfilePageSkeleton(document.querySelector('.profile-page:not(.player-profile-page)'), true);
			completeProfilePageLoadPart('nfts');
			collectionValuePromise
				.catch((error) => console.error('Не удалось оценить коллекцию профиля:', error))
				.finally(() => completeProfilePageLoadPart('value'));
		}
		filterProfileNftCards();
		updateVisibleNftCards();
	};
	if (canLoadPlayerData()) {
		showSquareSkeletons(nftGrid, 9, 'profile-nft-skeleton');
		window.VyrnApi.myNfts().then(({ items }) => renderOwnedNfts(items)).catch((error) => {
			nftGrid.replaceChildren();
			cards = [];
			const errorState = document.createElement('p');
			errorState.className = 'profile-load-error';
			errorState.setAttribute('role', 'status');
			errorState.textContent = 'Не удалось загрузить коллекцию NFT';
			nftGrid.append(errorState);
			console.error('Не удалось загрузить коллекцию профиля:', error);
			if (isProfilePageLoading()) {
				completeProfilePageLoadPart('nfts');
				const valueContainer = document.querySelector('.profile-page:not(.player-profile-page) .profile-collection-value');
				const total = valueContainer?.querySelector('.profile-collection-value-total');
				const detail = valueContainer?.querySelector('.profile-collection-value-detail');
				if (total) total.textContent = '—';
				if (detail) detail.textContent = 'Не удалось загрузить оценку коллекции';
				completeProfilePageLoadPart('value');
			} else {
				clearSkeletonState(nftGrid);
			}
		});
	}
	window.addEventListener('vyrn:cache-refresh', (event) => {
		if (event.detail?.action === 'my_nfts') renderOwnedNfts(event.detail.result.items || []);
	});
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

const playerProfileDialog = document.createElement('dialog');
playerProfileDialog.className = 'player-profile-dialog';
playerProfileDialog.setAttribute('aria-label', 'Профиль игрока');
playerProfileDialog.innerHTML = `
<section class="conversation-profile player-profile-view">
  <button class="profile-edit-button player-profile-back" type="button" aria-label="Закрыть профиль игрока">Назад</button>
  <main class="profile-page player-profile-page">
    <div class="profile-content">
      <section class="profile-summary" aria-labelledby="shared-player-profile-name">
        <button class="profile-avatar" type="button" aria-label="Аватар игрока" aria-expanded="false"></button>
        <h1 class="profile-name" id="shared-player-profile-name"></h1>
        <p class="profile-status">профиль игрока</p>
      </section>
      <section class="profile-details" aria-label="Информация профиля">
        <div class="profile-detail"><h2 class="profile-detail-label">Имя пользователя</h2><p class="profile-detail-value player-profile-username"></p></div>
        <div class="profile-detail"><h2 class="profile-detail-label">О себе</h2><p class="profile-detail-value player-profile-bio"></p></div>
      </section>
      <section class="profile-collection-value" aria-label="Ценность коллекции" aria-live="polite">
        <div>
          <span class="profile-collection-value-label">Ценность коллекции</span>
          <strong class="profile-collection-value-total">Считаем…</strong>
        </div>
        <p class="profile-collection-value-detail">Оценка по ценам</p>
      </section>
      <section class="profile-nft-grid player-profile-nft-grid" aria-label="NFT игрока"></section>
    </div>
  </main>
</section>`;
document.body.append(playerProfileDialog);

const sharedPlayerProfileName = playerProfileDialog.querySelector('.profile-name');
const sharedPlayerProfileAvatar = playerProfileDialog.querySelector('.profile-avatar');
const sharedPlayerProfileUsername = playerProfileDialog.querySelector('.player-profile-username');
const sharedPlayerProfileBio = playerProfileDialog.querySelector('.player-profile-bio');
const sharedPlayerProfileNfts = playerProfileDialog.querySelector('.player-profile-nft-grid');
let sharedPlayerProfileRequestId = 0;
let sharedPlayerProfileData = null;

const renderSharedPlayerProfile = (profile, items = []) => {
	if (sharedPlayerProfileData?.id === profile.id) {
		const cachedProfile = sharedPlayerProfileData;
		profile = {
			...cachedProfile,
			...profile,
			status: getProfileStatus(profile) || getProfileStatus(cachedProfile)
		};
	}
	sharedPlayerProfileData = profile;
	const displayName = getProfileDisplayName(profile);
	const profilePage = playerProfileDialog.querySelector('.player-profile-page');
	profilePage.dataset.profileId = profile.id || '';
	profilePage.dataset.accountStatus = getProfileStatus(profile);
	renderProfileBanner(profilePage, profile);
	renderProfileName(sharedPlayerProfileName, displayName, getProfileStatus(profile));
	sharedPlayerProfileUsername.textContent = profile.username ? `@${profile.username.replace(/^@+/, '')}` : `@${profile.nickname || ''}`;
	sharedPlayerProfileBio.textContent = profile.bio || '';
	sharedPlayerProfileAvatar.replaceChildren();
	sharedPlayerProfileAvatar.setAttribute('aria-label', `Аватар ${displayName}`);
	if (profile.avatar_url) {
		const avatar = document.createElement('img');
		avatar.className = 'profile-avatar-image';
		avatar.src = profile.avatar_url;
		avatar.alt = '';
		sharedPlayerProfileAvatar.append(avatar);
	} else {
		sharedPlayerProfileAvatar.textContent = displayName.slice(0, 1).toLocaleUpperCase('ru-RU');
	}
	sharedPlayerProfileNfts.replaceChildren();
	clearSkeletonState(sharedPlayerProfileNfts);
	items.map(mapOwnedNft).forEach((gift) => {
		const title = `${gift.name} #${gift.id}`;
		const file = gift.slug ? `${gift.slug}-${gift.id}.tgs` : '';
		const card = document.createElement('button');
		card.className = 'profile-nft-cell';
		card.type = 'button';
		card.dataset.nftItemId = '';
		card.dataset.nftListed = String(Boolean(gift.isListed));
		card.dataset.nftListingId = gift.listingId || '';
		card.classList.toggle('is-listed', Boolean(gift.isListed));
		card.dataset.nftSrc = gift.animationUrl || (file ? getNftAnimationUrl(file) : '');
		card.dataset.nftPreview = gift.previewUrl || './assets/placeholder.png';
		card.dataset.nftTitle = title;
		card.dataset.nftModel = gift.name;
		card.dataset.nftFile = file;
		card.dataset.nftFragmentPriceStars = gift.fragmentPriceStars ? String(gift.fragmentPriceStars) : '';
		card.setAttribute('aria-label', `Открыть ${title}`);
		card.append(createNftPreviewImage(card.dataset.nftPreview, title, 'profile-nft-preview'));
		sharedPlayerProfileNfts.append(card);
	});
	renderProfileCollectionValue(
		playerProfileDialog.querySelector('.profile-collection-value'),
		items
	);
};

window.openVyrnPlayerProfile = async (profileOrId) => {
	const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id || profileOrId?.profileId;
	if (!profileId) return;
	const requestId = ++sharedPlayerProfileRequestId;
	const providedProfile = typeof profileOrId === 'object' ? profileOrId : {};
	const cachedProfile = sharedPlayerProfileData?.id === profileId ? sharedPlayerProfileData : null;
	const initialProfile = providedProfile.first_name || providedProfile.last_name || providedProfile.nickname
		? providedProfile
		: cachedProfile || providedProfile;
	if (!playerProfileDialog.open || !cachedProfile) {
		renderSharedPlayerProfile(initialProfile, cachedProfile ? [...sharedPlayerProfileNfts.children] : []);
	}
	if (!cachedProfile && !sharedPlayerProfileNfts.children.length) {
		showSquareSkeletons(sharedPlayerProfileNfts, 9, 'profile-nft-skeleton');
	}
	setProfilePageSkeleton(playerProfileDialog.querySelector('.player-profile-page'), true);
	if (!playerProfileDialog.open) playerProfileDialog.showModal();
	requestAnimationFrame(() => {
		if (playerProfileDialog.open && sharedPlayerProfileData?.id === profileId) {
			renderProfileBanner(playerProfileDialog.querySelector('.player-profile-page'), sharedPlayerProfileData);
		}
	});
	try {
		const result = await window.VyrnApi.profileNfts(profileId);
		if (requestId !== sharedPlayerProfileRequestId || !playerProfileDialog.open) return;
		const loadedProfile = result.profile
			? {
				...initialProfile,
				...result.profile,
				status: getProfileStatus(result.profile) || result.status || getProfileStatus(initialProfile)
			}
			: {
				...initialProfile,
				status: result.status || getProfileStatus(initialProfile)
			};
		renderSharedPlayerProfile(loadedProfile, result.items || []);
	} catch (error) {
		if (requestId === sharedPlayerProfileRequestId) {
			sharedPlayerProfileNfts.replaceChildren();
			clearSkeletonState(sharedPlayerProfileNfts);
			setProfilePageSkeleton(playerProfileDialog.querySelector('.player-profile-page'), false);
			sharedPlayerProfileBio.textContent = error.message || 'Не удалось загрузить профиль';
		}
	}
};

window.addEventListener('vyrn:cache-refresh', (event) => {
	const detail = event.detail;
	if (detail?.action !== 'profile_nfts'
		|| detail.payload.profile_id !== sharedPlayerProfileData?.id
		|| !playerProfileDialog.open) return;
	const result = detail.result;
	const profile = result.profile
		? {
			...sharedPlayerProfileData,
			...result.profile,
			status: getProfileStatus(result.profile) || result.status || getProfileStatus(sharedPlayerProfileData)
		}
		: { ...sharedPlayerProfileData, status: result.status || getProfileStatus(sharedPlayerProfileData) };
	renderSharedPlayerProfile(profile, result.items || []);
});

playerProfileDialog.querySelector('.player-profile-back').addEventListener('click', () => playerProfileDialog.close());
playerProfileDialog.addEventListener('click', (event) => {
	if (event.target === playerProfileDialog) playerProfileDialog.close();
});

const nftGrids = [...document.querySelectorAll('.profile-nft-grid')];
const nftModal = document.querySelector('.nft-modal');
const nftModalAnimation = document.querySelector('.nft-modal-animation');
const nftModalBackdrop = document.querySelector('.nft-modal-backdrop');
if ((nftGrids.length || marketGrid) && nftModal && nftModalAnimation && nftModalBackdrop) {
	const nftModalArt = nftModal.querySelector('.nft-modal-art');
	const nftModalTitle = nftModal.querySelector('#nft-modal-title');
	const nftModalCollection = nftModal.querySelector('.nft-modal-collection');
	const nftModalCollectionName = nftModal.querySelector('.nft-modal-collection-name');
	const nftModalOwner = nftModal.querySelector('.nft-modal-owner');
	const nftModalOwnerLink = nftModal.querySelector('.nft-modal-owner-link');
	const nftModalOwnerAvatar = nftModal.querySelector('.nft-modal-owner-avatar');
	const nftModalOwnerName = nftModal.querySelector('.nft-modal-owner-name');
	const nftModalModel = nftModal.querySelector('.nft-modal-model');
	const nftModalPrice = nftModal.querySelector('.nft-modal-price');
	const nftModalPriceLabel = nftModalPrice.parentElement.querySelector('dt');
	const nftModalConfirm = nftModal.querySelector('.nft-modal-confirm');
	const nftModalSellButton = nftModal.querySelector('.nft-modal-sell-button');
	const nftModalError = nftModal.querySelector('.nft-modal-error');
	const nftModalErrorMessage = nftModal.querySelector('[data-nft-modal-error]');
	const nftModalErrorWalletLink = nftModalError?.querySelector('a');
	const nftListingDialog = document.querySelector('.nft-listing-dialog');
	const nftListingForm = nftListingDialog?.querySelector('.nft-listing-form');
	const nftListingPrice = nftListingDialog?.querySelector('#nft-listing-price');
	const nftListingError = nftListingDialog?.querySelector('.nft-listing-error');
	const nftListingSubmit = nftListingDialog?.querySelector('.nft-listing-submit');
	let activeNftCard;
	let activeNftAnimation;
	let activeNftBackdrop;
	let activeNftModalAction;
	let activeNftOwnerProfile;
	let activeNftPriceCurrency = 'stars';
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

	const setNftModalPrice = (price, currency = 'stars') => {
		if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
			nftModalPrice.textContent = 'Нет данных';
			return;
		}
		const priceValue = document.createElement('span');
		priceValue.textContent = currency === 'ton'
			? formatMarketPrice(price, currency)
			: Number(price).toLocaleString('ru-RU');
		if (currency === 'ton') {
			const currencyLabel = document.createElement('span');
			currencyLabel.textContent = 'TON';
			nftModalPrice.replaceChildren(priceValue, currencyLabel);
			return;
		}
		const currencyIcon = document.createElement('img');
		currencyIcon.className = 'nft-modal-price-icon';
		currencyIcon.src = './assets/stars.png';
		currencyIcon.alt = '';
		currencyIcon.setAttribute('aria-hidden', 'true');
		nftModalPrice.replaceChildren(priceValue, currencyIcon);
	};

	const loadNftPrice = (fileName = '', fragmentPriceStars = null) => {
		if (fragmentPriceStars !== null && Number.isFinite(Number(fragmentPriceStars))) {
			setNftModalPrice(fragmentPriceStars);
			return;
		}
		const giftId = fileName.replace(/\.tgs$/, '');
		const gift = nftCollection.find((item) => `${item.slug}-${item.id}` === giftId);
		if (!gift) {
			setNftModalPrice(null);
			return;
		}
		setNftModalPrice(Math.round(gift.lastSaleTon * 100));
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

	window.openVyrnNftModal = ({ card = null, title, model, source, preview, file = '', owner = '', ownerAvatar = '', ownerProfile = null, collection = 'VYRN', fragmentPriceStars = null, priceStars = null, priceCurrency = 'stars', confirmText = '', onConfirm = null }) => {
		nftModalTitle.textContent = title;
		nftModalCollection.textContent = `Коллекция ${collection}`;
		if (nftModalCollectionName) nftModalCollectionName.textContent = collection;
		if (nftModalError) nftModalError.hidden = true;
		if (nftModalErrorWalletLink) nftModalErrorWalletLink.hidden = true;
		const ownerName = owner || card?.closest('.profile-page')?.querySelector('.profile-name')?.textContent.trim() || '';
		activeNftCard = card;
		activeNftModalAction = onConfirm;
		const isOwnProfileItem = Boolean(card?.closest('.profile-page:not(.player-profile-page)'));
		const profilePage = card?.closest('.player-profile-page');
		const profilePageId = profilePage?.dataset.profileId;
		activeNftOwnerProfile = ownerProfile || (profilePageId
			? sharedPlayerProfileData?.id === profilePageId
				? sharedPlayerProfileData
				: { id: profilePageId, status: profilePage.dataset.accountStatus || '' }
			: isOwnProfileItem ? window.VyrnAccount?.profile || null : null);
		nftModalOwnerLink.disabled = !activeNftOwnerProfile?.id && !isOwnProfileItem;
		nftModalOwnerLink.setAttribute('aria-label', activeNftOwnerProfile?.id ? `Открыть профиль ${ownerName}` : ownerName);
		activeNftPriceCurrency = priceCurrency;
		renderProfileName(nftModalOwnerName, ownerName, getProfileStatus(activeNftOwnerProfile));
		const profileAvatar = card?.closest('.profile-page')?.querySelector('.profile-avatar-image, .player-profile-avatar-art img');
		const avatarSource = ownerAvatar || profileAvatar?.currentSrc || profileAvatar?.src || '';
		nftModalOwnerAvatar.hidden = !avatarSource;
		if (avatarSource) {
			nftModalOwnerAvatar.src = avatarSource;
			nftModalOwnerAvatar.onerror = () => {
				nftModalOwnerAvatar.hidden = true;
			};
		} else {
			nftModalOwnerAvatar.removeAttribute('src');
			nftModalOwnerAvatar.onerror = null;
		}
		nftModalModel.textContent = model;
		nftModalConfirm.textContent = confirmText || (onConfirm ? 'Подтвердить покупку' : 'OK');
		nftModalPriceLabel.textContent = priceStars !== null ? 'Цена' : 'Ценность (FRAGMENT)';
		if (nftModalSellButton) {
			const canManageListing = Boolean(card?.dataset.nftItemId);
			const isListed = card?.dataset.nftListed === 'true';
			nftModalSellButton.hidden = !canManageListing;
			nftModalSellButton.textContent = isListed ? 'Снять с продажи' : 'Продать';
		}
		clearNftAnimation();
		nftModal.showModal();
		nftModal.querySelector('.nft-modal-close').focus();
		loadModalAnimation(source, preview, title);
		loadNftPrice(file, fragmentPriceStars ?? card?.dataset.nftFragmentPriceStars ?? null);
		if (priceStars !== null) {
			setNftModalPrice(priceStars, priceCurrency);
		}
	};

	nftModalOwnerLink.addEventListener('click', async () => {
		let ownerProfile = activeNftOwnerProfile;
		if (!ownerProfile?.id && activeNftCard?.closest('.profile-page:not(.player-profile-page)')) {
			try {
				const account = await (window.VyrnAccountPromise || window.refreshVyrnAccount?.());
				ownerProfile = account?.profile;
			} catch {
				return;
			}
		}
		if (!ownerProfile?.id) return;
		nftModal.close();
		window.openVyrnPlayerProfile(ownerProfile);
	});

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
				file: nftCard.dataset.nftFile,
				fragmentPriceStars: nftCard.dataset.nftFragmentPriceStars || null
			});
		});
	});

	if (marketGrid) {
		const openMarketCard = (card) => {
			const listing = card.marketListing || {
				title: card.dataset.marketTitle,
				model: card.dataset.marketCollection,
				collection: 'VYRN',
				owner: 'VYRN Market',
				amount: card.dataset.marketPrice,
				currency: 'stars',
				actionLabel: '',
				action: null
			};
			window.openVyrnNftModal({
				card,
				title: listing.title,
				model: listing.model,
				collection: listing.collection,
				source: card.dataset.marketAnimation,
				preview: card.dataset.marketPreview,
				owner: listing.owner,
				ownerAvatar: listing.ownerAvatar,
				ownerProfile: listing.ownerProfile,
				priceStars: listing.amount,
				priceCurrency: listing.currency,
				confirmText: listing.actionLabel || 'Закрыть',
				onConfirm: listing.action
			});
		};
		marketGrid.addEventListener('click', (event) => {
			const card = event.target.closest('.market-card');
			if (card) openMarketCard(card);
		});
		marketGrid.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			const card = event.target.closest('.market-card');
			if (!card) return;
			event.preventDefault();
			openMarketCard(card);
		});
	}

	const updateListingState = (isListed, listingId = '') => {
		if (!activeNftCard) return;
		activeNftCard.dataset.nftListed = String(isListed);
		activeNftCard.dataset.nftListingId = listingId;
		activeNftCard.classList.toggle('is-listed', isListed);
		if (nftModalSellButton) {
			nftModalSellButton.textContent = isListed ? 'Снять с продажи' : 'Продать';
		}
		filterProfileNftCards();
	};

	nftModalSellButton?.addEventListener('click', async () => {
		if (!activeNftCard?.dataset.nftItemId) return;
		if (activeNftCard.dataset.nftListed === 'true') {
			nftModalSellButton.disabled = true;
			try {
				await window.VyrnApi.cancelListing(activeNftCard.dataset.nftListingId);
				updateListingState(false);
			} catch (error) {
				window.alert(error.message);
			} finally {
				nftModalSellButton.disabled = false;
			}
			return;
		}
		if (!nftListingDialog || !nftListingPrice) return;
		nftListingForm.reset();
		nftListingError.hidden = true;
		nftListingDialog.showModal();
		nftListingPrice.focus();
	});

	nftListingForm?.addEventListener('submit', async (event) => {
		event.preventDefault();
		const price = Number(nftListingPrice.value);
		if (!activeNftCard?.dataset.nftItemId || !Number.isSafeInteger(price) || price <= 0) {
			nftListingPrice.focus();
			return;
		}
		nftListingError.hidden = true;
		nftListingSubmit.disabled = true;
		try {
			const result = await window.VyrnApi.createListing(activeNftCard.dataset.nftItemId, price, 'stars');
			updateListingState(true, result.listing.id);
			nftListingDialog.close();
		} catch (error) {
			nftListingError.textContent = error.message || 'Не удалось выставить NFT';
			nftListingError.hidden = false;
		} finally {
			nftListingSubmit.disabled = false;
		}
	});

	nftListingDialog?.querySelector('.nft-listing-cancel').addEventListener('click', () => nftListingDialog.close());
	nftListingDialog?.querySelector('.nft-listing-close').addEventListener('click', () => nftListingDialog.close());
	nftListingDialog?.addEventListener('click', (event) => {
		if (event.target === nftListingDialog) nftListingDialog.close();
	});

	const closeNftModal = () => nftModal.close();
	nftModal.querySelector('.nft-modal-close').addEventListener('click', closeNftModal);
	nftModalConfirm.addEventListener('click', async () => {
		if (!activeNftModalAction) {
			closeNftModal();
			return;
		}

		nftModalConfirm.disabled = true;
		try {
			await activeNftModalAction();
			closeNftModal();
		} catch (error) {
			const insufficientBalance = /insufficient balance/i.test(error.message || '');
			if (nftModalError && nftModalErrorMessage && nftModalErrorWalletLink) {
				nftModalErrorMessage.textContent = insufficientBalance
					? `Недостаточно ${activeNftPriceCurrency === 'ton' ? 'TON' : 'Stars'} для покупки.`
					: error.message || 'Не удалось выполнить действие.';
				nftModalErrorWalletLink.hidden = !insufficientBalance;
				nftModalError.hidden = false;
			} else {
				window.alert(error.message);
			}
		} finally {
			nftModalConfirm.disabled = false;
		}
	});
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
		activeNftModalAction = null;
		nftModalConfirm.textContent = 'OK';
		nftModalPriceLabel.textContent = 'Стоимость';
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

if (bottomNav && navIndicator && activeItem) {
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

}

let chatRows = [...document.querySelectorAll('.chat-row')];
let addRemoteChatRow;
const conversationDialog = document.querySelector('.conversation-dialog');
const chatsPage = document.querySelector('.chats-page');
const chatsSearchInput = chatsPage?.querySelector('.chats-search-input');
const chatsProfileResults = chatsPage?.querySelector('.chats-profile-results');
const chatsProfileError = chatsPage?.querySelector('.chats-profile-error');
const chatsSearchClear = chatsPage?.querySelector('.chats-search-clear');
const chatsProfileResultList = chatsPage?.querySelector('.chats-profile-result-list');
const chatList = chatsPage?.querySelector('.chat-list');
const chatSkeletons = chatList ? Array.from({ length: 3 }, () => {
	const row = document.createElement('div');
	row.className = 'chat-skeleton-row';
	row.setAttribute('aria-hidden', 'true');
	const avatar = document.createElement('span');
	avatar.className = 'chat-skeleton-avatar vyrn-skeleton';
	const copy = document.createElement('span');
	copy.className = 'chat-skeleton-copy';
	const title = document.createElement('span');
	title.className = 'chat-skeleton-line vyrn-skeleton';
	const subtitle = document.createElement('span');
	subtitle.className = 'chat-skeleton-line is-short vyrn-skeleton';
	copy.append(title, subtitle);
	row.append(avatar, copy);
	return row;
}) : [];
const setChatListLoading = (loading) => {
	if (!chatList) return;
	chatSkeletons.forEach((row) => row.remove());
	if (loading) chatList.append(...chatSkeletons);
	chatList.classList.toggle('is-loading', loading);
	chatList.setAttribute('aria-busy', String(loading));
};

if (chatsPage && chatsSearchInput) {
	if (canUseSupabaseAccount()) setChatListLoading(true);
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
		renderProfileName(name, getProfileDisplayName(result.peer), result.peer.status);
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
	const playerProfileValue = conversationProfile.querySelector('.profile-collection-value');
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
	let activeMessageAnimation;
	let activeMessageMenuAnimation;
	let activeDeleteActionAnimation;
	let messageRefreshTimer;
	let messageRefreshInFlight = false;
	let selectedGiftItem;
	let giftPickerRequestId = 0;
	const pendingRemoteMessages = new Map();
	const formatRemoteMessages = (messages) => messages.map((message) => ({
		id: message.id,
		text: message.body,
		time: new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.created_at)),
		createdAt: message.created_at,
		outgoing: message.sender_profile_id === remoteProfileId,
		senderName: message.profiles ? getProfileDisplayName(message.profiles) : '',
		senderAvatar: message.profiles?.avatar_url || '',
		senderProfileId: message.profiles?.id || message.sender_profile_id,
		senderProfile: message.profiles || null,
		gift: message.gift_offer || null
	}));
	const getMessageListKey = (messages) => JSON.stringify(messages.map((message) => ({
		id: message.id || null,
		text: message.text,
		time: message.time,
		outgoing: message.outgoing,
		senderName: message.senderName || '',
		senderAvatar: message.senderAvatar || '',
		senderStatus: message.senderProfile?.status || '',
		giftId: message.gift?.id || null,
		giftStatus: message.gift?.status || null,
		giftResponseStatus: message.gift?.response?.status || null,
		giftPrice: message.gift?.price_stars ?? null
	})));
	const refreshActiveMessages = async () => {
		if (document.hidden || !activeServerChatId || activeChatIndex < 0 || !window.VyrnApi
			|| messageRefreshInFlight || !messageActionMenu.hidden) return;
		const chatId = activeServerChatId;
		messageRefreshInFlight = true;
		if (conversationMessageList.dataset.loaded !== 'true') setBlockSkeleton(conversationMessageList, true);
		let switchedChat = false;
		try {
			const result = await window.VyrnApi.messages(chatId);
			if (chatId !== activeServerChatId || activeChatIndex < 0) {
				switchedChat = true;
				return;
			}
			if (!messageActionMenu.hidden) return;
			conversationMessageList.dataset.loaded = 'true';
			setBlockSkeleton(conversationMessageList, false);
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
			const chatRow = chatRows.find((row) => row.dataset.chatId === chatId);
			if (chatRow) {
				const latestMessage = result.messages.at(-1);
				updateChatRowSummary(chatRow, { last_message: latestMessage, unread_count: 0 });
				sortChatRows();
			}
			if (getMessageListKey(currentMessages) === getMessageListKey(nextMessages)) return;
			conversationThreads[activeChatIndex] = nextMessages;
			if (activeChatIndex === favoritesChatIndex) {
				favoritesPreview.textContent = nextMessages.at(-1)?.text || 'Ваши сохранённые сообщения';
			}
			renderConversationMessages();
		} catch (error) {
			if (chatId === activeServerChatId) {
				conversationMessageList.dataset.loaded = 'false';
				setBlockSkeleton(conversationMessageList, false);
			}
			console.error('Не удалось загрузить сообщения чата:', error);
		} finally {
			messageRefreshInFlight = false;
			if (switchedChat && activeServerChatId && !document.hidden) {
				window.setTimeout(() => refreshActiveMessages(), 0);
			}
		}
	};
	const startMessageRefresh = () => {
		clearInterval(messageRefreshTimer);
		messageRefreshTimer = setInterval(() => refreshActiveMessages().catch(() => {}), 10000);
	};
	const favoritesPreview = chatRows[favoritesChatIndex]?.querySelector('.chat-message');
	let chatListRefreshInFlight = false;
	const sortChatRows = () => {
		const list = document.querySelector('.chat-list');
		if (!list) return;
		const directRows = chatRows
			.filter((row) => row.dataset.chatType === 'direct')
			.sort((first, second) => (Date.parse(second.dataset.lastMessageAt || '') || 0) - (Date.parse(first.dataset.lastMessageAt || '') || 0));
		const pinnedRows = chatRows.filter((row) => row.dataset.chatType !== 'direct');
		list.append(...directRows, ...pinnedRows);
	};
	const updateChatRowSummary = (row, summary = {}) => {
		const lastMessage = summary.last_message;
		const preview = row.querySelector('.chat-message');
		const unreadBadge = row.querySelector('.chat-unread');
		if (preview && lastMessage) preview.textContent = lastMessage.body;
		row.dataset.lastMessageAt = lastMessage?.created_at || summary.chats?.created_at || row.dataset.lastMessageAt || '';
		if (unreadBadge) {
			const unreadCount = Number(summary.unread_count) || 0;
			unreadBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
			unreadBadge.hidden = unreadCount === 0;
			row.classList.toggle('has-unread', unreadCount > 0);
			unreadBadge.setAttribute('aria-label', `${unreadCount} непрочитанных сообщений`);
		}
	};
	const refreshChatList = async (refreshedResult = null) => {
		if (document.hidden || !window.VyrnApi || !chatsPage || conversationDialog?.open || chatListRefreshInFlight) return;
		chatListRefreshInFlight = true;
		try {
			const result = refreshedResult || await window.VyrnApi.chats();
			result.chats.filter((member) => member.chats?.chat_type === 'direct' && member.peer).forEach((member) => {
				const row = addRemoteChatRow(member.chat_id, member.peer, member);
				updateChatRowSummary(row, member);
			});
			sortChatRows();
		} catch {
		} finally {
			chatListRefreshInFlight = false;
		}
	};
	window.addEventListener('vyrn:cache-refresh', (event) => {
		if (event.detail?.action === 'chats') refreshChatList(event.detail.result);
	});
	if (favoritesPreview && favoriteMessages.length) {
		favoritesPreview.textContent = favoriteMessages.at(-1).text;
	}
	if (canUseSupabaseAccount()) {
		window.VyrnApi.chats().then(async (result) => {
			remoteProfileId = result.current_profile_id;
			result.chats.filter((member) => member.chats?.chat_type === 'direct' && member.peer).forEach((member) => {
				const row = addRemoteChatRow(member.chat_id, member.peer, member);
				updateChatRowSummary(row, member);
			});
			sortChatRows();
			const deepLinkedChatId = new URLSearchParams(window.location.search).get('chat_id');
			if (deepLinkedChatId) {
				const deepLinkedChat = chatRows.find((row) => row.dataset.chatId === deepLinkedChatId);
				if (deepLinkedChat) {
					deepLinkedChat.click();
				} else {
					console.warn('Не удалось открыть диалог из ссылки: чат не найден среди чатов пользователя.');
				}
			}

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
		}).catch((error) => {
			console.error('Не удалось загрузить избранные сообщения:', error);
		}).finally(() => {
			setChatListLoading(false);
		});
		window.setInterval(refreshChatList, 30000);
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) {
				refreshChatList();
				if (activeServerChatId) refreshActiveMessages().catch(() => {});
			}
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
				const requestDelete = () => {
					const canDelete = activeChatIndex === favoritesChatIndex || Boolean(activeServerChatId);
					if (!canDelete || !messageActionMenu.hidden) {
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
					getComputedStyle(messageActionScrim).opacity;
					conversationScreen.classList.add('is-message-action-open');
					messageActionScrim.classList.add('is-active');
					if (typeof activeMessageClone.animate === 'function') {
						activeMessageAnimation = activeMessageClone.animate([
							{ opacity: 0.9, transform: 'scale(0.96) translateY(4px)' },
							{ opacity: 1, transform: 'scale(1.06) translateY(-5px)' }
						], {
							duration: 320,
							easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)',
							fill: 'forwards'
						});
					} else {
						requestAnimationFrame(() => activeMessageClone?.classList.add('is-raised'));
					}
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
					activeMessageMenuAnimation?.cancel();
					activeMessageMenuAnimation = messageActionMenu.animate([
						{ opacity: 0, transform: 'translateY(-6px) scale(0.94)' },
						{ opacity: 1, transform: 'translateY(0) scale(1)' }
					], {
						duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 180 : 300,
						easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)',
						fill: 'both'
					});
					activeDeleteActionAnimation?.cancel();
					activeDeleteActionAnimation = messageDeleteAction.animate([
						{ opacity: 0, transform: 'translateY(6px) scale(0.96)' },
						{ opacity: 1, transform: 'translateY(0) scale(1)' }
					], {
						duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 180 : 300,
						easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)',
						fill: 'both'
					});
					messageDeleteAction.focus();
				};
				bubble.addEventListener('click', (event) => {
					if (event.button !== 0) return;
					event.preventDefault();
					event.stopPropagation();
					requestDelete();
				});
				bubble.addEventListener('contextmenu', (event) => {
					event.preventDefault();
					requestDelete();
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
				const nftVisualId = nftItem.attributes?.crafting?.visual_external_id || nftItem.external_id;
				const nftTitle = `${nftModel.name || nftCollection.name || 'NFT'} #${nftId}`;
				const nftPreview = nftCollection.slug && nftItem.external_id
					? getNftPreviewUrl(nftCollection.slug, nftVisualId)
					: nftModel.preview_url || './assets/svg/placeholder.svg';
				const nftFile = nftCollection.slug && nftItem.external_id
					? `${nftCollection.slug}-${nftVisualId}.tgs`
					: '';
				const nftAnimation = nftCollection.slug && nftItem.external_id
					? getNftAnimationUrl(nftFile)
					: nftModel.animation_url || '';
				const fragmentPriceStars = nftItem.attributes?.fragment_price_stars ?? null;
				const senderName = message.senderName || (message.outgoing
					? getProfileDisplayName(getTelegramUser())
					: playerProfileName.textContent.trim()) || 'Игрок';
				const senderAvatar = message.senderAvatar || (message.outgoing ? getTelegramUser()?.photo_url : '');
				const senderProfile = message.senderProfile
					? { ...message.senderProfile, id: message.senderProfile.id || message.senderProfileId || offer.sender_profile_id }
					: message.outgoing
						? { id: offer.sender_profile_id || remoteProfileId, ...getTelegramUser() }
						: playerProfiles[activeChatIndex];
				const giftCard = document.createElement('section');
				giftCard.className = 'gift-telegram-card';
				const notification = document.createElement('p');
				notification.className = 'gift-telegram-notification';
				const peerName = playerProfileName.textContent.trim() || 'Собеседник';
				const appendPlayerNameToNotification = (prefix, name, suffix, status) => {
					notification.replaceChildren(document.createTextNode(prefix));
					const nameElement = document.createElement('span');
					renderProfileName(nameElement, name, status);
					notification.append(nameElement, document.createTextNode(suffix));
				};
				if (offer.price_stars > 0 && offer.status === 'declined') {
					if (message.outgoing) {
						appendPlayerNameToNotification('', peerName, ' отказался от вашего предложения', playerProfiles[activeChatIndex]?.accountStatus);
					} else {
						notification.textContent = 'Вы отказались от предложения';
					}
				} else if (offer.price_stars > 0 && offer.status === 'completed') {
					if (message.outgoing) {
						appendPlayerNameToNotification('', peerName, ' принял ваше предложение', playerProfiles[activeChatIndex]?.accountStatus);
					} else {
						notification.textContent = 'Вы приняли предложение';
					}
				} else if (offer.price_stars > 0) {
					if (message.outgoing) {
						notification.textContent = `Вы предложили NFT за ${Number(offer.price_stars).toLocaleString('ru-RU')} звёзд`;
					} else {
						appendPlayerNameToNotification('', senderName, ` предложил вам приобрести NFT за ${Number(offer.price_stars).toLocaleString('ru-RU')} звёзд`, senderProfile?.status);
					}
				} else {
					if (message.outgoing) {
						notification.textContent = 'Вы отправили подарок';
					} else {
						appendPlayerNameToNotification('', senderName, ' отправил вам подарок', senderProfile?.status);
					}
				}
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
				const senderLink = document.createElement('button');
				senderLink.className = 'gift-telegram-sender-link';
				senderLink.type = 'button';
				senderLink.disabled = !senderProfile?.id && !senderProfile?.profileId;
				senderLink.addEventListener('click', () => window.openVyrnPlayerProfile(senderProfile));
				const senderNameElement = document.createElement('span');
				renderProfileName(senderNameElement, senderName, senderProfile?.status);
				senderLink.append(senderAvatarElement, senderNameElement);
				giftTitle.append(giftFrom, senderLink);
				const giftSubtitle = document.createElement('p');
				giftSubtitle.className = 'gift-telegram-subtitle';
				giftSubtitle.textContent = nftTitle;
				const isPurchaseOffer = offer.price_stars > 0;
				const isIncomingPurchaseOffer = offer.status === 'pending'
					&& isPurchaseOffer
					&& offer.recipient_profile_id === remoteProfileId
					&& !message.outgoing;
				if (!isPurchaseOffer) {
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
							owner: senderName,
							ownerAvatar: senderAvatar,
							ownerProfile: senderProfile,
							fragmentPriceStars
						});
					});
					giftScene.append(giftView);
				}
				giftScene.prepend(preview, giftTitle, giftSubtitle);
				giftCard.append(notification, giftScene);
				row.append(giftCard);

				if (isIncomingPurchaseOffer && !offer.response) {
					const offerActions = document.createElement('div');
					offerActions.className = 'gift-offer-actions';
					const acceptButton = document.createElement('button');
					acceptButton.type = 'button';
					acceptButton.textContent = 'Принять';
					acceptButton.addEventListener('click', () => {
						window.openVyrnNftModal({
							title: nftTitle,
							model: nftModel.name || nftCollection.name || 'NFT',
							source: nftAnimation,
							preview: nftPreview,
							file: nftFile,
							owner: senderName,
							ownerAvatar: senderAvatar,
							ownerProfile: senderProfile,
							fragmentPriceStars,
							priceStars: offer.price_stars,
							onConfirm: async () => {
								await window.VyrnApi.acceptNftGift(offer.id);
								await refreshActiveMessages();
								window.refreshVyrnAccount?.().catch(() => {});
							}
						});
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
		if (showProfile) {
			requestAnimationFrame(() => {
				const profilePage = conversationProfile.querySelector('.player-profile-page');
				if (profilePage && activeChatIndex >= 0) {
					renderProfileBanner(profilePage, playerProfiles[activeChatIndex]);
				}
			});
		}
	};
	const openStandalonePlayerProfile = window.openVyrnPlayerProfile;
	window.openVyrnPlayerProfile = (profileOrId) => {
		const profileId = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id || profileOrId?.profileId;
		if (profileId && playerProfiles[activeChatIndex]?.profileId === profileId) {
			showConversationProfile(true);
			return;
		}
		return openStandalonePlayerProfile(profileOrId);
	};
	const updateGiftPriceLabel = () => {
		const price = Number(giftPickerPrice?.value);
		if (giftPickerSend) {
			if (price === 0) {
				giftPickerSend.textContent = 'Отправить бесплатно';
			} else {
				giftPickerSend.replaceChildren(document.createTextNode(`Предложить за ${price.toLocaleString('ru-RU')} `));
				const priceIcon = document.createElement('img');
				priceIcon.className = 'stars-inline-icon';
				priceIcon.src = './assets/stars.png';
				priceIcon.alt = '';
				priceIcon.setAttribute('aria-hidden', 'true');
				giftPickerSend.append(priceIcon);
			}
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
		giftPickerRecipient.replaceChildren(document.createTextNode('Кому: '));
		const recipientProfile = playerProfiles[activeChatIndex];
		const recipientLink = document.createElement('button');
		recipientLink.className = 'gift-picker-recipient-player';
		recipientLink.type = 'button';
		recipientLink.textContent = conversationPeerName.textContent.trim();
		recipientLink.addEventListener('click', () => {
			giftPickerDialog.close();
			window.openVyrnPlayerProfile(recipientProfile);
		});
		giftPickerRecipient.append(recipientLink);
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
				const image = createNftPreviewImage(gift.previewUrl || './assets/svg/placeholder.svg', `${gift.name} #${gift.id}`, '');
				image.addEventListener('error', () => { image.src = './assets/svg/placeholder.svg'; }, { once: true });
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
			conversationMessageList.dataset.loaded = 'false';
			setBlockSkeleton(conversationMessageList, Boolean(activeServerChatId));
			const unreadBadge = chatRow.querySelector('.chat-unread');
			if (unreadBadge) {
				unreadBadge.textContent = '';
				unreadBadge.hidden = true;
				chatRow.classList.remove('has-unread');
			}
			const name = chatRow.querySelector('.chat-name').textContent.replace(/\s+/g, ' ').trim();
			const profile = playerProfiles[index];
			const profilePage = conversationProfile.querySelector('.player-profile-page');
			if (profilePage) {
				profilePage.dataset.profileId = profile.profileId || profile.id || '';
				profilePage.dataset.accountStatus = getProfileStatus(profile);
				renderProfileBanner(profilePage, profile);
			}
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
			renderProfileName(conversationPeerName, name, getProfileStatus(profile));
			if (channelBadge) {
				conversationPeerName.append(channelBadge.cloneNode(true));
			}
			conversationActions.hidden = !profile.profileId || !activeServerChatId;
			conversationPeerStatus.textContent = profile.headerStatus;
			renderProfileName(playerProfileName, name, getProfileStatus(profile));
			playerProfileStatus.textContent = profile.status;
			playerProfileUsername.textContent = profile.username;
			playerProfileBio.textContent = profile.bio;
			setProfilePageSkeleton(conversationProfile.querySelector('.player-profile-page'), false);
			if (playerProfileNftGrid) {
				playerProfileNftGrid.replaceChildren();
				clearSkeletonState(playerProfileNftGrid);
			}
			if (playerProfileValue) renderProfileCollectionValue(playerProfileValue, []);
			if (profile.profileId && window.VyrnApi) {
				setProfilePageSkeleton(conversationProfile.querySelector('.player-profile-page'), true);
				showSquareSkeletons(playerProfileNftGrid, 9, 'profile-nft-skeleton');
				window.VyrnApi.profileNfts(profile.profileId).then(async ({ profile: latestProfile, items }) => {
					if (activeChatIndex !== index || !playerProfileNftGrid) return;
					playerProfileNftGrid.replaceChildren();
					if (latestProfile) {
						const latestStatus = getProfileStatus(latestProfile);
						profile.accountStatus = latestStatus;
						profile.status = latestProfile.status;
						playerProfiles[index] = { ...profile, ...latestProfile, accountStatus: latestStatus };
						if (profilePage) {
							profilePage.dataset.accountStatus = latestStatus;
							renderProfileBanner(profilePage, playerProfiles[index]);
						}
						renderProfileName(conversationPeerName, name, latestStatus);
						renderProfileName(playerProfileName, name, latestStatus);
						const chatName = chatRow.querySelector('.chat-name');
						if (chatName) renderProfileName(chatName, getProfileDisplayName(latestProfile), latestStatus);
					}
					await renderProfileCollectionValue(playerProfileValue, items, { manageSkeleton: false });
					setProfilePageSkeleton(conversationProfile.querySelector('.player-profile-page'), false);
					items.map(mapOwnedNft).forEach((gift) => {
						const title = `${gift.name} #${gift.id}`;
						const file = gift.slug ? `${gift.slug}-${gift.id}.tgs` : '';
						const card = document.createElement('button');
						card.className = 'profile-nft-cell';
						card.type = 'button';
						card.dataset.nftItemId = '';
						card.dataset.nftListed = String(Boolean(gift.isListed));
						card.dataset.nftListingId = gift.listingId || '';
						card.classList.toggle('is-listed', Boolean(gift.isListed));
						card.dataset.nftSrc = gift.animationUrl || (file ? getNftAnimationUrl(file) : '');
						card.dataset.nftLink = file ? `https://nft.fragment.com/gift/${file}` : '';
						card.dataset.nftPreview = gift.previewUrl || (gift.slug ? getNftPreviewUrl(gift.slug, gift.id) : './assets/placeholder.png');
						card.dataset.nftTitle = title;
						card.dataset.nftModel = gift.name;
						card.dataset.nftFile = file;
						card.dataset.nftFragmentPriceStars = gift.fragmentPriceStars ? String(gift.fragmentPriceStars) : '';
						card.setAttribute('aria-label', `Открыть ${title}`);
						card.append(createNftPreviewImage(card.dataset.nftPreview, title, 'profile-nft-preview'));
						playerProfileNftGrid.append(card);
					});
				}).catch((error) => {
					if (activeChatIndex !== index || !playerProfileNftGrid) return;
					playerProfileNftGrid.replaceChildren();
					clearSkeletonState(playerProfileNftGrid);
					setProfilePageSkeleton(conversationProfile.querySelector('.player-profile-page'), false);
					console.error('Не удалось загрузить NFT профиля собеседника:', error);
				});
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

	addRemoteChatRow = (chatId, peer, summary = {}) => {
		const existing = chatRows.find((row) => row.dataset.chatId === chatId);
		if (existing) {
			const existingIndex = chatRows.indexOf(existing);
			const name = existing.querySelector('.chat-name');
			const existingProfile = playerProfiles[existingIndex] || {};
			const status = getProfileStatus(peer) || getProfileStatus(existingProfile);
			if (name) renderProfileName(name, getProfileDisplayName(peer), status);
			playerProfiles[existingIndex] = {
				...existingProfile,
				...peer,
				accountStatus: status
			};
			updateChatRowSummary(existing, summary);
			return existing;
		}
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
		renderProfileName(name, getProfileDisplayName(peer), peer.status);
		const type = document.createElement('span');
		type.className = 'chat-time';
		type.textContent = peer.username ? `@${peer.username}` : 'Игрок';
		const side = document.createElement('span');
		side.className = 'chat-direct-side';
		const unreadBadge = document.createElement('span');
		unreadBadge.className = 'chat-unread chat-direct-unread';
		unreadBadge.hidden = true;
		side.append(type, unreadBadge);
		heading.append(name, side);
		heading.append(unreadBadge);
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
		updateChatRowSummary(row, summary);
		conversationThreads[index] = [];
		playerProfiles[index] = {
			id: peer.id,
			profileId: peer.id,
			nickname: peer.nickname,
			first_name: peer.first_name,
			last_name: peer.last_name,
			avatar_url: peer.avatar_url,
			bio: peer.bio || '',
			accountStatus: getProfileStatus(peer),
			username: peer.username ? `@${peer.username}` : `@${peer.nickname}`,
			status: 'профиль игрока',
			headerStatus: 'в VYRN',
			bio: '',
			notice: '',
			canSend: true
		};
		bindChatRow(row, index);
		sortChatRows();
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
				if (result.notification_sent === false) {
					const notificationError = result.notification_reason === 'web_app_url_not_configured'
						|| result.notification_reason === 'web_app_url_invalid'
						? 'Сообщение отправлено, но уведомление не настроено: задайте корректный HTTPS-секрет VYRN_WEB_APP_URL в Supabase.'
						: 'Сообщение отправлено, но уведомление в Telegram не доставлено. Попросите собеседника открыть бота VYRN и нажать «Запустить».';
					window.alert(notificationError);
				}
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
		messageActionScrim.classList.remove('is-active');
		conversationScreen.classList.remove('is-message-action-open');
		messageActionMenu.hidden = true;
		messageDeleteAction.disabled = false;
		activeMessageMenuAnimation?.cancel();
		activeMessageMenuAnimation = undefined;
		activeDeleteActionAnimation?.cancel();
		activeDeleteActionAnimation = undefined;
		activeMessageRow?.classList.remove('is-action-target');
		activeMessageBubble?.style.removeProperty('visibility');
		activeMessageAnimation?.cancel();
		activeMessageAnimation = undefined;
		activeMessageClone?.classList.remove('is-raised');
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
		if (messageDeleteAction.disabled) return;
		const threadIndex = activeChatIndex;
		const thread = conversationThreads[threadIndex];
		const chatId = activeServerChatId;
		if (pendingDeleteIndex < 0 || !thread || (threadIndex !== favoritesChatIndex && !chatId)) {
			closeMessageActionMenu();
			return;
		}

		const message = thread[pendingDeleteIndex];
		const messageIndex = pendingDeleteIndex;
		messageDeleteAction.disabled = true;
		if (chatId && message.id) {
			try {
				await window.VyrnApi.deleteMessage(message.id);
			} catch (error) {
				closeMessageActionMenu();
				window.alert(error.message);
				return;
			}
		} else if (chatId) {
			closeMessageActionMenu();
			window.alert('Дождитесь отправки сообщения, прежде чем удалять его.');
			return;
		} else {
			try {
				localStorage.setItem(favoritesStorageKey, JSON.stringify(thread.filter((_, index) => index !== messageIndex)));
			} catch {
			}
		}
		thread.splice(messageIndex, 1);
		if (threadIndex === favoritesChatIndex && favoritesPreview) {
			favoritesPreview.textContent = thread.at(-1)?.text || 'Ваши сохранённые сообщения';
		}
		if (chatId) {
			const chatRow = chatRows.find((row) => row.dataset.chatId === chatId);
			const latestMessage = thread.at(-1);
			if (chatRow) {
				const preview = chatRow.querySelector('.chat-message');
				if (preview) preview.textContent = latestMessage?.text || 'Открыть переписку';
				chatRow.dataset.lastMessageAt = latestMessage?.createdAt || '';
				sortChatRows();
			}
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
		refreshChatList();
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
