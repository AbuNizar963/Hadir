const MANAGER_NAV_SELECTOR = ".manager-nav";
const ACTIVE_SELECTOR = 'a[aria-current="page"]';

function keepActiveNavigationVisible(root: ParentNode = document) {
  const nav = root.querySelector<HTMLElement>(MANAGER_NAV_SELECTOR);
  if (!nav) return;
  const active = nav.querySelector<HTMLElement>(ACTIVE_SELECTOR);
  if (!active) return;

  const route = active.getAttribute("href") || active.getAttribute("aria-label") || "";
  if (nav.dataset.hadirActiveRoute === route) return;
  nav.dataset.hadirActiveRoute = route;

  requestAnimationFrame(() => {
    active.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  });
}

export function installNavigationScrollPersistence() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const run = () => keepActiveNavigationVisible();
  const observer = new MutationObserver(() => run());

  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current"] });
    run();
  };

  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start, { once: true });
}
