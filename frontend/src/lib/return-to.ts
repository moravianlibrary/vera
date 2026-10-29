// ACCESS-login-return: after logging in, back to the page that sent the person, but only a path
// within VERA. Anything else (another site, a protocol-relative //host, the login page itself)
// lands on the start page instead.
export function safeReturnTo(value: string | null): string {
  if (
    value === null ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/";
  }

  const path = value.split(/[?#]/)[0];
  return path === "/login" || path === "/signed-out" ? "/" : value;
}

// The address of the login page that comes back to where the person is now.
export function loginPathFor(location: { pathname: string; search: string }): string {
  const returnTo = `${location.pathname}${location.search}`;
  return returnTo === "/" ? "/login" : `/login?returnTo=${encodeURIComponent(returnTo)}`;
}
