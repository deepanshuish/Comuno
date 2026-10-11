import { route } from "@/lib/api";

export const GET = route(async ({ ctx }) => {
  const { gemini_api_key, smtp_json, ...workspace } = ctx.workspace;
  return {
    user: ctx.user,
    workspace: { ...workspace, has_gemini_key: !!gemini_api_key || !!process.env.GEMINI_API_KEY, has_smtp: !!smtp_json || !!process.env.SMTP_HOST },
  };
});
