# Deep Luck: Poki submission sheet

## Files in this folder
| File | What it is | Where it goes in Poki for Developers |
|---|---|---|
| `deep-luck-poki.zip` | The game build (`index.html` at the zip root, relative `./` paths, no source maps). 5.3 MB zipped, 5.6 MB unpacked; about 1.4 MB loads before the first cast, the rest streams in | Versions → Upload New Version |
| `thumb_1080.jpg` | Main static thumbnail, 1080 × 1080, full-bleed, no text | Thumbnails |
| `thumb_628.jpg` | Same art at the 628 × 628 minimum | Backup, if a smaller file is asked for |
| `thumb_1080_alt.jpg` | Alternative thumbnail (the crowned marlin), 1080 × 1080 | For a thumbnail A/B test during Soft Release |
| `thumb_1280x720.jpg` | Landscape key art / poster, 1280 × 720 | Page banner, socials, anywhere a 16:9 image is asked for |
| `animated_thumbnail_1080.mp4` | Animated thumbnail: 1080 × 1080, 60 fps, 5.85 s, muted, H.264 MP4, 6.1 MB | Thumbnails → animated (asked for at Soft Release) |
| `trailer_1280x720.mp4` | Trailer: 1280 × 720, 60 fps, 35 s, with music and sound, 24 MB | Optional: the game page, socials, or a "gameplay video" link |
| `screenshots/` | 3 real gameplay screenshots (2 × 1280 × 720 desktop, 1 × iPhone portrait), PNG, each under 5 MiB | The "share your game" form asks for 3 gameplay screenshots |

## Title
Deep Luck

## Short description (79 characters)
Drop your line, dodge the small fry and reel up the giant Legend of every sea!

## Long description
Captain Bo has given you his little boat and his old logbook. Each of its five pages holds a Legend of the sea.

Tap to cast, steer the hook down past the fish and catch everything you can on the way up. Every catch pulls your line closer to the giant Legend lurking in the deep. When the line reaches it, the Legend bites: hold on, strike on time and follow it through three rounds to land it!

- Five seas, five giant Legends: a grumpy catfish, a crowned marlin, a narwhal king, a coral dragon and a phoenix fish
- Each sea plays differently: drifting ice to steer around, strong currents on the reef, erupting volcano vents
- Golden, rainbow, ghost and electric fish are worth much more
- Sharks that steal your catch, octopus ink, a crab that grabs your hook, bouncing puffers
- Upgrade your line, hooks and luck, and fill your logbook with 50+ creatures
- After the last page, the Legends come back stronger
- Challenge a friend: three casts in the same sea, then send them your score

## Controls
- **Desktop:** click or Space to cast; move the mouse (or arrow keys / A, D) to steer the hook; hold or tap the mouse / Space during Legend fights. Esc or P pauses.
- **Mobile / tablet:** tap to cast; slide left and right to steer the hook; hold or tap during fights.

## Suggested categories (Settings → Suggested categories, up to 4)
Fishing, Casual, Idle, Kids. (Pick the closest names in Poki's own category list; Poki may add others.)

## Tags
Fishing, Casual, Collecting, Boss, Upgrade, Idle, Kids, Animals, 2D, Mobile

## Target audience
All ages, aimed at kids and young teens (about 6 to 16) and casual players. Cartoon art, no violence beyond catching fish, no chat, no accounts, no personal data, no text needed to play.

## Orientation
Both. Plays in landscape (desktop, tablets, phones held sideways) and portrait (phones); the layout adapts. Checked at 640 × 360, 836 × 470, 1031 × 580 and phone sizes.

## Languages
English, French, German, Spanish, Italian, Portuguese, Turkish, Hindi, Japanese (9). The playing field has no words; the few UI labels are translated. The language is picked from the browser and can be changed in settings.

## Engine
Custom HTML5 / TypeScript (Canvas 2D + DOM UI), built with Vite. No external requests except the Poki SDK script.

## Notes for the Poki QA team
**SDK events (wrapper in `src/platform/poki.ts`, guarded so the same event never fires twice in a row):**
- `PokiSDK.init()` at startup; the game continues whether init succeeds or fails (ad blockers).
- `gameLoadingFinished()` once all start-up assets are loaded.
- `gameplayStart()` when a cast begins (never on load) and when the game is unpaused during a dive.
- `gameplayStop()` when the hook comes back to the surface, on pause (Esc / P / tab hidden), and before every ad.
- `commercialBreak()` just before a cast (the natural break between dives), only from the 4th cast on (`save.dives > 2`). Poki decides whether an ad plays. Game audio is muted while an ad runs.
- `rewardedBreak()` only from optional purple 🎬 buttons, never green, always shown next to a normal option, one ad = one reward, no reward if the ad fails or is blocked:
  - ×2 on the last catch, and ×2 on the aquarium collection
  - retry when a Legend snaps the line
  - try a hat for 3 dives
  - swap a crew order, rush a crew trip
  - one extra spin of the lucky wheel
  - skip the wait for the next derby
- `shareableURL()` / `getURLParam()` for the friend challenge link (params `dlc`, `dls`).

**Other checks:** works in incognito (all localStorage in try/catch), works with an ad blocker (tested with the SDK script blocked: no errors), no internal ad timers, no ad-block messages, no purchases, one currency (coins), no outgoing links, no splash screen, Space and arrow keys don't scroll the page, progress saves automatically, the 3-second wordless intro can be skipped with a tap.

---

## توضیح فارسی

این پوشه همه‌ی چیزهایی است که برای فرستادن **Deep Luck** به Poki لازم دارید:

- **`deep-luck-poki.zip`**: خود بازی. این فایل را در Poki for Developers، در تب **Versions**، با دکمه‌ی **Upload New Version** آپلود کنید (یا قبلش پوشه‌ی بازشده‌اش را در Poki Inspector امتحان کنید). این zip را تازه از سورس فعلی ساختم و با نسخه‌ی قبلی بایت‌به‌بایت یکی بود، پس به‌روز است.
- **`thumb_1080.jpg`**: تصویر اصلی بازی (مربع، بدون متن). در تب **Thumbnails** آپلود کنید. Poki دست‌کم 628×628 می‌خواهد و این 1080×1080 است.
- **`thumb_1080_alt.jpg`**: تصویر جایگزین برای آزمایش A/B در Soft Release.
- **`thumb_1280x720.jpg`**: پوستر افقی برای صفحه‌ی بازی یا شبکه‌های اجتماعی.
- **`animated_thumbnail_1080.mp4`**: ویدیوی کوتاه ۶ ثانیه‌ای بی‌صدا که وقتی ماوس روی بازی می‌رود پخش می‌شود. Poki معمولاً آن را در مرحله‌ی Soft Release می‌خواهد. مشخصاتش با قوانین Poki می‌خواند: 1080×1080، 60fps، بین ۴ تا ۶ ثانیه، MP4، کمتر از 100MB.
- **`trailer_1280x720.mp4`**: تریلر ۳۵ ثانیه‌ای با صدا. اجباری نیست. در فرم اولیه اگر لینک ویدیو خواستند، یا برای شبکه‌های اجتماعی، به کار می‌آید.
- **`screenshots/`**: سه اسکرین‌شات واقعی از بازی. فرم اولیه‌ی Poki دقیقاً ۳ تصویر از گیم‌پلی می‌خواهد، هر کدام کمتر از 5MB.

متن‌های انگلیسی بالا (عنوان، توضیح کوتاه و بلند، کنترل‌ها، دسته‌ها) را عیناً در تب **Settings** بازی کپی کنید. Poki حداکثر ۴ دسته‌ی پیشنهادی قبول می‌کند. بخش «Notes for the Poki QA team» را هم وقتی تیم QA یا پشتیبانی Poki سؤال کرد، یا در ایمیل/دیسکورد، بفرستید. این بخش دقیق می‌گوید هر رویداد SDK کجای کد صدا زده می‌شود.
