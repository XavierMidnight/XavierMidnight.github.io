/** Escape a string for safe innerHTML insertion. */
export function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Read a nested value from an object by dot-separated path. */
export function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

/** Set a nested value on an object by dot-separated path. */
export function setByPath(obj, path, val) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o != null ? o[k] : undefined), obj);
  if (target != null) target[last] = val;
}

/** Generate a short unique id. */
export function uid() {
  return '_' + Math.random().toString(36).slice(2, 9);
}
