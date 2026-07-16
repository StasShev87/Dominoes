import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dominoes",
    short_name: "Dominoes",
    description: "Play Draw Dominoes with a computer or a friend.",
    start_url: "/uk",
    display: "standalone",
    background_color: "#102c26",
    theme_color: "#102c26",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }]
  };
}
