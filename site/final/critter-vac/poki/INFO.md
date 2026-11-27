# Critter Vac: Poki submission sheet

## Files in this folder
| File | What it is | Where it goes in Poki for Developers |
|---|---|---|
| `critter-vac-poki.zip` | The game build (`index.html` at the zip root, relative `./` paths, no source maps). 3.2 MB zipped, 3.3 MB unpacked; about 0.6 MB loads before play, the rest streams in | Versions → Upload New Version |
| `thumb_1080.jpg` | Main static thumbnail, 1080 × 1080, full-bleed, no text (the kid vacuuming a giant cake monster stretched like taffy) | Thumbnails |
| `thumb_628.jpg` | Same art at the 628 × 628 minimum | Backup, if a smaller file is asked for |
| `thumb_1080_moon.jpg` | Alternative thumbnail (the kid on a rocket vacuuming the Moon), 1080 × 1080 | For a thumbnail A/B test during Soft Release |
| `thumb_1280x720.jpg` | Landscape key art / poster, 1280 × 720 | Page banner, socials, anywhere a 16:9 image is asked for |
| `animated_thumbnail_1080.mp4` | Animated thumbnail: 1080 × 1080, 60 fps, 5.95 s, muted, H.264 MP4, 11 MB | Thumbnails → animated (asked for at Soft Release) |
| `trailer_1280x720.mp4` | Trailer: 1280 × 720, 60 fps, 33 s, with music and sound, 42 MB | Optional: the game page, socials, or a "gameplay video" link |
| `screenshots/` | 3 real gameplay screenshots (2 × 1280 × 720 desktop, 1 × iPhone portrait), PNG, each under 5 MiB | The "share your game" form asks for 3 gameplay screenshots |

## Title
Critter Vac

## Short description (67 characters)
Vacuum up cute critters, power up your vacuum, and suck in a GIANT!

## Long description
A kid with a toy vacuum dreams of catching the Moon.

Hold and aim to suck up adorable critters, grow your vacuum, and when the giant wakes up, win the tug of war and watch it stretch like taffy straight into your nozzle!

Travel from the flower meadow through the mushroom forest, the ice peaks, the candy hills and the volcano, build a rocket part by part, and fly to the Moon for the final giant.

- 30 short levels, every place with its own twist: blow bushes open, catch sliders on the ice, pull critters out of sticky candy, save them from the lava, grab them before they float into space
- Giants that fight back with stomps, bombs and roars
- A vacuum that evolves into a turbo, a golden mega machine and a cosmic black hole
- 72 critters to collect, a home to build, and a cheeky rival racing you to the Moon
- Challenge a friend in a 60-second Rush

## Controls
- **Desktop:** hold the left mouse button (or Space) to vacuum; move the mouse to aim. Click the buttons.
- **Mobile / tablet:** touch and hold to vacuum, drag to aim. Tap the buttons.

## Suggested categories (Settings → Suggested categories, up to 4)
Casual, Funny, Idle, Kids. (Pick the closest names in Poki's own category list; Poki may add others.)

## Tags
Casual, Cute, Animals, Collecting, Funny, Boss, Idle, Kids, 2D, Mobile

## Target audience
All ages, aimed at kids and young teens (about 6 to 16) and casual players. Cute cartoon art, nothing scary or violent (critters are collected, not hurt), no chat, no accounts, no personal data, no text needed to play.

## Orientation
Both. Plays in landscape (desktop, tablets, phones held sideways) and portrait (phones); the layout adapts. Checked at 640 × 360, 836 × 470, 1031 × 580, phones and desktop.

## Languages
English, French, German, Spanish, Italian, Portuguese, Turkish, Hindi, Japanese (9). The playing field has no words; the few UI labels are translated. The language is picked from the browser and can be changed with the flag button.

## Engine
Custom HTML5 / TypeScript (Canvas 2D + DOM UI), built with Vite. No external requests except the Poki SDK script.

## Notes for the Poki QA team
**SDK events (wrapper in `src/platform/poki.ts`, guarded so the same event never fires twice in a row):**
- `PokiSDK.init()` at startup; the game continues whether init succeeds or fails (ad blockers).
- `gameLoadingFinished()` once start-up art and fonts are loaded.
- `gameplayStart()` on the player's first input (never on load), then whenever a level is being played.
- `gameplayStop()` when a level ends, when the map, a sheet or any full-screen overlay opens, and before every ad.
- `commercialBreak()` at natural breaks only, never mid-level. Poki decides whether an ad plays. Game audio is muted while an ad runs:
  - going from the map back into a level, only after the player's first 20 catches
  - pressing "Go" to start a free hunt
  - starting a 60-second Rush, after the player's first catch
- `rewardedBreak()` only from optional purple 🎬 buttons, never green, one ad = one reward, no reward if the ad fails or is blocked:
  - 🎬✨ golden critters (a lure) in a level
  - hatch an egg in the nest before its timer runs out
- `shareableURL()` / `getURLParam()` for Rush challenge links (params `cvr`, `cvs`) and for sharing the Moon time.

**Other checks:** works in incognito (all localStorage in try/catch), works with an ad blocker (tested with the SDK script blocked: no errors), no internal ad timers, no ad-block messages, no purchases, one currency (coins), no outgoing links, no splash screen, Space and arrow keys don't scroll the page, progress saves automatically, every intro scene can be skipped. There is no keyboard pause key (the game is mouse/touch-first); gameplay stops whenever the map or a menu is open.

---

## توضیح فارسی

این پوشه همه‌ی چیزهایی است که برای فرستادن **Critter Vac** به Poki لازم دارید:

- **`critter-vac-poki.zip`**: خود بازی. در Poki for Developers، در تب **Versions**، با دکمه‌ی **Upload New Version** آپلودش کنید (یا قبلش پوشه‌ی بازشده‌اش را در Poki Inspector امتحان کنید). **این zip را دوباره ساختم**: در نسخه‌ی قبلی، چهار تصویر پس‌زمینه که از CSS صدا زده می‌شدند (پس‌زمینه‌ی تار نقشه‌ی دنیا و سه زمین در خانه: چمنزار، جنگل، یخ) پیدا نمی‌شدند و خطای 404 می‌دادند. مسیرشان در `critter/src/style.css` درست شد، بازی دوباره ساخته شد و حالا هیچ فایلی گم نیست.
- **`thumb_1080.jpg`**: تصویر اصلی بازی (مربع، بدون متن). در تب **Thumbnails** آپلود کنید.
- **`thumb_1080_moon.jpg`**: تصویر جایگزین برای آزمایش A/B در Soft Release.
- **`thumb_1280x720.jpg`**: پوستر افقی برای صفحه‌ی بازی یا شبکه‌های اجتماعی.
- **`animated_thumbnail_1080.mp4`**: ویدیوی کوتاه ۶ ثانیه‌ای بی‌صدا برای وقتی که ماوس روی بازی می‌رود. با قوانین Poki می‌خواند: 1080×1080، 60fps، بین ۴ تا ۶ ثانیه، MP4، کمتر از 100MB.
- **`trailer_1280x720.mp4`**: تریلر ۳۳ ثانیه‌ای با صدا. اجباری نیست.
- **`screenshots/`**: سه اسکرین‌شات واقعی از بازی برای فرم اولیه.

متن‌های انگلیسی بالا را عیناً در تب **Settings** بازی کپی کنید (حداکثر ۴ دسته‌ی پیشنهادی). بخش «Notes for the Poki QA team» دقیق می‌گوید هر رویداد SDK کجا صدا زده می‌شود. اگر QA پرسید، همین را بفرستید.

**دو نکته که ممکن است QA درباره‌شان بپرسد:**
۱. دکمه‌ی **Go** (شکار آزاد) و شروع **Rush** بلافاصله قبل از بازی `commercialBreak` صدا می‌زنند. طبق قوانین Poki این «برگشتن از وقفه به بازی» حساب می‌شود و درست است. فقط شکار آزاد مثل ورود به مرحله از روی نقشه شرط «بعد از ۲۰ گرفتن» را ندارد. اگر Poki گفت تبلیغ زود می‌آید، همان شرط را به `goField` در `critter/src/main.ts` هم اضافه کنید.
۲. بازی کلید Esc برای توقف ندارد. Poki این را فقط برای بازی‌هایی که با کیبورد کنترل می‌شوند «باید» می‌داند و این بازی با ماوس/لمس است، پس احتمالاً مشکلی نیست.
