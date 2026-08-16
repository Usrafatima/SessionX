import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "SessionX", short_name: "SessionX", description: "Global Market Sessions. Smarter Alerts.", start_url: "/", display: "standalone", background_color: "#030405", theme_color: "#030405", orientation: "portrait-primary",  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
  ] };
}
