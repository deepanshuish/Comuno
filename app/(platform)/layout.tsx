import { requireCtx } from "@/lib/auth";
import Sidebar from "@/components/app/Sidebar";

export const metadata = { title: "Comuno: AI sales platform" };

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace } = await requireCtx();
  return (
    <div className="platform min-h-screen bg-[#fbfbfa] text-zinc-900">
      <Sidebar
        user={{ name: user.name, email: user.email }}
        workspace={{ name: workspace.name, credits: workspace.credits, plan: workspace.plan }}
      />
      <main className="lg:pl-[232px]">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
