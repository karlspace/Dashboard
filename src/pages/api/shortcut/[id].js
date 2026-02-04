import checkAndCopyConfig, { getSettings } from "utils/config/config";
import { servicesFromConfig, servicesFromDocker, servicesFromKubernetes, findGroupByName, cleanServiceGroups } from "utils/config/service-helpers";
import createLogger from "utils/logger";
import slugify from "utils/slugify";

const logger = createLogger("shortcut-redirect");

export default async function handler(req, res) {
  const { id } = req.query;

  // Validate request method
  if (req.method !== "GET") {
    logger.warn(`Invalid method ${req.method} for shortcut redirect`);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate id parameter
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    logger.warn("Missing or invalid shortcut id");
    return res.status(400).json({ error: "Invalid shortcut id" });
  }

  try {
    // Load configuration
    checkAndCopyConfig("settings.yaml");
    const settings = getSettings();

    // Get shortcuts from PWA config or root settings
    const shortcuts = settings.pwa?.shortcuts || settings.shortcuts || [];

    // Find the shortcut by matching the slugified target/url name
    let targetShortcut = null;
    let targetServiceName = null;

    for (const shortcut of shortcuts) {
      if (shortcut.target) {
        const slugifiedTarget = slugify(shortcut.target);
        if (slugifiedTarget === id) {
          targetShortcut = shortcut;
          targetServiceName = shortcut.target;
          break;
        }
      } else if (shortcut.url) {
        // For URL-based shortcuts, match by slugified shortcut name
        const slugifiedName = slugify(shortcut.name);
        if (slugifiedName === id) {
          targetShortcut = shortcut;
          // For URL shortcuts, we'll redirect directly to the URL
          break;
        }
      }
    }

    // Validate that the shortcut exists and is configured
    if (!targetShortcut) {
      logger.warn(`Shortcut with id "${id}" not found in configuration`);
      return res.status(404).json({ error: "Shortcut not found" });
    }

    // If shortcut has a direct URL, redirect to it
    if (targetShortcut.url && !targetShortcut.target) {
      const directUrl = targetShortcut.url;
      logger.info(`Redirecting shortcut "${id}" to direct URL: ${directUrl}`);
      
      // Validate the URL before redirecting
      try {
        // Check if it's a relative URL or absolute URL
        if (directUrl.startsWith("/") || directUrl.startsWith("#")) {
          // Relative URL - safe to redirect
          return res.redirect(302, directUrl);
        }
        
        // For absolute URLs, validate that they are http/https
        const url = new URL(directUrl);
        if (url.protocol === "http:" || url.protocol === "https:") {
          return res.redirect(302, directUrl);
        }
        
        // Invalid protocol
        logger.warn(`Invalid protocol in direct URL: ${directUrl}`);
        return res.status(400).json({ error: "Invalid URL protocol" });
      } catch (error) {
        logger.error(`Error parsing direct URL: ${error.message}`);
        return res.status(400).json({ error: "Invalid URL" });
      }
    }

    // Target field specified - find the service by name
    if (!targetServiceName) {
      logger.warn(`Shortcut "${id}" has no target or url specified`);
      return res.status(400).json({ error: "Invalid shortcut configuration" });
    }

    // Load services from all sources
    const [configServices, dockerServices, kubernetesServices] = await Promise.all([
      servicesFromConfig().catch((err) => {
        logger.error(`Failed to load services from config: ${err.message}`);
        return [];
      }),
      servicesFromDocker().catch((err) => {
        logger.error(`Failed to load services from Docker: ${err.message}`);
        return [];
      }),
      servicesFromKubernetes().catch((err) => {
        logger.error(`Failed to load services from Kubernetes: ${err.message}`);
        return [];
      }),
    ]);

    // Merge and clean all service groups
    const allServices = cleanServiceGroups([...configServices, ...dockerServices, ...kubernetesServices]);

    // Search for the service by name across all groups
    let targetUrl = null;
    let foundServiceName = null;
    let foundGroupName = null;

    for (const group of allServices) {
      if (group.services && Array.isArray(group.services)) {
        for (const service of group.services) {
          if (service.name === targetServiceName) {
            if (service.href && service.href !== "#") {
              targetUrl = service.href;
              foundServiceName = service.name;
              foundGroupName = group.name;
              logger.info(`Found service "${foundServiceName}" in group "${foundGroupName}" with URL: ${targetUrl}`);
              break;
            }
          }
        }
        if (targetUrl) break;
      }
      
      // Also check nested groups
      if (group.groups && Array.isArray(group.groups)) {
        for (const nestedGroup of group.groups) {
          if (nestedGroup.services && Array.isArray(nestedGroup.services)) {
            for (const service of nestedGroup.services) {
              if (service.name === targetServiceName) {
                if (service.href && service.href !== "#") {
                  targetUrl = service.href;
                  foundServiceName = service.name;
                  foundGroupName = nestedGroup.name;
                  logger.info(`Found service "${foundServiceName}" in nested group "${foundGroupName}" with URL: ${targetUrl}`);
                  break;
                }
              }
            }
            if (targetUrl) break;
          }
        }
        if (targetUrl) break;
      }
    }

    // If no service found with that name
    if (!targetUrl) {
      logger.warn(`Service "${targetServiceName}" not found or has no URL`);
      return res.status(404).json({ error: "Service not found" });
    }

    // Validate the URL before redirecting
    try {
      // Check if it's a relative URL or absolute URL
      if (targetUrl.startsWith("/") || targetUrl.startsWith("#")) {
        // Relative URL - safe to redirect
        return res.redirect(302, targetUrl);
      }
      
      // For absolute URLs, validate that they are http/https
      const url = new URL(targetUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return res.redirect(302, targetUrl);
      }
      
      // Invalid protocol
      logger.warn(`Invalid protocol in URL: ${targetUrl}`);
      return res.status(400).json({ error: "Invalid URL protocol" });
    } catch (error) {
      logger.error(`Error parsing URL: ${error.message}`);
      return res.status(400).json({ error: "Invalid URL" });
    }
  } catch (error) {
    logger.error(`Error processing shortcut redirect: ${error.message}`);
    return res.status(500).json({ error: "Internal server error" });
  }
}
