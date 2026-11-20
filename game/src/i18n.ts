import type { EventId, Lang, Rarity, UpgradeId, ZoneId } from "./core/types.ts";
import type { FishDef } from "./core/types.ts";

// The whole game has very little text: icons, numbers and colours carry the rest.
// Missing strings fall back to English. Fish names live with the fish (data/fish.ts).

export const LANGS: Lang[] = ["en", "es", "pt", "hi", "ja"];
export const LANG_LABEL: Record<Lang, string> = { en: "EN", es: "ES", pt: "PT", hi: "हि", ja: "日本" };

type Key =
  | "rarity.common" | "rarity.rare" | "rarity.epic" | "rarity.legendary" | "rarity.secret"
  | "up.line" | "up.capacity" | "up.luck" | "max"
  | "zone.lake" | "zone.ocean" | "zone.ice" | "zone.reef" | "map.title" | "map.needs" | "cur"
  | "ev.blood_moon" | "ev.meteor" | "ev.rainbow_sky" | "ev.golden_hour" | "ev.next"
  | "sur.golden_school" | "sur.shark" | "sur.bottle" | "sur.whirlpool" | "sur.chest" | "sur.shadow" | "stolen" | "escaped" | "map"
  | "wx.sunny" | "wx.rain" | "wx.storm" | "wx.fog"
  | "record" | "sur.glimpse" | "fx.casts" | "fx.nextcasts" | "fx.attracts" | "fx.secret" | "fx.lantern" | "fx.sonar" | "fx.lanternDo" | "fx.sonarDo"
  | "lv.t0" | "lv.t1" | "lv.t2" | "lv.t3" | "lv.t4" | "lv.t5" | "tier.bronze" | "tier.silver" | "tier.gold" | "tier.diamond" | "tier.legend" | "cmp.league" | "cmp.derby" | "cmp.daily" | "cmp.duel" | "cmp.voyage" | "cmp.start" | "cmp.left" | "cmp.promote" | "cmp.demote" | "cmp.you" | "rule.value" | "rule.count" | "rule.heaviest" | "duel.p" | "duel.win" | "duel.draw" | "daily.best" | "daily.streak" | "daily.done" | "voy.need" | "voy.go" | "voy.desc" | "derby.place" | "levelup" | "league.result"
  | "fight.tap" | "fight.follow"
  | "tank.tap" | "tank.hint" | "tank.empty" | "orders.note" | "orders.deliver"
  | "ward.note" | "fx.mygear" | "fx.nobait" | "fx.line" | "fx.capacity" | "fx.luck"
  | "new" | "collect" | "double" | "snapped" | "retry" | "letgo" | "reel" | "album" | "paused" | "resume";

const T: Record<Lang, Partial<Record<Key, string>>> = {
  en: {
    "fight.tap": "TAP when the rings meet!", "fight.follow": "STAY under the fish!",
    "lv.t0": "Rookie", "lv.t1": "Angler", "lv.t2": "Skipper", "lv.t3": "Captain", "lv.t4": "Sea Master", "lv.t5": "Legend of the Seas", "tier.bronze": "Bronze", "tier.silver": "Silver", "tier.gold": "Gold", "tier.diamond": "Diamond", "tier.legend": "Legend", "cmp.league": "Weekly League", "cmp.derby": "Fishing Derby", "cmp.daily": "Daily Sea", "cmp.duel": "2-Player Duel", "cmp.voyage": "New Voyage", "cmp.start": "Start", "cmp.left": "left", "cmp.promote": "top 5 move up", "cmp.demote": "bottom 4 move down", "cmp.you": "You", "rule.value": "Most coins in 3 min", "rule.count": "Most fish in 3 min", "rule.heaviest": "Heaviest fish in 3 min", "duel.p": "Player", "duel.win": "wins!", "duel.draw": "Draw!", "daily.best": "Best", "daily.streak": "Streak", "daily.done": "Done today: come back tomorrow!", "voy.need": "Open all 4 places and reach 200 m line", "voy.go": "Set sail again", "voy.desc": "Start over with a permanent +25% coins star. Album, tank, hats and level stay.", "derby.place": "Place", "levelup": "Level up!", "league.result": "Last week",
    "tank.tap": "Tap a fish to KEEP it (tank + orders) instead of selling", "tank.hint": "Kept fish earn while you are away. 3 of a kind merge into ★★, 3 ★★ into ★★★ (much stronger).", "tank.empty": "Your tank is empty. After a dive, tap fish cards to keep them.", "orders.note": "Customers pay much more than selling. Keep the fish they want, then deliver.", "orders.deliver": "Deliver",
    "ward.note": "Just for looks: hats and vests on your fisher, paint on your boat, pets ride along. Tap 👕 to wear.",
    "fx.casts": "casts", "fx.nextcasts": "active for your next {n} casts", "fx.attracts": "attracts special fish", "fx.secret": "secret fish can appear", "fx.lantern": "Lantern", "fx.sonar": "Sonar", "fx.lanternDo": "Bigger light in the dark deep", "fx.sonarDo": "Arrows point to hidden rare fish", "fx.mygear": "My gear (working now)", "fx.nobait": "No bait: buy one below", "fx.line": "go deeper, new fish live there", "fx.capacity": "catch more fish per dive", "fx.luck": "rare fish appear more often",
    record: "RECORD!", "sur.glimpse": "A legend swims below...",
    "wx.sunny": "Sunny", "wx.rain": "Rain: rare fish rise!", "wx.storm": "Storm! Electric fish!", "wx.fog": "Fog: hidden treasures...",
    "sur.golden_school": "Golden school!", "sur.shark": "Shark! Dodge it!", "sur.bottle": "A bottle drifts by...", "sur.whirlpool": "Whirlpool! Going deeper!", "sur.chest": "Treasure chest!", "sur.shadow": "Something HUGE is down there...", stolen: "The shark stole a fish!", escaped: "You escaped the shark!", map: "Map piece",
    "rarity.common": "Common", "rarity.rare": "Rare", "rarity.epic": "Epic", "rarity.legendary": "Legendary", "rarity.secret": "SECRET",
    "up.line": "Line", "up.capacity": "Hooks", "up.luck": "Luck", max: "MAX",
    "zone.lake": "Lake", "zone.ocean": "Ocean", "zone.ice": "Frozen North", "zone.reef": "Coral Reef", "map.title": "World Map", "map.needs": "First:", cur: "Current!",
    "ev.blood_moon": "Blood Moon", "ev.meteor": "Meteor Shower", "ev.rainbow_sky": "Rainbow Sky", "ev.golden_hour": "Golden Hour", "ev.next": "Next",
    new: "NEW!", collect: "Collect", double: "x2", snapped: "Line snapped!", retry: "Try again", letgo: "Let it go",
    reel: "HOLD!", album: "Album", paused: "Paused", resume: "Play",
  },
  es: {
    "fight.tap": "¡TOCA cuando se junten los aros!", "fight.follow": "¡QUÉDATE bajo el pez!",
    "lv.t0": "Novato", "lv.t1": "Pescador", "lv.t2": "Patrón", "lv.t3": "Capitán", "lv.t4": "Maestro del mar", "lv.t5": "Leyenda de los mares", "tier.bronze": "Bronce", "tier.silver": "Plata", "tier.gold": "Oro", "tier.diamond": "Diamante", "tier.legend": "Leyenda", "cmp.league": "Liga semanal", "cmp.derby": "Torneo de pesca", "cmp.daily": "Mar del día", "cmp.duel": "Duelo de 2", "cmp.voyage": "Nuevo viaje", "cmp.start": "Empezar", "cmp.left": "restante", "cmp.promote": "los 5 primeros suben", "cmp.demote": "los 4 últimos bajan", "cmp.you": "Tú", "rule.value": "Más monedas en 3 min", "rule.count": "Más peces en 3 min", "rule.heaviest": "Pez más pesado en 3 min", "duel.p": "Jugador", "duel.win": "¡gana!", "duel.draw": "¡Empate!", "daily.best": "Mejor", "daily.streak": "Racha", "daily.done": "Hecho hoy: ¡vuelve mañana!", "voy.need": "Abre los 4 lugares y llega a 200 m", "voy.go": "Zarpar de nuevo", "voy.desc": "Empieza de nuevo con una estrella de +25% de monedas. Álbum, pecera, gorros y nivel se quedan.", "derby.place": "Puesto", "levelup": "¡Subes de nivel!", "league.result": "Semana pasada",
    "tank.tap": "Toca un pez para GUARDARLO (pecera + pedidos) en vez de venderlo", "tank.hint": "Los peces guardados ganan mientras no estás. 3 iguales se fusionan en ★★, 3 ★★ en ★★★.", "tank.empty": "Tu pecera está vacía. Tras una bajada, toca peces para guardarlos.", "orders.note": "Los clientes pagan mucho más que la venta. Guarda los peces que piden y entrégalos.", "orders.deliver": "Entregar",
    "ward.note": "Solo estética: gorros y chalecos para tu pescador, pintura para tu barca y mascotas a bordo. Toca 👕 para usar.",
    "fx.casts": "lanzamientos", "fx.nextcasts": "activo en tus próximos {n} lanzamientos", "fx.attracts": "atrae peces especiales", "fx.secret": "pueden salir peces secretos", "fx.lantern": "Linterna", "fx.sonar": "Sonar", "fx.lanternDo": "Más luz en lo profundo", "fx.sonarDo": "Flechas hacia peces raros ocultos", "fx.mygear": "Mi equipo (activo)", "fx.nobait": "Sin cebo: compra uno abajo", "fx.line": "más profundo, peces nuevos", "fx.capacity": "más peces por bajada", "fx.luck": "peces raros más a menudo",
    record: "¡RÉCORD!", "sur.glimpse": "Una leyenda nada abajo...",
    "wx.sunny": "Soleado", "wx.rain": "Lluvia: ¡suben peces raros!", "wx.storm": "¡Tormenta! ¡Peces eléctricos!", "wx.fog": "Niebla: tesoros ocultos...",
    "sur.golden_school": "¡Banco dorado!", "sur.shark": "¡Tiburón! ¡Esquívalo!", "sur.bottle": "Una botella flota...", "sur.whirlpool": "¡Remolino! ¡Más hondo!", "sur.chest": "¡Cofre del tesoro!", "sur.shadow": "Algo ENORME hay ahí abajo...", stolen: "¡El tiburón robó un pez!", escaped: "¡Escapaste del tiburón!", map: "Trozo de mapa",
    "rarity.common": "Común", "rarity.rare": "Raro", "rarity.epic": "Épico", "rarity.legendary": "Legendario", "rarity.secret": "SECRETO",
    "up.line": "Sedal", "up.capacity": "Anzuelos", "up.luck": "Suerte", max: "MÁX",
    "zone.lake": "Lago", "zone.ocean": "Océano", "zone.ice": "Norte Helado", "zone.reef": "Arrecife de Coral", "map.title": "Mapa", "map.needs": "Antes:", cur: "¡Corriente!",
    "ev.blood_moon": "Luna de Sangre", "ev.meteor": "Lluvia de Meteoros", "ev.rainbow_sky": "Cielo Arcoíris", "ev.golden_hour": "Hora Dorada", "ev.next": "Siguiente",
    new: "¡NUEVO!", collect: "Cobrar", double: "x2", snapped: "¡Se rompió el sedal!", retry: "Otra vez", letgo: "Soltarlo",
    reel: "¡MANTÉN!", album: "Álbum", paused: "Pausa", resume: "Jugar",
  },
  pt: {
    "fight.tap": "TOQUE quando os anéis se encontrarem!", "fight.follow": "FIQUE embaixo do peixe!",
    "lv.t0": "Novato", "lv.t1": "Pescador", "lv.t2": "Mestre", "lv.t3": "Capitão", "lv.t4": "Mestre do mar", "lv.t5": "Lenda dos mares", "tier.bronze": "Bronze", "tier.silver": "Prata", "tier.gold": "Ouro", "tier.diamond": "Diamante", "tier.legend": "Lenda", "cmp.league": "Liga semanal", "cmp.derby": "Torneio de pesca", "cmp.daily": "Mar do dia", "cmp.duel": "Duelo a 2", "cmp.voyage": "Nova viagem", "cmp.start": "Começar", "cmp.left": "restante", "cmp.promote": "os 5 primeiros sobem", "cmp.demote": "os 4 últimos descem", "cmp.you": "Você", "rule.value": "Mais moedas em 3 min", "rule.count": "Mais peixes em 3 min", "rule.heaviest": "Peixe mais pesado em 3 min", "duel.p": "Jogador", "duel.win": "vence!", "duel.draw": "Empate!", "daily.best": "Melhor", "daily.streak": "Sequência", "daily.done": "Feito hoje: volte amanhã!", "voy.need": "Abra os 4 lugares e chegue a 200 m", "voy.go": "Zarpar de novo", "voy.desc": "Recomece com uma estrela de +25% de moedas. Álbum, aquário, chapéus e nível ficam.", "derby.place": "Lugar", "levelup": "Subiu de nível!", "league.result": "Semana passada",
    "tank.tap": "Toque num peixe para GUARDAR (aquário + pedidos) em vez de vender", "tank.hint": "Peixes guardados rendem enquanto você está fora. 3 iguais viram ★★, 3 ★★ viram ★★★.", "tank.empty": "Seu aquário está vazio. Depois de pescar, toque nos peixes para guardar.", "orders.note": "Clientes pagam bem mais que a venda. Guarde os peixes pedidos e entregue.", "orders.deliver": "Entregar",
    "ward.note": "Só visual: chapéus e coletes no pescador, pintura no barco e pets a bordo. Toque 👕 para usar.",
    "fx.casts": "lançamentos", "fx.nextcasts": "ativo nos próximos {n} lançamentos", "fx.attracts": "atrai peixes especiais", "fx.secret": "peixes secretos podem aparecer", "fx.lantern": "Lanterna", "fx.sonar": "Sonar", "fx.lanternDo": "Mais luz no fundo escuro", "fx.sonarDo": "Setas para peixes raros escondidos", "fx.mygear": "Meu equipamento (ativo)", "fx.nobait": "Sem isca: compre uma abaixo", "fx.line": "mais fundo, peixes novos", "fx.capacity": "mais peixes por descida", "fx.luck": "peixes raros com mais frequência",
    record: "RECORDE!", "sur.glimpse": "Uma lenda nada lá embaixo...",
    "wx.sunny": "Ensolarado", "wx.rain": "Chuva: peixes raros sobem!", "wx.storm": "Tempestade! Peixes elétricos!", "wx.fog": "Neblina: tesouros escondidos...",
    "sur.golden_school": "Cardume dourado!", "sur.shark": "Tubarão! Desvie!", "sur.bottle": "Uma garrafa passa...", "sur.whirlpool": "Redemoinho! Mais fundo!", "sur.chest": "Baú do tesouro!", "sur.shadow": "Tem algo ENORME lá embaixo...", stolen: "O tubarão roubou um peixe!", escaped: "Você escapou do tubarão!", map: "Pedaço do mapa",
    "rarity.common": "Comum", "rarity.rare": "Raro", "rarity.epic": "Épico", "rarity.legendary": "Lendário", "rarity.secret": "SECRETO",
    "up.line": "Linha", "up.capacity": "Anzóis", "up.luck": "Sorte", max: "MÁX",
    "zone.lake": "Lago", "zone.ocean": "Oceano", "zone.ice": "Norte Gelado", "zone.reef": "Recife de Coral", "map.title": "Mapa", "map.needs": "Antes:", cur: "Correnteza!",
    "ev.blood_moon": "Lua de Sangue", "ev.meteor": "Chuva de Meteoros", "ev.rainbow_sky": "Céu Arco-íris", "ev.golden_hour": "Hora Dourada", "ev.next": "Próximo",
    new: "NOVO!", collect: "Pegar", double: "x2", snapped: "A linha arrebentou!", retry: "De novo", letgo: "Deixar ir",
    reel: "SEGURE!", album: "Álbum", paused: "Pausado", resume: "Jogar",
  },
  hi: {
    "fight.tap": "छल्ले मिलें तब टैप करें!", "fight.follow": "मछली के नीचे रहें!",
    "lv.t0": "नौसिखिया", "lv.t1": "मछुआरा", "lv.t2": "नाविक", "lv.t3": "कप्तान", "lv.t4": "समुद्र गुरु", "lv.t5": "समुद्रों की किंवदंती", "tier.bronze": "कांस्य", "tier.silver": "रजत", "tier.gold": "स्वर्ण", "tier.diamond": "हीरा", "tier.legend": "किंवदंती", "cmp.league": "साप्ताहिक लीग", "cmp.derby": "मछली प्रतियोगिता", "cmp.daily": "आज का समुद्र", "cmp.duel": "2 खिलाड़ी", "cmp.voyage": "नई यात्रा", "cmp.start": "शुरू", "cmp.left": "बाकी", "cmp.promote": "ऊपर के 5 आगे बढ़ते हैं", "cmp.demote": "नीचे के 4 पीछे जाते हैं", "cmp.you": "आप", "rule.value": "3 मिनट में सबसे ज़्यादा सिक्के", "rule.count": "3 मिनट में सबसे ज़्यादा मछलियाँ", "rule.heaviest": "3 मिनट में सबसे भारी मछली", "duel.p": "खिलाड़ी", "duel.win": "जीता!", "duel.draw": "बराबरी!", "daily.best": "सर्वश्रेष्ठ", "daily.streak": "लगातार", "daily.done": "आज हो गया: कल आना!", "voy.need": "चारों जगहें खोलें और 200 मीटर तक पहुँचें", "voy.go": "फिर से रवाना", "voy.desc": "+25% सिक्कों के स्थायी सितारे के साथ फिर शुरू करें। एल्बम, टैंक, टोपी और लेवल रहते हैं।", "derby.place": "स्थान", "levelup": "लेवल अप!", "league.result": "पिछला हफ़्ता",
    "tank.tap": "बेचने की जगह रखने के लिए मछली पर टैप करें (टैंक + ऑर्डर)", "tank.hint": "रखी मछलियाँ आपकी गैरमौजूदगी में कमाती हैं। 3 एक जैसी मिलकर ★★, 3 ★★ मिलकर ★★★।", "tank.empty": "टैंक खाली है। शिकार के बाद मछली कार्ड पर टैप करें।", "orders.note": "ग्राहक बेचने से कहीं ज़्यादा देते हैं। उनकी मछली रखें और पहुँचाएँ।", "orders.deliver": "दें",
    "ward.note": "सिर्फ़ दिखावट: मछुआरे पर टोपी और जैकेट, नाव पर रंग, पालतू साथ में। पहनने के लिए 👕 दबाएँ।",
    "fx.casts": "बार", "fx.nextcasts": "अगले {n} बार के लिए चालू", "fx.attracts": "खास मछलियाँ खींचता है", "fx.secret": "रहस्य मछलियाँ आ सकती हैं", "fx.lantern": "लालटेन", "fx.sonar": "सोनार", "fx.lanternDo": "अँधेरी गहराई में ज़्यादा रोशनी", "fx.sonarDo": "छिपी दुर्लभ मछलियों की ओर तीर", "fx.mygear": "मेरा सामान (चालू)", "fx.nobait": "चारा नहीं: नीचे खरीदें", "fx.line": "और गहराई, नई मछलियाँ", "fx.capacity": "हर बार ज़्यादा मछलियाँ", "fx.luck": "दुर्लभ मछलियाँ ज़्यादा",
    record: "रिकॉर्ड!", "sur.glimpse": "नीचे एक दिग्गज तैर रहा है...",
    "wx.sunny": "धूप", "wx.rain": "बारिश: दुर्लभ मछलियाँ ऊपर!", "wx.storm": "तूफ़ान! बिजली वाली मछलियाँ!", "wx.fog": "कोहरा: छिपे खज़ाने...",
    "sur.golden_school": "सुनहरा झुंड!", "sur.shark": "शार्क! बचो!", "sur.bottle": "एक बोतल तैर रही है...", "sur.whirlpool": "भँवर! और गहराई में!", "sur.chest": "खज़ाने का संदूक!", "sur.shadow": "नीचे कुछ विशाल है...", stolen: "शार्क ने मछली चुरा ली!", escaped: "तुम शार्क से बच गए!", map: "नक्शे का टुकड़ा",
    "rarity.common": "साधारण", "rarity.rare": "दुर्लभ", "rarity.epic": "महाकाव्य", "rarity.legendary": "पौराणिक", "rarity.secret": "रहस्य",
    "up.line": "डोरी", "up.capacity": "काँटे", "up.luck": "किस्मत", max: "अधिकतम",
    "zone.lake": "झील", "zone.ocean": "समुद्र", "zone.ice": "बर्फ़ीला उत्तर", "zone.reef": "मूंगा चट्टान", "map.title": "नक्शा", "map.needs": "पहले:", cur: "धारा!",
    "ev.blood_moon": "रक्त चंद्र", "ev.meteor": "उल्का वर्षा", "ev.rainbow_sky": "इंद्रधनुषी आकाश", "ev.golden_hour": "सुनहरा समय", "ev.next": "अगला",
    new: "नया!", collect: "लें", double: "x2", snapped: "डोरी टूट गई!", retry: "फिर से", letgo: "जाने दो",
    reel: "दबाए रखें!", album: "एल्बम", paused: "रुका हुआ", resume: "खेलें",
  },
  ja: {
    "fight.tap": "輪が重なったらタップ!", "fight.follow": "魚の下をキープ!",
    "lv.t0": "ルーキー", "lv.t1": "釣り人", "lv.t2": "スキッパー", "lv.t3": "キャプテン", "lv.t4": "海の達人", "lv.t5": "海の伝説", "tier.bronze": "ブロンズ", "tier.silver": "シルバー", "tier.gold": "ゴールド", "tier.diamond": "ダイヤ", "tier.legend": "レジェンド", "cmp.league": "週間リーグ", "cmp.derby": "釣り大会", "cmp.daily": "今日の海", "cmp.duel": "2人対戦", "cmp.voyage": "新たな航海", "cmp.start": "スタート", "cmp.left": "残り", "cmp.promote": "上位5人が昇格", "cmp.demote": "下位4人が降格", "cmp.you": "あなた", "rule.value": "3分で一番コインを稼ぐ", "rule.count": "3分で一番たくさん釣る", "rule.heaviest": "3分で一番重い魚", "duel.p": "プレイヤー", "duel.win": "の勝ち!", "duel.draw": "引き分け!", "daily.best": "ベスト", "daily.streak": "連続", "daily.done": "今日はクリア: また明日!", "voy.need": "4つの場所を開放して200mに到達", "voy.go": "再び出航", "voy.desc": "コイン+25%の永久スターで最初から。図鑑・水槽・帽子・レベルは残るよ。", "derby.place": "順位", "levelup": "レベルアップ!", "league.result": "先週",
    "tank.tap": "魚をタップすると売らずに水槽にキープ(注文にも使える)", "tank.hint": "キープした魚は留守中も稼ぐ。同じ魚3匹で★★、★★3匹で★★★に合体。", "tank.empty": "水槽は空っぽ。釣った後に魚カードをタップしてキープしよう。", "orders.note": "お客さんは売るよりずっと高く買ってくれる。注文の魚をキープして届けよう。", "orders.deliver": "届ける",
    "ward.note": "見た目だけ: 釣り人に帽子とベスト、ボートに塗装、ペットも一緒。👕で装備。",
    "fx.casts": "回", "fx.nextcasts": "次の{n}回キャストで有効", "fx.attracts": "特別な魚を引き寄せる", "fx.secret": "シークレットの魚が出るかも", "fx.lantern": "ランタン", "fx.sonar": "ソナー", "fx.lanternDo": "暗い深海でもっと明るく", "fx.sonarDo": "隠れたレア魚を矢印で表示", "fx.mygear": "装備中のアイテム", "fx.nobait": "エサなし: 下で買おう", "fx.line": "もっと深く、新しい魚がいる", "fx.capacity": "1回でもっと釣れる", "fx.luck": "レアな魚が出やすくなる",
    record: "新記録!", "sur.glimpse": "下に伝説の魚が...",
    "wx.sunny": "晴れ", "wx.rain": "雨: レアな魚が浮上!", "wx.storm": "嵐! 電気の魚!", "wx.fog": "霧: 隠れたお宝...",
    "sur.golden_school": "金色の群れ!", "sur.shark": "サメだ! よけて!", "sur.bottle": "ボトルが流れてきた...", "sur.whirlpool": "渦潮! もっと深く!", "sur.chest": "宝箱!", "sur.shadow": "下に何か巨大なものが...", stolen: "サメに魚を取られた!", escaped: "サメから逃げた!", map: "地図のかけら",
    "rarity.common": "コモン", "rarity.rare": "レア", "rarity.epic": "エピック", "rarity.legendary": "レジェンド", "rarity.secret": "シークレット",
    "up.line": "糸", "up.capacity": "針", "up.luck": "運", max: "MAX",
    "zone.lake": "湖", "zone.ocean": "海", "zone.ice": "氷の北", "zone.reef": "サンゴ礁", "map.title": "ワールドマップ", "map.needs": "先に:", cur: "海流!",
    "ev.blood_moon": "ブラッドムーン", "ev.meteor": "流星群", "ev.rainbow_sky": "虹の空", "ev.golden_hour": "ゴールデンアワー", "ev.next": "次",
    new: "NEW!", collect: "受け取る", double: "x2", snapped: "糸が切れた!", retry: "もう一回", letgo: "逃がす",
    reel: "長押し!", album: "図鑑", paused: "一時停止", resume: "プレイ",
  },
};

let lang: Lang = "en";
export const getLang = () => lang;
export function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
}

/** first browser language we support; Hindi only when the browser itself asks for Hindi */
export function detectLang(): Lang {
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.toLowerCase().slice(0, 2) as Lang;
    if (LANGS.includes(code)) return code;
  }
  return "en";
}

export const t = (k: Key) => T[lang][k] ?? T.en[k] ?? k;
export const tRarity = (r: Rarity) => t(`rarity.${r}` as Key);
export const tUpgrade = (u: UpgradeId) => t(`up.${u}` as Key);
export const tZone = (z: ZoneId) => t(`zone.${z}` as Key);
export const tEvent = (e: EventId) => t(`ev.${e}` as Key);
export const tWeather = (w: string) => t(`wx.${w}` as Key);
export const fishName = (f: FishDef) => f.names?.[lang] ?? f.name;
