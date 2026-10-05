// Site chrome: header and footer only.
import Link from "next/link";

import { GitHub, ScaleLogo } from "@/components/Icons";
import { METHOD_URL, REPO_URL } from "@/lib/sample";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="ميزان، الصفحة الرئيسية">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-contrast">
            <ScaleLogo className="h-[18px] w-[18px]" />
          </span>
          <span className="text-lg font-bold">ميزان</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="روابط">
          <a href={METHOD_URL} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-muted hover:text-foreground">
            المنهجية
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="الكود المصدري على GitHub"
            className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <GitHub className="h-[18px] w-[18px]" />
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="px-4 py-4 text-center text-xs leading-6 text-muted">
      ميزان أداة مدعومة بالذكاء الاصطناعي للمراجعة، وليس مرجعًا شرعيًا ولا يصدر فتاوى. المصادر المعتمدة:{" "}
      <a className="underline hover:text-foreground" href="https://quranenc.com" target="_blank" rel="noreferrer">
        موسوعة القرآن الكريم
      </a>{" "}
      و
      <a className="underline hover:text-foreground" href="https://hadeethenc.com" target="_blank" rel="noreferrer">
        موسوعة الأحاديث النبوية
      </a>
      ، ومصدر إضافي غير مدرج في الحزمة العلمية:{" "}
      <a className="underline hover:text-foreground" href="https://github.com/fawazahmed0/hadith-api" target="_blank" rel="noreferrer">
        hadith-api
      </a>{" "}
      (يُذكر في كل نتيجة تعتمد عليه). لا نحتفظ بنص ما تفحصه.
    </footer>
  );
}
