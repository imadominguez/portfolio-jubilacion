import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { CocosGuide } from "@/components/guide/cocos-guide";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const metadata: Metadata = {
  title: "Guía Cocos",
};

export default function GuiaPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Guía Cocos"
        description="Cómo descargar CSV desde Cocos Capital"
      />

      <main className="flex-1 px-6 py-10 max-w-5xl w-full mx-auto">
        <CocosGuide />
      </main>
    </div>
  );
}
