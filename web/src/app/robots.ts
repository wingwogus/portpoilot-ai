import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/decision-brief", "/survey", "/portfolio-result"],
    },
    sitemap: "http://localhost:3000/sitemap.xml",
  };
}
