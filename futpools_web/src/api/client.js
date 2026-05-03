const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(method, path, body = null, token = null) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (res.status >= 400) {
    // Pick the first usable message in this order:
    //   1. structured `{ message, code, field }`
    //   2. legacy `{ msg }`
    //   3. validator-array `{ errors: [{ msg, path }] }`
    //   4. HTTP status text
    let msg = data.message || data.msg;
    if (!msg && Array.isArray(data.errors) && data.errors.length) {
      msg = data.errors[0].msg || data.errors[0].message;
    }
    if (!msg) msg = res.statusText || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = data.code || (Array.isArray(data.errors) && data.errors[0]?.path
      ? `INVALID_${String(data.errors[0].path).toUpperCase()}`
      : null);
    err.field = data.field || (Array.isArray(data.errors) ? data.errors[0]?.path : null);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path, token) => request('GET', path, null, token),
  post: (path, body, token) => request('POST', path, body, token),
  put: (path, body, token) => request('PUT', path, body, token),
  delete: (path, token) => request('DELETE', path, null, token),
};
