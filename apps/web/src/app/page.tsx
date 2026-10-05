import { SiteFooter, SiteHeader } from "@/components/Landing";
import Verifier from "@/components/Verifier";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Verifier />
      </main>
      <SiteFooter />
    </>
  );
}
