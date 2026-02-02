/**
 * PWA External Links Handler
 * 
 * Fixes issue where links with target="_blank" don't open in external browser
 * when running as PWA on Android devices. This script intercepts link clicks
 * and explicitly opens them in the system browser.
 */

export function initPWAExternalLinks() {
  // Only run on client side
  if (typeof window === 'undefined') return;

  // Check if running in standalone/PWA mode
  const isStandalone = () => {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  };

  // Only apply the fix if running in PWA mode
  if (!isStandalone()) {
    return;
  }

  // Handle clicks on links with target="_blank"
  const handleLinkClick = (event) => {
    // Find the closest anchor element
    let target = event.target;
    while (target && target.tagName !== 'A') {
      target = target.parentElement;
    }

    // If not an anchor or doesn't have href, ignore
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
      
      // Open in external browser
      // On Android PWA, this will open in the system browser
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  // Add event listener for clicks
  document.addEventListener('click', handleLinkClick, true);

  // Return cleanup function
  return () => {
    document.removeEventListener('click', handleLinkClick, true);
  };
}
