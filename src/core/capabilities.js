/**
 * Browser capability checks.
 *
 * School PCs are often locked down: WebGL can be disabled, storage can be
 * blocked or wiped at logout, and pointer lock may be restricted.
 * This is a "spike" (OS spec 1.4) to find out early what the target machines allow.
 */

/** @param {Document} doc */
export function hasWebGL(doc) {
  try {
    const canvas = doc.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** @param {() => Storage} getStorage accessing window.localStorage can itself throw */
export function hasLocalStorage(getStorage) {
  try {
    const storage = getStorage();
    const testKey = "__codebreach_check__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/** @param {Window} win */
export function detectCapabilities(win) {
  return {
    webgl: hasWebGL(win.document),
    localStorage: hasLocalStorage(() => win.localStorage),
    indexedDB: Boolean(win.indexedDB),
    pointerLock: "pointerLockElement" in win.document,
  };
}
