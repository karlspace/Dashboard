import checkAndCopyConfig, { getSettings } from "utils/config/config";
import { servicesFromConfig, servicesFromDocker, servicesFromKubernetes, cleanServiceGroups } from "utils/config/service-helpers";
import createLogger from "utils/logger";
import slugify from "utils/slugify";

const logger = createLogger("shortcut-redirect");

// Helper function to validate and redirect to a URL
function validateAndRedirect(url, res, loggerInstance) {
  try {
    // Check if it's a relative URL or absolute URL
    if (url.startsWith("/") || url.startsWith("#")) {
      // Relative URL - safe to redirect
      return res.redirect(302, url);
    }
    
    // For absolute URLs, validate that they are http/https
    const urlObj = new URL(url);
    if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
      return res.redirect(302, url);
    }
    
    // Invalid protocol
    loggerInstance.warn(`Invalid protocol in URL: ${url}`);
    return res.status(400).json({ error: "Invalid URL protocol" });
  } catch (error) {
    loggerInstance.error(`Error parsing URL: ${error.message}`);
    return res.status(400).json({ error: "Invalid URL" });
  }
}

// Helper function to search for a service by name across all groups
function findServiceByName(allServices, serviceName) {
  for (const group of allServices) {
    // Check regular services
    if (group.services && Array.isArray(group.services)) {
      for (const service of group.services) {
        if (service.name === serviceName && service.href && service.href !== "#") {
          return {
            url: service.href,
            serviceName: service.name,
            groupName: group.name,
          };
        }
      }
    }
    
    // Check nested groups
    if (group.groups && Array.isArray(group.groups)) {
      for (const nestedGroup of group.groups) {
        if (nestedGroup.services && Array.isArray(nestedGroup.services)) {
          for (const service of nestedGroup.services) {
            if (service.name === serviceName && service.href && service.href !== "#") {
              return {
                url: service.href,
                serviceName: service.name,
                groupName: nestedGroup.name,
              };
            }
          }
        }
      }
    }
  }
  
  return null;
}

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

    // Find the shortcut by matching the slugified name
    // For 'target' shortcuts: ID is slugified target name
    // For 'url' shortcuts: ID is slugified shortcut name
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
      return validateAndRedirect(directUrl, res, logger);
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

    // Search for the service by name
    const foundService = findServiceByName(allServices, targetServiceName);

    if (!foundService) {
      logger.warn(`Service "${targetServiceName}" not found or has no URL`);
      return res.status(404).json({ error: "Service not found" });
    }

    logger.info(`Found service "${foundService.serviceName}" in group "${foundService.groupName}" with URL: ${foundService.url}`);

    // Validate and redirect to the service URL
    return validateAndRedirect(foundService.url, res, logger);
  } catch (error) {
    logger.error(`Error processing shortcut redirect: ${error.message}`);
    return res.status(500).json({ error: "Internal server error" });
  }
}
