const routeTransitionKey = 'vyrn:section-transition';
const routeNavigation = [...document.querySelectorAll('.bottom-nav .nav-button')];
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

	const main = document.querySelector('body > main, body > .app main');
	main?.classList.add('section-route-content');
	return main;
})();

const createRouteSkeleton = (pathname) => {
	const skeleton = document.createElement('div');
	skeleton.className = 'route-pending-skeleton';
	skeleton.setAttribute('role', 'status');
	skeleton.setAttribute('aria-label', 'Загрузка раздела');
	skeleton.setAttribute('aria-busy', 'true');

	const addBlock = (className) => {
		const block = document.createElement('div');
		block.className = `route-pending-block vyrn-skeleton ${className}`;
		block.setAttribute('aria-hidden', 'true');
		skeleton.append(block);
		return block;
	};
	const addRows = (count, className) => {
		const list = addBlock(className);
		for (let index = 0; index < count; index += 1) {
			const row = document.createElement('div');
			row.className = 'route-pending-row';
			row.setAttribute('aria-hidden', 'true');
			const avatar = document.createElement('span');
			avatar.className = 'route-pending-avatar vyrn-skeleton';
			const lines = document.createElement('span');
			lines.className = 'route-pending-lines';
			lines.innerHTML = '<i class="vyrn-skeleton"></i><i class="vyrn-skeleton"></i>';
			row.append(avatar, lines);
			list.append(row);
		}
		return list;
	};
	const addGrid = (count, className = '') => {
		const grid = addBlock(`route-pending-grid ${className}`.trim());
		for (let index = 0; index < count; index += 1) {
			const card = document.createElement('span');
			card.className = 'route-pending-card vyrn-skeleton';
			card.setAttribute('aria-hidden', 'true');
			grid.append(card);
		}
		return grid;
	};

	if (/\/market\.html$/i.test(pathname)) {
		addBlock('route-pending-toolbar');
		addBlock('route-pending-tabs');
		addGrid(9, 'is-market');
	} else if (/\/chats\.html$/i.test(pathname)) {
		addBlock('route-pending-toolbar');
		addRows(6, 'route-pending-list');
	} else if (/\/profile\.html$/i.test(pathname)) {
		const profile = addBlock('route-pending-profile');
		profile.innerHTML = '<span class="route-pending-avatar vyrn-skeleton"></span><span class="route-pending-lines"><i class="vyrn-skeleton"></i><i class="vyrn-skeleton"></i></span>';
		addBlock('route-pending-details');
		addBlock('route-pending-details');
		addBlock('route-pending-value');
		addGrid(9, 'is-profile');
	} else if (/\/wallet\.html$/i.test(pathname)) {
		addBlock('route-pending-value');
		addRows(5, 'route-pending-list');
	} else if (/\/gift-craft\.html$/i.test(pathname) || /\/upgrade\.html$/i.test(pathname)) {
		addBlock('route-pending-toolbar');
		addGrid(9, 'is-compact');
	} else {
		addBlock('route-pending-hero');
		addBlock('route-pending-details');
		addGrid(4, 'is-home');
		addBlock('route-pending-details');
	}

	return skeleton;
};

try {
	const savedTransition = sessionStorage.getItem(routeTransitionKey);
	if (savedTransition) {
		sessionStorage.removeItem(routeTransitionKey);
		const transition = JSON.parse(savedTransition);
		if (transition.path === window.location.pathname
			&& ['forward', 'backward'].includes(transition.direction)
			&& !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			document.documentElement.dataset.routeDirection = transition.direction;
		}
	}
} catch (error) {
	console.warn('Не удалось восстановить направление перехода раздела:', error);
}

routeNavigation.filter((item) => item.tagName === 'A').forEach((link) => {
	link.addEventListener('click', (event) => {
		if (event.defaultPrevented || event.button !== 0
			|| event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const destination = new URL(link.href, window.location.href);
		if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
		const fromIndex = routeNavigation.findIndex((item) => item.classList.contains('is-active'));
		const toIndex = routeNavigation.indexOf(link);
		if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			document.documentElement.removeAttribute('data-route-direction');
			return;
		}
		const direction = toIndex > fromIndex ? 'forward' : 'backward';
		try {
			sessionStorage.setItem(routeTransitionKey, JSON.stringify({
				path: destination.pathname,
				direction
			}));
		} catch (error) {
			console.warn('Не удалось сохранить направление перехода раздела:', error);
		}
		document.documentElement.dataset.routeDirection = direction;
		if (routeContent) routeContent.replaceChildren(createRouteSkeleton(destination.pathname));
		routeNavigation.forEach((item) => {
			const isActive = item === link;
			item.classList.toggle('is-active', isActive);
			if (isActive) item.setAttribute('aria-current', 'page');
			else item.removeAttribute('aria-current');
		});
		const nav = link.closest('.bottom-nav');
		const indicator = nav?.querySelector('.nav-indicator');
		if (nav && indicator) {
			const navRect = nav.getBoundingClientRect();
			const linkRect = link.getBoundingClientRect();
			const inset = 4;
			indicator.style.left = `${linkRect.left - navRect.left - nav.clientLeft + inset}px`;
			indicator.style.setProperty('--indicator-width', `${linkRect.width - inset * 2}px`);
			indicator.classList.remove('is-moving');
			void indicator.offsetWidth;
			indicator.classList.add('is-moving');
			nav.classList.add('is-route-transitioning');
		}
		event.stopImmediatePropagation();
	});
});
