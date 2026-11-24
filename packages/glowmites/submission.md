# Glowmites — Poki submission

**Title:** Glowmites
**Genre / categories:** Casual, .io-style growth, Idle-free action, Destruction, Swarm
**Tags:** swarm, destroy, grow, satisfying, colour, giant, 3D, physics, relaxing, kids
**Orientation:** landscape and portrait (fully responsive)
**Languages:** wordless (no text in the game; works in every language)
**Input:** mouse, touch; pinch / mouse wheel / +- to zoom
**Size:** ~90 KB (code only, everything is generated and synthesized at runtime: no images, no audio files)
**Tech:** WebGL2, one canvas; 60 fps on mid-range phones (adaptive quality governor)

## Short description (≤160)
Lead a glowing swarm of up to 200,000 tiny mites. Eat the grey stone world, grow bigger, topple the giant and bring the colour back!

## Long description
The grey has turned the whole world to stone. Only one tiny glowing seed is left.
Drag to lead it. Every bite of stone hatches new mites, and your swarm grows from a few hundred to two hundred thousand. Houses crumble, towers topple, trees come crashing down, and every piece follows real physics as it falls. Where your swarm passes, grass, flowers and colour grow back.
When a land is almost free, its stone giant wakes up. Swarm all over it, dodge its stomps and bring it down.
Free five lands: the Meadow, the Mushroom Forest, the Old Town, the Snow Peaks and the Crystal Heart, where the grey began.

## Controls
- **Desktop:** move the mouse (or click and drag) to lead the swarm. Mouse wheel or +/- to zoom.
- **Mobile:** drag with one finger to lead the swarm. Pinch to zoom.

## Notes for the Poki team
- Poki SDK v2 loaded without blocking the page; `init()` → `gameLoadingFinished()` after the first frame.
- `gameplayStart()` on the first touch and when a new land starts; `gameplayStop()` when a land is won.
- `commercialBreak()` only between lands (the ▶ button on the win screen); audio is muted during ads.
- `rewardedBreak()` is optional: the purple 🎬✨ button on the win screen grows the swarm by 50%.
- Progress (land and swarm size) is saved in localStorage.
- No external links, no text, no in-game purchases.
- No keyboard scroll (space and arrow keys are prevented).

---
## توضیح فارسی
- **اسم:** Glowmites (گلومایت = «کرم‌های تابان»). کوتاه است، به خاطر می‌ماند و موضوع بازی را می‌گوید.
- **داستان:** خاکستری همه‌ی دنیا را سنگ کرده. یک دانه‌ی نور مانده؛ با هر گاز سنگ، نورچه‌های تازه به دنیا می‌آیند. پنج سرزمین را آزاد کن تا به قلب کریستالی، جایی که خاکستری از آن شروع شد، برسی.
- **تبلیغ:** فقط بین سرزمین‌ها (دکمه‌ی ▶). دکمه‌ی بنفش 🎬✨ اختیاری است و جایزه می‌دهد.
