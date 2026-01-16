import type { AstroIntegration } from "astro";
import { generateSearchIndex } from "../lib/search-indexer";

export default (): AstroIntegration => ({
  name: "search-index",
  hooks: {
    "astro:build:done": async () => {
      try {
        await generateSearchIndex();
        console.log("Search index generation completed successfully");
      } catch (error) {
        console.error("Error generating search index:", error);
        process.exit(1);
      }
    },
  },
});
