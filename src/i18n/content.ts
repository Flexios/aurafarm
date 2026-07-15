import { CHALLENGES } from "../data/challenges";
import type { Challenge, ChallengeCategory } from "../types";
import { getLang, t } from "./locale";
import type { AppLang } from "./types";

type ChallengeCopy = { title: string; prompt: string; hint: string };

const challengeEn: Record<string, ChallengeCopy> = Object.fromEntries(
  CHALLENGES.map((c) => [c.id, { title: c.title, prompt: c.prompt, hint: c.hint }]),
);

/** English title → id for localizing cloud-stored duel titles */
const titleToId = new Map(CHALLENGES.map((c) => [c.title, c.id]));

const challengeDe: Record<string, ChallengeCopy> = {
  "fit-mirror": {
    title: "Fit Check",
    prompt:
      "Beschreib deinen heutigen Fit so, als wärst du die Main Character, die in ein Café läuft, in dem nur deine Playlist läuft.",
    hint: "Farben, Energie, ein ikonisches Accessoire.",
  },
  "fit-first-day": {
    title: "First-Day-Energie",
    prompt:
      "Du bist neu an der Schule. Caption den Fit, der den Flur stumm macht.",
    hint: "Selbstbewusstsein schlägt Markennamen.",
  },
  "rizz-bus": {
    title: "Bushaltestellen-Rizz",
    prompt:
      "Jemand Süßes fragt, was du hörst. Bring den Satz, der wirklich funktioniert.",
    hint: "Charme > Cringe. Keine Pickup-Lines von 2016.",
  },
  "rizz-groupchat": {
    title: "Groupchat-Retter",
    prompt:
      "Der Groupchat stirbt. Schick die Nachricht, die ihn mit purem Aura wiederbelebt.",
    hint: "Unhinged, aber liebenswert.",
  },
  "rizz-apology": {
    title: "Soft-Launch-Entschuldigung",
    prompt:
      "Du hast sie 6 Stunden auf gelesen gelassen. Schreib den Recovery-Text mit maximaler Aura.",
    hint: "Ehrlich + witzig schlägt verzweifelt.",
  },
  "room-tour": {
    title: "Room Core",
    prompt:
      "Beschreib die Aesthetic deines Zimmers in 2–3 Sätzen wie ein Lifestyle-Magazin, das nur Teens coveret.",
    hint: "Licht, Chaoslevel, Signatur-Objekt.",
  },
  "room-night": {
    title: "2-Uhr-Schreibtisch",
    prompt:
      "Es ist 2 Uhr nachts. Male die Vibe deines Schreibtischs / Bett-Ecke wie eine Filmszene.",
    hint: "Bildschirmglühen, Snacks, offene Tabs.",
  },
  "mc-monday": {
    title: "Montag-Monolog",
    prompt:
      "Schreib deinen inneren Monolog, wenn du in den Montag läufst und der Soundtrack gerade droppt.",
    hint: "Dramatik ist erlaubt. Prätentiös ist erwünscht.",
  },
  "mc-villain": {
    title: "Soft-Villain-Arc",
    prompt:
      "Jemand hat deine Pommes geklaut. Schreib deinen Schurken-Monolog (noch PG-13).",
    hint: "Petty-Royalty-Energie.",
  },
  "cap-story": {
    title: "Story-Caption",
    prompt:
      "Du hast ein unscharfes Sunset-Foto gepostet. Schreib die Caption, die trotzdem 10k Vibes hat.",
    hint: "Kurz, poetisch oder unhinged — wähl eine Spur.",
  },
  "cap-bio": {
    title: "Bio-Rewrite",
    prompt:
      "Schreib deine Social-Bio in einer Zeile um, die deinen Aesthetic Core schreit.",
    hint: "Kein „Link in Bio“-Energie, außer es ist witzig.",
  },
  "cap-playlist": {
    title: "Playlist-Titel",
    prompt:
      "Benenne eine Playlist, die deine ganze Persönlichkeit diese Woche beschreibt.",
    hint: "Seltsam spezifisch = mehr Aura.",
  },
  "fit-thrift": {
    title: "Thrift-Legende",
    prompt:
      "Du hast ein chaotisches Secondhand-Teil gefunden. Erklär, wie du daraus eine ganze Persönlichkeit gestylt hast.",
    hint: "Story + Style-Kombo.",
  },
  "rizz-compliment": {
    title: "Elite-Kompliment",
    prompt:
      "Mach einem Fremden ein Kompliment zur Vibe, ohne weird zu werden. Max-Aura-Edition.",
    hint: "Spezifisch > generisch.",
  },
  "mc-plot": {
    title: "Plot-Twist-Tag",
    prompt:
      "Dein Tag hat gerade einen Plot Twist. Erzähle die nächste Szene in deinem Life-Movie.",
    hint: "Cliffhanger willkommen.",
  },
  "room-guest": {
    title: "Unerwarteter Gast",
    prompt:
      "Dein Crush steht in 60 Sekunden vor der Tür. Was „fixilest“ du zuerst — und warum knallt’s?",
    hint: "Comedy-Gold bevorzugt.",
  },
};

const challengeFr: Record<string, ChallengeCopy> = {
  "fit-mirror": {
    title: "Fit Check",
    prompt:
      "Décris ton fit d’aujourd’hui comme si tu étais la main character qui entre dans un café qui ne passe que ta playlist.",
    hint: "Couleurs, énergie, un accessoire iconique.",
  },
  "fit-first-day": {
    title: "Énergie premier jour",
    prompt:
      "Tu viens d’arriver dans un nouveau lycée. Caption le fit qui fait taire le couloir.",
    hint: "La confiance > les marques.",
  },
  "rizz-bus": {
    title: "Rizz à l’arrêt de bus",
    prompt:
      "Quelqu’un de cute te demande ce que tu écoutes. Balance la phrase qui marche vraiment.",
    hint: "Charme > cringe. Pas de punchlines 2016.",
  },
  "rizz-groupchat": {
    title: "Sauveur du group chat",
    prompt:
      "Le group chat meurt. Envoie le message qui le ressuscite avec de l’aura pure.",
    hint: "Unhinged mais adorable.",
  },
  "rizz-apology": {
    title: "Excuse soft launch",
    prompt:
      "Tu les as laissés en vu pendant 6 heures. Écris le texto de recovery avec un maximum d’aura.",
    hint: "Honnête + drôle bat le désespoir.",
  },
  "room-tour": {
    title: "Room Core",
    prompt:
      "Décris l’esthétique de ta chambre en 2–3 phrases comme un magazine lifestyle qui ne couvre que les ados.",
    hint: "Lumière, niveau de bordel, objet signature.",
  },
  "room-night": {
    title: "Setup 2h du mat",
    prompt:
      "Il est 2h du matin. Peins l’ambiance de ton bureau / coin lit comme un plan de film.",
    hint: "Lueur d’écran, snacks, onglets ouverts.",
  },
  "mc-monday": {
    title: "Monologue du lundi",
    prompt:
      "Écris ton monologue intérieur en entrant dans le lundi comme si la BO venait de drop.",
    hint: "Le dramatique est ok. Le prétentieux est encouragé.",
  },
  "mc-villain": {
    title: "Arc soft villain",
    prompt:
      "Quelqu’un a volé tes frites. Écris ton monologue de vilain (toujours PG-13).",
    hint: "Énergie royauté petty.",
  },
  "cap-story": {
    title: "Caption Story",
    prompt:
      "Tu as posté un sunset flou. Écris la caption qui cartonne quand même à 10k vibes.",
    hint: "Court, poétique ou unhinged — choisis une lane.",
  },
  "cap-bio": {
    title: "Bio rewrite",
    prompt:
      "Réécris ta bio en une ligne qui crie ton aesthetic core.",
    hint: "Pas d’énergie « link in bio » sauf si c’est drôle.",
  },
  "cap-playlist": {
    title: "Titre de playlist",
    prompt:
      "Nomme une playlist qui décrit toute ta personnalité cette semaine.",
    hint: "Bizarrement précis = plus d’aura.",
  },
  "fit-thrift": {
    title: "Légende thrift",
    prompt:
      "Tu as thrifté une pièce chaotique. Explique comment tu en as fait toute une personnalité.",
    hint: "Combo histoire + style.",
  },
  "rizz-compliment": {
    title: "Compliment d’élite",
    prompt:
      "Complimente la vibe d’un inconnu sans être weird. Édition max aura.",
    hint: "Spécifique > générique.",
  },
  "mc-plot": {
    title: "Journée plot twist",
    prompt:
      "Ta journée vient d’avoir un plot twist. Raconte la prochaine scène de ton film de vie.",
    hint: "Les cliffhangers sont bienvenus.",
  },
  "room-guest": {
    title: "Invité surprise",
    prompt:
      "Ton crush est devant ta porte dans 60 secondes. Qu’est-ce que tu « ranges » en premier — et pourquoi ça claque ?",
    hint: "La comédie est préférée.",
  },
};

const challengeZh: Record<string, ChallengeCopy> = {
  "fit-mirror": {
    title: "今日穿搭检查",
    prompt: "像走进一家只放你歌单的咖啡店的主角一样，描述你今天的穿搭。",
    hint: "颜色、气场、一件标志性配饰。",
  },
  "fit-first-day": {
    title: "第一天气场",
    prompt: "你刚转学。给这身让走廊瞬间安静的穿搭写个 caption。",
    hint: "自信比品牌名更重要。",
  },
  "rizz-bus": {
    title: "公交站搭讪",
    prompt: "有个好看的人问你在听什么。甩出那句真的有用的回应。",
    hint: "魅力 > 尴尬。别用 2016 土味情话。",
  },
  "rizz-groupchat": {
    title: "群聊救星",
    prompt: "群聊快死了。发一条能用纯 aura 救活它的消息。",
    hint: "放飞但可爱。",
  },
  "rizz-apology": {
    title: "软着陆道歉",
    prompt: "你已读不回六小时。写一条带满 aura 的挽回短信。",
    hint: "真诚+好笑，别卑微。",
  },
  "room-core": {
    title: "房间核心",
    prompt: "用两三句话描述你房间的审美，像一本只拍青少年的生活方式杂志。",
    hint: "光线、乱度、标志物件。",
  },
  "room-night": {
    title: "凌晨两点桌面",
    prompt: "现在是凌晨两点。像电影镜头一样描绘你的书桌 / 床角氛围。",
    hint: "屏幕光、零食、开着的标签页。",
  },
  "mc-monday": {
    title: "周一独白",
    prompt: "像配乐刚 drop 一样，写下你走进周一的内心独白。",
    hint: "允许戏剧化，鼓励装腔。",
  },
  "mc-villain": {
    title: "软反派弧线",
    prompt: "有人偷了你的薯条。写一段反派独白（仍限 PG-13）。",
    hint: "小气又高贵的能量。",
  },
  "cap-story": {
    title: "动态文案",
    prompt: "你发了一张模糊日落照。写一条依然能拿 1 万 vibe 的 caption。",
    hint: "短、诗意或疯一点——选一条路。",
  },
  "cap-bio": {
    title: "简介重写",
    prompt: "用一句话重写你的社交简介，让它大声喊出你的审美核心。",
    hint: "别整“主页有链接”那套，除非真的好笑。",
  },
  "cap-playlist": {
    title: "歌单名",
    prompt: "给歌单起个名，概括你这周整个人格。",
    hint: "越具体越怪，aura 越高。",
  },
  "fit-thrift": {
    title: "二手传奇",
    prompt: "你淘到一件离谱单品。解释你怎么把它穿成一整个人设。",
    hint: "故事 + 造型双杀。",
  },
  "rizz-compliment": {
    title: "顶级夸赞",
    prompt: "夸一个陌生人的 vibe，但不尴尬。满 aura 版。",
    hint: "具体 > 空泛。",
  },
  "mc-plot": {
    title: "剧情反转日",
    prompt: "你的一天刚有了 plot twist。叙述人生电影的下一幕。",
    hint: "欢迎悬念。",
  },
  "room-guest": {
    title: "不速之客",
    prompt: "你 crush 六十秒后到门口。你“随意”先收拾什么——为什么这招绝？",
    hint: "喜剧向优先。",
  },
};

const challengeEs: Record<string, ChallengeCopy> = {
  "fit-mirror": {
    title: "Fit check",
    prompt:
      "Describe el fit de hoy como si fueras la main character entrando a un café que solo pone tu playlist.",
    hint: "Colores, energía, un accesorio icónico.",
  },
  "fit-first-day": {
    title: "Energía primer día",
    prompt:
      "Acabas de cambiarte de colegio. Caption del fit que deja el pasillo en silencio.",
    hint: "Confianza > marcas.",
  },
  "rizz-bus": {
    title: "Rizz en la parada",
    prompt:
      "Alguien cute pregunta qué escuchas. Suelta la frase que de verdad funciona.",
    hint: "Encanto > cringe. Nada de piropos de 2016.",
  },
  "rizz-groupchat": {
    title: "Salvador del group chat",
    prompt:
      "El group chat se está muriendo. Manda el mensaje que lo revive con aura pura.",
    hint: "Unhinged pero adorable.",
  },
  "rizz-apology": {
    title: "Disculpa soft launch",
    prompt:
      "Los dejaste en visto 6 horas. Escribe el texto de recovery con máximo aura.",
    hint: "Honesto + gracioso gana a desesperado.",
  },
  "room-core": {
    title: "Room core",
    prompt:
      "Describe la estética de tu cuarto en 2–3 frases como una revista lifestyle solo de teens.",
    hint: "Luz, nivel de caos, objeto firma.",
  },
  "room-night": {
    title: "Setup a las 2AM",
    prompt:
      "Son las 2AM. Pinta la vibe de tu escritorio / rincón de cama como un plano de cine.",
    hint: "Brillo de pantalla, snacks, pestañas abiertas.",
  },
  "mc-monday": {
    title: "Monólogo del lunes",
    prompt:
      "Escribe tu monólogo interno entrando al lunes como si la banda sonora acabara de droppear.",
    hint: "Lo dramático vale. Lo pretencioso se agradece.",
  },
  "mc-villain": {
    title: "Arco soft villain",
    prompt:
      "Alguien te robó las papas. Escribe tu monólogo de villano (sigue siendo PG-13).",
    hint: "Energía realeza petty.",
  },
  "cap-story": {
    title: "Caption de story",
    prompt:
      "Subiste un sunset borroso. Escribe el caption que igual pega 10k vibes.",
    hint: "Corto, poético o unhinged — elige un carril.",
  },
  "cap-bio": {
    title: "Reescribir bio",
    prompt:
      "Reescribe tu bio en una línea que grite tu aesthetic core.",
    hint: "Nada de “link in bio” salvo que sea gracioso.",
  },
  "cap-playlist": {
    title: "Título de playlist",
    prompt:
      "Nombra una playlist que describa toda tu personalidad esta semana.",
    hint: "Raramente específico = más aura.",
  },
  "fit-thrift": {
    title: "Leyenda thrift",
    prompt:
      "Thrifteaste una prenda caótica. Explica cómo la convertiste en toda una personalidad.",
    hint: "Combo historia + estilo.",
  },
  "rizz-compliment": {
    title: "Cumplido élite",
    prompt:
      "Halaga la vibe de un desconocido sin ser raro. Edición max aura.",
    hint: "Específico > genérico.",
  },
  "mc-plot": {
    title: "Día plot twist",
    prompt:
      "Tu día acaba de tener un plot twist. Narra la siguiente escena de tu película de vida.",
    hint: "Cliffhangers bienvenidos.",
  },
  "room-guest": {
    title: "Invitado inesperado",
    prompt:
      "Tu crush está afuera en 60 segundos. ¿Qué “ordenas” primero — y por qué pega tanto?",
    hint: "Se prefiere comedia.",
  },
};

const CHALLENGE_I18N: Record<AppLang, Record<string, ChallengeCopy>> = {
  en: challengeEn,
  de: challengeDe,
  fr: challengeFr,
  zh: challengeZh,
  es: challengeEs,
};

const CATEGORY: Record<AppLang, Record<ChallengeCategory, string>> = {
  en: {
    "fit-check": "fit-check",
    rizz: "rizz",
    "room-vibe": "room-vibe",
    "main-character": "main-character",
    caption: "caption",
  },
  de: {
    "fit-check": "Fit-Check",
    rizz: "Rizz",
    "room-vibe": "Room-Vibe",
    "main-character": "Main Character",
    caption: "Caption",
  },
  fr: {
    "fit-check": "fit-check",
    rizz: "rizz",
    "room-vibe": "room-vibe",
    "main-character": "main character",
    caption: "caption",
  },
  zh: {
    "fit-check": "穿搭",
    rizz: "撩感",
    "room-vibe": "房间氛围",
    "main-character": "主角感",
    caption: "文案",
  },
  es: {
    "fit-check": "fit-check",
    rizz: "rizz",
    "room-vibe": "room-vibe",
    "main-character": "main character",
    caption: "caption",
  },
};

const COSMETIC_NAMES: Record<AppLang, Record<string, string>> = {
  en: {
    "frame-basic": "Plain Frame",
    "frame-neon": "Neon Ring",
    "frame-chrome": "Chrome Halo",
    "frame-gold": "Main Character Gold",
    "aura-soft": "Soft Glow",
    "aura-pulse": "Pulse Aura",
    "aura-flame": "Pink Flame",
    "aura-galaxy": "Galaxy Drift",
    "name-plain": "Default Plate",
    "name-ticker": "Hype Ticker",
    "name-royal": "Royal Banner",
    "bg-void": "Void Night",
    "bg-sunset": "Story Sunset",
    "bg-mint": "Mint Dream",
    "bg-aurora": "Aurora Grid",
  },
  de: {
    "frame-basic": "Schlichter Rahmen",
    "frame-neon": "Neon-Ring",
    "frame-chrome": "Chrome-Halo",
    "frame-gold": "Main-Character-Gold",
    "aura-soft": "Soft Glow",
    "aura-pulse": "Pulse-Aura",
    "aura-flame": "Pinke Flamme",
    "aura-galaxy": "Galaxy Drift",
    "name-plain": "Standard-Platte",
    "name-ticker": "Hype-Ticker",
    "name-royal": "Royal-Banner",
    "bg-void": "Void Night",
    "bg-sunset": "Story-Sunset",
    "bg-mint": "Mint Dream",
    "bg-aurora": "Aurora-Grid",
  },
  fr: {
    "frame-basic": "Cadre simple",
    "frame-neon": "Anneau néon",
    "frame-chrome": "Halo chrome",
    "frame-gold": "Or main character",
    "aura-soft": "Soft glow",
    "aura-pulse": "Aura pulse",
    "aura-flame": "Flamme rose",
    "aura-galaxy": "Dérive galaxie",
    "name-plain": "Plaque de base",
    "name-ticker": "Ticker hype",
    "name-royal": "Bannière royale",
    "bg-void": "Nuit void",
    "bg-sunset": "Sunset story",
    "bg-mint": "Rêve menthe",
    "bg-aurora": "Grille aurore",
  },
  zh: {
    "frame-basic": "素框",
    "frame-neon": "霓虹环",
    "frame-chrome": "铬光晕",
    "frame-gold": "主角金框",
    "aura-soft": "柔光",
    "aura-pulse": "脉冲光环",
    "aura-flame": "粉焰",
    "aura-galaxy": "星系漂流",
    "name-plain": "默认铭牌",
    "name-ticker": "热度滚动条",
    "name-royal": "皇家横幅",
    "bg-void": "虚空夜",
    "bg-sunset": "故事日落",
    "bg-mint": "薄荷梦",
    "bg-aurora": "极光网格",
  },
  es: {
    "frame-basic": "Marco simple",
    "frame-neon": "Anillo neón",
    "frame-chrome": "Halo chrome",
    "frame-gold": "Oro main character",
    "aura-soft": "Brillo suave",
    "aura-pulse": "Aura pulse",
    "aura-flame": "Llama rosa",
    "aura-galaxy": "Deriva galaxia",
    "name-plain": "Placa default",
    "name-ticker": "Ticker hype",
    "name-royal": "Banner real",
    "bg-void": "Noche void",
    "bg-sunset": "Sunset story",
    "bg-mint": "Sueño menta",
    "bg-aurora": "Grid aurora",
  },
};

const CORE_NAMES: Record<AppLang, Record<string, string>> = {
  en: {
    "spark-seed": "Spark Seed",
    "mirror-glint": "Mirror Glint",
    "caption-comet": "Caption Comet",
    "rizz-relic": "Rizz Relic",
    "night-neon": "Night Neon",
    "plot-pearl": "Plot Pearl",
    "aura-crown": "Aura Crown",
    "void-velvet": "Void Velvet",
    "owner-seal": "Owner Seal",
  },
  de: {
    "spark-seed": "Spark Seed",
    "mirror-glint": "Spiegelglanz",
    "caption-comet": "Caption-Komet",
    "rizz-relic": "Rizz-Relikt",
    "night-neon": "Night Neon",
    "plot-pearl": "Plot-Perle",
    "aura-crown": "Aura-Krone",
    "void-velvet": "Void Velvet",
    "owner-seal": "Owner Seal",
  },
  fr: {
    "spark-seed": "Graine spark",
    "mirror-glint": "Éclat miroir",
    "caption-comet": "Comète caption",
    "rizz-relic": "Relique rizz",
    "night-neon": "Néon de nuit",
    "plot-pearl": "Perle de plot",
    "aura-crown": "Couronne aura",
    "void-velvet": "Velours void",
    "owner-seal": "Sceau owner",
  },
  zh: {
    "spark-seed": "火花种子",
    "mirror-glint": "镜光微闪",
    "caption-comet": "文案彗星",
    "rizz-relic": "撩感遗物",
    "night-neon": "夜色霓虹",
    "plot-pearl": "剧情珍珠",
    "aura-crown": "Aura 冠冕",
    "void-velvet": "虚空丝绒",
    "owner-seal": "创始人印",
  },
  es: {
    "spark-seed": "Semilla spark",
    "mirror-glint": "Destello espejo",
    "caption-comet": "Cometa caption",
    "rizz-relic": "Reliquia rizz",
    "night-neon": "Neón nocturno",
    "plot-pearl": "Perla de plot",
    "aura-crown": "Corona aura",
    "void-velvet": "Terciopelo void",
    "owner-seal": "Sello owner",
  },
};

const RARITY: Record<AppLang, Record<string, string>> = {
  en: { common: "common", rare: "rare", epic: "epic", legendary: "legendary" },
  de: { common: "gewöhnlich", rare: "selten", epic: "episch", legendary: "legendär" },
  fr: { common: "commun", rare: "rare", epic: "épique", legendary: "légendaire" },
  zh: { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" },
  es: { common: "común", rare: "raro", epic: "épico", legendary: "legendario" },
};

export function localizeChallenge(challenge: Challenge): Challenge {
  const lang = getLang();
  const pack = CHALLENGE_I18N[lang]?.[challenge.id] ?? CHALLENGE_I18N.en[challenge.id];
  if (!pack) return challenge;
  return {
    ...challenge,
    title: pack.title,
    prompt: pack.prompt,
    hint: pack.hint,
    category: challenge.category,
  };
}

/** Localize a stored challenge title (e.g. from online duels) when the English title matches a known card. */
export function localizeChallengeTitle(title: string): string {
  const id = titleToId.get(title);
  if (!id) return title;
  const pack = CHALLENGE_I18N[getLang()]?.[id] ?? CHALLENGE_I18N.en[id];
  return pack?.title ?? title;
}

export function localizeChallengePrompt(title: string, prompt: string): string {
  const id = titleToId.get(title);
  if (!id) return prompt;
  const pack = CHALLENGE_I18N[getLang()]?.[id] ?? CHALLENGE_I18N.en[id];
  return pack?.prompt ?? prompt;
}

export function localizeCategory(category: string): string {
  const lang = getLang();
  const map = CATEGORY[lang] ?? CATEGORY.en;
  return (map as Record<string, string>)[category] ?? category;
}

export function cosmeticName(id: string, fallback = ""): string {
  const lang = getLang();
  return COSMETIC_NAMES[lang]?.[id] ?? COSMETIC_NAMES.en[id] ?? (fallback || id);
}

export function coreName(id: string, fallback = ""): string {
  const lang = getLang();
  return CORE_NAMES[lang]?.[id] ?? CORE_NAMES.en[id] ?? (fallback || id);
}

export function rarityLabel(rarity: string): string {
  const lang = getLang();
  return RARITY[lang]?.[rarity] ?? RARITY.en[rarity] ?? rarity;
}

export function rewardLabel(reward: {
  type: string;
  id?: string;
  amount?: number;
  label: string;
}): string {
  if (reward.type === "sparks" && reward.amount != null) {
    return t("reward.sparks", { n: reward.amount });
  }
  if (reward.type === "glow" && reward.amount != null) {
    return t("reward.glow", { n: reward.amount });
  }
  if (reward.type === "cosmetic" && reward.id) {
    return cosmeticName(reward.id, reward.label);
  }
  if (reward.type === "core" && reward.id) {
    return coreName(reward.id, reward.label);
  }
  return reward.label;
}
