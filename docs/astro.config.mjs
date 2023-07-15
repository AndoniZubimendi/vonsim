import { fileURLToPath } from "node:url";

import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://vonsim.github.io",
  base: "/docs",

  integrations: [
    starlight({
      title: "VonSim",
      editLink: {
        baseUrl: "https://github.com/vonsim/vonsim/edit/main/docs/",
      },
      pagination: false,
      lastUpdated: true,
      social: {
        github: "https://github.com/vonsim/vonsim",
      },

      defaultLocale: "root",
      locales: {
        root: { lang: "es", label: "Español" },
        // en: { label: "English" },
      },

      sidebar: [
        { label: "Inicio", link: "/" },
        {
          label: "CPU",
          items: [
            { label: "Conceptos generales", link: "/cpu/" },
            { label: "Lenguaje ensamblador", link: "/cpu/assembly/" },
            {
              label: "Instrucciones",
              collapsed: true,
              autogenerate: { directory: "cpu/instructions" },
            },
          ],
        },
        {
          label: "Entrada/Salida",
          items: [
            { label: "Conceptos generales", link: "/io/" },
            {
              label: "Módulos E/S",
              collapsed: true,
              autogenerate: { directory: "io/modules" },
            },
            {
              label: "Dispositivos",
              collapsed: true,
              autogenerate: { directory: "io/devices" },
            },
          ],
        },
        {
          label: "Referencia",
          autogenerate: { directory: "reference" },
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],

  // Process images with sharp: https://docs.astro.build/en/guides/assets/#using-sharp
  image: { service: { entrypoint: "astro/assets/services/sharp" } },

  // Markdown configuration: https://docs.astro.build/en/reference/configuration-reference/#markdown-options
  markdown: {
    shikiConfig: {
      langs: [
        {
          id: "vonsim",
          scopeName: "source.asm.vonsim",
          displayName: "asm",
          aliases: ["vonsim", "asm"],
          path: fileURLToPath(new URL("./src/assets/vonsim.tmLanguage.json", import.meta.url)),
        },
      ],
    },
  },
});