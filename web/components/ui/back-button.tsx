'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function BackButton({
  fallbackHref = '/students',
  label = 'Back',
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const router = useRouter();

  function onClick() {
    if (
      typeof window !== 'undefined' &&
      window.history.length > 1 &&
      document.referrer.includes(window.location.host)
    ) {
      router.back();
    } else {
      router.push(fallbackHref as any);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500 hover:text-ink-800 mb-3"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}