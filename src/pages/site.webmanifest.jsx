import { createHash } from "crypto";
import { existsSync } from "fs";
import { join } from "path";

import checkAndCopyConfig, { getSettings } from "utils/config/config";
import createLogger from "utils/logger";
import slugify from "utils/slugify";
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

function validateShortcuts(shortcuts, settings) {
  if (!shortcuts || !Array.isArray(shortcuts)) {
    return [];
  }

  const validShortcuts = [];
  
  for (let i = 0; i < shortcuts.length; i++) {
    const shortcut = shortcuts[i];
    
    // Validate required fields
    if (!shortcut.name || typeof shortcut.name !== "string" || shortcut.name.trim().length === 0) {
      logger.warn(`Shortcut at index ${i} missing required "name" field, skipping`);
      continue;
    }
    
    // Check for either 'url' or 'target' field
    let urlValue;
    if (shortcut.target && typeof shortcut.target === "string" && shortcut.target.trim().length > 0) {
      // Target field specified - generate redirect API URL
      const targetName = shortcut.target.trim();
      
      // Check if target exists in layout
      if (settings?.layout && settings.layout[targetName]) {
        // Use redirect API instead of anchor link
        urlValue = `/api/shortcut/${slugify(targetName)}`;
        logger.debug(`Shortcut "${shortcut.name}" target "${targetName}" resolved to redirect URL: ${urlValue}`);
      } else {
        logger.warn(`Shortcut "${shortcut.name}" target "${targetName}" not found in layout, skipping`);
        continue;
      }
    } else if (shortcut.url && typeof shortcut.url === "string" && shortcut.url.trim().length > 0) {
      // URL field specified - use as is
      urlValue = shortcut.url.trim();
    } else {
      logger.warn(`Shortcut "${shortcut.name}" missing required "url" or "target" field, skipping`);
      continue;
    }
    
    const validShortcut = {
      name: shortcut.name.trim(),
      url: urlValue,
    };
    
    // Add optional short_name if provided
    if (shortcut.short_name && typeof shortcut.short_name === "string" && shortcut.short_name.trim().length > 0) {
      validShortcut.short_name = shortcut.short_name.trim();
    }
    
    // Add optional description if provided
    if (shortcut.description && typeof shortcut.description === "string" && shortcut.description.trim().length > 0) {
      validShortcut.description = shortcut.description.trim();
    }
    
    // Add optional icons if provided
    if (shortcut.icons && Array.isArray(shortcut.icons) && shortcut.icons.length > 0) {
      const validIcons = shortcut.icons.filter(icon => {
        if (!icon.src || typeof icon.src !== "string" || icon.src.trim().length === 0) {
          logger.warn(`Shortcut "${shortcut.name}" has icon with missing "src", skipping icon`);
          return false;
        }
        if (!icon.sizes || typeof icon.sizes !== "string" || icon.sizes.trim().length === 0) {
          logger.warn(`Shortcut "${shortcut.name}" has icon with missing "sizes", skipping icon`);
          return false;
        }
        
        // Check if icon exists
        const exists = checkIconExists(icon.src);
        if (!exists) {
          logger.warn(`Shortcut "${shortcut.name}" icon not found: ${icon.src}, skipping icon`);
          return false;
        }
        
        return true;
      }).map(icon => {
        const validIcon = {
          src: icon.src.trim(),
          sizes: icon.sizes.trim(),
        };
        
        if (icon.type && typeof icon.type === "string" && icon.type.trim().length > 0) {
          validIcon.type = icon.type.trim();
        }
        
        if (icon.purpose && typeof icon.purpose === "string" && icon.purpose.trim().length > 0) {
          validIcon.purpose = icon.purpose.trim();
        }
        
        return validIcon;
      });
      
      if (validIcons.length > 0) {
        validShortcut.icons = validIcons;
      }
    }
    
    validShortcuts.push(validShortcut);
  }
  
  return validShortcuts;
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
  
  // Log config file location for debugging
  const configDir = process.env.HOMEPAGE_CONFIG_DIR || join(process.cwd(), "config");
  const settingsPath = join(configDir, "settings.yaml");
  logger.debug(`Settings file location: ${settingsPath}`);

  // Check if PWA configuration exists
  const pwaConfig = settings.pwa || null;
  
  // If no PWA config, return default minimal manifest
  if (!pwaConfig) {
    logger.info("No PWA configuration found, using default manifest");
    
    // Validate language from root settings
    const language = validateLanguage(settings.language);
    
    // Validate display and orientation from root settings
    const display = validateDisplay(settings.display);
    const orientation = validateOrientation(settings.orientation);
    
    // Get theme colors from root settings or defaults
    const color = settings.color || "slate";
    const theme = settings.theme || "dark";
    const themeColor = validateHexColor(settings.themeColor) || themes[color][theme];
    const backgroundColor = validateHexColor(settings.backgroundColor) || themes[color][theme];
    
    // Validate default icons exist
    const defaultIconCandidates = [
      { src: "/android-chrome-192x192.png?v=2", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png?v=2", sizes: "512x512", type: "image/png" },
    ];
    
    const defaultIcons = defaultIconCandidates.filter((icon) => {
      const exists = checkIconExists(icon.src);
      if (!exists) {
        logger.warn(`Default icon not found: ${icon.src}, excluding from manifest`);
      }
      return exists;
    });
    
    if (defaultIcons.length === 0) {
      logger.warn("No default icons found for default manifest");
    }
    
    const defaultManifest = {
      name: settings.title || "Homepage",
      short_name: settings.title || "Homepage",
      description: settings.description || "A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations.",
      lang: language,
      start_url: settings.startUrl || "/",
      scope: settings.scope || "/",
      display,
      orientation,
      background_color: backgroundColor,
      theme_color: themeColor,
      icons: defaultIcons,
    };
    
    // Add shortcuts if provided in root settings
    const defaultShortcuts = validateShortcuts(settings.shortcuts, settings);
    if (defaultShortcuts.length > 0) {
      defaultManifest.shortcuts = defaultShortcuts;
      logger.debug(`Added ${defaultShortcuts.length} shortcuts to default manifest`);
    }
    
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
  logger.debug("PWA configuration found, building custom manifest");
  logger.debug(`PWA config keys: ${Object.keys(pwaConfig).join(', ')}`);
  logger.debug(`PWA config: ${JSON.stringify(pwaConfig, null, 2)}`);
  
  const color = settings.color || "slate";
  const theme = settings.theme || "dark";

  // Helper function to get value with fallback: pwa.field -> settings.field -> default
  // Used for general settings that can fall back to root settings
  const getConfigValue = (pwaField, settingsField, defaultValue) => {
    if (pwaConfig[pwaField] !== undefined && pwaConfig[pwaField] !== null) {
      return pwaConfig[pwaField];
    }
    if (settings[settingsField] !== undefined && settings[settingsField] !== null) {
      return settings[settingsField];
    }
    return defaultValue;
  };
  
  // Helper function for PWA-specific settings that should NOT fall back to root settings
  // Only use pwa.field -> default (no root fallback)
  const getPwaOnlyValue = (pwaField, defaultValue) => {
    if (pwaConfig[pwaField] !== undefined && pwaConfig[pwaField] !== null) {
      return pwaConfig[pwaField];
    }
    return defaultValue;
  };

  // Validate language - can fall back to root settings
  const rawLanguage = getConfigValue('language', 'language', null);
  const language = validateLanguage(rawLanguage);
  if (rawLanguage && rawLanguage !== language) {
    logger.warn(`Invalid language code "${rawLanguage}", using default "en"`);
  }

  // Get icon path from PWA config only (no root fallback for PWA-specific paths)
  const iconPath = getPwaOnlyValue('iconPath', '');
  const useCustomIcons = iconPath && iconPath.length > 0;
  
  if (useCustomIcons) {
    logger.debug(`Custom icon path configured: ${iconPath}`);
  } else {
    logger.debug("No custom icon path configured, using default icons");
  }

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

  // Validate PWA-specific display and orientation settings
  // These are PWA-specific and should NOT fall back to root settings
  // Use defaults if not specified in pwa section
  const rawDisplay = getPwaOnlyValue('display', 'standalone');
  const display = validateDisplay(rawDisplay);
  if (rawDisplay && rawDisplay !== display) {
    logger.warn(`Invalid display value "${rawDisplay}", using default "standalone"`);
  }

  const rawOrientation = getPwaOnlyValue('orientation', 'any');
  const orientation = validateOrientation(rawOrientation);
  if (rawOrientation && rawOrientation !== orientation) {
    logger.warn(`Invalid orientation value "${rawOrientation}", using default "any"`);
  }

  // Validate colors - can fall back to root settings
  const rawThemeColor = getConfigValue('themeColor', 'themeColor', null);
  logger.debug(`rawThemeColor value: "${rawThemeColor}", pwaConfig.themeColor: "${pwaConfig.themeColor}"`);
  const themeColor = validateHexColor(rawThemeColor) || themes[color][theme];
  if (rawThemeColor && !validateHexColor(rawThemeColor)) {
    logger.warn(`Invalid themeColor "${rawThemeColor}", using theme default "${themes[color][theme]}"`);
  } else if (rawThemeColor) {
    const source = (pwaConfig.themeColor !== undefined && pwaConfig.themeColor !== null) ? 'pwa config' : 'root settings';
    logger.debug(`Using themeColor: ${rawThemeColor} from ${source}`);
  } else {
    logger.debug(`Using default themeColor: ${themes[color][theme]} from theme`);
  }

  const rawBackgroundColor = getConfigValue('backgroundColor', 'backgroundColor', null);
  logger.debug(`rawBackgroundColor value: "${rawBackgroundColor}", pwaConfig.backgroundColor: "${pwaConfig.backgroundColor}"`);
  const backgroundColor = validateHexColor(rawBackgroundColor) || themes[color][theme];
  if (rawBackgroundColor && !validateHexColor(rawBackgroundColor)) {
    logger.warn(`Invalid backgroundColor "${rawBackgroundColor}", using theme default "${themes[color][theme]}"`);
  } else if (rawBackgroundColor) {
    const source = (pwaConfig.backgroundColor !== undefined && pwaConfig.backgroundColor !== null) ? 'pwa config' : 'root settings';
    logger.debug(`Using backgroundColor: ${rawBackgroundColor} from ${source}`);
  } else {
    logger.debug(`Using default backgroundColor: ${themes[color][theme]} from theme`);
  }

  // Build manifest with fallback values
  const shortNameValue = getConfigValue('shortName', 'shortName', null);
  logger.debug(`shortName from config: "${shortNameValue}", pwaConfig.shortName: "${pwaConfig.shortName}"`);
  
  // Validate shortName is a non-empty string, otherwise fall back to title
  let shortName;
  if (shortNameValue !== null && shortNameValue !== undefined && typeof shortNameValue === 'string' && shortNameValue.trim().length > 0) {
    shortName = shortNameValue;
  } else {
    if (shortNameValue !== null && shortNameValue !== undefined) {
      logger.warn(`Invalid shortName "${shortNameValue}", must be a non-empty string, using title instead`);
    }
    shortName = getConfigValue('title', 'title', 'Homepage');
  }
  
  const manifest = {
    name: getConfigValue('title', 'title', 'Homepage'),
    short_name: shortName,
    description: getConfigValue('description', 'description', 'A highly customizable homepage (or startpage / application dashboard) with Docker and service API integrations.'),
    lang: language,
    start_url: getPwaOnlyValue('startUrl', '/'),  // PWA-specific, use default
    scope: getPwaOnlyValue('scope', '/'),         // PWA-specific, use default
    display,
    orientation,
    background_color: backgroundColor,
    theme_color: themeColor,
    icons,
  };

  // Add optional fields if they are set and valid
  // Categories - only add if specified in pwa section (no root fallback for PWA-specific categorization)
  const categories = getPwaOnlyValue('categories', null);
  if (categories && Array.isArray(categories)) {
    // Validate that categories are non-empty strings
    const validCategories = categories.filter(cat => typeof cat === "string" && cat.trim().length > 0);
    if (validCategories.length > 0) {
      manifest.categories = validCategories;
    } else if (categories.length > 0) {
      logger.warn("Invalid categories array, must contain non-empty strings");
    }
  }

  // Add Apple-specific web app settings - only from pwa section (PWA-specific)
  const appleMobileWebAppCapable = getPwaOnlyValue('appleMobileWebAppCapable', null);
  if (appleMobileWebAppCapable !== null && appleMobileWebAppCapable !== undefined) {
    const capableValue = appleMobileWebAppCapable === "yes" || appleMobileWebAppCapable === true ? "yes" : "no";
    manifest["apple-mobile-web-app-capable"] = capableValue;
  }

  const appleMobileWebAppStatusBarStyle = getPwaOnlyValue('appleMobileWebAppStatusBarStyle', null);
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

  const appleMobileWebAppTitle = getPwaOnlyValue('appleMobileWebAppTitle', null);
  if (appleMobileWebAppTitle) {
    if (typeof appleMobileWebAppTitle === "string" && appleMobileWebAppTitle.trim().length > 0) {
      manifest["apple-mobile-web-app-title"] = appleMobileWebAppTitle;
    } else {
      logger.warn("Invalid appleMobileWebAppTitle, must be a non-empty string");
    }
  }

  // Add shortcuts if provided - only from pwa section (PWA-specific)
  const shortcutsConfig = getPwaOnlyValue('shortcuts', null);
  if (shortcutsConfig) {
    const validatedShortcuts = validateShortcuts(shortcutsConfig, settings);
    if (validatedShortcuts.length > 0) {
      manifest.shortcuts = validatedShortcuts;
      logger.debug(`Added ${validatedShortcuts.length} shortcuts to PWA manifest`);
    } else if (Array.isArray(shortcutsConfig) && shortcutsConfig.length > 0) {
      logger.warn("No valid shortcuts found in configuration");
    }
  }

  // Log final manifest summary for debugging
  logger.debug(`Generated PWA manifest: name="${manifest.name}", short_name="${manifest.short_name}", theme_color="${manifest.theme_color}", background_color="${manifest.background_color}", icons=${manifest.icons.length}`);

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
