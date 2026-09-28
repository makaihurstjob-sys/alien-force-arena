// Keep a visual snapshot while React tears down the room and reveals home.
export function animateLobbyExit(source: HTMLDialogElement | null) {
  if (!source?.open || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const snapshot = source.cloneNode(true) as HTMLDialogElement;
  snapshot.classList.add('lobby-exit-snapshot');
  snapshot.removeAttribute('open');
  snapshot.removeAttribute('id');
  snapshot.removeAttribute('aria-labelledby');
  snapshot.setAttribute('aria-label', 'Returning to main menu');
  snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  snapshot.querySelectorAll('button, input, select').forEach(node => node.setAttribute('disabled', ''));
  const originals = source.querySelectorAll('canvas');
  snapshot.querySelectorAll('canvas').forEach((canvas, index) => {
    const original = originals[index];
    if (original) canvas.getContext('2d')?.drawImage(original, 0, 0);
  });
  snapshot.style.pointerEvents = 'none';
  snapshot.addEventListener('cancel', event => event.preventDefault());
  document.body.append(snapshot);
  snapshot.showModal();
  const logo = snapshot.querySelector<HTMLElement>('.hangar-brand');
  const home = [...document.querySelectorAll<HTMLElement>('.desktop-menu-brand h1, .mobile-menu-header h1')]
    .find(node => node.getBoundingClientRect().width > 0);
  if (logo && home) {
    const from = logo.getBoundingClientRect();
    const to = home.getBoundingClientRect();
    logo.animate([
      { transform: 'scale(.5)' },
      { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${.5 * to.width / from.width})` },
    ], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
  }
  const animation = snapshot.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 420, easing: 'ease-in-out', fill: 'forwards',
  });
  void animation.finished.finally(() => {
    snapshot.close();
    snapshot.remove();
    document.querySelector<HTMLElement>(window.matchMedia('(min-width:768px)').matches ? '.desktop-play' : '.mobile-play')?.focus({ preventScroll: true });
  });
}
