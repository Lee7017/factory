/* Communicate legacy module size and route to the React shell. */
(() => {
  if (window.parent === window) return;
  const message = (type, extra = {}) => window.parent.postMessage({ type, ...extra }, window.location.origin);
  function resize() {
    const view = document.getElementById('view');
    if (!view) return;
    const height = Math.max(view.scrollHeight, view.getBoundingClientRect().height, 140);
    message('factory-legacy-height', { height: Math.ceil(height) + 30 });
  }
  function route() {
    message('factory-legacy-route', { hash: location.hash });
    requestAnimationFrame(resize);
  }
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);
  history.pushState = (...args) => { originalPush(...args); route(); };
  history.replaceState = (...args) => { originalReplace(...args); route(); };
  addEventListener('hashchange', route);
  addEventListener('load', () => {
    const view = document.getElementById('view');
    if (view && 'ResizeObserver' in window) {
      new ResizeObserver(resize).observe(view);
      new MutationObserver(resize).observe(view, { childList: true, subtree: true, attributes: true });
    }
    route();
  });
})();
