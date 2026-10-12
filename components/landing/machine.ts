import { FAQ, HOW_IT_WORKS, PLANS, PRODUCTS } from "./content";

/** Markdown description of Comuno for AI agents and crawlers (llms.txt style). */
export function machineMarkdown(origin: string) {
  return `# Comuno

> Comuno is an AI-native outbound sales platform where users work alongside AI agents to build pipeline. It unifies AI lead discovery grounded in live web search, enrichment and email verification, personalized multi-channel outreach (email, LinkedIn, power dialer), a unified inbox and CRM, and real-time buying signals. Google Gemini is the AI engine.

## Product
${PRODUCTS.map((p) => `- [${p.eyebrow}](${origin}${p.href}): ${p.body}`).join("\n")}
- [Comuno Agent](${origin}/agent): Instruct agents in natural language to prospect, engage, research and manage deals. Outward-facing actions require user approval.

## How it works
${HOW_IT_WORKS.map((s) => `${Number(s.n)}. **${s.title}.** ${s.body}`).join("\n")}

## For agents
- MCP server: ${origin}/api/mcp (Streamable HTTP; \`Authorization: Bearer <Comuno API key>\`)
- REST API: ${origin}/api/v1/contacts, ${origin}/api/v1/companies, ${origin}/api/v1/deals, ${origin}/api/v1/agent
- API keys: Settings → API & integrations

## Pricing
${PLANS.map((p) => `- ${p.name}: ${p.price}${p.cadence} — ${p.credits}, ${p.seats}`).join("\n")}
- Annual billing saves 25%.

## FAQ
${FAQ.map((f) => `### ${f.q}\n${f.a}`).join("\n\n")}

## Links
- [Start for free](${origin}/signup)
- [Login](${origin}/login)
- [Human version](${origin}/)
`;
}
