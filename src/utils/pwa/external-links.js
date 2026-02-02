/**
 * PWA External Links Handler
 * 
 * Fixes issue where links with target="_blank" don't open in external browser
 * when running as PWA on Android devices. This script intercepts link clicks
 * and explicitly opens them in the system browser.
 */

export function initPWAExternalLinks() {
  // Only run on client side
  if (typeof window === 'undefined') {
    return () => {}; // Return empty cleanup for SSR
  }

  // Check if running in standalone/PWA mode
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    (document.referrer && document.referrer.startsWith('android-app://'));

  // Only apply the fix if running in PWA mode
  if (!isStandalone) {
    return () => {}; // Return empty cleanup for non-PWA mode
  }

  // Handle clicks on links with target="_blank"
  const handleLinkClick = (event) => {
    // Find the closest anchor element by traversing up the DOM tree
    let target = event.target;
    
    while (target) {
      // Check if current element is an anchor
      if (target.tagName && target.tagName.toUpperCase() === 'A') {
        break;
      }
      // Move to parent element
      target = target.parentElement;
    }

    // If we didn't find an anchor or it doesn't have an href, ignore the click
    if (!target || !target.href) {
      return;
    }

    // Check if the link should open in a new window/tab
    const targetAttr = target.getAttribute('target');
    const shouldOpenExternally = targetAttr === '_blank' || targetAttr === '_new';

    if (shouldOpenExternally) {
      // Prevent default navigation
      event.preventDefault();
      
      // Get the href
      const href = target.href;
      
      // Validate the URL is safe (only allow http/https protocols)
      try {
        const url = new URL(href, window.location.href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          // Unsafe protocol, ignore
          return;
        }
      } catch (e) {
        // Invalid URL, ignore
        return;
      }
      
      // Open in external browser
      // On Android PWA, this will open in the system browser
      const newWindow = window.open(href, '_blank');
      
      // Set opener to null for security
      if (newWindow) {
        newWindow.opener = null;
      }
      // Note: If popup was blocked (newWindow is null), we silently fail
      // rather than navigating the PWA away, preserving the user's state
    }
  };

  // Add event listener for clicks (using bubble phase)
  document.addEventListener('click', handleLinkClick);

  // Return cleanup function
  return () => {
    document.removeEventListener('click', handleLinkClick);
  };
}
