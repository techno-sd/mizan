import Verifier from "@/components/Verifier";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            ميزان <span className="text-lg font-medium text-muted">Mizan</span>
          </h1>
          <p className="mt-1 text-muted">من الادعاء إلى الدليل: افحص الآيات والأحاديث والأقوال المنسوبة قبل النشر.</p>
        </div>
      </header>
      <Verifier />
      <footer className="mt-10 border-t border-border pt-4 text-xs leading-6 text-muted">
        ميزان أداة مساعدة للبحث والمراجعة، وليس مرجعًا شرعيًا ولا يصدر فتاوى أو أحكامًا على الأحاديث؛ الأحكام
        المعروضة منقولة عن أصحابها كما وردت في المصادر. نص القرآن الكريم من{" "}
        <a className="underline" href="https://tanzil.net" target="_blank" rel="noreferrer">
          مشروع تنزيل
        </a>
        ، ونصوص الأحاديث وأحكامها من{" "}
        <a className="underline" href="https://github.com/fawazahmed0/hadith-api" target="_blank" rel="noreferrer">
          hadith-api
        </a>
        . لا نحتفظ بنص ما تفحصه.
      </footer>
    </main>
  );
}
