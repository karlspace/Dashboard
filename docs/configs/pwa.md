---
title: PWA Configuration
description: Progressive Web App Manifest Configuration
---

Homepage supports Progressive Web App (PWA) installation with comprehensive manifest customization. The PWA manifest controls how your homepage appears when installed as an app on mobile devices, tablets, and desktops.

**Configuration Structure:** All PWA-specific settings should be nested under a `pwa:` key in your `settings.yaml` file.

**Behavior:**
- **With `pwa:` key present**: Homepage generates a custom PWA manifest with all specified settings
- **Without `pwa:` key**: Homepage generates a default minimal manifest using root-level settings (title, description, language, display, orientation, theme colors) when available

**Fallback Behavior (when `pwa:` key is present):**

Settings are divided into two categories:

1. **General Settings** (title, description, language, themeColor, backgroundColor, shortName):
   - First checks `pwa.field`
   - If not found, falls back to root-level `settings.field`
   - If still not found, uses default value

2. **PWA-Specific Settings** (display, orientation, scope, startUrl, iconPath, categories, Apple settings):
   - Only checks `pwa.field`
   - If not found and mandatory, uses default value
   - If not found and optional, field is omitted from manifest
   - **Does NOT fall back to root-level settings**

## Basic PWA Settings

All settings in this section should be placed under the `pwa:` key.

### Title and Short Name

The `title` is used as both the app name and short name by default. You can customize the short name separately for home screen display:

```yaml
pwa:
  title: "Dashboard | BAUER GROUP"
  shortName: "Dashboard"  # Optional, defaults to pwa.title or root title
```

**Fallback:** If `pwa.title` is not set, falls back to root-level `title`, then defaults to "Homepage".

### Description

Customize the app description shown in app stores and installation prompts:

```yaml
pwa:
  description: "Dashboard of Company Services at BAUER GROUP"
```

**Fallback:** If `pwa.description` is not set, falls back to root-level `description`, then to a default description.

### Language

Set the primary language for your PWA manifest:

```yaml
pwa:
  language: en  # ISO 639-1 language code (e.g., en, de, fr, es)
```

Supports language codes with regions (e.g., `en-US`, `de-DE`, `fr-FR`).

**Fallback:** If `pwa.language` is not set, falls back to root-level `language`, then defaults to "en".

## PWA Display Settings

### Display Mode

Controls how the PWA appears when launched:

```yaml
pwa:
  display: standalone  # Options: standalone, fullscreen, minimal-ui, browser
```

- **standalone** (default): Looks like a native app, hides browser UI
- **fullscreen**: Full screen without any browser UI
- **minimal-ui**: Similar to standalone with minimal browser controls
- **browser**: Opens in a regular browser tab

**Default:** If not specified in `pwa:` section, defaults to "standalone". Does NOT fall back to root-level settings.

### Orientation

Set the preferred screen orientation:

```yaml
pwa:
  orientation: any  # Options: any, natural, landscape, portrait
```

Additional options: `portrait-primary`, `portrait-secondary`, `landscape-primary`, `landscape-secondary`

**Default:** If not specified in `pwa:` section, defaults to "any". Does NOT fall back to root-level settings.

### Scope and Start URL

Define the PWA's navigation scope and starting point:

```yaml
pwa:
  scope: /         # Navigation scope, defaults to "/"
  startUrl: /      # Starting URL when app launches, defaults to "/"
```

**Default:** Both default to "/" if not specified. These are PWA-specific settings and do NOT fall back to root-level settings.

## Theme Customization

### Colors

Override theme colors with custom hex values:

```yaml
pwa:
  themeColor: "#FF8500"        # Hex color for browser UI
  backgroundColor: "#18181B"    # Hex color for splash screen background
```

If not specified in the `pwa:` section, these will check root-level settings, then use the selected theme's default colors (based on `color` and `theme` settings).

**Color format:** Must be valid hex colors (`#RRGGBB` or `#RGB`). Invalid colors will fall back to theme defaults with a warning.

### Categories

Specify app categories for app stores:

```yaml
pwa:
  categories:
    - business
    - productivity
    - utilities
```

Common categories: `business`, `education`, `entertainment`, `finance`, `fitness`, `games`, `lifestyle`, `medical`, `music`, `news`, `productivity`, `shopping`, `social`, `sports`, `travel`, `utilities`

**Optional:** If not specified in `pwa:` section, this field is omitted from the manifest. Does NOT fall back to root-level settings.

## Icon Configuration

### Custom Icon Path

Configure a directory containing your custom PWA icons:

```yaml
pwa:
  iconPath: /images/icons
```

**Default Behavior:** If `pwa.iconPath` is not set or omitted, Homepage will use the default built-in icons (`android-chrome-192x192.png` and `android-chrome-512x512.png` from the root path). All icons are validated for existence before being included in the manifest. Does NOT fall back to root-level settings.

When `iconPath` is set, Homepage will look for the following icon files:

**Standard Icons (required):**
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon-48x48.png`
- `favicon-72x72.png`
- `favicon-96x96.png`
- `favicon-128x128.png`
- `favicon-144x144.png`
- `favicon-152x152.png`
- `favicon-180x180.png`
- `favicon-192x192.png`
- `favicon-384x384.png`
- `favicon-512x512.png`

**Special Purpose Icons (optional):**
- `apple-touch-icon.png` (180x180) - iOS home screen icon
- `maskable-icon-192x192.png` - Adaptive icon for Android
- `maskable-icon-512x512.png` - Adaptive icon for Android

!!! note "Icon File Validation"
    Homepage validates that icon files exist before including them in the manifest. Only existing icons will be included, preventing broken references. If no custom icons are found, the system falls back to default icons automatically.

!!! warning "Volume Mount Required"
    To use custom icons, mount your icon directory to the Docker container:

    ```yaml
    volumes:
      - /path/to/your/icons:/app/public/images/icons
    ```

### Icon File Guidelines

**File Format:** PNG format recommended for best compatibility

**Sizes:** Provide multiple sizes for optimal display across devices
- Small sizes (16-48px): Browser tabs and taskbar
- Medium sizes (72-152px): Mobile home screens
- Large sizes (192-512px): App stores and high-DPI displays

**Maskable Icons:** For Android adaptive icons, ensure your design works within the safe zone (80% of canvas centered)

## Apple-Specific Settings

Configure iOS/macOS specific PWA behavior:

```yaml
pwa:
  appleMobileWebAppCapable: yes           # Enable iOS web app mode
  appleMobileWebAppStatusBarStyle: black-translucent  # Status bar style
  appleMobileWebAppTitle: "Dashboard"     # iOS home screen name
```

**Status Bar Styles:**
- `default`: White background with black text
- `black`: Black background with white text
- `black-translucent`: Translucent black, content shows behind

**Optional:** All Apple-specific settings are optional. If not specified in `pwa:` section, they are omitted from the manifest. Does NOT fall back to root-level settings.

## Complete Example

Here's a comprehensive PWA configuration example:

```yaml
# PWA Configuration
pwa:
  # Basic App Info
  title: "Dashboard | BAUER GROUP"
  shortName: "Dashboard"
  description: "Dashboard of Company Services at BAUER GROUP"
  language: en

  # Display & Navigation
  display: standalone
  orientation: any
  scope: /
  startUrl: /

  # Theme & Colors
  themeColor: "#FF8500"        # BAUER GROUP Orange
  backgroundColor: "#18181B"   # Dark background (matches dark theme)

  # App Categories
  categories:
    - business
    - productivity
    - utilities

  # Icons
  iconPath: /images/icons

  # Apple / iOS specific settings
  appleMobileWebAppCapable: yes
  appleMobileWebAppStatusBarStyle: black-translucent
  appleMobileWebAppTitle: "Dashboard"

# Standard Settings (used as fallbacks and for general theme)
theme: dark
color: slate
```

## Validation and Best Practices

Homepage automatically validates all PWA manifest settings:

**Validated Parameters:**
- Language codes (ISO format)
- Display modes (PWA spec)
- Orientation values (PWA spec)
- Hex color formats
- Icon file existence
- Apple status bar styles

**Invalid values** are logged as warnings and replaced with safe defaults.

## Troubleshooting

### Icons Not Showing

1. **Check file paths**: Ensure icons exist at specified path
2. **Check permissions**: Files must be readable by the container
3. **Check logs**: Look for "Icon not found" warnings in logs
4. **Verify mount**: Ensure volume is properly mounted in Docker

### Manifest Not Updating

1. **Clear browser cache**: Force refresh with Ctrl+Shift+R (Cmd+Shift+R on Mac)
2. **Check version**: Manifest includes versioning for cache busting
3. **Rebuild**: Restart the container to regenerate manifest

### PWA Not Installing

1. **HTTPS required**: PWAs require HTTPS (localhost works for testing)
2. **Manifest valid**: Check browser DevTools → Application → Manifest
3. **Service worker**: Ensure no service worker conflicts
4. **Icons present**: At least one 192x192 and one 512x512 icon required

## Testing Your PWA

1. **Chrome DevTools**: Open Application tab → Manifest to see parsed manifest
2. **Lighthouse**: Run PWA audit to check compliance
3. **Test Installation**: Click install prompt or use browser menu
4. **Mobile Testing**: Test on actual devices for best results

## Cache and Versioning

Homepage automatically handles manifest versioning:

- **Build Version**: Timestamp added at build time forces reload on deploy
- **ETag Validation**: Content-based hashing enables efficient cache validation
- **No-Cache Headers**: Ensures manifest validates on each request
- **Config Changes**: Manifest updates immediately when settings change

No manual cache clearing needed - the system handles it automatically!
