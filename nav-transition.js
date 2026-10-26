const routeTransitionKey = 'vyrn:section-transition';
const routeNavigation = [...document.querySelectorAll('.bottom-nav .nav-button')];
const getNavigationItem = (pathname) => routeNavigation.find((item) => {
	const href = item.getAttribute('href');
	if (href) return new URL(href, window.location.href).pathname === pathname;
	const label = item.querySelector('span')?.textContent.trim();
	return label === 'Главное' && new URL('index.html', window.location.href).pathname === pathname;
});
const setNavigationItem = (item) => {
	routeNavigation.forEach((navItem) => {
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
	document.querySelectorAll('.bottom-nav .nav-indicator').forEach((indicator) => {
		indicator.classList.toggle('is-hidden', !item);
	});
};
if (!getNavigationItem(window.location.pathname)) setNavigationItem(null);
const routeContent = (() => {
	const embeddedApp = document.querySelector('body > #app');
	const embeddedNav = embeddedApp?.querySelector(':scope > .bottom-nav');
	const embeddedHeader = embeddedApp?.querySelector(':scope > .top');
	if (embeddedApp && embeddedNav && embeddedHeader) {
		const content = document.createElement('div');
		content.className = 'section-route-content section-route-content-embedded';
		embeddedApp.insertBefore(content, embeddedHeader.nextSibling);
		while (content.nextSibling && content.nextSibling !== embeddedNav) {
			content.append(content.nextSibling);
		}
		return content;
	}

	const upgradeApp = document.querySelector('body > .app');
	const main = document.querySelector('body > main');
	const content = upgradeApp || main;
	content?.classList.add('section-route-content');
	return content;
})();

try {
	const savedTransition = sessionStorage.getItem(routeTransitionKey);
	if (savedTransition) {
		sessionStorage.removeItem(routeTransitionKey);
		const transition = JSON.parse(savedTransition);
		if (transition.path === window.location.pathname) {
			document.documentElement.dataset.routeEnter = 'true';
		}
	}
} catch (error) {
	console.warn('Не удалось восстановить направление перехода раздела:', error);
}

if (routeContent) {
	routeContent.addEventListener('animationend', (event) => {
		if (event.target === routeContent
			&& event.animationName === 'route-content-fade-in'
			&& document.documentElement.dataset.routeEnter) {
			delete document.documentElement.dataset.routeEnter;
		}
	});
}

let routeNavigationPending = false;
document.addEventListener('click', (event) => {
	const target = event.target;
	const link = target instanceof Element ? target.closest('a[href]') : null;
	if (!link || !routeContent || routeNavigationPending
		|| event.defaultPrevented || event.button !== 0
		|| event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
		|| link.hasAttribute('download')
		|| (link.target && link.target !== '_self')) return;

	const destination = new URL(link.href, window.location.href);
	if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;

	event.preventDefault();
	routeNavigationPending = true;
	try {
		sessionStorage.setItem(routeTransitionKey, JSON.stringify({
			path: destination.pathname
		}));
	} catch (error) {
		console.warn('Не удалось сохранить направление перехода раздела:', error);
	}
	delete document.documentElement.dataset.routeEnter;
	routeContent.classList.add('route-is-leaving');
	let navigationStarted = false;
	const navigate = () => {
		if (navigationStarted) return;
		navigationStarted = true;
		window.location.assign(destination.href);
	};
	const finishLeaving = (animationEvent) => {
		if (animationEvent.target !== routeContent
			|| animationEvent.animationName !== 'route-content-fade-out') return;
		routeContent.removeEventListener('animationend', finishLeaving);
		window.clearTimeout(fallbackTimer);
		navigate();
	};
	routeContent.addEventListener('animationend', finishLeaving);
	const fallbackTimer = window.setTimeout(() => {
		routeContent.removeEventListener('animationend', finishLeaving);
		navigate();
	}, 500);

	const destinationItem = getNavigationItem(destination.pathname);
	setNavigationItem(destinationItem || null);
	const nav = document.querySelector('.bottom-nav');
	const indicator = destinationItem && nav?.querySelector('.nav-indicator');
	if (destinationItem && nav && indicator) {
		const navRect = nav.getBoundingClientRect();
		const linkRect = destinationItem.getBoundingClientRect();
		const inset = 4;
		indicator.style.left = `${linkRect.left - navRect.left - nav.clientLeft + inset}px`;
		indicator.style.setProperty('--indicator-width', `${linkRect.width - inset * 2}px`);
		indicator.classList.remove('is-hidden');
		indicator.classList.remove('is-moving');
		void indicator.offsetWidth;
		indicator.classList.add('is-moving');
		nav.classList.add('is-route-transitioning');
	}
});
