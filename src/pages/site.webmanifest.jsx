import checkAndCopyConfig, { getSettings } from "utils/config/config";
import themes from "utils/styles/themes";

export async function getServerSideProps({ res }) {
  checkAndCopyConfig("settings.yaml");
  const settings = getSettings();

  const color = settings.color || "slate";
  const theme = settings.theme || "dark";

  // Get icon path from settings, default to /images/icons or root
  const iconPath = settings.iconPath || "";
  const useCustomIcons = settings.iconPath && settings.iconPath.length > 0;

  // Generate icon array based on whether custom icons are configured
  const icons = useCustomIcons
    ? [
        { src: `${iconPath}/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
        { src: `${iconPath}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
        { src: `${iconPath}/favicon-48x48.png`, sizes: "48x48", type: "image/png" },
        { src: `${iconPath}/favicon-72x72.png`, sizes: "72x72", type: "image/png" },
        { src: `${iconPath}/favicon-96x96.png`, sizes: "96x96", type: "image/png" },
        { src: `${iconPath}/favicon-128x128.png`, sizes: "128x128", type: "image/png" },
        { src: `${iconPath}/favicon-144x144.png`, sizes: "144x144", type: "image/png" },
        { src: `${iconPath}/favicon-152x152.png`, sizes: "152x152", type: "image/png" },
        { src: `${iconPath}/favicon-180x180.png`, sizes: "180x180", type: "image/png" },
        { src: `${iconPath}/favicon-192x192.png`, sizes: "192x192", type: "image/png" },
        { src: `${iconPath}/favicon-384x384.png`, sizes: "384x384", type: "image/png" },
        { src: `${iconPath}/favicon-512x512.png`, sizes: "512x512", type: "image/png" },
        { src: `${iconPath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png", purpose: "any" },
        { src: `${iconPath}/maskable-icon-192x192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: `${iconPath}/maskable-icon-512x512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    : [
        { src: "/android-chrome-192x192.png?v=2", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png?v=2", sizes: "512x512", type: "image/png" },
      ];

  const manifest = {
    name: settings.title || "Homepage",
    short_name: settings.shortName || settings.title || "Homepage",
    description:
      settings.description ||
      "A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations.",
    lang: settings.language || "en",
    start_url: settings.startUrl || "/",
    scope: settings.scope || "/",
    display: settings.display || "standalone",
    orientation: settings.orientation || "any",
    background_color: settings.backgroundColor || themes[color][theme],
    theme_color: settings.themeColor || themes[color][theme],
    icons,
  };

  // Add optional fields if they are set
  if (settings.categories && Array.isArray(settings.categories)) {
    manifest.categories = settings.categories;
  }

  // Add Apple-specific web app settings
  if (settings.appleMobileWebAppCapable !== undefined) {
    manifest["apple-mobile-web-app-capable"] = settings.appleMobileWebAppCapable;
  }

  if (settings.appleMobileWebAppStatusBarStyle) {
    manifest["apple-mobile-web-app-status-bar-style"] = settings.appleMobileWebAppStatusBarStyle;
  }

  if (settings.appleMobileWebAppTitle) {
    manifest["apple-mobile-web-app-title"] = settings.appleMobileWebAppTitle;
  }

  res.setHeader("Content-Type", "application/manifest+json");
  res.write(JSON.stringify(manifest));
  res.end();

  return {
    props: {},
  };
}

export default function Webmanifest() {
  return null;
}
