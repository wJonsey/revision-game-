/**
 * Minimal screen router.
 * A screen is a function that draws itself into the root element. It receives
 * `navigate` and optional `params`, and may return a cleanup function
 * (e.g. to stop a game loop) that runs before the next screen is shown.
 */

/**
 * @param {{ replaceChildren: () => void }} root element screens are drawn into
 * @param {Record<string, (root: any, context: { navigate: Function, params: any }) => (void|(() => void))>} screens
 */
export function createRouter(root, screens) {
  let currentScreen = null;
  let cleanup = null;

  function navigate(screenName, params = {}) {
    const renderScreen = screens[screenName];
    if (typeof renderScreen !== "function") {
      throw new Error(`Unknown screen "${screenName}"`);
    }
    if (typeof cleanup === "function") {
      const previousCleanup = cleanup;
      cleanup = null;
      previousCleanup();
    }
    // Set before rendering: a screen may navigate again while it is drawing.
    currentScreen = screenName;
    root.replaceChildren();
    const result = renderScreen(root, { navigate, params });
    if (currentScreen === screenName && typeof result === "function") cleanup = result;
  }

  return {
    navigate,
    get currentScreen() {
      return currentScreen;
    },
  };
}
