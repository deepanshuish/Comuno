import { getCtx } from "@/lib/auth";
import Landing from "@/components/landing/Landing";

export default async function Home() {
  const signedIn = !!(await getCtx().catch(() => null));
  return <Landing signedIn={signedIn} />;
}
