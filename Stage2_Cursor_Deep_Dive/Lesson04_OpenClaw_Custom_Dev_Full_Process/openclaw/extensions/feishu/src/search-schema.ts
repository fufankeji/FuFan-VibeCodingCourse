import { Type, type Static } from "@sinclair/typebox";

export const FeishuSearchSchema = Type.Union([
  Type.Object({
    action: Type.Literal("search"),
    query: Type.String({ description: "Search query" }),
    max_results: Type.Optional(
      Type.Number({ description: "Number of results (1-20, default: 5)", minimum: 1, maximum: 20 }),
    ),
    search_depth: Type.Optional(
      Type.Union([Type.Literal("basic"), Type.Literal("advanced")], {
        description: "Search depth: basic (fast) or advanced (slower, more comprehensive)",
      }),
    ),
    topic: Type.Optional(
      Type.Union([Type.Literal("general"), Type.Literal("news")], {
        description: "Search topic: general (default) or news (current events)",
      }),
    ),
    days: Type.Optional(
      Type.Number({ description: "For news topic, limit to last n days" }),
    ),
  }),
  Type.Object({
    action: Type.Literal("extract"),
    urls: Type.Array(Type.String({ description: "URL to extract content from" }), {
      description: "One or more URLs to extract raw content from",
      minItems: 1,
    }),
  }),
]);

export type FeishuSearchParams = Static<typeof FeishuSearchSchema>;
