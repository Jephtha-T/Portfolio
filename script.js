(() => {
  'use strict';

  const desktop = document.getElementById('desktop');
  if (!desktop) return;

  const splash = document.querySelector('.splash');
  document.body.classList.add('is-loading');

  const waitForImage = (image) => {
    if (image.complete && image.naturalWidth > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const done = () => {
        image.removeEventListener('load', done);
        image.removeEventListener('error', done);
        resolve();
      };

      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
    });
  };

  const revealSite = async () => {
    const images = Array.from(document.images);
    const decodePromises = images.map((image) =>
      typeof image.decode === 'function'
        ? image.decode().catch(() => undefined)
        : waitForImage(image)
    );

    await Promise.all(decodePromises);

    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');

    if (splash) {
      window.setTimeout(() => {
        splash.remove();
      }, 360);
    }
  };

  window.addEventListener('load', () => {
    revealSite().catch(() => {
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-ready');
      if (splash) splash.remove();
    });
  });

  const clickSfx = new Audio('Assets/SFX/click.mp3');
  clickSfx.preload = 'auto';
  clickSfx.volume = 0.42;

  const playClickSfx = () => {
    clickSfx.currentTime = 0;
    clickSfx.play().catch(() => {
      // Some browsers block audio until the first trusted interaction.
    });
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest && target.closest('button, a')) {
      playClickSfx();
    }
  });

  const openButtons = document.querySelectorAll('[data-open]');
  const closeButtons = document.querySelectorAll('[data-close]');
  const scrollButtons = document.querySelectorAll('[data-scroll-target]');
  const floatingWindows = document.querySelectorAll('.window--floating');
  const logoButton = document.querySelector('.taskbar-logo');
  let topZ = 20;
  const openerMap = new WeakMap();

  const bringToFront = (win) => {
    topZ += 1;
    win.style.zIndex = String(topZ);
  };

  const playWindowVideos = (win) => {
    win.querySelectorAll('video').forEach((video) => {
      video.muted = true;
      video.play().catch(() => {
        // Muted project previews may still be deferred by some browser policies.
      });
    });
  };

  const pauseWindowVideos = (win) => {
    win.querySelectorAll('video').forEach((video) => {
      video.pause();
    });
  };

  const openWindow = (id, opener = null) => {
    const win = document.querySelector(`.window--floating[data-window="${id}"]`);
    if (!win) return;

    if (opener) openerMap.set(win, opener);

    if (opener) {
      opener.setAttribute('aria-expanded', 'true');
      if (win.id) opener.setAttribute('aria-controls', win.id);
    }

    win.classList.add('is-open');
    win.setAttribute('aria-hidden', 'false');
    win.setAttribute('aria-modal', 'true');
    bringToFront(win);
    playWindowVideos(win);
    resetProjectScroll(win);

    const closeBtn = win.querySelector('[data-close]');
    if (closeBtn) closeBtn.focus();
  };

  const closeWindow = (win) => {
    win.classList.remove('is-open');
    win.setAttribute('aria-hidden', 'true');
    win.setAttribute('aria-modal', 'false');
    pauseWindowVideos(win);

    // Restore focus to opener if available
    const opener = openerMap.get(win);
    if (opener && opener instanceof Element) {
      opener.setAttribute('aria-expanded', 'false');
      try {
        opener.focus();
      } catch {
        // ignore focus failures
      }
    }
    openerMap.delete(win);
  };

  const closeAllWindows = () => {
    Array.from(floatingWindows)
      .filter((win) => win.classList.contains('is-open'))
      .forEach(closeWindow);

    if (logoButton instanceof HTMLElement) {
      logoButton.focus();
    }
  };

  const getSectionScrollTop = (section, scroller) =>
    section.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;

  const resetProjectScroll = (win) => {
    win.querySelectorAll('.project-scroll').forEach((scroller) => {
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event('scroll'));
    });
  };

  // Initialize aria attributes on open buttons and wire click to openWindow with opener reference.
  openButtons.forEach((button) => {
    const targetId = button.dataset.open;
    const targetWin = document.querySelector(`.window--floating[data-window="${targetId}"]`);
    if (targetWin && targetWin.id) {
      button.setAttribute('aria-controls', targetWin.id);
    }
    button.setAttribute('aria-expanded', 'false');

    button.addEventListener('click', () => openWindow(button.dataset.open, button));
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const win = event.currentTarget.closest('.window--floating');
      if (win) closeWindow(win);
    });
  });

  if (logoButton instanceof HTMLElement) {
    logoButton.addEventListener('click', closeAllWindows);
  }

  scrollButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const section = document.getElementById(button.dataset.scrollTarget);
      const scroller = section?.closest('.project-scroll');
      if (!section || !scroller) return;

      scroller.scrollTo({ top: getSectionScrollTop(section, scroller), behavior: 'smooth' });
    });
  });

  document.querySelectorAll('.project-scroll').forEach((scroller) => {
    const sections = Array.from(scroller.querySelectorAll('.project-section'));
    const dots = Array.from(
      scroller
        .closest('.window__body--project, .window__body--showcase')
        ?.querySelectorAll('[data-scroll-target]') || []
    );

    const setActiveDot = () => {
      const activeSection = sections.reduce(
        (closest, section) => {
          const distance = Math.abs(getSectionScrollTop(section, scroller) - scroller.scrollTop);
          return distance < closest.distance ? { section, distance } : closest;
        },
        { section: sections[0], distance: Number.POSITIVE_INFINITY }
      ).section;

      dots.forEach((dot) => {
        const isActive = dot.dataset.scrollTarget === activeSection?.id;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    };

    scroller.addEventListener('scroll', () => window.requestAnimationFrame(setActiveDot), {
      passive: true,
    });
    setActiveDot();
  });

  floatingWindows.forEach((win) => win.addEventListener('pointerdown', () => bringToFront(win)));

  const initialWindow = window.location.hash.replace('#', '');
  if (initialWindow) openWindow(initialWindow);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const openWindows = Array.from(floatingWindows).filter((win) =>
      win.classList.contains('is-open')
    );
    const topWindow = openWindows.sort(
      (a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0)
    )[0];
    if (topWindow) closeWindow(topWindow);
  });

  let activeWindow = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let winWidth = 0;
  let winHeight = 0;
  let activePointerId = null;

  const handlePointerDown = (event) => {
    if (window.matchMedia('(max-width: 780px)').matches) return;

    const bar =
      event.target instanceof Element
        ? event.target.closest('.window--floating .window__bar')
        : null;
    const win = event.target instanceof Element ? event.target.closest('.window--floating') : null;

    if (!bar || !win || !win.classList.contains('is-open')) return;
    if (event.target instanceof Element && event.target.closest('[data-close]')) return;

    activeWindow = win;
    activePointerId = event.pointerId;
    bringToFront(win);

    const desktopRect = desktop.getBoundingClientRect();
    const winRect = win.getBoundingClientRect();

    startX = event.clientX;
    startY = event.clientY;
    startLeft = winRect.left - desktopRect.left;
    startTop = winRect.top - desktopRect.top;
    winWidth = winRect.width;
    winHeight = winRect.height;

    win.classList.add('is-dragging');
    win.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event) => {
    if (!activeWindow || event.pointerId !== activePointerId) return;

    const desktopRect = desktop.getBoundingClientRect();
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;

    const maxLeft = Math.max(8, desktopRect.width - winWidth - 8);
    const maxTop = Math.max(8, desktopRect.height - winHeight - 8);

    const nextLeft = Math.min(Math.max(startLeft + deltaX, 8), maxLeft);
    const nextTop = Math.min(Math.max(startTop + deltaY, 8), maxTop);

    activeWindow.style.left = `${nextLeft}px`;
    activeWindow.style.top = `${nextTop}px`;
    activeWindow.style.transform = 'translate(0, 0)';
  };

  const handlePointerUp = (event) => {
    if (!activeWindow || event.pointerId !== activePointerId) return;

    activeWindow.classList.remove('is-dragging');

    try {
      activeWindow.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be released on some touch interactions.
    }

    activeWindow = null;
    activePointerId = null;
  };

  desktop.addEventListener('pointerdown', handlePointerDown);
  desktop.addEventListener('pointermove', handlePointerMove);
  desktop.addEventListener('pointerup', handlePointerUp);
  desktop.addEventListener('pointercancel', handlePointerUp);
})();
