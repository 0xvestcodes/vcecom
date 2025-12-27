import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "VCEcom Documentation",
  tagline:
    "Lightweight ecommerce backend built with NestJS, Drizzle ORM, and Next.js",
  favicon: "img/favicon.ico",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://vcecom-internal.vestcodes.co",
  // Set the /<baseUrl>/ pathname under which your site is served
  // GitHub Pages serves from root, so docs are at /docs/
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "Vestcodes", // Usually your GitHub org/user name.
  projectName: "vcecom", // Usually your repo name.

  // Enable Mermaid diagrams
  markdown: {
    mermaid: true,
  },

  themes: ["@docusaurus/theme-mermaid"],

  onBrokenLinks: "ignore",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/Vestcodes/vcecom/tree/main/apps/docs/",
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false, // Disable blog for documentation-only site
        theme: {
          customCss: "./src/css/custom.css",
        },
        pages: {
          path: "src/pages",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: "img/docusaurus-social-card.jpg",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "VCEcom",
      logo: {
        alt: "VCEcom Logo",
        src: "img/logo.svg",
      },
      hideOnScroll: true,
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Documentation",
        },
        {
          type: "dropdown",
          label: "API Reference",
          position: "left",
          items: [
            {
              label: "Store API",
              to: "/api-reference/store",
            },
            {
              label: "Admin API",
              to: "/api-reference/admin",
            },
          ],
        },
        {
          href: "https://github.com/Vestcodes/vcecom",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "Introduction",
              to: "/introduction",
            },
            {
              label: "Architecture",
              to: "/architecture/overview",
            },
            {
              label: "API Reference",
              to: "/api-reference/admin-api",
            },
          ],
        },
        {
          title: "Resources",
          items: [
            {
              label: "Database Schema",
              to: "/database-schema/overview",
            },
            {
              label: "Deployment",
              to: "/deployment/overview",
            },
            {
              label: "Redis Architecture",
              to: "/redis/overview",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/Vestcodes/vcecom",
            },
            {
              label: "Issues",
              href: "https://github.com/Vestcodes/vcecom/issues",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Vestcodes. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ["bash", "json", "typescript", "javascript"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
