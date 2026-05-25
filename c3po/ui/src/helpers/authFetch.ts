export function authFetch(input: RequestInfo, init: RequestInit = {}) {
  return fetch(input, { ...init, credentials: "include" });
}
