import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import AuthForm from "@/components/app/AuthForm";

export const metadata = { title: "Start for free — Comuno" };

export default async function SignupPage() {
  if (await getCtx()) redirect("/dashboard");
  return <AuthForm mode="signup" />;
}
