import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import AuthForm from "@/components/app/AuthForm";

export const metadata = { title: "Sign in — Comuno" };

export default async function LoginPage() {
  if (await getCtx()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
