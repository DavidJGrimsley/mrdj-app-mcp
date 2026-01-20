# Styling with Uniwind (Tailwind for React Native)

## Overview
PokePages uses **Uniwind** - fast Tailwind `className` bindings for React Native.

Key mindset:
- Prefer `className` utilities over `StyleSheet.create()` for layout/spacing/typography.
- Keep design tokens + theming in **CSS** (Uniwind), not in `tailwind.config.js`.

## Why Uniwind?

### Advantages
- Familiar Tailwind class syntax
- Cross-platform styling (iOS/Android/Web)
- Build-time style computation (fast)
- Theming via CSS (no Tailwind config required)
- Pseudo-classes (e.g. `active:`) and responsive breakpoints

### Key Differences vs NativeWind
Uniwind’s important differences (relevant when migrating):
- **Tailwind 4 only** (you’ll need `tailwindcss@4`)
- Default `rem` is **16px** (NativeWind default was 14px)
- Themes live in **CSS**, not `tailwind.config.js`
- No NativeWind `ThemeProvider` required
- No automatic class dedupe on web (use `tailwind-merge` if you rely on conflicts)

## Setup

### Install
Follow the official quickstart: https://docs.uniwind.dev/quickstart

Typical packages:
```bash
npm install uniwind
npm install --save-dev tailwindcss@^4
```

### Metro configuration
Uniwind is wired through Metro via `withUniwindConfig`:
```js
// metro.config.js
const { getDefaultConfig } = require('@react-native/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
});
```

If you want to keep NativeWind’s old `rem = 14px` behavior (we probably don't and won't ever use this):
```js
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  polyfills: {
    rem: 14,
  },
});
```

### Global CSS
Uniwind uses Tailwind 4 CSS imports:
```css
/* src/global.css */
@import 'tailwindcss';
@import 'uniwind';

/* Theme + tokens (example pattern) */
@layer theme {
  :root {
    @variant light {
      --color-primary: #ef5350;
      --color-background: #fafafa;
      --color-typography: #212121;
    }

    @variant dark {
      --color-primary: #ef5350;
      --color-background: #121212;
      --color-typography: #ffffff;
    }
  }
}

/* Utilities / components */
@layer utilities {
  .typography-header {
    @apply text-4xl font-bold tracking-tight;
  }

  .typography-body {
    @apply text-base leading-6;
  }
}
```

Import the CSS once at your root entry (Expo Router root layout / app root):
```ts
import '@/global.css';
```

## DJsPortfolio defaults

- `global.css` lives at the project root (not under `src/`). Import it once in `src/app/_layout.tsx` (use a path alias or a relative import).
- Keep `uniwind-types.d.ts` in the project root so TypeScript understands the `className` prop on React Native components.
- The app uses Uniwind only (no `nativewind/babel` preset, no `ThemeProvider`).

## Basic Usage

### Simple styling
```ts
import { Pressable, Text } from 'react-native';

export function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable className="bg-black px-4 py-3 rounded-lg active:opacity-80" onPress={onPress}>
      <Text className="text-white font-semibold text-center">{title}</Text>
    </Pressable>
  );
}
```

### Common patterns

Flex layouts:
```ts
<View className="flex-col gap-4" />
<View className="flex-row items-center gap-2" />
<View className="flex-1 justify-center items-center" />
<View className="flex-row justify-between items-center" />
```

Spacing:
```ts
<View className="p-4" />
<View className="px-4 py-2" />
<View className="mt-4 mb-2" />
<View className="flex-row gap-2" />
```

Dark mode:
```ts
<View className="bg-white dark:bg-black">
  <Text className="text-black dark:text-white">Hello</Text>
</View>
```

Responsive (breakpoints):
```ts
<View className="w-full md:w-1/2 lg:w-1/3" />
```

## Handling conditional / conflicting classNames

### Use `cn()` with `tailwind-merge`
Unlike NativeWind, Uniwind does not automatically deduplicate conflicting classNames (especially on web).
Use a `cn()` helper that merges classes:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Example:
```ts
<View className={cn('bg-red-500', isActive && 'bg-blue-500')} />
```

## Migration

### Migration from StyleSheet
Aim to migrate incrementally: start with layout + spacing + typography.

Before:
```ts
import { StyleSheet, Text, View } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
});

export function Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Title</Text>
    </View>
  );
}
```

After:
```ts
import { Text, View } from 'react-native';

export function Screen() {
  return (
    <View className="flex-1 p-4 bg-white">
      <Text className="text-2xl font-bold mb-2">Title</Text>
    </View>
  );
}
```

Notes:
- Prefer `gap-*` over `marginBottom` stacks where possible.
- If you have dynamic numeric styles, keep `style={{ ... }}` locally for that single value.

### Migration from NativeWind
Use the official guide as the source of truth: https://docs.uniwind.dev/migration-from-nativewind

Practical checklist:
1. Upgrade to `tailwindcss@4` (Uniwind requires Tailwind 4).
2. Remove the NativeWind Babel preset (`nativewind/babel`) from `babel.config.js`.
3. Replace NativeWind’s Metro config with Uniwind’s `withUniwindConfig`.
4. Update your `global.css` header to:
   ```css
   @import 'tailwindcss';
   @import 'uniwind';
   ```
5. Delete `nativewind.d.ts` (no longer needed).
6. Move theme/token configuration from `tailwind.config.js` into CSS (`@layer theme` + `@variant`).
7. Remove `tailwind.config.js` if it only existed for NativeWind theming.
8. If you had font families in `tailwind.config.js`, move them into CSS (Uniwind docs note RN doesn’t support font fallbacks).
9. Optional: set `polyfills.rem = 14` in Metro if you need old sizing behavior.
10. Remove NativeWind’s `ThemeProvider` (keep React Navigation’s theme provider if you use it).
11. If you used NativeWind’s `cssInterop`, migrate to Uniwind’s `withUniwind` API.
12. Safe area utilities:
    - If using open-source Uniwind, forward insets via `react-native-safe-area-context`:
      ```ts
      import { SafeAreaListener } from 'react-native-safe-area-context';
      import { Uniwind } from 'uniwind';

      export function App() {
        return (
          <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
            <View className="p-safe">{/* content */}</View>
          </SafeAreaListener>
        );
      }
      ```
13. If you relied on conflicting class ordering, adopt `tailwind-merge` (`cn()` above).

## Debugging & Tooling

### Editor support
Install **Tailwind CSS IntelliSense** in VS Code for autocomplete and hover previews.

### Docs lookup (Uniwind + NativeWind)
- Uniwind docs: https://docs.uniwind.dev/
- Uniwind migration from NativeWind: https://docs.uniwind.dev/migration-from-nativewind
- NativeWind docs: https://www.nativewind.dev/

This repo’s MCP server includes tools so you don’t have to paste URLs:
- `list-docs` — shows known docs ids (e.g. `uniwind`, `nativewind`)
- `search-docs` — searches docs by `docId` + `query`

Example lookups:
- `search-docs` with `docId=uniwind` and `query=ThemeProvider`
- `search-docs` with `docId=nativewind` and `query=cssInterop`

If you need an ad-hoc URL that isn’t in the registry yet, you can still use:
- `fetch-web-doc` with `url=...` and `query=...`

## Resources
- Uniwind: https://docs.uniwind.dev/
- Class names: https://docs.uniwind.dev/class-names
- Theming basics: https://docs.uniwind.dev/theming/basics
- FAQ (including `tailwind-merge` guidance): https://docs.uniwind.dev/faq
- Tailwind CSS (v4): https://tailwindcss.com/docs
