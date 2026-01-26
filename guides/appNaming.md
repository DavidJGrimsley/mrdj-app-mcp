# App Naming Guide

This guide documents all files and locations where the app name must be updated when scaffolding a new Expo project. Use this during project intake or initial setup to ensure consistency across the entire codebase.

## Core Principle

An app has multiple naming variants that must remain consistent:
- **Display Name**: Human-readable title (e.g., "TemplateApp", "My Cool App")
- **Slug**: URL-friendly lowercase identifier (e.g., "templateapp", "my-cool-app")
- **Package Name**: npm package identifier, kebab-case (e.g., "template-app", "my-cool-app")
- **Bundle Identifier**: Reverse domain notation (e.g., "com.yourcompany.templateapp")
- **Scheme**: Deep linking protocol, kebab-case (e.g., "template-app")

## Files to Update

### 1. package.json
```json
{
  "name": "template-app"  // npm package name, kebab-case
}
```

**What to change**: The `"name"` field to your kebab-case app identifier.

---

### 2. app.json
```json
{
  "expo": {
    "name": "TemplateApp",           // Display name (human-readable)
    "slug": "templateapp",            // URL-friendly slug (lowercase, no spaces)
    "scheme": "template-app",         // Deep link scheme (kebab-case)
    "ios": {
      "bundleIdentifier": "com.mrdj2u.templateapp"  // iOS bundle ID (reverse domain)
    },
    "android": {
      "package": "com.mrdj2u.templateapp"           // Android package (reverse domain)
    }
  }
}
```

**What to change**:
- `expo.name`: User-facing display name
- `expo.slug`: Lowercase identifier for Expo (used in URLs, file paths)
- `expo.scheme`: Deep linking protocol (typically kebab-case)
- `expo.ios.bundleIdentifier`: iOS bundle identifier (reverse domain: `com.yourcompany.appname`)
- `expo.android.package`: Android package name (reverse domain: `com.yourcompany.appname`)

---

### 3. public/manifest.webmanifest
```json
{
  "name": "TemplateApp",              // Full app name for PWA
  "short_name": "Template",           // Short name (12 chars max recommended)
  "description": "A UniWind-ready Expo template for rapid starts."
}
```

**What to change**:
- `name`: Full display name for PWA install
- `short_name`: Abbreviated name for home screen icons (keep it concise)
- `description`: Brief description of the app

---

### 4. README.md (if present)
Update project title, description, and any hardcoded references to the template name.

---

### 5. eas.json (if using EAS Build)
Check for any project-specific identifiers or environment variables that reference the app name.

---

## Naming Conventions

### Display Name (expo.name, manifest.name)
- Use PascalCase or Title Case
- Examples: `"TemplateApp"`, `"My Cool App"`, `"PokePages"`

### Slug (expo.slug)
- All lowercase, no spaces or special characters
- Examples: `"templateapp"`, `"mycoolapp"`, `"pokepages"`

### Package Name (package.json name)
- Kebab-case (lowercase with hyphens)
- Must be URL-safe
- Examples: `"template-app"`, `"my-cool-app"`, `"poke-pages"`

### Scheme (expo.scheme)
- Kebab-case, must match deep linking expectations
- Examples: `"template-app"`, `"my-cool-app"`, `"poke-pages"`

### Bundle Identifier (iOS/Android)
- Reverse domain notation: `com.yourcompany.appname`
- All lowercase, no hyphens (use dots only)
- Examples: `"com.mrdj2u.templateapp"`, `"com.company.mycoolapp"`

---

## Automation Checklist

When setting up a new project from a template, ensure:

1. ✅ `package.json` → `"name"` updated to kebab-case identifier
2. ✅ `app.json` → `expo.name` updated to display name
3. ✅ `app.json` → `expo.slug` updated to lowercase slug
4. ✅ `app.json` → `expo.scheme` updated to kebab-case scheme
5. ✅ `app.json` → `expo.ios.bundleIdentifier` updated to reverse domain
6. ✅ `app.json` → `expo.android.package` updated to reverse domain
7. ✅ `public/manifest.webmanifest` → `name`, `short_name`, `description` updated
8. ✅ `README.md` → Title and description updated (if exists)
9. ✅ `eas.json` → Any project-specific identifiers updated (if exists)

---

## Example Transformation

**From Template:**
```
package.json:              "name": "template-app"
app.json:                  "name": "TemplateApp"
app.json:                  "slug": "templateapp"
app.json:                  "scheme": "template-app"
ios.bundleIdentifier:      "com.mrdj2u.templateapp"
android.package:           "com.mrdj2u.templateapp"
manifest.webmanifest:      "name": "TemplateApp"
manifest.webmanifest:      "short_name": "Template"
```

**To Your App (e.g., "My Event Tracker"):**
```
package.json:              "name": "my-event-tracker"
app.json:                  "name": "My Event Tracker"
app.json:                  "slug": "myeventtracker"
app.json:                  "scheme": "my-event-tracker"
ios.bundleIdentifier:      "com.yourcompany.myeventtracker"
android.package:           "com.yourcompany.myeventtracker"
manifest.webmanifest:      "name": "My Event Tracker"
manifest.webmanifest:      "short_name": "Events"
```

---

## Integration with MCP Prompts

### project-intake
When running `project-intake`, the system should:
1. Ask for the app display name
2. Derive slug, package name, scheme, and bundle identifiers from it
3. Validate naming conventions
4. Update all files listed above in a single pass

### full-app-build
During initial planning, confirm:
- App name variants are defined
- All files have been updated
- No template-specific names remain in the codebase

---

## Common Pitfalls

❌ **Don't**: Leave "template" or "TemplateApp" anywhere in production config  
❌ **Don't**: Use spaces or special characters in slugs, schemes, or bundle IDs  
❌ **Don't**: Mismatch between iOS and Android bundle identifiers (keep them consistent)  
❌ **Don't**: Forget to update the PWA manifest for web deployments

✅ **Do**: Use consistent casing rules across all naming variants  
✅ **Do**: Test deep linking with the new scheme  
✅ **Do**: Verify bundle identifiers are unique to your organization  
✅ **Do**: Keep short_name concise (12 characters or less)

---

## References

- [Expo App Config Documentation](https://docs.expo.dev/workflow/configuration/)
- [iOS Bundle Identifier Guidelines](https://developer.apple.com/documentation/bundleresources/information_property_list/cfbundleidentifier)
- [Android Package Naming](https://developer.android.com/studio/build/configure-app-module#set-namespace)
- [PWA Manifest Specification](https://developer.mozilla.org/en-US/docs/Web/Manifest)
