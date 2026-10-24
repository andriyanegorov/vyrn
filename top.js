const topMetricTabs = document.querySelector('.top-metric-tabs');

if (topMetricTabs) {
  const rankingContainer = topMetricTabs.closest('.top-ranking');
  const buttons = [...topMetricTabs.querySelectorAll('.top-metric-button')];
  const indicator = topMetricTabs.querySelector('.top-metric-indicator');
  const metricLabel = document.querySelector('[data-top-metric-label]');
  const playerList = document.querySelector('.top-player-list');
  const podium = {
    1: document.querySelector('.top-podium-first'),
    2: document.querySelector('.top-podium-second'),
    3: document.querySelector('.top-podium-third')
  };
  const playerRows = [...document.querySelectorAll('.top-player-list > .top-player-row:not([data-top-self-row])')];
  const selfRow = document.querySelector('[data-top-self-row]');
  const status = document.querySelector('.top-demo-note');
  let leaderboard;
  let metricTransitionId = 0;
  let metricAnimations = [];
  let metricTransitionTimer;
  const playerProfiles = new WeakMap();

  const formatAmount = (amount) => {
    const value = String(amount ?? '0');
    if (/^-?\d+$/.test(value)) return BigInt(value).toLocaleString('ru-RU');
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
      : '—';
  };

  const getPlayerName = (player) => [player.first_name, player.last_name]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    || player.nickname
    || 'Игрок';

  const getInitial = (player) => Array.from(getPlayerName(player).trim())[0]?.toUpperCase() || '?';
  const setVisible = (element, visible) => {
    if (!element) return;
    element.hidden = !visible;
    element.style.display = visible ? '' : 'none';
  };

  const setPlayerAvatar = (avatar, player) => {
    const initial = getInitial(player);
    const image = avatar.querySelector('img');
    const initials = avatar.querySelector('[data-top-avatar-initials]');
    if (initials) initials.textContent = initial;
    else avatar.textContent = initial;
    if (image) {
      const avatarUrl = player.avatar_url || '';
      image.hidden = !avatarUrl;
      image.src = avatarUrl;
    } else if (player.avatar_url) {
      avatar.style.backgroundImage = `url("${player.avatar_url.replace(/["\\]/g, '')}")`;
      avatar.style.backgroundPosition = 'center';
      avatar.style.backgroundSize = 'cover';
      avatar.style.color = 'transparent';
    }
  };

  const updatePlayer = (container, player) => {
    if (!container || !player) return;
    container.dataset.playerId = player.id || '';
    container.setAttribute('role', 'button');
    container.tabIndex = 0;
    container.setAttribute('aria-label', `Открыть профиль: ${getPlayerName(player)}`);
    container.setAttribute('aria-haspopup', 'dialog');
    playerProfiles.set(container, player);
    const name = container.querySelector('.top-player-name, [data-top-player-name], .top-player-info > strong');
    const username = container.querySelector('.top-player-handle, [data-top-player-username], .top-player-info > span');
    const avatar = container.querySelector('.top-player-avatar, .top-self-avatar');
    const value = container.querySelector('[data-top-value][data-top-stars]');
    if (name) name.textContent = getPlayerName(player);
    if (username) {
      const handle = player.username || player.nickname;
      username.textContent = handle ? `@${handle.replace(/^@+/, '')}` : '';
    }
    if (avatar) setPlayerAvatar(avatar, player);
    if (value) {
      value.dataset.topValue = String(player.value ?? '');
      value.dataset.topStars = String(player.stars ?? '');
    }
  };

  const openPlayerProfile = (container) => {
    const player = playerProfiles.get(container);
    if (!player?.id || typeof window.openVyrnPlayerProfile !== 'function') return;
    window.openVyrnPlayerProfile(player);
  };

  const handlePlayerClick = (event) => {
    const playerContainer = event.target.closest('[data-player-id]');
    if (!playerContainer || !rankingContainer?.contains(playerContainer)) return;
    openPlayerProfile(playerContainer);
  };

  const handlePlayerKeydown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const playerContainer = event.target.closest('[data-player-id]');
    if (!playerContainer || !rankingContainer?.contains(playerContainer)) return;
    event.preventDefault();
    openPlayerProfile(playerContainer);
  };

  rankingContainer?.addEventListener('click', handlePlayerClick);
  rankingContainer?.addEventListener('keydown', handlePlayerKeydown);

  const renderPlayerSet = (players, self, metric) => {
    const orderedPlayers = (Array.isArray(players) ? players : []).map((player) =>
      self && player.id === self.id ? { ...player, ...self, rank: player.rank } : player
    );
    const selfRank = metric === 'stars' ? Number(self?.stars_rank) : Number(self?.value_rank);
    if (self && selfRank >= 1 && selfRank <= 15 && !orderedPlayers.some((player) => player.id === self.id)) {
      orderedPlayers.push({ ...self, rank: selfRank });
    }
    orderedPlayers.sort((first, second) => Number(first.rank) - Number(second.rank));

    for (let rank = 1; rank <= 3; rank += 1) {
      const podiumPlayer = podium[rank];
      const player = orderedPlayers.find((item) => Number(item.rank) === rank);
      if (podiumPlayer) {
        setVisible(podiumPlayer, Boolean(player));
        if (player) updatePlayer(podiumPlayer, player);
      }
    }

    const lowerPlayers = orderedPlayers.filter((player) => Number(player.rank) >= 4);
    const rowsToRender = [];
    for (let index = 0; index < playerRows.length; index += 1) {
      const rank = index + 4;
      const player = lowerPlayers.find((item) => Number(item.rank) === rank);
      const isSelf = Boolean(player && self && player.id === self.id);
      const row = isSelf ? selfRow : playerRows[index];
      setVisible(playerRows[index], Boolean(player) && !isSelf);
      if (!row || !player) continue;
      setVisible(row, true);
      const rankElement = row.querySelector('.top-player-rank');
      if (rankElement) {
        rankElement.textContent = String(player.rank);
        rankElement.setAttribute('aria-label', `Место ${player.rank}`);
      }
      updatePlayer(row, player);
      rowsToRender.push(row);
    }

    if (selfRow) {
      const selfIsOnPodium = selfRank >= 1 && selfRank <= 3;
      const selfIsInList = rowsToRender.includes(selfRow);
      if (self && !selfIsOnPodium && !selfIsInList) {
        const rank = selfRow.querySelector('.top-player-rank');
        if (rank) {
          rank.textContent = selfRank ? String(selfRank) : '—';
          rank.setAttribute('aria-label', selfRank ? `Место ${selfRank}` : 'Позиция в рейтинге недоступна');
        }
        updatePlayer(selfRow, self);
        setVisible(selfRow, true);
        rowsToRender.push(selfRow);
      } else if (!selfIsInList) {
        setVisible(selfRow, false);
      }
    }

    if (playerList) playerList.replaceChildren(...rowsToRender);
    if (metricLabel) metricLabel.textContent = metric === 'stars' ? 'VYRN Stars' : 'Ценность';
    document.querySelectorAll('[data-top-value][data-top-stars]').forEach((element) => {
      const amount = metric === 'stars' ? element.dataset.topStars : element.dataset.topValue;
      element.textContent = amount === '' ? '—' : formatAmount(amount);
    });
  };

  const getVisiblePlayers = (podiumOrder = [1, 2, 3]) => [
    ...podiumOrder.map((rank) => podium[rank]),
    ...(playerList?.querySelectorAll('.top-player-row') || [])
  ].filter((element) => element
    && !element.hidden
    && getComputedStyle(element).display !== 'none');

  const animateMetricChange = (render) => {
    const transitionId = ++metricTransitionId;
    clearTimeout(metricTransitionTimer);
    metricAnimations.forEach((animation) => animation.cancel());
    metricAnimations = [];

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = prefersReducedMotion ? 180 : 500;
    const stagger = prefersReducedMotion ? 12 : 28;
    const exitDuration = prefersReducedMotion ? 120 : 350;
    const animateIncomingPlayers = () => {
      metricTransitionTimer = setTimeout(() => {
        if (transitionId !== metricTransitionId) return;
        const podiumOrder = [1, 2, 3];
        const incomingPlayers = getVisiblePlayers(podiumOrder);
        metricAnimations = incomingPlayers.map((element, index) => {
          const isPodium = element.classList.contains('top-podium-item');
          const delay = isPodium
            ? podiumOrder.indexOf(Number(element.dataset.rank)) * duration
            : Math.min(index * stagger, prefersReducedMotion ? 72 : 280);
          return element.animate(
            isPodium
              ? [
                { opacity: 0, transform: 'scaleY(0)', transformOrigin: 'bottom' },
                { opacity: 1, transform: 'scaleY(1)', transformOrigin: 'bottom' }
              ]
              : [
                { opacity: 0, transform: 'translateY(18px) scale(0.96)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' }
              ],
            {
              duration,
              delay,
              easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
              fill: 'both'
            }
          );
        });
      }, 250);
    };
    const podiumOrder = [3, 2, 1];
    const outgoingPlayers = getVisiblePlayers(podiumOrder);

    if (outgoingPlayers.length === 0) {
      render();
      animateIncomingPlayers();
      return;
    }

    let remaining = outgoingPlayers.length;
    metricAnimations = outgoingPlayers.map((element, index) => {
      const isPodium = element.classList.contains('top-podium-item');
      const delay = isPodium
        ? podiumOrder.indexOf(Number(element.dataset.rank)) * exitDuration
        : Math.min(index * stagger, prefersReducedMotion ? 72 : 280);
      const animation = element.animate(
        isPodium
          ? [
            { opacity: 1, transform: 'scaleY(1)', transformOrigin: 'bottom' },
            { opacity: 0, transform: 'scaleY(0)', transformOrigin: 'bottom' }
          ]
          : [
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.96)' }
          ],
        {
          duration: exitDuration,
          delay,
          easing: 'cubic-bezier(0.55, 0, 1, 0.45)',
          fill: 'forwards'
        }
      );
      const finish = () => {
        remaining -= 1;
        if (remaining !== 0 || transitionId !== metricTransitionId) return;
        metricAnimations.forEach((item) => {
          item.onfinish = null;
          item.oncancel = null;
        });
        metricAnimations = [];
        render();
        animateIncomingPlayers();
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
      return animation;
    });
  };

  const moveIndicator = (button) => {
    const indicator = topMetricTabs.querySelector('.top-metric-indicator');
    if (!indicator) return;
    indicator.style.left = `${button.offsetLeft}px`;
    indicator.style.setProperty('--top-metric-indicator-width', `${button.offsetWidth}px`);
  };

  const selectMetric = (button) => {
    const metric = button.dataset.topMetric;
    if (button.classList.contains('is-active')) return;
    buttons.forEach((tab) => {
      const isActive = tab === button;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-pressed', String(isActive));
    });
    if (leaderboard) {
      animateMetricChange(() => renderPlayerSet(
        metric === 'stars' ? leaderboard.players_stars : leaderboard.players_value,
        leaderboard.current_player,
        metric
      ));
    }
    moveIndicator(button);
  };

  const activeButton = buttons.find((button) => button.classList.contains('is-active'));
  if (activeButton) {
    moveIndicator(activeButton);
    buttons.forEach((button) => button.addEventListener('click', () => selectMetric(button)));
  }

  const clearSampleData = () => {
    Object.values(podium).forEach((item) => {
      setVisible(item, false);
    });
    playerRows.forEach((row) => {
      setVisible(row, false);
    });
    setVisible(selfRow, false);
    document.querySelectorAll('[data-top-value][data-top-stars]').forEach((element) => {
      element.dataset.topValue = '';
      element.dataset.topStars = '';
      element.textContent = '—';
    });
  };

  const loadLeaderboard = async () => {
    if (!window.VyrnApi?.leaderboard) {
      if (status) status.textContent = 'Не удалось подключиться к рейтингу игроков.';
      clearSampleData();
      return;
    }
    if (status) status.textContent = 'Загрузка реального рейтинга…';
    clearSampleData();
    try {
      leaderboard = await window.VyrnApi.leaderboard();
      if (!Array.isArray(leaderboard?.players_value) || !Array.isArray(leaderboard?.players_stars)) {
        throw new Error('Сервер вернул некорректные данные рейтинга.');
      }
      if (status) status.textContent = '';
      const selectedMetric = buttons.find((button) => button.classList.contains('is-active'))?.dataset.topMetric || 'value';
      renderPlayerSet(
        selectedMetric === 'stars' ? leaderboard.players_stars : leaderboard.players_value,
        leaderboard.current_player,
        selectedMetric
      );
    } catch (error) {
      console.error('Не удалось загрузить реальный рейтинг игроков:', error);
      if (status) status.textContent = 'Не удалось загрузить рейтинг. Попробуйте обновить страницу.';
      clearSampleData();
    }
  };

  loadLeaderboard();
}
