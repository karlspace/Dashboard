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

    // Find the shortcut by matching the slugified target name
    let targetShortcut = null;
    let targetName = null;

    for (const shortcut of shortcuts) {
      if (shortcut.target) {
        const slugifiedTarget = slugify(shortcut.target);
        if (slugifiedTarget === id) {
          targetShortcut = shortcut;
          targetName = shortcut.target;
          break;
        }
      }
    }

    // Validate that the shortcut exists and is configured
    if (!targetShortcut || !targetName) {
      logger.warn(`Shortcut with id "${id}" not found in configuration`);
      return res.status(404).json({ error: "Shortcut not found" });
    }

    // Validate that the target section exists in layout
    if (!settings.layout || !settings.layout[targetName]) {
      logger.warn(`Layout section "${targetName}" not found for shortcut "${id}"`);
      return res.status(404).json({ error: "Layout section not found" });
    }

    // Load services from all sources
    const [configServices, dockerServices, kubernetesServices] = await Promise.all([
      servicesFromConfig().catch(() => []),
      servicesFromDocker().catch(() => []),
      servicesFromKubernetes().catch(() => []),
    ]);

    // Merge and clean all service groups
    const allServices = cleanServiceGroups([...configServices, ...dockerServices, ...kubernetesServices]);

    // Find the target group
    const targetGroup = findGroupByName(allServices, targetName);

    let targetUrl = null;

    if (targetGroup && targetGroup.services && targetGroup.services.length > 0) {
      // Find the first service with a valid href
      for (const service of targetGroup.services) {
        if (service.href && service.href !== "#") {
          targetUrl = service.href;
          logger.info(`Redirecting shortcut "${id}" (${targetName}) to service "${service.name}" URL: ${targetUrl}`);
          break;
        }
      }
    }

    // If no service URL found, fall back to anchor link on dashboard
    if (!targetUrl) {
      logger.warn(`No service with URL found in section "${targetName}", falling back to anchor`);
      targetUrl = `/#${slugify(targetName)}`;
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
