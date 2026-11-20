# تحلیل رقبا: Deep Luck روی Poki

> تاریخ تحقیق: ۲۰ نوامبر ۲۰۲۶. ارقام امتیاز و رأی از صفحه‌ی خود بازی‌ها در poki.com در همین تاریخ برداشته شده‌اند. Poki برای بازی‌ها تعداد play عمومی نشان نمی‌دهد، پس **تعداد رأی (votes)** بهترین شاخص عمومی محبوبیت است.
> هر جا نوشته شده **[تخمین]**، نظر کارشناسی ماست و منبع مستقیم ندارد. سطح‌بندی Deep Luck هم بر اساس توضیحات خود ما و build فعلی است، نه نتیجه‌ی playtest واقعی. پس آن را هم تخمین بدانید.

---

## ۱. خلاصه‌ی مدیریتی (TL;DR)

- **رقیب اصلی و مستقیم: Tiny Fishing** است (۴.۶ امتیاز از ۷۱۵ هزار رأی؛ آخرین به‌روزرسانی آوریل ۲۰۲۲). حلقه‌ی اصلی ما تقریباً همان است. Poki صریحاً می‌گوید *«Clones of existing hits ... won't be promoted»*. پس باید تفاوت ما (zoneها، fightها، mutationها) در **همان ۳۰ ثانیه‌ی اول** دیده شود، نه بعد از ۲۰ دقیقه.
- بازار ماهیگیری روی Poki **کوچک ولی زنده** است: ۱۰ بازی در دسته‌ی Fishing. بازی تازه‌ی Sea Catcher (ژوئن ۲۰۲۶) در حدود ۵ ماه ۵۹ هزار رأی گرفته است.
- **رقیب واقعی برای زمان بازیکن** idle/collection hitها هستند: Monkey Mart (۳.۸ میلیون رأی)، Idle Ants (۱.۲۷ میلیون) و Steal a Brainrot (۴۳۸ هزار رأی در یک سال، با collection و rarity و rebirth و eventهای زمان‌دار).
- **بزرگ‌ترین ریسک ما کمبود محتوا نیست؛ زیادی سیستم است.** Poki می‌گوید: *«Make the first minutes brilliant before making the tenth hour deep»* و *«Sprawling progression systems designed for mobile rarely work well on the web»*. ما حدود ۲۰ سیستم متا داریم و Tiny Fishing فقط ۳ upgrade و یک aquarium.
- عبور از تست‌های Poki به این عددها بستگی دارد: **C2P ≥ ۶۵٪**، **playtime میانگین بیش از ۳ دقیقه برای عبور و ۵ دقیقه یا بیشتر برای موفقیت**، و CTR thumbnail. حجم ۵.۵ مگابایت قابل قبول است ولی جای بهبود دارد (جزئیات در بخش ۵).

---

## ۲. معیارهای Poki (بازی ما را با این‌ها می‌سنجند)

| معیار | عدد یا قانون | منبع |
|---|---|---|
| Player fit test (۵۰۰ بازیکن) | برای عبور: playtime میانگین بیش از ۳ دقیقه **و** دست‌کم ۲۵٪ بازی‌ها بیش از ۳ دقیقه. بازی قوی: ۵ دقیقه یا بیشتر (برای management/sim: ۱۰ دقیقه یا بیشتر) | [player-fit-test](https://developers.poki.com/guide/player-fit-test) |
| Web fit test (حدود ۱۰ هزار بازیکن، ۳ تا ۵ روز) | سه معیار با وزن برابر: CTR thumbnail، time on page و C2P. نمره‌ی ۰ تا ۵ نسبت به میانگین دسته؛ نمره‌ی ۳ یعنی هم‌سطح میانگین | [web-fit-test](https://developers.poki.com/guide/web-fit-test) |
| Conversion to play | هدف پایه: «65%+ conversion to play» | [reading-results](https://developers.poki.com/guide/reading-results) |
| اثر حجم فایل | Stickman Hook با ۴۰ مگابایت: load میانه ۲۹.۵ ثانیه و conversion ۵۰٪. نسخه‌ی ۶ مگابایتی: ۳.۷ ثانیه و conversion ۷۲٪ (۲۲٪ play بیشتر) | [Poki blog](https://poki.com/blog/what-makes-high-quality-browser-game) |
| Loading | «Players tend to move to another game if loading takes more than 10 seconds». Progressive loading توصیه شده است | [requirements](https://developers.poki.com/guide/requirements-quality) |
| Onboarding | splash، title screen و level select را برای بازیکن جدید حذف کنید. آموزش تصویری باشد نه متنی. «Overwhelmed players end their session» | [easy-access](https://developers.poki.com/guide/easy-access) |
| Engagement | حلقه‌ی حدود ۳ دقیقه‌ای. کل محتوا معمولاً حدود ۱ ساعت کافی است. بازی‌هایی که بازیکن مدام در آن‌ها کاری دارد، از بازی‌های دارای انتظار بهتر عمل می‌کنند | [engagement](https://developers.poki.com/guide/engagement) |
| پول‌سازی | فقط یک ارز (**No secondary currencies**). ساخت ad timer داخلی ممنوع است. دکمه‌ی rewarded نباید سبز باشد و آیکون 🎬 لازم دارد. دکمه‌ی عادی باید هم‌اندازه یا بزرگ‌تر از آن باشد و کنارش یا بالایش قرار بگیرد. reward wall ممنوع است | [requirements](https://developers.poki.com/guide/requirements-quality)، [monetization](https://developers.poki.com/guide/monetization) |
| Cutscene | همه‌ی intro و cutsceneها باید skippable باشند | [requirements](https://developers.poki.com/guide/requirements-quality) |
| Portrait | بازی‌های portrait به‌طور میانگین بازیکن بیشتری را وارد gameplay می‌کنند و واجد Gamebar Display ads هستند | [easy-access](https://developers.poki.com/guide/easy-access) |
| Localization | اولویت ۱: EFIGS (en, fr, it, de, es) به‌علاوه‌ی Turkish. اولویت ۲: CJK. اولویت ۳: pt-BR و Russian | [localization](https://developers.poki.com/guide/localization) |
| Visual | «Bright, colorful assets» play بیشتری می‌گیرند. visual cohesion نشانه‌ی کیفیت است | [Poki blog](https://poki.com/blog/what-makes-high-quality-browser-game) |
| Thumbnail | «the single most important factor for click-through rate». کاراکتر اصلی در ژست پویا، بدون متن، با کنتراست بالا | [game-thumbnail](https://developers.poki.com/guide/game-thumbnail) |
| Originality | «Clones of existing hits don't stand out to players and won't be promoted» | [what-we-look-for](https://developers.poki.com/guide/what-we-look-for) |
| رفتار بازیکن وب | رایج‌ترین طول session بین ۱۱ تا ۲۰ دقیقه است، با ۲ تا ۳ بازی در هر session | [State of Web Gaming 2026](https://poki.com/blog/state-of-web-gaming-report-2026) |
| درآمد | ترافیک Poki: تقسیم ۵۰/۵۰. ترافیک مستقیم خود ما: ۱۰۰٪. در عوض web exclusivity لازم است | [guide](https://developers.poki.com/guide) |

---

## ۳. رقبای کلیدی

### الف) رقبای مستقیم (دسته‌ی Fishing در Poki)
منبع فهرست: [poki.com/en/fishing](https://poki.com/en/fishing). این صفحه ۱۰ بازی دارد، از جمله Tiny Fishing، Fishing World، Sea Catcher، Pixel Fishing، Fishing League و Fishing Alive.

| بازی | امتیاز (رأی) | انتشار / آخرین آپدیت | سازنده |
|---|---|---|---|
| [Tiny Fishing](https://poki.com/en/g/tiny-fishing) | ۴.۶ (۷۱۵,۱۱۲) | سپتامبر ۲۰۲۰ / آوریل ۲۰۲۲ | BuyHTML5 |
| [Sea Catcher](https://poki.com/en/g/sea-catcher) | ۴.۳ (۵۹,۲۲۴) | ژوئن ۲۰۲۶ / ژوئن ۲۰۲۶ | ANV Games |
| [Fishing League](https://poki.com/en/g/fishing-league) | ۴.۲ (۳۶,۰۱۹) | آوریل ۲۰۲۵ / ژانویه ۲۰۲۶ | OnRush Studio |
| [Pixel Fishing](https://poki.com/en/g/pixel-fishing) | ۴.۳ (۳۴,۱۸۵) | نوامبر ۲۰۲۴ | Kzunec Games |
| [Fishing World](https://poki.com/en/g/fishing-world) | ۴.۲ (۲۷,۶۸۸) | آوریل ۲۰۲۵ / سپتامبر ۲۰۲۵ | Panda Pasha Games |
| [Fishing Alive](https://poki.com/en/g/fishing-alive) | ۴.۳ (۲۱,۲۶۱) | سپتامبر ۲۰۲۴ / اوت ۲۰۲۵ | AdaBella Games |

**۱. Tiny Fishing: الگوی اصلی و رقیب شماره‌ی ۱**
- **Core:** rod را پایین می‌اندازی، ماهی‌ها را در مسیر بالا آمدن می‌گیری، می‌فروشی و upgrade می‌کنی. سه upgrade دارد: Max fishes (از ۳ شروع می‌شود و هر upgrade یکی اضافه می‌کند)، Max depth (از ۳ متر، هر upgrade یک متر) و Offline earnings (از ۵ دلار در دقیقه). یک aquarium درآمدزا و مینی‌گیم «Win a Prize» هم دارد ([منبع](https://poki.com/en/g/tiny-fishing)).
- **عمق محتوا:** کم. حدود ده‌ها گونه ماهی با رنگ‌های rare و legendary، بدون پایان. hookها فقط ظاهری‌اند.
- **گرافیک:** 2D ساده و تمیز. juice متوسط **[تخمین]**.
- **Story/onboarding:** داستان ندارد. ورود فوری است و تقریباً آموزش لازم ندارد.
- **Meta:** فقط upgrade، offline earnings و aquarium. social و event ندارد.
- **پول‌سازی:** rewarded برای Win a Prize و offline، به‌علاوه‌ی midroll **[تخمین بر اساس الگوی رایج]**.
- **درس:** با سیستم‌های بسیار کم، ۷۱۵ هزار رأی و ۴.۶ امتیاز گرفته است. **سادگی برنده است.** با این حال از ۲۰۲۲ آپدیت نشده و گرافیکش قدیمی است. این فرصت ماست.

**۲. Sea Catcher: سریع‌ترین رشد در ۲۰۲۶**
- raft survival به سبک Raft: «with nothing but a plank and a net». debris جمع می‌کنی، raft را بزرگ می‌کنی و ابزار craft می‌کنی ([منبع](https://poki.com/en/g/sea-catcher)).
- حدود ۵۹ هزار رأی در ۵ ماه. نشان می‌دهد تقاضا برای «دریا + جمع‌آوری + ساختن» هنوز بالاست.
- حلقه‌اش با ما فرق دارد (حرکت با WASD، ساختن پایگاه)، ولی روی همان مخاطب «آرام، دریایی و پیشرفتی» رقابت می‌کند.

**۳. Fishing World: عمق محتوای واقعی**
- ادعای «over 300 freshwater fish species»، legendary monsterها، competition، upgrade تجهیزات، قایق و locationهای جدید ([منبع](https://poki.com/en/g/fishing-world)).
- از نظر **تعداد محتوا** از ما جلوتر است (۳۰۰ گونه در برابر ۵۳). ولی امتیاز و رأی‌اش متوسط است (۴.۲، حدود ۲۸ هزار). پس **تعداد زیاد محتوا به‌تنهایی برنده نمی‌شود.**

**۴. Fishing League: رقیب ما در social و competition**
- simulation واقع‌گرا، tournament، live leaderboard، online multiplayer و بازی با دوستان، به‌علاوه‌ی collection tracking ([منبع](https://poki.com/en/g/fishing-league)).
- multiplayer واقعی دارد. league ما با «۱۹ رقیب شخصیت» (bot) است. اگر بازیکن متوجه شود رقبا واقعی نیستند، ارزش social ما کم می‌شود **[تخمین]**.

**۵. Pixel Fishing / Fishing Alive: کلون‌های Tiny Fishing**
- Pixel Fishing: سبک retro pixel، upgrade برای rod، طول نخ و bait، locationهای جدید و daily quest ([منبع](https://poki.com/en/g/pixel-fishing)).
- Fishing Alive: همان حلقه‌ی dive-the-hook با upgrade برای rod و قایق ([منبع](https://poki.com/en/g/fishing-alive)).
- هر دو حدود ۲۰ تا ۳۵ هزار رأی دارند. یعنی **کلون صرفِ Tiny Fishing حدود ۳ تا ۵٪ موفقیت Tiny Fishing را می‌گیرد.** این مهم‌ترین هشدار برای ماست.

### ب) رقبای غیرمستقیم (idle/collection hits که زمان همین بازیکن‌ها را می‌گیرند)
منبع: [poki.com/en/idle](https://poki.com/en/idle). این صفحه بیش از ۱۵۰ بازی idle دارد. پرطرفدارترین‌ها: My Perfect Hotel، Monkey Mart، Idle Ants، Blumgi Merge و Beach Boxing Simulator.

| بازی | امتیاز (رأی) | چرا رقیب ماست |
|---|---|---|
| [Monkey Mart](https://poki.com/en/g/monkey-mart) | ۴.۶ (۳,۸۲۳,۸۴۱) | idle management. ۶ mart، upgradeهای Stamina/Stack/Speed (هر کدام تا سطح ۴)، ۵ daily quest، بیش از ۲۰ کلاه. بازی سال ۲۰۲۲ است و همچنان تا مارس ۲۰۲۶ آپدیت شده. نکته: diamond به‌عنوان ارز دوم دارد، که قوانین فعلی Poki آن را برای بازی جدید منع می‌کند |
| [Idle Ants](https://poki.com/en/g/idle-ants) | ۴.۵ (۱,۲۷۱,۵۱۴) | فقط ۳ upgrade (Speed، Workers، Strength)، tap برای boost، چند location. **سادگی مطلق** |
| [Steal a Brainrot](https://poki.com/en/g/steal-a-brainrot) | ۴.۲ (۴۳۸,۲۳۵) | collection (۸۰ Brainrot) با rarity از Common تا Celestial، Index Book، rebirth، Fuse Machine (شبیه merge ما)، eventهای زمان‌دار هر چند ساعت، ۶ world. در فهرست Popular رتبه‌ی ۲ است ([popular](https://poki.com/en/popular)). **نزدیک‌ترین الگو به meta ما**؛ ترند Roblox |
| [Mystery Digger](https://poki.com/en/g/mystery-digger) | ۴.۵ (۲۳,۲۵۸) | حلقه‌ی «پایین برو، منابع جمع کن، upgrade کن» با story از طریق یادداشت‌های پیداشده. شبیه logbook و message bottle ما |
| [Fish Drop](https://poki.com/en/g/fish-drop) | ۴.۰ (۶,۵۳۸) | merge ماهی. نشان می‌دهد merge با تم ماهی به‌تنهایی جذب زیادی ندارد |

**نکته‌ی ترند [تخمین]:** موفقیت Roblox‌هایی مثل Fish It (با mutationها) و Grow a Garden مخاطب جوان را با «mutation + rarity + event» آشنا کرده است ([نمونه: Fish It mutations](https://bo3.gg/games/articles/fish-it-mutations)). سیستم mutation و world event ما با این ترند هم‌جهت است. **این نقطه‌ی قوت واقعی ماست**، به شرط آنکه در thumbnail و دقیقه‌ی اول دیده شود.

---

## ۴. جدول مقایسه

مقیاس: ۱ = ضعیف، ۵ = بهترین در Poki. ستون «میانگین Poki» یعنی یک بازی متوسط پذیرفته‌شده. **همه‌ی اعداد این جدول تخمین هستند.**

| بُعد | Deep Luck | بهترین رقیب (سطح) | میانگین Poki | رقیب ما در این بُعد | توضیح |
|---|---|---|---|---|---|
| Core feel (حس حلقه‌ی اصلی) | ۳.۵ | Tiny Fishing (۴.۵) | ۳ | Tiny Fishing، Fishing Alive | حلقه‌ی ما ثابت‌شده است. ولی dodge + fight + ۳ نوع مینی‌گیم ممکن است cast اول را از Tiny Fishing کندتر و گیج‌کننده‌تر کند. هنوز playtest نشده |
| Content quantity | ۴ | Fishing World (۴.۵، ۳۰۰+ گونه) | ۲.۵ | Fishing World، Steal a Brainrot (۸۰) | ۵۳ موجود، ۵ zone و ۵ mutation برای وب کافی و حتی زیاد است (Poki: حدود ۱ ساعت محتوا) |
| Graphics/polish | ۴ | Monkey Mart / Steal a Brainrot (۴) | ۳ | Sea Catcher، Fishing World | cartoon براق و رنگی با سلیقه‌ی Poki جور است. ریسک: یکدست نبودن art تولیدشده با AI («visual cohesion») |
| Animation/juice | ۴ | Monkey Mart (۴) | ۳ | Tiny Fishing (۳) | refraction، god rays، squash و camera punch از اغلب رقبای ماهیگیری جلوتر است. باید روی گوشی ضعیف 60fps بماند |
| Story/onboarding | ۲.۵ | Tiny Fishing (۵، بدون اصطکاک) | ۳ | Tiny Fishing، Mystery Digger | intro کاپیتان Bo جذاب است ولی هر ثانیه پیش از اولین cast هزینه دارد (C2P). باید skippable و حداقلی باشد |
| Progression depth | ۵ | Steal a Brainrot (۴) | ۲.۵ | Steal a Brainrot، Monkey Mart | از همه عمیق‌تر است، **که خودش ریسک است** (بخش ۵) |
| Social/competition | ۳ | Fishing League (۴، multiplayer واقعی) | ۱.۵ | Fishing League، Steal a Brainrot | league با bot، derby، Daily Sea و Challenge-a-friend خوب است ولی real-time نیست |
| Live-ops/events | ۴ | Steal a Brainrot (۴) | ۱.۵ | Steal a Brainrot | weather، world eventها و surprise director قوی‌اند. «event» واقعی بدون آپدیت سرور، با seed و ساعت UTC، کار می‌کند |
| Retention hooks | ۴.۵ | Monkey Mart (۴) | ۲ | Monkey Mart، Tiny Fishing (offline) | offline earnings، streak، restock و league. احتمالاً بیش از حد زیاد |
| Ad monetization fit | ۴ | Tiny Fishing / Monkey Mart (۴) | ۳ | Tiny Fishing | x2 coins، retry و try-cosmetic دقیقاً الگوهای «helping hand / economy / customization» Poki هستند. باید قوانین دکمه رعایت شود |
| Mobile/desktop fit | ۴ | Tiny Fishing (۵) | ۳.۵ | Tiny Fishing | portrait و landscape هر دو پشتیبانی می‌شوند، که عالی است. fight مدل «follow the fish» روی موبایل باید تست شود |
| Load size/performance | ۳.۵ | Tiny Fishing (۴.۵) [تخمین] | ۳ | Tiny Fishing، کلون‌های سبک | build فعلی حدود ۵.۷ مگابایت است (JS حدود ۱۶۷ کیلوبایت و art حدود ۵.۴ مگابایت در ۱۶۰ فایل webp). با lazy loading مشکلی نیست، ولی initial payload باید زیر حدود ۲ تا ۳ مگابایت باشد. effectهای Canvas روی Android ارزان سنگین‌اند |
| Localization | ۳ | Monkey Mart (۴) [تخمین] | ۲ | — | en, es, pt, hi, ja داریم. اما Poki اولویت را به EFIGS + Turkish می‌دهد: **fr, de, it, tr نداریم**. hi در فهرست Poki نیست. فونت Fredoka فقط latin است و ja/hi به فونت سیستم برمی‌گردند |

---

## ۵. فهرست صادقانه‌ی شکاف‌ها و ریسک‌ها

1. **ریسک «کلون Tiny Fishing».** حلقه‌ی پایه یکی است. اگر بازیکن در ۱۰ تا ۱۵ ثانیه‌ی اول فقط «Tiny Fishing قشنگ‌تر» ببیند، CTR و playtime ما در حد Fishing Alive و Pixel Fishing (حدود ۲۰ تا ۳۵ هزار رأی) خواهد بود. تفاوت‌ها (fight، mutation، zone technique) دیر ظاهر می‌شوند.
2. **زیادی سیستم برای وب.** حدود ۲۰ سیستم داریم: weather، event، director، bait shop، lantern، sonar، aquarium، merge tank، orders، album، missions، level/title، league، derby، Daily Sea، challenge، prestige، cosmetics و pets. Poki صریحاً از progression «sprawling» به سبک موبایل انتقاد می‌کند. HUD شلوغ و نوتیف‌های زیاد هم خلاف «Don't be pushy» است.
3. **C2P و onboarding.** story intro، captain NPC و هر منو پیش از اولین cast از C2P کم می‌کند (هدف ۶۵٪ یا بیشتر). `gameplayStart()` باید روی اولین input صدا زده شود و intro باید skippable باشد.
4. **پیچیدگی fight.** سه مکانیک مختلف به‌علاوه‌ی grace ۲.۶ ثانیه‌ای ممکن است برای بازیکن ۸ تا ۱۴ ساله (مخاطب Poki) در دقیقه‌ی اول گیج‌کننده باشد. هر مکانیک یک «آموزش» جدا لازم دارد.
5. **قانون ارز واحد.** باید بررسی شود که bait، star در prestige، sonar و غیره ارز دوم پنهان نسازند. Poki می‌گوید «No secondary currencies».
6. **Social تقلبی.** league با ۱۹ bot اگر واضح باشد، اعتماد را کم می‌کند. Fishing League رقیب با multiplayer واقعی است.
7. **Performance روی موبایل ضعیف.** refraction، caustics و god rays روی Canvas 2D در Android ارزان ممکن است FPS را بیندازد. بخش بزرگ Poki موبایل است. یک quality toggle خودکار لازم است.
8. **Localization با اولویت اشتباه.** hi و ja گران‌تر و کم‌اولویت‌تر از fr، de، tr و it هستند. فونت CJK و Devanagari ممکن است روی بعضی دستگاه‌ها زشت رندر شود.
9. **Art تولیدشده با AI.** باید یکدستی سبک (outline، نور و پالت) در ۱۶۰ asset بررسی شود. ناهمگونی کوچک هم کیفیت دیده‌شده را پایین می‌آورد. ماهیت AI بودن art هم نباید در thumbnail حس شود.
10. **Thumbnail هنوز تعریف نشده است.** یک‌سوم نمره‌ی web fit test به CTR بستگی دارد.

---

## ۶. مهم‌ترین بهبودها (رتبه‌بندی بر اساس اثر روی پذیرش Poki، retention و درآمد تبلیغات)

| # | اقدام | چرا | اثر |
|---|---|---|---|
| 1 | **First-session funnel سخت‌گیرانه:** بازی مستقیم با اولین cast شروع شود (کمتر از ۵ ثانیه از load تا input)، intro کاپیتان تبدیل به یک حباب ۱ خطی شود، آموزش فقط با دست یا انگشت تصویری باشد، و یک **rare fight تضمینی و آسان** در cast دوم یا سوم بیاید | C2P، playtime fit test و تمایز از Tiny Fishing همه در دقیقه‌ی اول تعیین می‌شوند | پذیرش: بسیار بالا. retention: بالا |
| 2 | **Progressive disclosure سیستم‌ها:** در ۱۰ دقیقه‌ی اول فقط cast، upgrade و album دیده شود. بقیه (league، derby، merge، orders، bait، Daily Sea و prestige) با level یا milestone و با جشن باز شوند. حدود ۳۰٪ سیستم‌ها را ادغام یا حذف کنید (مثلاً orders با missions، sonar با lantern) | هشدار مستقیم Poki درباره‌ی progression «sprawling» | playtime و retention: بالا |
| 3 | **«Wow» در ۳۰ ثانیه‌ی اول:** یک mutation (gold یا rainbow) یا surprise director (golden school یا shadow teaser) در session اول با احتمال زیاد scripted شود | این تمایز اصلی ما از کلون‌هاست و به ترند Roblox (mutation و rarity) گره می‌خورد | CTR (از طریق thumbnail)، playtime و originality |
| 4 | **Thumbnail و animated thumbnail:** ماهیگیر کارتونی با کلاه، در حال کشیدن یک ماهی legendary یا rainbow غول‌پیکر، با کنتراست بالا و بدون متن. ۲ تا ۳ نسخه را در player fit test مقایسه کنید | Poki: thumbnail «the single most important factor for CTR» است | پذیرش (web fit): بالا |
| 5 | **کوچک کردن initial load:** فقط Lake، UI و ۱۰ ماهی اول در bundle اولیه باشد (هدف حدود ۱.۵ تا ۲.۵ مگابایت). بقیه‌ی zoneها در background بارگذاری شوند. ده‌ها sprite کوچک در atlas ادغام شوند و صدا procedural بماند. حالت low-quality خودکار روی دستگاه ضعیف (بدون refraction و caustics) فعال شود | داده‌ی Poki: ۶ مگابایت در برابر ۴۰ مگابایت یعنی ۷۲٪ در برابر ۵۰٪ conversion. موبایل ارزان اکثریت است | C2P و درآمد: متوسط تا بالا |
| 6 | **Ad compliance و جای‌گذاری درست:** commercialBreak فقط بین castها و هنگام بازگشت به gameplay. دکمه‌های rewarded غیرسبز با 🎬، و دکمه‌ی «ادامه» هم‌اندازه یا بزرگ‌تر. یک فرصت پویا اضافه شود (مثلاً «golden school: x3 برای این cast 🎬»). ad timer داخلی نداشته باشیم. وجود فقط یک ارز (coins) بررسی شود | شکست در final review گران است. فرصت‌های پویا را خود Poki توصیه کرده | پذیرش و درآمد: بالا |
| 7 | **Localization بازچینی:** fr، de، it و tr اضافه شوند (ارزان، با فونت latin). hi تا زمان داشتن داده نگه داشته شود ولی اولویت نباشد | فهرست اولویت رسمی Poki | reach: متوسط |
| 8 | **شفاف‌سازی league:** رقبا را «crew» یا «shadow anglers» شخصیت‌دار معرفی کنید، نه بازیکن واقعی. «Challenge a friend» را برجسته کنید چون تنها social واقعی ماست. فقط با `PokiSDK` share و link کار کنید | اعتماد بازیکن و جلوگیری از حس فریب | retention: متوسط |

**پیشنهاد فرایندی:** پیش از افزودن هر feature جدید، ۱۰ playtest recording ببینید (پیش‌نیاز player fit test) و دو نسخه را با هم مقایسه کنید: «نسخه‌ی کامل» در برابر «نسخه‌ی ساده با ۵ سیستم». اگر نسخه‌ی ساده playtime برابر یا بالاتری بگیرد، شواهد روشنی است که باید سیستم‌ها را کم کنیم.

---

## منابع
- Poki Fishing category: https://poki.com/en/fishing
- Tiny Fishing: https://poki.com/en/g/tiny-fishing
- Sea Catcher: https://poki.com/en/g/sea-catcher
- Fishing World: https://poki.com/en/g/fishing-world
- Fishing League: https://poki.com/en/g/fishing-league
- Pixel Fishing: https://poki.com/en/g/pixel-fishing
- Fishing Alive: https://poki.com/en/g/fishing-alive
- Fish Drop: https://poki.com/en/g/fish-drop
- Idle category: https://poki.com/en/idle
- Popular: https://poki.com/en/popular
- Monkey Mart: https://poki.com/en/g/monkey-mart
- Idle Ants: https://poki.com/en/g/idle-ants
- Steal a Brainrot: https://poki.com/en/g/steal-a-brainrot
- Mystery Digger: https://poki.com/en/g/mystery-digger
- Poki for Developers guide: https://developers.poki.com/guide
- What we look for: https://developers.poki.com/guide/what-we-look-for
- Requirements: https://developers.poki.com/guide/requirements-quality
- Easy access & onboarding: https://developers.poki.com/guide/easy-access
- Engagement: https://developers.poki.com/guide/engagement
- Monetization tips: https://developers.poki.com/guide/monetization
- Localization: https://developers.poki.com/guide/localization
- Player fit test: https://developers.poki.com/guide/player-fit-test
- Web fit test: https://developers.poki.com/guide/web-fit-test
- Reading results: https://developers.poki.com/guide/reading-results
- Game thumbnail: https://developers.poki.com/guide/game-thumbnail
- Poki blog, high-quality browser game: https://poki.com/blog/what-makes-high-quality-browser-game
- Poki State of Web Gaming 2026: https://poki.com/blog/state-of-web-gaming-report-2026
- Fish It mutations (ترند Roblox): https://bo3.gg/games/articles/fish-it-mutations
