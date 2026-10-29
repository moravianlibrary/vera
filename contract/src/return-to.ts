// ACCESS-login-return: keep only a VERA path after login.
export function safeReturnTo(value: string | null): string {
  if (value === null || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\"))
    return "/";
  const path = value.split(/[?#]/)[0];
  return path === "/login" || path === "/signed-out" ? "/" : value;
}

export function loginPathFor(location: { pathname: string; search: string }): string {
  const returnTo = `${location.pathname}${location.search}`;
  return returnTo === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
