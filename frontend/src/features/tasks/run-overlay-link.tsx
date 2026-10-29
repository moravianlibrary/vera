import type { ComponentProps } from "react";
import { Link, useLocation, useNavigate } from "react-router";

export const runOverlayParam = "run";

function runPath(pathname: string, search: string, hash: string, runId: string): string {
  const params = new URLSearchParams(search);
  params.set(runOverlayParam, runId);
  return `${pathname}?${params}${hash}`;
}

export function useOpenRunOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  return (runId: string) =>
    navigate(runPath(location.pathname, location.search, location.hash, runId));
}

export function RunOverlayLink({
  runId,
  ...props
}: Omit<ComponentProps<typeof Link>, "to"> & { runId: string }) {
  const location = useLocation();
  return <Link {...props} to={runPath(location.pathname, location.search, location.hash, runId)} />;
}
