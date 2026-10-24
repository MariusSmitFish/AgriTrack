# PWA Installation Guide

## Installing AgriScale Farm as a Progressive Web App

### Android Devices (Including REDMI/MIUI phones)

#### Recommended Method: Using Chrome Browser

1. **Open the website in Google Chrome** (not MIUI Browser or other browsers)
   - Download Chrome from Play Store if not installed
   - Chrome has the best PWA support on Android

2. **Wait for the install prompt**
   - A banner will appear at the bottom of the screen after a few seconds
   - Tap "Install" when it appears

3. **If no banner appears:**
   - Tap the **three-dot menu (⋮)** in the top-right corner
   - Select **"Add to Home screen"** or **"Install app"**
   - Confirm the installation

#### REDMI/MIUI Specific Instructions

MIUI (Xiaomi's Android skin) has aggressive battery optimization that can interfere with PWA functionality. Follow these steps:

**1. Allow Chrome to run in the background:**
   - Go to **Settings → Apps → Manage apps**
   - Find and select **Chrome**
   - Tap **Battery saver**
   - Select **"No restrictions"**

**2. Enable Chrome Autostart:**
   - In the same Chrome app settings
   - Tap **Autostart**
   - Enable the toggle

**3. Disable Battery Optimization for the PWA (after installation):**
   - After installing the PWA, go back to **Settings → Apps → Manage apps**
   - Find **"AgriScale Farm"**
   - Set **Battery saver** to **"No restrictions"**
   - Enable **Autostart**

#### Troubleshooting on Android/MIUI

**Problem: Install button doesn't appear**
- Ensure you're using Chrome (not MIUI Browser)
- The website must be served over HTTPS (http:// won't work)
- Try clearing Chrome's cache: Settings → Apps → Chrome → Clear cache
- Restart Chrome and visit the website again

**Problem: App doesn't work offline after installation**
- Check that Chrome and the PWA have "No restrictions" in Battery saver settings
- Ensure Autostart is enabled for both Chrome and the PWA

**Problem: Can't find the installed app**
- Check your home screen and app drawer
- The app icon might be in a different location than expected
- Try searching for "AgriScale" in your app drawer

### iOS Devices (iPhone/iPad)

1. **Open the website in Safari** (Chrome on iOS doesn't support PWA installation)

2. **Tap the Share button** (square with arrow pointing up)
   - It's at the bottom of the screen on iPhone
   - It's at the top on iPad

3. **Scroll down and tap "Add to Home Screen"**

4. **Edit the name if needed, then tap "Add"**

### Desktop (Windows/Mac/Linux)

#### Chrome, Edge, or Brave:
1. Look for the **install icon** (⊕ or computer icon) in the address bar
2. Click it and confirm the installation

#### Alternative method:
1. Click the **three-dot menu**
2. Select **"Install AgriScale Farm"** or **"Create shortcut"**
3. Confirm the installation

## Benefits of Installing as PWA

- **Faster access**: Launch directly from your home screen
- **Offline support**: Access cached data even without internet
- **Native experience**: Runs in its own window without browser UI
- **Background sync**: Receive updates when you open the app
- **Better performance**: Optimized for installed use

## Checking Installation Requirements

The PWA must meet these criteria for the install prompt to appear:

- ✅ Served over HTTPS (or localhost for development)
- ✅ Has a valid web app manifest
- ✅ Has a registered service worker
- ✅ Has appropriate icons (192px and 512px)
- ✅ User has interacted with the page (spent some time on it)

## Technical Notes

### For Developers

The app automatically detects:
- **iOS Safari**: Shows manual installation instructions
- **Android Chrome**: Shows native install prompt
- **MIUI/Other Android browsers**: Shows fallback instructions after 3 seconds if native prompt doesn't fire

The install prompt is dismissed permanently when:
- User taps "Not now" (stored in localStorage)
- User successfully installs the app
- App is already running in standalone mode

To reset the prompt (for testing):
1. Open browser DevTools (F12)
2. Go to Application → Storage
3. Clear localStorage for the site
4. Refresh the page

### Service Worker

The app uses Workbox with these caching strategies:
- **HTML pages**: NetworkFirst (3 second timeout)
- **JS/CSS/Images**: Precached during installation
- **Google Fonts**: CacheFirst with 1 year expiration

### Manifest Location

After build, the manifest is available at: `/manifest.webmanifest`

## Support

For issues or questions about PWA installation, contact your system administrator or check the browser console for error messages (F12 → Console).
