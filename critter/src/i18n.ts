// Every word the player reads. Missing strings fall back to English.
// Critter and place names live with the critters (data/critters.ts). Flags are shared with Deep Luck.

export type Lang = "en" | "fr" | "de" | "es" | "it" | "pt" | "tr" | "hi" | "ja";
export const LANGS: Lang[] = ["en", "fr", "de", "es", "it", "pt", "tr", "hi", "ja"];
export const LANG_NAME: Record<Lang, string> = { en: "English", fr: "Français", de: "Deutsch", es: "Español", it: "Italiano", pt: "Português", tr: "Türkçe", hi: "हिन्दी", ja: "日本語" };
const svg = (b: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">${b}</svg>`)}`;
/** small inline flags: no image files, and they render the same on every OS */
export const LANG_FLAG: Record<Lang, string> = {
  en: svg('<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#C8102E" stroke-width="3.4"/>'),
  fr: svg('<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#002395"/><rect x="20" width="10" height="20" fill="#ED2939"/>'),
  de: svg('<rect width="30" height="20" fill="#FFCE00"/><rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#DD0000"/>'),
  es: svg('<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>'),
  it: svg('<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#009246"/><rect x="20" width="10" height="20" fill="#CE2B37"/>'),
  pt: svg('<rect width="30" height="20" fill="#009C3B"/><path d="M15 2.5L27 10L15 17.5L3 10Z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/>'),
  tr: svg('<rect width="30" height="20" fill="#E30A17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.25" cy="10" r="4" fill="#E30A17"/><path d="M16.8 10L20.6 8.76L18.25 12.0L18.25 8.0L20.6 11.24Z" fill="#fff"/>'),
  hi: svg('<rect width="30" height="20" fill="#fff"/><rect width="30" height="6.67" fill="#FF9933"/><rect y="13.33" width="30" height="6.67" fill="#138808"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width="0.8"/>'),
  ja: svg('<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>'),
};

export type Key =
  | "hint" | "park" | "parkTitle" | "lure" | "rush" | "catchMore" | "share" | "ok" | "play" | "lang"
  | "offline" | "combo" | "bossCaught" | "egg" | "eggTip" | "new" | "newName" | "jarFull" | "holdGold" | "hold" | "escaped"
  | "visitor" | "boss" | "goldenRain" | "stampede" | "split" | "tipShell" | "tipBurrow" | "tipShy" | "bossPhase"
  | "rushGoal" | "rushStart" | "rushOver" | "won" | "close" | "best" | "shareText" | "copied" | "challenged" | "chScore" | "chDesc"
  | "lureToast" | "hatched" | "hatchedGold" | "unlocked"
  | "up.power" | "up.range" | "up.tank" | "max";

// \u2060 (word joiner) keeps short Japanese button labels on one line: kana may otherwise break between any two characters
const T: Record<Lang, Partial<Record<Key, string>>> = {
  en: {
    hint: "👆 Hold & aim to suck up critters!", park: "🏡 Park", parkTitle: "🏡 Critter Park", lure: "🎬 ✨ Lure", rush: "🏁 Rush", catchMore: "Catch more!", share: "📤 Challenge a friend", ok: "OK", play: "🏁 Play!", lang: "Language",
    offline: "🏡 +🪙{n} while you were away!", combo: "COMBO ×{n}!", bossCaught: "👑 You caught the giant {name}! +🪙{n}", egg: "🥚 An egg!", eggTip: "🥚 It left an egg! It hatches in the park in {n} min.",
    new: "NEW!", newName: "NEW! {name}", jarFull: "🫙 Jar full! Bring them to the park", holdGold: "✨ GOLDEN! Hold on!", hold: "💪 Hold on!", escaped: "💨 escaped!",
    visitor: "✨ A wild {name} appeared!", boss: "👑 A GIANT {name} appeared! Catch it 3 times!", goldenRain: "🌟 Golden critters! Quick!", stampede: "🏃 Stampede! Suck them all up!", split: "Split!",
    tipShell: "🐚 It hid in its shell! Let go, wait for it to peek, then suck!", tipBurrow: "🕳️ It went underground! Catch it when it pops up.", tipShy: "💨 Shy ones run from the wind! Sweep the cone onto them fast.", bossPhase: "It broke free! {n} more!",
    rushGoal: "🏁 Beat {n} in 60 seconds!", rushStart: "🏁 Catch as many as you can in 60 seconds!", rushOver: "🏁 Rush over!", won: "🏆 You won!", close: "😅 So close!", best: "⭐ Best {n}",
    shareText: "🫙 Critter Vac: can you beat {n} in a 60-second Rush?", copied: "📋 Link copied! Send it to a friend.", challenged: "🤝 A friend challenges you!", chScore: "🎯 {n} in 60 seconds", chDesc: "Same critters, same vacuum. Can you beat it?",
    lureToast: "✨ The next 3 critters will be GOLDEN!", hatched: "🐣 {name} hatched!", hatchedGold: "🐣 A GOLDEN {name} hatched!", unlocked: "{name} unlocked!",
    "up.power": "Suction", "up.range": "Reach", "up.tank": "Jar", max: "MAX",
  },
  fr: {
    hint: "👆 Vise et aspire les bestioles !", park: "🏡 Parc", parkTitle: "🏡 Parc des bestioles", lure: "🎬 ✨ Appât", rush: "🏁 Course", catchMore: "Attraper !", share: "📤 Défier un ami", ok: "OK", play: "🏁 Jouer !", lang: "Langue",
    offline: "🏡 +🪙{n} pendant ton absence !", combo: "COMBO ×{n} !", bossCaught: "👑 Géant attrapé : {name} ! +🪙{n}", egg: "🥚 Un œuf !", eggTip: "🥚 Il a laissé un œuf ! Il éclot au parc dans {n} min.",
    new: "NOUVEAU !", newName: "NOUVEAU ! {name}", jarFull: "🫙 Bocal plein ! Va au parc", holdGold: "✨ DORÉ ! Tiens bon !", hold: "💪 Tiens bon !", escaped: "💨 envolé !",
    visitor: "✨ {name} sauvage apparaît !", boss: "👑 {name} GÉANT apparaît ! Attrape-le 3 fois !", goldenRain: "🌟 Bestioles dorées ! Vite !", stampede: "🏃 Ruée ! Aspire-les tous !", split: "En deux !",
    tipShell: "🐚 Il se cache dans sa coquille ! Lâche, attends qu'il sorte, puis aspire !", tipBurrow: "🕳️ Il est sous terre ! Attrape-le quand il ressort.", tipShy: "💨 Les timides fuient le vent ! Balaie-les vite avec le cône.", bossPhase: "Il s'est libéré ! Encore {n} !",
    rushGoal: "🏁 Bats {n} en 60 secondes !", rushStart: "🏁 Attrape-en un max en 60 secondes !", rushOver: "🏁 Course finie !", won: "🏆 Gagné !", close: "😅 Presque !", best: "⭐ Record {n}",
    shareText: "🫙 Critter Vac : peux-tu battre {n} en 60 secondes ?", copied: "📋 Lien copié ! Envoie-le à un ami.", challenged: "🤝 Un ami te défie !", chScore: "🎯 {n} en 60 secondes", chDesc: "Mêmes bestioles, même aspirateur. Tu peux battre ça ?",
    lureToast: "✨ Les 3 prochaines bestioles seront DORÉES !", hatched: "🐣 {name} est né !", hatchedGold: "🐣 {name} DORÉ est né !", unlocked: "Débloqué : {name} !",
    "up.power": "Aspiration", "up.range": "Portée", "up.tank": "Bocal", max: "MAX",
  },
  de: {
    hint: "👆 Halten & zielen zum Einsaugen!", park: "🏡 Park", parkTitle: "🏡 Tierchen-Park", lure: "🎬 ✨ Köder", rush: "🏁 Sprint", catchMore: "Fangen!", share: "📤 Herausfordern", ok: "OK", play: "🏁 Los!", lang: "Sprache",
    offline: "🏡 +🪙{n}, während du weg warst!", combo: "KOMBO ×{n}!", bossCaught: "👑 Riesen-{name} gefangen! +🪙{n}", egg: "🥚 Ein Ei!", eggTip: "🥚 Ein Ei! Es schlüpft in {n} Min. im Park.",
    new: "NEU!", newName: "NEU! {name}", jarFull: "🫙 Glas voll! Ab in den Park", holdGold: "✨ GOLDEN! Festhalten!", hold: "💪 Festhalten!", escaped: "💨 entwischt!",
    visitor: "✨ Ein wildes {name} taucht auf!", boss: "👑 Riesen-{name} taucht auf! Fang es 3-mal!", goldenRain: "🌟 Goldene Tierchen! Schnell!", stampede: "🏃 Herde! Saug alle ein!", split: "Geteilt!",
    tipShell: "🐚 Es versteckt sich im Haus! Loslassen, warten, bis es rausguckt, dann saugen!", tipBurrow: "🕳️ Es ist unter der Erde! Fang es, wenn es auftaucht.", tipShy: "💨 Scheue fliehen vor dem Wind! Schnell mit dem Kegel erwischen.", bossPhase: "Losgerissen! Noch {n}!",
    rushGoal: "🏁 Schlag {n} in 60 Sekunden!", rushStart: "🏁 Fang so viele wie möglich in 60 Sekunden!", rushOver: "🏁 Sprint vorbei!", won: "🏆 Gewonnen!", close: "😅 Knapp!", best: "⭐ Rekord {n}",
    shareText: "🫙 Critter Vac: Schaffst du mehr als {n} in 60 Sekunden?", copied: "📋 Link kopiert! Schick ihn einem Freund.", challenged: "🤝 Ein Freund fordert dich heraus!", chScore: "🎯 {n} in 60 Sekunden", chDesc: "Gleiche Tierchen, gleicher Sauger. Schaffst du mehr?",
    lureToast: "✨ Die nächsten 3 Tierchen sind GOLDEN!", hatched: "🐣 {name} ist geschlüpft!", hatchedGold: "🐣 Goldenes {name} geschlüpft!", unlocked: "{name} freigeschaltet!",
    "up.power": "Saugkraft", "up.range": "Reichweite", "up.tank": "Glas", max: "MAX",
  },
  es: {
    hint: "👆 ¡Mantén y apunta para aspirar!", park: "🏡 Parque", parkTitle: "🏡 Parque de bichitos", lure: "🎬 ✨ Cebo", rush: "🏁 Carrera", catchMore: "¡A cazar!", share: "📤 Reta a un amigo", ok: "OK", play: "🏁 ¡Jugar!", lang: "Idioma",
    offline: "🏡 ¡+🪙{n} mientras no estabas!", combo: "¡COMBO ×{n}!", bossCaught: "👑 ¡Atrapaste al {name} gigante! +🪙{n}", egg: "🥚 ¡Un huevo!", eggTip: "🥚 ¡Dejó un huevo! Eclosiona en el parque en {n} min.",
    new: "¡NUEVO!", newName: "¡NUEVO! {name}", jarFull: "🫙 ¡Frasco lleno! Llévalos al parque", holdGold: "✨ ¡DORADO! ¡Aguanta!", hold: "💪 ¡Aguanta!", escaped: "💨 ¡se escapó!",
    visitor: "✨ ¡Apareció un {name} salvaje!", boss: "👑 ¡Apareció un {name} GIGANTE! ¡Atrápalo 3 veces!", goldenRain: "🌟 ¡Bichitos dorados! ¡Rápido!", stampede: "🏃 ¡Estampida! ¡Aspíralos todos!", split: "¡Se dividió!",
    tipShell: "🐚 ¡Se escondió en su concha! Suelta, espera a que asome y aspira.", tipBurrow: "🕳️ ¡Se metió bajo tierra! Atrápalo cuando salga.", tipShy: "💨 ¡Los tímidos huyen del viento! Pásales el cono rápido.", bossPhase: "¡Se soltó! ¡Faltan {n}!",
    rushGoal: "🏁 ¡Supera {n} en 60 segundos!", rushStart: "🏁 ¡Atrapa todos los que puedas en 60 segundos!", rushOver: "🏁 ¡Fin de la carrera!", won: "🏆 ¡Ganaste!", close: "😅 ¡Casi!", best: "⭐ Récord {n}",
    shareText: "🫙 Critter Vac: ¿puedes superar {n} en 60 segundos?", copied: "📋 ¡Enlace copiado! Envíalo a un amigo.", challenged: "🤝 ¡Un amigo te reta!", chScore: "🎯 {n} en 60 segundos", chDesc: "Mismos bichitos, misma aspiradora. ¿Puedes superarlo?",
    lureToast: "✨ ¡Los próximos 3 bichitos serán DORADOS!", hatched: "🐣 ¡Nació {name}!", hatchedGold: "🐣 ¡Nació un {name} DORADO!", unlocked: "¡{name} desbloqueado!",
    "up.power": "Succión", "up.range": "Alcance", "up.tank": "Frasco", max: "MÁX",
  },
  it: {
    hint: "👆 Tieni e mira per aspirare!", park: "🏡 Parco", parkTitle: "🏡 Parco Bestioline", lure: "🎬 ✨ Esca", rush: "🏁 Corsa", catchMore: "Cattura!", share: "📤 Sfida un amico", ok: "OK", play: "🏁 Gioca!", lang: "Lingua",
    offline: "🏡 +🪙{n} mentre eri via!", combo: "COMBO ×{n}!", bossCaught: "👑 Hai preso {name} gigante! +🪙{n}", egg: "🥚 Un uovo!", eggTip: "🥚 Ha lasciato un uovo! Si schiude nel parco tra {n} min.",
    new: "NUOVO!", newName: "NUOVO! {name}", jarFull: "🫙 Barattolo pieno! Portali al parco", holdGold: "✨ D'ORO! Tieni duro!", hold: "💪 Tieni duro!", escaped: "💨 scappato!",
    visitor: "✨ È apparso {name} selvatico!", boss: "👑 È apparso {name} GIGANTE! Prendilo 3 volte!", goldenRain: "🌟 Bestioline d'oro! Presto!", stampede: "🏃 Fuggi fuggi! Aspirali tutti!", split: "Diviso!",
    tipShell: "🐚 Si è nascosto nel guscio! Molla, aspetta che spunti, poi aspira!", tipBurrow: "🕳️ È sottoterra! Prendilo quando spunta fuori.", tipShy: "💨 I timidi scappano dal vento! Prendili in fretta col cono.", bossPhase: "Si è liberato! Ancora {n}!",
    rushGoal: "🏁 Batti {n} in 60 secondi!", rushStart: "🏁 Prendine più che puoi in 60 secondi!", rushOver: "🏁 Corsa finita!", won: "🏆 Hai vinto!", close: "😅 Quasi!", best: "⭐ Record {n}",
    shareText: "🫙 Critter Vac: riesci a battere {n} in 60 secondi?", copied: "📋 Link copiato! Mandalo a un amico.", challenged: "🤝 Un amico ti sfida!", chScore: "🎯 {n} in 60 secondi", chDesc: "Stesse bestioline, stesso aspiratore. Riesci a batterlo?",
    lureToast: "✨ Le prossime 3 bestioline saranno D'ORO!", hatched: "🐣 È nato {name}!", hatchedGold: "🐣 È nato {name} D'ORO!", unlocked: "{name} sbloccato!",
    "up.power": "Risucchio", "up.range": "Portata", "up.tank": "Barattolo", max: "MAX",
  },
  pt: {
    hint: "👆 Segure e mire para aspirar!", park: "🏡 Parque", parkTitle: "🏡 Parque dos Bichinhos", lure: "🎬 ✨ Isca", rush: "🏁 Corrida", catchMore: "Pegar mais!", share: "📤 Desafiar amigo", ok: "OK", play: "🏁 Jogar!", lang: "Idioma",
    offline: "🏡 +🪙{n} enquanto você estava fora!", combo: "COMBO ×{n}!", bossCaught: "👑 Você pegou o {name} gigante! +🪙{n}", egg: "🥚 Um ovo!", eggTip: "🥚 Deixou um ovo! Ele choca no parque em {n} min.",
    new: "NOVO!", newName: "NOVO! {name}", jarFull: "🫙 Pote cheio! Leve ao parque", holdGold: "✨ DOURADO! Segura firme!", hold: "💪 Segura firme!", escaped: "💨 escapou!",
    visitor: "✨ Um {name} selvagem apareceu!", boss: "👑 Um {name} GIGANTE apareceu! Pegue 3 vezes!", goldenRain: "🌟 Bichinhos dourados! Rápido!", stampede: "🏃 Debandada! Aspire todos!", split: "Dividiu!",
    tipShell: "🐚 Ele se escondeu na concha! Solte, espere ele espiar e aspire!", tipBurrow: "🕳️ Ele entrou na terra! Pegue quando ele sair.", tipShy: "💨 Os tímidos fogem do vento! Passe o cone neles rápido.", bossPhase: "Escapou! Mais {n}!",
    rushGoal: "🏁 Supere {n} em 60 segundos!", rushStart: "🏁 Pegue o máximo que puder em 60 segundos!", rushOver: "🏁 Fim da corrida!", won: "🏆 Você venceu!", close: "😅 Quase!", best: "⭐ Recorde {n}",
    shareText: "🫙 Critter Vac: consegue superar {n} em 60 segundos?", copied: "📋 Link copiado! Mande para um amigo.", challenged: "🤝 Um amigo te desafia!", chScore: "🎯 {n} em 60 segundos", chDesc: "Mesmos bichinhos, mesmo aspirador. Consegue superar?",
    lureToast: "✨ Os próximos 3 bichinhos serão DOURADOS!", hatched: "🐣 {name} nasceu!", hatchedGold: "🐣 Um {name} DOURADO nasceu!", unlocked: "{name} liberado!",
    "up.power": "Sucção", "up.range": "Alcance", "up.tank": "Pote", max: "MÁX",
  },
  tr: {
    hint: "👆 Basılı tut, nişan al, çek!", park: "🏡 Park", parkTitle: "🏡 Hayvancık Parkı", lure: "🎬 ✨ Yem", rush: "🏁 Yarış", catchMore: "Yakala!", share: "📤 Meydan oku", ok: "Tamam", play: "🏁 Oyna!", lang: "Dil",
    offline: "🏡 Sen yokken +🪙{n} kazandın!", combo: "KOMBO ×{n}!", bossCaught: "👑 Dev {name} yakalandı! +🪙{n}", egg: "🥚 Bir yumurta!", eggTip: "🥚 Bir yumurta bıraktı! Parkta {n} dk sonra çatlar.",
    new: "YENİ!", newName: "YENİ! {name}", jarFull: "🫙 Kavanoz doldu! Parka götür", holdGold: "✨ ALTIN! Sıkı tut!", hold: "💪 Sıkı tut!", escaped: "💨 kaçtı!",
    visitor: "✨ Vahşi bir {name} çıktı!", boss: "👑 DEV bir {name} çıktı! 3 kez yakala!", goldenRain: "🌟 Altın hayvancıklar! Çabuk!", stampede: "🏃 Sürü geliyor! Hepsini çek!", split: "Bölündü!",
    tipShell: "🐚 Kabuğuna saklandı! Bırak, dışarı bakmasını bekle, sonra çek!", tipBurrow: "🕳️ Yerin altına girdi! Çıkınca yakala.", tipShy: "💨 Utangaçlar rüzgârdan kaçar! Koniyi hızla üstlerine getir.", bossPhase: "Kurtuldu! {n} kez daha!",
    rushGoal: "🏁 60 saniyede {n} puanı geç!", rushStart: "🏁 60 saniyede yakalayabildiğin kadar yakala!", rushOver: "🏁 Yarış bitti!", won: "🏆 Kazandın!", close: "😅 Az kaldı!", best: "⭐ Rekor {n}",
    shareText: "🫙 Critter Vac: 60 saniyede {n} puanı geçebilir misin?", copied: "📋 Bağlantı kopyalandı! Bir arkadaşına gönder.", challenged: "🤝 Bir arkadaşın sana meydan okuyor!", chScore: "🎯 60 saniyede {n}", chDesc: "Aynı hayvancıklar, aynı süpürge. Geçebilir misin?",
    lureToast: "✨ Sonraki 3 hayvancık ALTIN olacak!", hatched: "🐣 {name} yumurtadan çıktı!", hatchedGold: "🐣 ALTIN {name} yumurtadan çıktı!", unlocked: "{name} açıldı!",
    "up.power": "Emiş", "up.range": "Menzil", "up.tank": "Kavanoz", max: "MAKS",
  },
  hi: {
    hint: "👆 दबाकर रखो, निशाना लगाओ, खींचो!", park: "🏡 पार्क", parkTitle: "🏡 क्रिटर पार्क", lure: "🎬 ✨ चारा", rush: "🏁 रेस", catchMore: "और पकड़ो!", share: "📤 दोस्त को चुनौती", ok: "ठीक है", play: "🏁 खेलो!", lang: "भाषा",
    offline: "🏡 तुम्हारे पीछे +🪙{n} मिले!", combo: "कॉम्बो ×{n}!", bossCaught: "👑 तुमने विशाल {name} पकड़ा! +🪙{n}", egg: "🥚 एक अंडा!", eggTip: "🥚 एक अंडा मिला! यह पार्क में {n} मिनट में फूटेगा।",
    new: "नया!", newName: "नया! {name}", jarFull: "🫙 जार भर गया! पार्क ले चलो", holdGold: "✨ सुनहरा! पकड़े रहो!", hold: "💪 पकड़े रहो!", escaped: "💨 भाग गया!",
    visitor: "✨ एक जंगली {name} आया!", boss: "👑 एक विशाल {name} आया! इसे 3 बार पकड़ो!", goldenRain: "🌟 सुनहरे जीव! जल्दी!", stampede: "🏃 भगदड़! सबको खींच लो!", split: "बँट गया!",
    tipShell: "🐚 यह खोल में छिप गया! छोड़ो, झाँकने तक रुको, फिर खींचो!", tipBurrow: "🕳️ यह ज़मीन में चला गया! बाहर आए तब पकड़ो।", tipShy: "💨 शर्मीले जीव हवा से भागते हैं! जल्दी से उन पर घुमाओ।", bossPhase: "छूट गया! {n} बार और!",
    rushGoal: "🏁 60 सेकंड में {n} से आगे निकलो!", rushStart: "🏁 60 सेकंड में जितने हो सकें पकड़ो!", rushOver: "🏁 रेस खत्म!", won: "🏆 तुम जीते!", close: "😅 बस थोड़ा सा!", best: "⭐ बेस्ट {n}",
    shareText: "🫙 Critter Vac: क्या तुम 60 सेकंड में {n} से आगे निकल सकते हो?", copied: "📋 लिंक कॉपी हुआ! दोस्त को भेजो।", challenged: "🤝 दोस्त की चुनौती!", chScore: "🎯 60 सेकंड में {n}", chDesc: "वही जीव, वही वैक्यूम। क्या तुम आगे निकल सकते हो?",
    lureToast: "✨ अगले 3 जीव सुनहरे होंगे!", hatched: "🐣 {name} निकला!", hatchedGold: "🐣 सुनहरा {name} निकला!", unlocked: "{name} खुल गया!",
    "up.power": "खिंचाव", "up.range": "पहुँच", "up.tank": "जार", max: "मैक्स",
  },
  ja: {
    hint: "👆 おしっぱなしで すいこもう！", park: "🏡 パーク", parkTitle: "🏡 いきものパーク", lure: "🎬 ル\u2060ア\u2060ー", rush: "🏁 ラ\u2060ッ\u2060シ\u2060ュ", catchMore: "い\u2060こ\u2060う\u2060！", share: "📤 友だちと勝負", ok: "OK", play: "🏁 プレイ！", lang: "ことば",
    offline: "🏡 るすの間に +🪙{n}！", combo: "コンボ ×{n}！", bossCaught: "👑 でっかい{name}をゲット！ +🪙{n}", egg: "🥚 タマゴだ！", eggTip: "🥚 タマゴをのこした！パークで{n}分後にかえるよ。",
    new: "NEW！", newName: "NEW！ {name}", jarFull: "🫙 ビンがいっぱい！パークへ行こう", holdGold: "✨ ゴールド！がんばれ！", hold: "💪 がんばれ！", escaped: "💨 にげた！",
    visitor: "✨ やせいの{name}があらわれた！", boss: "👑 でっかい{name}があらわれた！3回つかまえよう！", goldenRain: "🌟 ゴールドのいきもの！いそげ！", stampede: "🏃 大行進！ぜんぶすいこもう！", split: "ぶんれつ！",
    tipShell: "🐚 カラにかくれた！はなして、顔を出したらすいこもう！", tipBurrow: "🕳️ 地面にもぐった！出てきたらつかまえよう。", tipShy: "💨 こわがりは風からにげる！すばやくねらおう。", bossPhase: "ふりほどいた！あと{n}回！",
    rushGoal: "🏁 60秒で{n}をこえよう！", rushStart: "🏁 60秒でたくさんつかまえよう！", rushOver: "🏁 ラッシュおわり！", won: "🏆 かち！", close: "😅 おしい！", best: "⭐ ベスト {n}",
    shareText: "🫙 Critter Vac：60秒ラッシュで{n}をこえられる？", copied: "📋 リンクをコピーしたよ！友だちに送ろう。", challenged: "🤝 友だちからのちょうせん！", chScore: "🎯 60秒で{n}", chDesc: "同じいきもの、同じそうじき。こえられるかな？",
    lureToast: "✨ つぎの3ひきはゴールドだよ！", hatched: "🐣 {name}がうまれた！", hatchedGold: "🐣 ゴールドの{name}がうまれた！", unlocked: "{name}がひらいた！",
    "up.power": "すいこみ", "up.range": "はんい", "up.tank": "ビン", max: "MAX",
  },
};

let lang: Lang = "en";
export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

/** first browser language we support; Hindi only when the browser itself asks for Hindi */
export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.toLowerCase().slice(0, 2) as Lang;
    if (LANGS.includes(code)) return code;
  }
  return "en";
}

export const t = (k: Key) => T[lang][k] ?? T.en[k] ?? k;
/** t() with {n} {name} {x} filled in */
export const tf = (k: Key, vars: Record<string, string | number>) => t(k).replace(/\{(\w+)\}/g, (m, v: string) => (v in vars ? String(vars[v]) : m));
