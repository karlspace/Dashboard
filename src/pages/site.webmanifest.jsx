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

  // Check if PWA configuration exists
  const pwaConfig = settings.pwa || null;
  
  // If no PWA config, return default minimal manifest
  if (!pwaConfig) {
    logger.info("No PWA configuration found, using default manifest");
    const defaultManifest = {
      name: settings.title || "Homepage",
      short_name: settings.title || "Homepage",
      description: settings.description || "A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations.",
      lang: "en",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "any",
      background_color: themes[settings.color || "slate"][settings.theme || "dark"],
      theme_color: themes[settings.color || "slate"][settings.theme || "dark"],
      icons: [
        { src: "/android-chrome-192x192.png?v=2", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png?v=2", sizes: "512x512", type: "image/png" },
      ],
    };
    
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    const manifestJson = JSON.stringify(defaultManifest);
    const etag = createHash("md5").update(manifestJson).digest("hex");
    res.setHeader("ETag", `"${etag}"`);
    
    const clientEtag = res.req.headers["if-none-match"];
    if (clientEtag === `"${etag}"`) {
      res.statusCode = 304;
      res.end();
      return { props: {} };
    }
    
    res.write(manifestJson);
    res.end();
    return { props: {} };
  }

  // PWA config exists, build custom manifest
  logger.info("PWA configuration found, building custom manifest");
  
  const color = settings.color || "slate";
  const theme = settings.theme || "dark";

  // Helper function to get value with fallback: pwa.field -> settings.field -> default
  const getConfigValue = (pwaField, settingsField, defaultValue) => {
    if (pwaConfig[pwaField] !== undefined && pwaConfig[pwaField] !== null) {
      return pwaConfig[pwaField];
    }
    if (settings[settingsField] !== undefined && settings[settingsField] !== null) {
      return settings[settingsField];
    }
    return defaultValue;
  };

  // Validate language
  const rawLanguage = getConfigValue('language', 'language', null);
  const language = validateLanguage(rawLanguage);
  if (rawLanguage && rawLanguage !== language) {
    logger.warn(`Invalid language code "${rawLanguage}", using default "en"`);
  }

  // Get icon path from PWA config, with fallback to settings, then empty
  const iconPath = pwaConfig.iconPath || "";
  const useCustomIcons = iconPath && iconPath.length > 0;

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
      const defaultIcons = [
        { src: "/android-chrome-192x192.png?v=2", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png?v=2", sizes: "512x512", type: "image/png" },
      ];
      
      // Validate default icons exist
      icons = defaultIcons.filter((icon) => {
        const exists = checkIconExists(icon.src);
        if (!exists) {
          logger.warn(`Default icon not found: ${icon.src}, excluding from manifest`);
        }
        return exists;
      });
      
      if (icons.length === 0) {
        logger.warn("No default icons found, manifest will have no icons");
      }
    }
  } else {
    // No custom icon path, validate and use default icons
    const defaultIcons = [
      { src: "/android-chrome-192x192.png?v=2", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png?v=2", sizes: "512x512", type: "image/png" },
    ];
    
    // Validate default icons exist
    icons = defaultIcons.filter((icon) => {
      const exists = checkIconExists(icon.src);
      if (!exists) {
        logger.warn(`Default icon not found: ${icon.src}, excluding from manifest`);
      }
      return exists;
    });
    
    // If no default icons exist, provide empty array (manifest will still be valid)
    if (icons.length === 0) {
      logger.warn("No default icons found, manifest will have no icons");
    }
  }

  // Validate display and orientation
  const rawDisplay = getConfigValue('display', 'display', 'standalone');
  const display = validateDisplay(rawDisplay);
  if (rawDisplay && rawDisplay !== display) {
    logger.warn(`Invalid display value "${rawDisplay}", using default "standalone"`);
  }

  const rawOrientation = getConfigValue('orientation', 'orientation', 'any');
  const orientation = validateOrientation(rawOrientation);
  if (rawOrientation && rawOrientation !== orientation) {
    logger.warn(`Invalid orientation value "${rawOrientation}", using default "any"`);
  }

  // Validate colors with fallback chain: pwa.themeColor -> settings.themeColor -> theme default
  const rawThemeColor = pwaConfig.themeColor || settings.themeColor;
  const themeColor = validateHexColor(rawThemeColor) || themes[color][theme];
  if (rawThemeColor && !validateHexColor(rawThemeColor)) {
    logger.warn(`Invalid themeColor "${rawThemeColor}", using theme default`);
  }

  const rawBackgroundColor = pwaConfig.backgroundColor || settings.backgroundColor;
  const backgroundColor = validateHexColor(rawBackgroundColor) || themes[color][theme];
  if (rawBackgroundColor && !validateHexColor(rawBackgroundColor)) {
    logger.warn(`Invalid backgroundColor "${rawBackgroundColor}", using theme default`);
  }

  // Build manifest with fallback values
  const manifest = {
    name: getConfigValue('title', 'title', 'Homepage'),
    short_name: pwaConfig.shortName || getConfigValue('title', 'title', 'Homepage'),
    description: getConfigValue('description', 'description', 'A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations.'),
    lang: language,
    start_url: getConfigValue('startUrl', 'startUrl', '/'),
    scope: getConfigValue('scope', 'scope', '/'),
    display,
    orientation,
    background_color: backgroundColor,
    theme_color: themeColor,
    icons,
  };

  // Add optional fields if they are set and valid
  const categories = pwaConfig.categories || settings.categories;
  if (categories && Array.isArray(categories)) {
    // Validate that categories are non-empty strings
    const validCategories = categories.filter(cat => typeof cat === "string" && cat.trim().length > 0);
    if (validCategories.length > 0) {
      manifest.categories = validCategories;
    } else if (categories.length > 0) {
      logger.warn("Invalid categories array, must contain non-empty strings");
    }
  }

  // Add Apple-specific web app settings with validation
  const appleMobileWebAppCapable = pwaConfig.appleMobileWebAppCapable !== undefined 
    ? pwaConfig.appleMobileWebAppCapable 
    : settings.appleMobileWebAppCapable;
  
  if (appleMobileWebAppCapable !== undefined) {
    const capableValue = appleMobileWebAppCapable === "yes" || appleMobileWebAppCapable === true ? "yes" : "no";
    manifest["apple-mobile-web-app-capable"] = capableValue;
  }

  const appleMobileWebAppStatusBarStyle = pwaConfig.appleMobileWebAppStatusBarStyle || settings.appleMobileWebAppStatusBarStyle;
  if (appleMobileWebAppStatusBarStyle) {
    const validStyles = ["default", "black", "black-translucent"];
    const style = validStyles.includes(appleMobileWebAppStatusBarStyle) 
      ? appleMobileWebAppStatusBarStyle 
      : "default";
    if (appleMobileWebAppStatusBarStyle !== style) {
      logger.warn(`Invalid appleMobileWebAppStatusBarStyle "${appleMobileWebAppStatusBarStyle}", using "default"`);
    }
    manifest["apple-mobile-web-app-status-bar-style"] = style;
  }

  const appleMobileWebAppTitle = pwaConfig.appleMobileWebAppTitle || settings.appleMobileWebAppTitle;
  if (appleMobileWebAppTitle) {
    if (typeof appleMobileWebAppTitle === "string" && appleMobileWebAppTitle.trim().length > 0) {
      manifest["apple-mobile-web-app-title"] = appleMobileWebAppTitle;
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
