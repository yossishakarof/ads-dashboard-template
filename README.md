# Meta Ads + Instagram Dashboard

דשבורד פרטי, רץ לוקאלית, למעקב אחרי קמפיינים ב-Meta Ads ופוסטים באינסטגרם.
כל הנתונים נשארים אצלך — אין שרת מרכזי, אין DB, אין Supabase.
ההגדרות נשמרות ב-localStorage של הדפדפן, וההתחברות מול Meta נעשית דרך OAuth ישיר.

> בנוי על Next.js 16 (App Router), React 19, Tailwind v4, ו-Anthropic SDK (אופציונלי, רק לפיצ'רי AI).

---

## פיצ'רים

- 🔐 התחברות OAuth מול חשבון ה-Meta שלך (Facebook + Instagram).
- 📊 דשבורד יומי של קמפיינים, אד-סטים ומודעות עם ROAS, CPM, CPL וכל המספרים החשובים.
- 📅 סנכרון אוטומטי מ-Meta Marketing API לפי טווח תאריכים.
- 🎯 צפייה ב-Best Ads / Worst Ads עם המלצות חכמות.
- 📷 ניתוח ביצועי פוסטים, סטוריז וריילז באינסטגרם (Instagram Insights API).
- 🤖 (אופציונלי) צ'אט AI לניתוח החשבון — דורש מפתח Anthropic.
- 🌙 RTL מלא, עברית, מותאם מובייל.

---

## דרישות מוקדמות

1. **Node.js 20+** ו-**pnpm** (או npm/yarn).
2. **חשבון Meta Developers** ואפליקציית Meta משלך:
   - היכנס ל-https://developers.facebook.com/apps
   - לחץ "Create App" → בחר Type: **Business**
   - לאחר היצירה: רשום את ה-`App ID` ואת ה-`App Secret` (תחת Settings → Basic).
3. **הוסף את המוצרים הבאים לאפליקציה** (Add Product):
   - **Facebook Login for Business**
   - **Marketing API**
4. **הגדר Redirect URI**:
   - בתוך Facebook Login → Settings → Valid OAuth Redirect URIs
   - הוסף: `http://localhost:3000/api/ad-dashboard/auth/callback`
5. **הוסף את עצמך כ-Tester** (לאפליקציה ב-Development Mode):
   - Roles → Roles → Add People → Testers
6. (אופציונלי) **מפתח Anthropic API**: https://console.anthropic.com — רק אם רוצים את פיצ'רי ה-AI.

---

## התקנה

```bash
git clone <REPO_URL> ads-dashboard
cd ads-dashboard
pnpm install                    # או npm install
cp .env.example .env.local
```

ערוך את `.env.local` והוסף את המפתחות שלך:

```bash
META_APP_ID=123456789012345
META_APP_SECRET=abcdef0123456789abcdef0123456789
META_REDIRECT_URI=http://localhost:3000/api/ad-dashboard/auth/callback
AD_DASHBOARD_SESSION_SECRET=<תוצאת openssl rand -hex 32>
ANTHROPIC_API_KEY=                # אופציונלי
```

ייצור secret אקראי חזק:

```bash
openssl rand -hex 32
```

הפעל את ה-dev server:

```bash
pnpm dev
```

פתח את הדפדפן בכתובת **http://localhost:3000** — תיעשה הפניה אוטומטית ל-`/ad-dashboard`.
לחץ "התחבר עם Meta" וזהו.

---

## הרשאות (Scopes) שהדשבורד מבקש

- **דשבורד מודעות בלבד**: `ads_read`
- **דשבורד + אינסטגרם**:
  `ads_read, pages_show_list, pages_read_engagement, business_management, instagram_basic, instagram_manage_insights`

כל ההרשאות הן read-only. הדשבורד **לא** משנה כלום בחשבון ה-Meta שלך.

---

## איפה הנתונים נשמרים?

| נתון | מיקום |
|------|------|
| Access Token של Meta | Cookie חתום HMAC (httpOnly) על המחשב שלך |
| הגדרות (חודש, יעד, ROAS break-even וכו') | `localStorage` של הדפדפן |
| הוצאות יומיות שנערכו ידנית | `localStorage` של הדפדפן |
| נתוני קמפיינים | נמשכים בכל סנכרון מ-Meta API (אין cache בשרת) |

**אין DB. אין שרת. הכול אצלך.**

---

## פריסה לפרודקשן (אופציונלי)

אם אתה רוצה להריץ את זה לא רק לוקאלית:

1. עדכן את `META_REDIRECT_URI` ל-URL של הפרודקשן (חובה HTTPS).
2. הוסף את ה-URL החדש ל-Valid OAuth Redirect URIs ב-Meta App.
3. שנה את ה-App מ-Development ל-Live (אם רוצים להשתמש בחשבונות מלבד Testers).
4. פרוס לכל פלטפורמה שתומכת ב-Next.js (Vercel, Netlify, Railway, fly.io וכו').
5. הגדר את אותם משתני סביבה.

---

## מבנה הפרויקט

```
src/
├── app/
│   ├── layout.tsx            ← RTL + Hebrew font
│   ├── page.tsx              ← redirect → /ad-dashboard
│   ├── ad-dashboard/         ← UI של הדשבורד (Client Components)
│   │   ├── dashboard.tsx     ← הקומפוננט הראשי
│   │   ├── instagram-view.tsx
│   │   ├── ai-chat.tsx
│   │   ├── login/page.tsx
│   │   └── lib/              ← meta-api, calculations, types, session
│   └── api/
│       └── ad-dashboard/     ← API Routes (Server)
│           ├── auth/         ← OAuth login/callback/logout
│           ├── accounts, campaigns, ads, sync, ...
│           └── instagram/    ← Instagram API endpoints
└── lib/
    └── utils/
        └── anthropic-client.ts  ← (אופציונלי) ל-AI features
```

---

## פתרון בעיות

**"Invalid OAuth Redirect URI"**
ה-`META_REDIRECT_URI` ב-`.env.local` חייב להיות זהה *בדיוק* למה שמוגדר ב-Meta App
(כולל http/https, port, ו-trailing slash).

**"Application does not have permission for this action"**
האפליקציה ב-Development Mode והמשתמש שלך לא מוגדר כ-Tester. לך ל-Roles → Add People → Testers.

**"Access token expired"**
התנתק והתחבר מחדש. ה-token תקף ל-60 יום.

**ה-AI Chat לא עובד**
ודא שיש לך `ANTHROPIC_API_KEY` תקין ב-`.env.local`. בלי המפתח, פיצ'רי ה-AI כבויים — שאר הדשבורד עובד רגיל.

---

## רישיון

פרטי. אל תפיץ הלאה ללא רשות.
