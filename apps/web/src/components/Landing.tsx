// Site chrome: header and footer only.
import Link from "next/link";

import { ScaleLogo } from "@/components/Icons";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="site-header-content mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="ميزان، الصفحة الرئيسية">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-contrast">
            <ScaleLogo className="h-[18px] w-[18px]" />
          </span>
          <span className="text-lg font-bold">ميزان</span>
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-surface/60 px-4">
      <div className="site-footer-content mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 py-5 sm:flex-row">
        <Link
          href="/"
          aria-label="ميزان، الصفحة الرئيسية"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/15 bg-accent-soft text-accent">
            <ScaleLogo className="h-5 w-5" />
          </span>
          <span className="text-base font-bold text-foreground">ميزان</span>
        </Link>
        <p className="text-center text-xs leading-6 text-muted">
          جميع الحقوق محفوظة لفريق إنجاز © <bdi>{new Date().getFullYear()}</bdi>
        </p>
      </div>
    </footer>
  );
}
