# Ads & Monetization Strategies

## Overview
This guide covers monetization strategies for React Native/Expo apps, from ad networks to sponsored content. Choose the approach that best fits your app's UX and business model.

**Ethics & UX First:**
- Users hate intrusive ads
- Frequency caps are essential
- Privacy compliance is mandatory (GDPR, COPPA)
- Premium/ad-free options improve retention
- Consider your audience (kids apps have strict rules)

## Table of Contents
1. [No Ads (Premium/Freemium)](#no-ads-premiumfreemium)
2. [David's Portfolio Ads (Sponsored Content)](#davids-portfolio-ads-sponsored-content)
3. [External Ad Networks](#external-ad-networks)
4. [Implementation Patterns](#implementation-patterns)
5. [Privacy & Compliance](#privacy--compliance)

---

## No Ads (Premium/Freemium)

### Overview
Cleanest user experience. Monetize through premium features, subscriptions, or one-time purchases instead of ads.

**When to use:**
- Premium apps
- B2B/productivity apps
- Apps targeting professionals
- When UX is the competitive advantage

### Implementation
```typescript
// Example: Feature gating
import { useAuthStore } from '@/store/authStore';

export function PremiumFeature() {
  const isPremium = useAuthStore((s) => s.profile?.isPremium);
  
  if (!isPremium) {
    return <UpgradePrompt />;
  }
  
  return <FeatureContent />;
}
```

**Best Practices:**
- ✅ Offer generous free tier to attract users
- ✅ Clear value proposition for premium
- ✅ Trial periods to demonstrate value
- ✅ Restore purchases across devices
- ❌ Don't lock core functionality behind paywall
- ❌ Don't hide pricing (users hate surprises)

---

## David's Portfolio Ads (Sponsored Content)

### Overview
**Custom offline-first ad system** for displaying your own services or sponsored content. Perfect for apps where you want full control over ads and don't want to share revenue with ad networks.

**When to use:**
- You have your own services to promote
- You want to feature partners/sponsors
- You want full control over ad content
- You need offline support
- You want to avoid ad network revenue cuts

**Reference Implementation:**
- PokePages uses this pattern successfully
- Full code in: `code/ads/` folder
- Service: `adsService.ts`
- Components: `Ads/AdBanner.tsx`, `AdModal.tsx`, etc.

### Architecture

**API-First with Offline Fallback:**
```
┌─────────────────────────────────────────┐
│         Client Application              │
└──────────────┬──────────────────────────┘
               │
               ├─── Cache Layer (AsyncStorage/localStorage)
               │    └─── 1-hour cache, instant loads
               │
               └─── Ad API Server
                    └─── Returns ads + service details
                         └─── Admin controls content
```

### Setup Steps

#### 1. API Endpoint Setup

**Option A: Use David's Portfolio API**
```bash
# .env or .env.local
EXPO_PUBLIC_ADS_API_URL=https://davidjgrimsley.com/api/content
EXPO_PUBLIC_ADS_INTAKE_BASE_URL=https://davidjgrimsley.com/services
```

**Option B: Create Your Own API**

Create API route at `/api/content+api.ts`:
```typescript
export async function GET() {
  return Response.json({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    services: [
      {
        id: 'your-service-id',
        description: 'Service description',
        features: ['Feature 1', 'Feature 2']
      }
    ],
    ads: [
      {
        id: 'ad-1',
        serviceId: 'your-service-id',
        headline: 'Ad Headline',
        body: 'Ad body text',
        ctaLabel: 'Learn More',
        ctaUrl: 'https://yoursite.com/service',
        accent: '#0E668B'
      }
    ]
  });
}
```

#### 2. Install the Ads Service

Copy from `code/ads/` into your project:

```bash
# Copy service
cp code/ads/adsService.ts src/services/adsService.ts

# Copy components
cp -r code/ads/Ads src/components/Ads
```

#### 3. Configure Environment Variables

```bash
# .env
EXPO_PUBLIC_ADS_API_URL=https://yourapi.com/api/content
EXPO_PUBLIC_ADS_INTAKE_BASE_URL=https://yoursite.com/services
EXPO_PUBLIC_ADS_DEBUG=true  # Optional: enable logging
```

#### 4. Use in Your App

**Simple Banner:**
```typescript
import { AdBannerWithModal } from '@/components/Ads';

export default function HomePage() {
  return (
    <View>
      {/* Your content */}
      
      {/* Ad banner */}
      <AdBannerWithModal />
    </View>
  );
}
```

**Multiple Ads (like TypeInfo):**
```typescript
import { getAllAds, type AdConfig } from '@/services/adsService';
import { AdBannerWithModal } from '@/components/Ads';

export function ContentPage() {
  const [ads, setAds] = useState<AdConfig[]>([]);
  
  useEffect(() => {
    const loadAds = async () => {
      const results = await getAllAds();
      setAds(results);
    };
    loadAds();
  }, []);
  
  return (
    <ScrollView>
      {items.map((item, index) => (
        <Fragment key={item.id}>
          <ContentItem item={item} />
          
          {/* Show ad every 25 items */}
          {(index + 1) % 25 === 0 && ads.length > 0 && (
            <AdBannerWithModal adId={ads[index % ads.length].id} />
          )}
        </Fragment>
      ))}
    </ScrollView>
  );
}
```

### Offline-First Caching Strategy

The service implements automatic caching:

```typescript
// Caching Logic (built into adsService.ts)
export async function getAllAds(): Promise<AdConfig[]> {
  // 1. Try cache first (instant UX)
  const cachedAds = await getCachedAds();
  const cacheExpired = await isCacheExpired();
  
  // 2. Return cached if valid
  if (cachedAds && !cacheExpired) {
    return cachedAds;
  }
  
  // 3. Return cached while refreshing in background
  if (cachedAds && cacheExpired) {
    fetchAdsFromAPI()
      .then(setCachedAds)
      .catch(console.error);
    
    return cachedAds; // Instant return
  }
  
  // 4. No cache - fetch (blocking)
  const freshAds = await fetchAdsFromAPI();
  await setCachedAds(freshAds);
  return freshAds;
}
```

**Cache Configuration:**
- **Duration:** 1 hour (configurable in `adsService.ts`)
- **Storage:** AsyncStorage (mobile) / localStorage (web)
- **Keys:** `ads_cache`, `ads_cache_timestamp`

### Customization

**Icon Mapping** (in `adsService.ts`):
```typescript
const iconMap: Record<string, string> = {
  'app-development': 'phone-portrait-outline',
  'website-building': 'globe-outline',
  'game-development': 'game-controller-outline',
  'tutoring': 'school-outline',
  'online-presence': 'trending-up-outline',
  // Add your service IDs here
};
```

**Color Mapping**:
```typescript
const colorMap: Record<string, string> = {
  '#0E668B': 'blue',
  '#1E9E70': 'green',
  '#723B80': 'purple',
  '#EEA444': 'orange',
  '#D63C83': 'pink',
  // Add your brand colors here
};
```

### Best Practices

✅ **DO:**
- Cache aggressively (1-hour minimum)
- Load ads in useEffect with cleanup
- Handle empty ad arrays gracefully
- Log payload for debugging (remove in production)
- Use external intake URLs for conversions
- Test offline behavior thoroughly

❌ **DON'T:**
- Block UI waiting for ads
- Show ads on every screen (user fatigue)
- Use sync loading (`useMemo(() => getAllAds())` ❌)
- Forget to handle loading states
- Show broken ads (always have fallback)

### Troubleshooting

**Ads not showing:**
```typescript
// Check console logs
EXPO_PUBLIC_ADS_DEBUG=true

// Common issues:
// 1. API URL wrong
// 2. CORS not enabled on API
// 3. Async loading not implemented (must use useEffect)
// 4. Empty ads array from API
```

**"Cannot read properties of undefined (reading 'map')":**
```typescript
// Fix: Guard against undefined
const features = Array.isArray(ad.features) ? ad.features : [];
```

**Conditional React Hook Error:**
```typescript
// ❌ Bad: Hook after early return
if (!ad) return null;
const [loading, setLoading] = useState(false);

// ✅ Good: All hooks before early return
const [loading, setLoading] = useState(false);
if (!ad) return null;
```

---

## External Ad Networks

### Overview
Third-party ad networks (AdMob, AdSense, etc.) handle ad serving, targeting, and payment. You integrate their SDK and they fill your ad slots.

**Options:**

### 1. Google AdMob (Mobile)

**When to use:**
- iOS and Android apps
- Want Google's ad targeting
- Need reliable fill rates

**Setup:**
```bash
npx expo install expo-ads-admob
```

**Implementation:**
```typescript
import { AdMobBanner, AdMobInterstitial } from 'expo-ads-admob';

// Banner Ad
export function BannerAd() {
  return (
    <AdMobBanner
      bannerSize="banner"
      adUnitID="ca-app-pub-xxxxx/xxxxx"
      servePersonalizedAds={true}
    />
  );
}

// Interstitial Ad
async function showInterstitial() {
  await AdMobInterstitial.setAdUnitID('ca-app-pub-xxxxx/xxxxx');
  await AdMobInterstitial.requestAdAsync();
  await AdMobInterstitial.showAdAsync();
}
```

**Best Practices:**
- ✅ Test with test ad unit IDs first
- ✅ Implement frequency caps (max 1 interstitial per 5 minutes)
- ✅ Show interstitials at natural breaks
- ❌ Don't show on app launch (terrible UX)
- ❌ Don't show during critical tasks

### 2. Google AdSense (Web)

**When to use:**
- Web apps (Expo web builds)
- Content-heavy sites

**Implementation:**
```typescript
// components/AdSense.tsx
import { useEffect } from 'react';

export function AdSense({ adSlot }: { adSlot: string }) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('AdSense error:', e);
    }
  }, []);
  
  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client="ca-pub-xxxxx"
      data-ad-slot={adSlot}
      data-ad-format="auto"
    />
  );
}
```

**Add to `app.json`:**
```json
{
  "expo": {
    "web": {
      "scripts": [
        {
          "src": "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
          "async": true,
          "data-ad-client": "ca-pub-xxxxx"
        }
      ]
    }
  }
}
```

### 3. Rewarded Ads

**When to use:**
- Games
- Apps with virtual currency
- User-initiated actions

**Pattern:**
```typescript
import { AdMobRewarded } from 'expo-ads-admob';

async function watchRewardedAd() {
  // Show loading
  setLoading(true);
  
  try {
    await AdMobRewarded.setAdUnitID('ca-app-pub-xxxxx/xxxxx');
    await AdMobRewarded.requestAdAsync();
    await AdMobRewarded.showAdAsync();
    
    // User completed - give reward
    giveUserReward();
  } catch (e) {
    console.error('Rewarded ad failed:', e);
    // Optional: Give reward anyway (goodwill)
  } finally {
    setLoading(false);
  }
}

// UI
<Button onPress={watchRewardedAd}>
  Watch Ad for 100 Coins
</Button>
```

**Best Practices:**
- ✅ Make reward clear upfront
- ✅ Allow users to skip if they want
- ✅ Give reward even if ad fails (maintain trust)
- ✅ Limit frequency (1-2 per hour max)
- ❌ Don't force users to watch
- ❌ Don't make core features require ads

### 4. Native Ads

**When to use:**
- Content feeds
- List-based UIs
- When you want ads to blend in

**Example:**
```typescript
import { AdMobNative } from 'expo-ads-admob';

<FlatList
  data={items}
  renderItem={({ item, index }) => (
    <>
      <ContentItem item={item} />
      
      {/* Native ad every 10 items */}
      {(index + 1) % 10 === 0 && (
        <AdMobNative
          adUnitID="ca-app-pub-xxxxx/xxxxx"
          type="image"
        />
      )}
    </>
  )}
/>
```

---

## Implementation Patterns

### Ad Frequency Caps

```typescript
// utils/adFrequency.ts
const AD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let lastAdShown = 0;

export function canShowAd(): boolean {
  const now = Date.now();
  const timeSinceLastAd = now - lastAdShown;
  
  if (timeSinceLastAd >= AD_COOLDOWN_MS) {
    lastAdShown = now;
    return true;
  }
  
  return false;
}

// Usage
if (canShowAd()) {
  await showInterstitial();
}
```

### Ad Placement Strategy

**Good Placements:**
- ✅ Between content sections (like TypeInfo every 25 items)
- ✅ After completing a task (level complete, form submitted)
- ✅ During natural pauses (waiting for game to start)
- ✅ Bottom of articles/content

**Bad Placements:**
- ❌ On app launch (instant annoyance)
- ❌ During gameplay/critical tasks
- ❌ Multiple ads on same screen
- ❌ Blocking navigation elements

### Platform-Specific Considerations

```typescript
import { Platform } from 'react-native';

export function AdComponent() {
  // Web: Use AdSense
  if (Platform.OS === 'web') {
    return <AdSense adSlot="xxxxx" />;
  }
  
  // Mobile: Use AdMob
  return (
    <AdMobBanner
      adUnitID={
        Platform.OS === 'ios'
          ? 'ca-app-pub-xxxxx/ios'
          : 'ca-app-pub-xxxxx/android'
      }
    />
  );
}
```

---

## Privacy & Compliance

### GDPR Compliance (Europe)

**Required:**
- ✅ User consent before showing personalized ads
- ✅ Option to use non-personalized ads
- ✅ Privacy policy explaining data collection
- ✅ Allow users to withdraw consent

**Implementation:**
```typescript
import { AdMobConsent } from 'expo-ads-admob';

async function checkGDPRConsent() {
  const { status } = await AdMobConsent.requestInfoUpdateAsync({
    publisherIds: ['pub-xxxxx'],
  });
  
  if (status === 'REQUIRED') {
    const { status: consentStatus } = await AdMobConsent.showAsync();
    
    // Use consentStatus to determine ad personalization
    const canUsePersonalizedAds = consentStatus === 'PERSONALIZED';
    return canUsePersonalizedAds;
  }
  
  return false;
}
```

### COPPA Compliance (Children's Apps)

**If your app targets children under 13:**
- ❌ NO personalized ads allowed
- ❌ NO data collection
- ✅ MUST use child-directed ad settings
- ✅ MUST disclose in app store listing

**Implementation:**
```typescript
// Mark app as child-directed
await AdMobBanner.setRequestNonPersonalizedAdsOnly(true);
```

### Privacy Policy Requirements

Your privacy policy MUST include:
- What data ads collect (device ID, location, etc.)
- How data is used (ad targeting, analytics)
- Third parties receiving data (Google, ad networks)
- User rights (opt-out, data deletion)
- Contact information

**Template:**
```markdown
## Advertising

Our app uses third-party advertising services (Google AdMob) that may collect 
information about your device and app usage to serve personalized ads. This includes:

- Device identifiers (Advertising ID)
- Device type and operating system
- Approximate location (based on IP address)
- App usage data (pages viewed, time spent)

You can opt out of personalized advertising:
- iOS: Settings > Privacy > Advertising > Limit Ad Tracking
- Android: Settings > Google > Ads > Opt out of Ads Personalization

For more information, see [Google's Privacy Policy](https://policies.google.com/privacy).
```

---

## Quick Wins Checklist

### Pre-Implementation
- [ ] Choose monetization strategy (no ads / sponsored / external)
- [ ] Check platform policies (App Store, Play Store)
- [ ] Review privacy laws (GDPR, COPPA, CCPA)
- [ ] Write privacy policy explaining ad data collection
- [ ] Plan ad placements (frequency, locations)

### David's Portfolio Ads
- [ ] Copy `adsService.ts` and `Ads/` components from `code/ads/`
- [ ] Set up API endpoint (use David's or create your own)
- [ ] Configure env variables (`EXPO_PUBLIC_ADS_API_URL`)
- [ ] Test async loading with useEffect
- [ ] Verify offline caching works
- [ ] Add ads to appropriate screens (frequency caps!)
- [ ] Remove debug logging for production

### External Ads (AdMob/AdSense)
- [ ] Install expo-ads-admob
- [ ] Create AdMob/AdSense account
- [ ] Generate ad unit IDs (separate for iOS/Android/Web)
- [ ] Implement consent flow (GDPR)
- [ ] Test with test ad unit IDs first
- [ ] Implement frequency caps (5-minute cooldown minimum)
- [ ] Add ad placement between content (not on launch!)
- [ ] Set up child-directed settings if applicable

### Testing
- [ ] Test ads on real devices (not just simulator)
- [ ] Test with airplane mode (offline behavior)
- [ ] Verify frequency caps work
- [ ] Test consent flow (GDPR)
- [ ] Check ad loading states (loading, error, success)
- [ ] Verify ads don't break navigation
- [ ] Test with AdBlockers (graceful degradation)

### Production
- [ ] Replace test ad IDs with production IDs
- [ ] Remove debug logging
- [ ] Add analytics for ad impressions
- [ ] Monitor fill rates and revenue
- [ ] A/B test ad placements
- [ ] Gather user feedback (ad intrusiveness)

---

## Resources

### David's Portfolio Ads
- Reference Implementation: PokePages app
- Code: `code/ads/` in this MCP
- Guide: [Offline First](offlineFirst.md) for caching strategies

### External Ad Networks
- [Google AdMob](https://admob.google.com/)
- [Expo AdMob Docs](https://docs.expo.dev/versions/latest/sdk/admob/)
- [Google AdSense](https://www.google.com/adsense/)
- [AdMob GDPR](https://support.google.com/admob/answer/7666366)

### Privacy & Compliance
- [GDPR Guidelines](https://gdpr.eu/)
- [COPPA Rules](https://www.ftc.gov/enforcement/rules/rulemaking-regulatory-reform-proceedings/childrens-online-privacy-protection-rule)
- [App Store Review Guidelines - Ads](https://developer.apple.com/app-store/review/guidelines/#advertising)
- [Google Play Policy - Ads](https://support.google.com/googleplay/android-developer/answer/9857753)
