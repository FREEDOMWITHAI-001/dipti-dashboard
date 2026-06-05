'use client';

import { usePathname, useSearchParams } from 'next/navigation';

// A KPI-card / pill link that changes a single URL search param WITHOUT a server
// navigation. The page data doesn't depend on these params (the lists filter
// client-side from already-loaded rows), so a full server refetch on every click
// is wasted work and is what made the cards feel slow. history.pushState updates
// the URL in place — shareable/bookmarkable, back-button works — and any client
// component reading useSearchParams (the tables here) reacts instantly. Mirrors
// the pattern already used for the student slideover deep-link.
//
// Ctrl/Cmd/Shift/middle-click fall through to the real <a> so "open in new tab"
// still works.
export function FilterLink({
  param, value, defaultValue, className, children,
}: {
  param: string;
  value: string;
  defaultValue?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(param) ?? defaultValue;
  const active = current === value;

  const next = new URLSearchParams(params.toString());
  next.set(param, value);
  const href = `${pathname}?${next.toString()}`;

  return (
    <a
      href={href}
      data-active={active}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        window.history.pushState(null, '', href);
      }}
    >
      {children}
    </a>
  );
}
