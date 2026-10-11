import { bad, body, route } from "@/lib/api";
import { withCredits } from "@/lib/credits";
import { generateJSON } from "@/lib/gemini";

type Profile = {
  company_name: string;
  product_description: string;
  value_prop: string;
  icp: { industries: string[]; company_sizes: string[]; locations: string[]; titles: string[]; seniorities: string[]; keywords: string[]; notes: string };
};

/** Research the user's own website and draft their company profile + ICP. */
export const POST = route(async ({ req, ctx }) => {
  const { website } = await body<{ website?: string }>(req);
  if (!website?.trim()) bad("Enter your company website");
  const { data, sources } = await withCredits(ctx.workspace, "research", 1, () =>
    generateJSON<Profile>({
      workspace: ctx.workspace,
      search: true,
      prompt: `Research the company at ${website}. Using what you find, draft a B2B sales profile for it:
- company_name
- product_description: 2-3 sentences on what they sell and to whom
- value_prop: the core outcome customers get, in one or two crisp sentences
- icp: who they should sell to. industries, company_sizes (ranges like "51-200"), locations, titles (buyer job titles), seniorities, keywords, and notes on qualification criteria.
Base it on the company's actual positioning and customers.`,
      schema: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          product_description: { type: "string" },
          value_prop: { type: "string" },
          icp: {
            type: "object",
            properties: {
              industries: { type: "array", items: { type: "string" } },
              company_sizes: { type: "array", items: { type: "string" } },
              locations: { type: "array", items: { type: "string" } },
              titles: { type: "array", items: { type: "string" } },
              seniorities: { type: "array", items: { type: "string" } },
              keywords: { type: "array", items: { type: "string" } },
              notes: { type: "string" },
            },
            required: ["industries", "company_sizes", "locations", "titles", "seniorities", "keywords", "notes"],
          },
        },
        required: ["company_name", "product_description", "value_prop", "icp"],
      },
    }),
  );
  return { profile: data, sources };
});
