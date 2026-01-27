import { createHash } from "crypto";
import { existsSync } from "fs";
import { join } from "path";

import checkAndCopyConfig, { getSettings } from "utils/config/config";
import createLogger from "utils/logger";
import themes from "utils/styles/themes";

const logger = createLogger("webmanifest");

// Validation helper functions
function validateDisplay(display) {
  const validValues = ["standalone", "fullscreen", "minimal-ui", "browser"];
  return validValues.includes(display) ? display : "standalone";
}

function validateOrientation(orientation) {
  const validValues = ["any", "natural", "landscape", "portrait", "portrait-primary", "portrait-secondary", "landscape-primary", "landscape-secondary"];
  return validValues.includes(orientation) ? orientation : "any";
}

function validateHexColor(color) {
  if (!color) return null;
  // Check if it's a valid hex color
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color) ? color : null;
}

function validateLanguage(lang) {
  if (!lang) return "en";
  // Basic language code validation (2-letter or with region like en-US)
  const langRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
  return langRegex.test(lang) ? lang : "en";
}

function checkIconExists(iconPath) {
  // Remove query params for file check
  const cleanPath = iconPath.split("?")[0];
  // Check in public directory
  const publicPath = join(process.cwd(), "public", cleanPath);
  return existsSync(publicPath);
}

export async function getServerSideProps({ res }) {
  checkAndCopyConfig("settings.yaml");
  const settings = getSettings();

  const color = settings.color || "slate";
  const theme = settings.theme || "dark";

  // Validate language
  const language = validateLanguage(settings.language);
  if (settings.language && settings.language !== language) {
    logger.warn(`Invalid language code "${settings.language}", using default "en"`);
  }

  // Get icon path from settings, default to /images/icons or root
  const iconPath = settings.iconPath || "";
  const useCustomIcons = settings.iconPath && settings.iconPath.length > 0;

  // Generate icon array based on whether custom icons are configured
  let icons;
  if (useCustomIcons) {
    // Define all potential custom icons
    const potentialIcons = [
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
    ];

    // Filter to only include icons that actually exist
    icons = potentialIcons.filter((icon) => {
      const exists = checkIconExists(icon.src);
      if (!exists) {
        logger.warn(`Icon not found: ${icon.src}, excluding from manifest`);
      }
      return exists;
    });

    // If no custom icons exist, fall back to defaults
    if (icons.length === 0) {
      logger.warn(`No custom icons found in ${iconPath}, falling back to default icons`);
      icons = [
        { src: "/android-chrome-192x192.png?v=2", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png?v=2", sizes: "512x512", type: "image/png" },
      ];
    }
  } else {
    icons = [
      { src: "/android-chrome-192x192.png?v=2", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png?v=2", sizes: "512x512", type: "image/png" },
    ];
  }

  // Validate display and orientation
  const display = validateDisplay(settings.display);
  if (settings.display && settings.display !== display) {
    logger.warn(`Invalid display value "${settings.display}", using default "standalone"`);
  }

  const orientation = validateOrientation(settings.orientation);
  if (settings.orientation && settings.orientation !== orientation) {
    logger.warn(`Invalid orientation value "${settings.orientation}", using default "any"`);
  }

  // Validate colors
  const themeColor = validateHexColor(settings.themeColor) || themes[color][theme];
  if (settings.themeColor && !validateHexColor(settings.themeColor)) {
    logger.warn(`Invalid themeColor "${settings.themeColor}", using theme default`);
  }

  const backgroundColor = validateHexColor(settings.backgroundColor) || themes[color][theme];
  if (settings.backgroundColor && !validateHexColor(settings.backgroundColor)) {
    logger.warn(`Invalid backgroundColor "${settings.backgroundColor}", using theme default`);
  }

  const manifest = {
    name: settings.title || "Homepage",
    short_name: settings.shortName || settings.title || "Homepage",
    description:
      settings.description ||
      "A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations.",
    lang: language,
    start_url: settings.startUrl || "/",
    scope: settings.scope || "/",
    display,
    orientation,
    background_color: backgroundColor,
    theme_color: themeColor,
    icons,
  };

  // Add optional fields if they are set and valid
  if (settings.categories && Array.isArray(settings.categories)) {
    // Validate that categories are non-empty strings
    const validCategories = settings.categories.filter(cat => typeof cat === "string" && cat.trim().length > 0);
    if (validCategories.length > 0) {
      manifest.categories = validCategories;
    } else if (settings.categories.length > 0) {
      logger.warn("Invalid categories array, must contain non-empty strings");
    }
  }

  // Add Apple-specific web app settings with validation
  if (settings.appleMobileWebAppCapable !== undefined) {
    const capableValue = settings.appleMobileWebAppCapable === "yes" || settings.appleMobileWebAppCapable === true ? "yes" : "no";
    manifest["apple-mobile-web-app-capable"] = capableValue;
  }

  if (settings.appleMobileWebAppStatusBarStyle) {
    const validStyles = ["default", "black", "black-translucent"];
    const style = validStyles.includes(settings.appleMobileWebAppStatusBarStyle) 
      ? settings.appleMobileWebAppStatusBarStyle 
      : "default";
    if (settings.appleMobileWebAppStatusBarStyle !== style) {
      logger.warn(`Invalid appleMobileWebAppStatusBarStyle "${settings.appleMobileWebAppStatusBarStyle}", using "default"`);
    }
    manifest["apple-mobile-web-app-status-bar-style"] = style;
  }

  if (settings.appleMobileWebAppTitle) {
    if (typeof settings.appleMobileWebAppTitle === "string" && settings.appleMobileWebAppTitle.trim().length > 0) {
      manifest["apple-mobile-web-app-title"] = settings.appleMobileWebAppTitle;
    } else {
      logger.warn("Invalid appleMobileWebAppTitle, must be a non-empty string");
    }
  }

  res.setHeader("Content-Type", "application/manifest+json");
  // Set cache headers to ensure manifest updates when config changes
  // Use no-cache to allow conditional requests with ETag
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  
  // Generate ETag from manifest content for proper cache validation
  const manifestJson = JSON.stringify(manifest);
  const etag = createHash("md5").update(manifestJson).digest("hex");
  res.setHeader("ETag", `"${etag}"`);
  
  // Check if client has the same version
  const clientEtag = res.req.headers["if-none-match"];
  if (clientEtag === `"${etag}"`) {
    res.statusCode = 304;
    res.end();
    return { props: {} };
  }
  
  res.write(manifestJson);
  res.end();

  return {
    props: {},
  };
}

export default function Webmanifest() {
  return null;
}
