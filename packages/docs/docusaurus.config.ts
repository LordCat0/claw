import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Claw",
  url: process.env.DOCS_URL || "https://example.com",
  baseUrl: process.env.DOCS_BASE_URL || "/docs/",
  presets: [
    [
      "classic",
      {
        blog: false,
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
        },
      } satisfies Preset.Options,
    ],
  ],
};

export default config;
