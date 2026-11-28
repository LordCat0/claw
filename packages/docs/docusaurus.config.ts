import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Claw",
  url: "https://example.com",
  baseUrl: "/docs",
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
