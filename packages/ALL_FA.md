# بسته‌ی کامل دو بازی برای پوکی

مخزن: `sorooshrahimi-codes/poki`، شاخه‌ی `ccr-712f8ebd-3t9t7z`، پوشه‌ی `packages/`

## لینک بازی‌ها (بدون لاگین، روی Cloudflare)
| بازی | لینک |
|---|---|
| صفحه‌ی معرفی هر دو بازی (تریلر، پوستر، فایل‌ها) | https://kidgames.soroosh-ra.workers.dev/ |
| Deep Luck | https://kidgames.soroosh-ra.workers.dev/deep-luck/ |
| Critter Vac | https://kidgames.soroosh-ra.workers.dev/critter-vac/ |

یک Worker کوچک روی Cloudflare (کد: `site/_worker_source.js`) فایل‌ها را از همین مخزن گیت‌هاب سرو می‌کند. برای همین مخزن باید **Public** بماند.

## ویدیوها (همین حالا کار می‌کنند)
- Deep Luck: https://cdn.jsdelivr.net/gh/sorooshrahimi-codes/poki@17172afeedd7ddf5986fb8f377a91454356a631e/packages/deep-luck/trailer_web.mp4
- Critter Vac: https://cdn.jsdelivr.net/gh/sorooshrahimi-codes/poki@17172afeedd7ddf5986fb8f377a91454356a631e/packages/critter-vac/trailer_web.mp4

---

## پوستر و تریلر تازه (پوشه‌ی `packages/promo/`)
| فایل | کاربرد |
|---|---|
| `deep-luck_poster_1080x1350.jpg`، `critter-vac_poster_1080x1350.jpg` | پوستر عمودی با لوگو، شعار و دکمه‌ی بازی (اینستاگرام، معرفی) |
| `*_keyart_1080.jpg` | تصویر مربعی با لوگو |
| `*_banner_1920x1080.jpg` | بنر افقی با لوگو و سه ویژگی |
| `*_trailer_1280x720.mp4` و `*_trailer_web.mp4` | تریلر با کارت پایانی (لوگو + لینک بازی) |
| `email_*.jpg` | تصویرهای داخل ایمیل |

ایمیل به پوکی: `EMAIL_TO_POKI.html` (پیش‌نویسش در جیمیل ساخته شده، در همان رشته‌ی ایمیل پوکی).

---

## ① Deep Luck
- فایل بازی برای آپلود: `packages/deep-luck/deep-luck-poki.zip`
- ۳ عکس فرم: `packages/deep-luck/screenshots/1_poster.jpg`، `2_reef_dive.jpg` و `3_volcano_dock.jpg`
- تامبنیل‌ها (بعد از پذیرش): `thumb_1080.jpg`، `thumb_628.jpg` و `animated_thumbnail_1080.mp4`

| فیلد فرم | جواب |
|---|---|
| Game title | Deep Luck |
| Engine | AI/Claude/ChatGPT |
| Build or video | Playable browser build (یا Gameplay video) |
| Released elsewhere? | No |

**Describe your game**
> A one-thumb fishing adventure. Cast your hook, steer it down past the fish, then catch everything on the way up. Every catch pulls your line closer to the giant Legend hiding in each of five seas: hold on, strike on time and land it. Each sea plays differently (drifting ice, strong reef currents, erupting volcano vents), with golden and rainbow fish, sharks that steal your catch, and a logbook of 50+ creatures to fill.

**Why a good fit for Poki**
> It is instantly readable for every age: tap to cast, slide to steer, no reading needed, and a full first catch takes under 10 seconds. Short dives make it perfect for quick sessions, while five seas, giant boss fish, upgrades and a 50+ creature logbook give players a reason to come back. It runs smoothly on phones and desktop, loads fast, works in 9 languages, and already integrates the Poki SDK with ads only at natural breaks.

---

## ② Critter Vac
- فایل بازی برای آپلود: `packages/critter-vac/critter-vac-poki.zip`
- ۳ عکس فرم: `packages/critter-vac/screenshots/1_poster.jpg`، `2_forest.jpg` و `3_moon.jpg`
- تامبنیل‌ها: `thumb_1080.jpg`، `thumb_628.jpg` و `animated_thumbnail_1080.mp4`

| فیلد فرم | جواب |
|---|---|
| Game title | Critter Vac |
| Engine | AI/Claude/ChatGPT |
| Build or video | Playable browser build (یا Gameplay video) |
| Released elsewhere? | No |

**Describe your game**
> A kid with a toy vacuum dreams of catching the Moon. Hold and aim to suck up adorable critters, grow your vacuum, and when a giant wakes up, win the tug of war and watch it stretch like taffy straight into your nozzle. Travel through six places (meadow, mushroom forest, ice peaks, candy hills, volcano and the Moon), each with its own twist, collect 72 critters and race a cheeky rival to the Moon.

**Why a good fit for Poki**
> The core is one simple, satisfying action: hold to suck up cute critters, which kids and adults understand in a second, with no reading needed. Levels are short, the vacuum visibly evolves, and huge funny giant fights give a big payoff every few minutes. 72 critters to collect, a home to build and a rival to race keep players coming back. Runs on phone and desktop, 9 languages, Poki SDK integrated with ads only at natural breaks.

---

## بعد از ارسال
راهنمای کامل مراحل (playtest، player fit test، web fit test، قرارداد و درآمد): `packages/POKI_GUIDE_FA.md`
