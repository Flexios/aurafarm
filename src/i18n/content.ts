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
  "fit-date-night": {
    title: "Date-Night-Armor",
    prompt:
      "Du triffst jemanden zum ersten Mal IRL. Beschreib den Fit, der sagt „ich bin spaßig, aber nicht try-hard“.",
    hint: "Ein bewusster Detail-Hit schlägt den Totalumbau.",
  },
  "fit-rain": {
    title: "Regen-Fit",
    prompt:
      "Es fängt mitten im Walk an zu schütten. Schreib deinen Fit als Main-Character-Wetter-Montage um.",
    hint: "Haare, Jacke, Attitude unter Druck.",
  },
  "rizz-voice-note": {
    title: "Voice-Note-Chaos",
    prompt:
      "Du hast aus Versehen eine 47-Sekunden-Sprachnachricht geschickt. Transkribiere die ersten 15 Sekunden so, als wär’s trotzdem cool.",
    hint: "Selbstbewusstes Rumgequatsche ist ein Skill.",
  },
  "rizz-pet": {
    title: "Pet-Parent-Rizz",
    prompt:
      "Im Park rennt dir ein Hund zu. Eröffne mit einer Line, die Mensch und Hund beeindruckt.",
    hint: "Hund zuerst, Flirt zweitens.",
  },
  "room-morning": {
    title: "Golden-Hour-Schreibtisch",
    prompt:
      "Morgenlicht trifft dein Zimmer. Beschreib das Chaos, als wäre es absichtliches Set-Design.",
    hint: "Staubpartikel zählen als Production Value.",
  },
  "room-party": {
    title: "Pre-Game-Staging",
    prompt:
      "Freunde sind in 20 Minuten da. Erzähl deinen hektischen Living-Room-Glow-up.",
    hint: "Verstecken, dimmen, sprühen, beten.",
  },
  "mc-commute": {
    title: "Commute-Cinematic",
    prompt:
      "Dein Bus/Zug/Auto ist eine Filmszene. Schreib das Voiceover für die 8-Minuten-Fahrt.",
    hint: "Kopfhörer rein = Third-Person-Mode.",
  },
  "mc-receipts": {
    title: "Receipt-Ära",
    prompt:
      "Du bist fertig mit nett. Schreib den ruhigen, vernichtenden Absatz, der das Kapitel schließt.",
    hint: "Weiche Stimme, scharfe Kanten.",
  },
  "cap-gym": {
    title: "Gym-Story-Flex",
    prompt:
      "Du hast ein mittelmäßiges Gym-Mirror-Pic gepostet. Caption so, dass es nicht wie jede andere Gym-Story klingt.",
    hint: "Self-aware > try-hard.",
  },
  "cap-food": {
    title: "Foodie-Propaganda",
    prompt:
      "Caption ein unscharfes Foto des besten Essens diesen Monat wie einen Liebesbrief.",
    hint: "Sensorik gewinnt.",
  },
  "rizz-coworker": {
    title: "Professional Rizz",
    prompt:
      "Du matchst mit jemandem und merkst: fast dasselbe Gebäude. Schreib den Opener, der das Awkward navigiert.",
    hint: "Verspielt, kein HR-Fall.",
  },
  "mc-solo": {
    title: "Solo-Tisch-Energie",
    prompt:
      "Du isst absichtlich allein an einem schönen Ort. Schreib den Monolog, der es ikonisch macht, nicht einsam.",
    hint: "Gewählte Einsamkeit ist elite.",
  },
  "nsfw-thirst-trap": {
    title: "Thirst-Trap-Caption",
    prompt:
      "Du hast absichtlich ein heißes Mirror-Pic gepostet. Schreib die Caption, die thirsty ist, ohne try-hard-Cringe.",
    hint: "Andeuten, nicht ansagen.",
  },
  "nsfw-situationship": {
    title: "Situationship-Audit",
    prompt:
      "1:17 Uhr. Wieder „you up?“. Schreib die Antwort, die Grenze setzt und trotzdem Spannung hält.",
    hint: "Selbstrespekt ist sexy.",
  },
  "nsfw-walk-of-fame": {
    title: "Morning-After-Monolog",
    prompt:
      "Du schleichst dich leise aus ihrer/seiner Wohnung. Nur innerer Monolog — Comedy erlaubt, Würde optional.",
    hint: "Schuhe, Schlüssel, Aura.",
  },
  "nsfw-bar-close": {
    title: "Last-Call-Close",
    prompt:
      "Bar schließt. Eine Stunde geflirtet. Bring die Line, die nach Hause einlädt, ohne bedrohlich zu klingen.",
    hint: "Klare Absicht, weiche Delivery.",
  },
  "nsfw-dirty-joke": {
    title: "Doppeldeutigkeit",
    prompt:
      "Schreib eine flirty One-Liner, die je nach Lesart unschuldig oder dreckig ist.",
    hint: "Plausible Deniability ist Kunst.",
  },
  "nsfw-ex-text": {
    title: "Ex um 2 Uhr",
    prompt:
      "Dein Ex schickt einen Roman. Schreib die Drei-Wort-Antwort, die mit maximaler Aura endet.",
    hint: "Kurz kann tödlich sein.",
  },
  "nsfw-hotel": {
    title: "Hotel-Key-Energie",
    prompt:
      "Wochenendtrip mit jemandem Neuem. Beschreib die ersten zehn Minuten im Zimmer wie eine spicy Slow-Burn-Szene (geschmackvoll, kein Porno).",
    hint: "Spannung > Checkliste.",
  },
  "nsfw-jealousy": {
    title: "Soft Jealousy",
    prompt:
      "Du siehst deine Situationship mit jemand anderem lachen. Innerer Monolog — petty, hot, self-aware.",
    hint: "Fühlen, nicht öffentlich crashen.",
  },
  "nsfw-voice-note-late": {
    title: "Late-Night-Voice-Note",
    prompt:
      "Du bist etwas angetrunken, sie wollen eine Voice Note. Skripte, was du sagst — flirty, etwas gefährlich, trotzdem charmant.",
    hint: "Tiefere Stimme = höhere Stakes.",
  },
  "nsfw-rules": {
    title: "House Rules",
    prompt:
      "Sie kommen vorbei. Schreib die spielerische „House Rules“-Nachricht, die den Vibe der Nacht setzt.",
    hint: "Consent + Humor = Peak Aura.",
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
  "fit-date-night": {
    title: "Armure date night",
    prompt:
      "Premier IRL. Décris le fit qui dit « je suis fun sans en faire trop ».",
    hint: "Un détail intentionnel bat un rebrand complet.",
  },
  "fit-rain": {
    title: "Fit sous la pluie",
    prompt:
      "Il se met à pourrir en plein walk. Réécris ton fit en montage météo main character.",
    hint: "Cheveux, veste, attitude sous pression.",
  },
  "rizz-voice-note": {
    title: "Chaos vocal",
    prompt:
      "Tu as envoyé un vocal de 47s par accident. Transcris les 15 premières secondes comme si c’était encore cool.",
    hint: "Bavarder avec confiance est un skill.",
  },
  "rizz-pet": {
    title: "Rizz pet parent",
    prompt:
      "Au parc, un chien court vers toi. Ouvre avec une phrase qui impressionne humain et chien.",
    hint: "Chien d’abord, flirt ensuite.",
  },
  "room-morning": {
    title: "Bureau golden hour",
    prompt:
      "La lumière du matin frappe ta chambre. Décris le bordel comme un décor volontaire.",
    hint: "Les poussières comptent en production value.",
  },
  "room-party": {
    title: "Staging pré-soirée",
    prompt:
      "Les potes arrivent dans 20 min. Raconte ton glow-up frénétique du salon.",
    hint: "Cacher, tamiser, vaporiser, prier.",
  },
  "mc-commute": {
    title: "Commute ciné",
    prompt:
      "Ton bus/train/voiture est une scène de film. Écris la VO des 8 minutes de trajet.",
    hint: "Écouteurs = mode troisième personne.",
  },
  "mc-receipts": {
    title: "Ère des reçus",
    prompt:
      "Tu as fini d’être gentil. Écris le paragraphe calme et dévastateur qui clôt le chapitre.",
    hint: "Voix douce, bords tranchants.",
  },
  "cap-gym": {
    title: "Flex story salle",
    prompt:
      "Tu as posté un mirror gym moyen. Caption pour ne pas sonner comme toutes les stories salle.",
    hint: "Self-aware > try-hard.",
  },
  "cap-food": {
    title: "Propagande foodie",
    prompt:
      "Caption une photo floue du meilleur repas du mois comme une lettre d’amour.",
    hint: "Le sensoriel gagne.",
  },
  "rizz-coworker": {
    title: "Rizz pro",
    prompt:
      "Match app : presque le même immeuble. Écris l’opener qui gère l’awkward.",
    hint: "Playful, pas case RH.",
  },
  "mc-solo": {
    title: "Énergie table solo",
    prompt:
      "Tu manges seul·e dans un bel endroit exprès. Monologue interne qui le rend iconique, pas triste.",
    hint: "Solitude choisie = elite.",
  },
  "nsfw-thirst-trap": {
    title: "Caption thirst trap",
    prompt:
      "Mirror pic volontairement hot. Caption thirsty sans cringe try-hard.",
    hint: "Suggérer, ne pas annoncer.",
  },
  "nsfw-situationship": {
    title: "Audit situationship",
    prompt:
      "1h17. Encore « you up? ». Réponds en posant une limite tout en gardant la tension.",
    hint: "Le respect de soi est sexy.",
  },
  "nsfw-walk-of-fame": {
    title: "Monologue lendemain",
    prompt:
      "Sortie discrète de chez elles/eux. Monologue interne — comédie ok, dignité optionnelle.",
    hint: "Chaussures, clés, aura.",
  },
  "nsfw-bar-close": {
    title: "Close last call",
    prompt:
      "Le bar ferme. Une heure de flirt. La phrase qui invite chez toi sans menacer.",
    hint: "Intention claire, delivery soft.",
  },
  "nsfw-dirty-joke": {
    title: "Double sens",
    prompt:
      "One-liner flirty innocent ou coquin selon qui lit.",
    hint: "Le doute raisonnable est un art.",
  },
  "nsfw-ex-text": {
    title: "Ex à 2h",
    prompt:
      "Ton ex envoie un pavé. Réponds en trois mots qui tuent avec max d’aura.",
    hint: "Court peut être létal.",
  },
  "nsfw-hotel": {
    title: "Énergie clé d’hôtel",
    prompt:
      "Week-end avec quelqu’un de nouveau. Les 10 premières minutes dans la chambre en slow-burn spicy (goût, pas porno).",
    hint: "Tension > check-list.",
  },
  "nsfw-jealousy": {
    title: "Jalousie soft",
    prompt:
      "Tu vois ta situationship rire avec quelqu’un d’autre. Monologue — petty, hot, self-aware.",
    hint: "Ressens, ne crash pas en public.",
  },
  "nsfw-voice-note-late": {
    title: "Vocal tardif",
    prompt:
      "Un peu pompette, iels veulent un vocal. Script flirty, un peu dangereux, toujours charmant.",
    hint: "Voix plus basse = enjeux plus hauts.",
  },
  "nsfw-rules": {
    title: "Règles de la maison",
    prompt:
      "Iels viennent. Message « house rules » playful qui pose le vibe de la nuit.",
    hint: "Consent + humour = peak aura.",
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
  "fit-date-night": {
    title: "约会夜战甲",
    prompt: "第一次线下面基。描述一套“好玩但不刻意”的穿搭。",
    hint: "一个有心机的细节胜过整个人设重做。",
  },
  "fit-rain": {
    title: "暴雨穿搭",
    prompt: "半路下暴雨。把你的穿搭改写成主角天气蒙太奇。",
    hint: "头发、外套、压力下的态度。",
  },
  "rizz-voice-note": {
    title: "语音混乱",
    prompt: "你误发了 47 秒语音。把前 15 秒整理成听起来依然很酷的样子。",
    hint: "自信地碎碎念也是技能。",
  },
  "rizz-pet": {
    title: "铲屎官撩感",
    prompt: "公园里别人的狗冲向你。开一句同时打动人和狗的话。",
    hint: "先狗后撩。",
  },
  "room-morning": {
    title: "金色时刻书桌",
    prompt: "晨光打进房间。把乱糟糟写成刻意布景。",
    hint: "灰尘光斑也是制作价值。",
  },
  "room-party": {
    title: "酒前布景",
    prompt: "朋友 20 分钟后到。叙述你疯狂给客厅做 glow-up。",
    hint: "藏、调暗、喷香、祈祷。",
  },
  "mc-commute": {
    title: "通勤电影感",
    prompt: "公交/地铁/车里是电影场景。写 8 分钟路程的旁白。",
    hint: "戴上耳机=第三人称模式。",
  },
  "mc-receipts": {
    title: "收据时代",
    prompt: "你不再好脾气。写一段冷静又杀伤力的收尾段落。",
    hint: "声音软，刀口利。",
  },
  "cap-gym": {
    title: "健身动态装",
    prompt: "你发了张中规中矩的健身房镜子照。写个不像人人都发的 caption。",
    hint: "自嘲 > 硬装。",
  },
  "cap-food": {
    title: "美食宣传",
    prompt: "给本月最好吃的一餐糊图写恋爱信级别的 caption。",
    hint: "感官细节赢。",
  },
  "rizz-coworker": {
    title: "职场撩",
    prompt: "App 上匹配到几乎同楼的人。写开场白化解尴尬。",
    hint: "好玩，别变 HR 案件。",
  },
  "mc-solo": {
    title: "单人桌气场",
    prompt: "你故意在好地方独自吃饭。写内心独白，让它传奇而不是落寞。",
    hint: "主动独处才是精英。",
  },
  "nsfw-thirst-trap": {
    title: "渴图文案",
    prompt: "你故意发了张很撩的镜子照。写既渴又不尴尬硬装的 caption。",
    hint: "暗示，别直球公告。",
  },
  "nsfw-situationship": {
    title: "暧昧审计",
    prompt: "凌晨 1:17。对方又发 “you up?”。回一句既设边界又留张力的话。",
    hint: "自重才性感。",
  },
  "nsfw-walk-of-fame": {
    title: "次日清晨独白",
    prompt: "你从对方住处悄悄离开。只写内心独白——允许喜剧，尊严可选。",
    hint: "鞋、钥匙、aura。",
  },
  "nsfw-bar-close": {
    title: "打烊收尾",
    prompt: "酒吧要关了。你们撩了一小时。甩出邀请回家却不吓人的那句。",
    hint: "意图清楚，语气柔。",
  },
  "nsfw-dirty-joke": {
    title: "双关",
    prompt: "写一句调情 one-liner，正经读也行、下流读也行。",
    hint: "可否认性是艺术。",
  },
  "nsfw-ex-text": {
    title: "凌晨两点前任",
    prompt: "前任发了长文。用三个字的回复以最大 aura 结束对话。",
    hint: "短也可以致命。",
  },
  "nsfw-hotel": {
    title: "酒店钥匙能量",
    prompt: "和新认识的人周末旅行。描述进屋前十分钟，像辣味慢燃戏（有品味，不是黄片）。",
    hint: "张力 > 清单。",
  },
  "nsfw-jealousy": {
    title: "软醋意",
    prompt: "你看到暧昧对象和别人大笑。内心独白——小气、撩、清醒。",
    hint: "可以感觉，别当众崩。",
  },
  "nsfw-voice-note-late": {
    title: "深夜语音",
    prompt: "你有点微醺，对方要语音。写你说什么——撩、一点危险、仍迷人。",
    hint: "声音越低，赌注越高。",
  },
  "nsfw-rules": {
    title: "家里规矩",
    prompt: "对方要来。发一条俏皮的“家里规矩”，定下夜晚氛围。",
    hint: "同意 + 幽默 = 满 aura。",
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
  "fit-date-night": {
    title: "Armadura date night",
    prompt:
      "Primera cita IRL. Describe el fit que diga “soy fun sin forzar”.",
    hint: "Un detalle intencional gana al rebrand total.",
  },
  "fit-rain": {
    title: "Fit bajo la lluvia",
    prompt:
      "Empieza a llover a mitad del walk. Reescribe tu fit como montaje climática main character.",
    hint: "Pelo, chaqueta, actitud bajo presión.",
  },
  "rizz-voice-note": {
    title: "Caos de nota de voz",
    prompt:
      "Mandaste una nota de 47s por error. Transcribe los primeros 15s como si aún fuera cool.",
    hint: "Divagar con confianza es skill.",
  },
  "rizz-pet": {
    title: "Rizz pet parent",
    prompt:
      "En el parque un perro corre hacia ti. Abre con una línea que impresione a humano y perro.",
    hint: "Perro primero, flirteo después.",
  },
  "room-morning": {
    title: "Escritorio golden hour",
    prompt:
      "La luz de la mañana pega en tu cuarto. Describe el desorden como set design a propósito.",
    hint: "El polvo cuenta como production value.",
  },
  "room-party": {
    title: "Staging pre-fiesta",
    prompt:
      "Amigos en 20 min. Narra tu glow-up frenético de la sala.",
    hint: "Esconder, bajar luces, spray, rezar.",
  },
  "mc-commute": {
    title: "Commute cinemático",
    prompt:
      "Tu bus/tren/auto es una escena de peli. Escribe la VO del viaje de 8 minutos.",
    hint: "Auriculares = modo tercera persona.",
  },
  "mc-receipts": {
    title: "Era de recibos",
    prompt:
      "Ya no eres nice. Escribe el párrafo calmado y devastador que cierra el capítulo.",
    hint: "Voz suave, filos afilados.",
  },
  "cap-gym": {
    title: "Flex de story gym",
    prompt:
      "Subiste un mirror gym mediocre. Caption para no sonar como todas las stories del gym.",
    hint: "Self-aware > try-hard.",
  },
  "cap-food": {
    title: "Propaganda foodie",
    prompt:
      "Caption una foto borrosa de la mejor comida del mes como carta de amor.",
    hint: "Gana lo sensorial.",
  },
  "rizz-coworker": {
    title: "Rizz profesional",
    prompt:
      "Matcheas con alguien y casi comparten edificio. Escribe el opener que maneje el awkward.",
    hint: "Playful, no caso de RR.HH.",
  },
  "mc-solo": {
    title: "Energía mesa solo",
    prompt:
      "Comes solo en un lugar lindo a propósito. Monólogo que lo haga icónico, no triste.",
    hint: "Soledad elegida es elite.",
  },
  "nsfw-thirst-trap": {
    title: "Caption thirst trap",
    prompt:
      "Subiste un mirror pic deliberadamente hot. Caption thirsty sin cringe try-hard.",
    hint: "Sugiere, no anuncies.",
  },
  "nsfw-situationship": {
    title: "Auditoría situationship",
    prompt:
      "1:17 AM. Otra vez “you up?”. Responde poniendo límite y manteniendo tensión.",
    hint: "El auto-respeto es sexy.",
  },
  "nsfw-walk-of-fame": {
    title: "Monólogo morning after",
    prompt:
      "Sales en silencio de su depto. Solo monólogo interno — comedia ok, dignidad opcional.",
    hint: "Zapatos, llaves, aura.",
  },
  "nsfw-bar-close": {
    title: "Close de last call",
    prompt:
      "El bar cierra. Una hora de flirteo. La línea que invita a casa sin amenazar.",
    hint: "Intención clara, delivery suave.",
  },
  "nsfw-dirty-joke": {
    title: "Doble sentido",
    prompt:
      "One-liner flirty que suene inocente o sucio según quién lea.",
    hint: "La negación plausible es un arte.",
  },
  "nsfw-ex-text": {
    title: "Ex a las 2AM",
    prompt:
      "Tu ex manda un párrafo. Responde en tres palabras que cierren con máximo aura.",
    hint: "Corto puede ser letal.",
  },
  "nsfw-hotel": {
    title: "Energía llave de hotel",
    prompt:
      "Fin de semana con alguien nuevo. Describe los primeros diez minutos en la habitación como slow-burn spicy (con gusto, no porno).",
    hint: "Tensión > checklist.",
  },
  "nsfw-jealousy": {
    title: "Celos soft",
    prompt:
      "Ves a tu situationship reír con otra persona. Monólogo — petty, hot, self-aware.",
    hint: "Siéntelo, no crashees en público.",
  },
  "nsfw-voice-note-late": {
    title: "Nota de voz nocturna",
    prompt:
      "Estás un poco tomado y piden nota de voz. Script flirty, un poco peligroso, aún encantador.",
    hint: "Voz más baja = apuestas más altas.",
  },
  "nsfw-rules": {
    title: "Reglas de la casa",
    prompt:
      "Vienen a tu casa. Manda las “house rules” juguetonas que marquen el vibe de la noche.",
    hint: "Consentimiento + humor = peak aura.",
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
    "after-dark": "after-dark · 18+",
  },
  de: {
    "fit-check": "Fit-Check",
    rizz: "Rizz",
    "room-vibe": "Room-Vibe",
    "main-character": "Main Character",
    caption: "Caption",
    "after-dark": "After Dark · 18+",
  },
  fr: {
    "fit-check": "fit-check",
    rizz: "rizz",
    "room-vibe": "room-vibe",
    "main-character": "main character",
    caption: "caption",
    "after-dark": "after-dark · 18+",
  },
  zh: {
    "fit-check": "穿搭",
    rizz: "撩感",
    "room-vibe": "房间氛围",
    "main-character": "主角感",
    caption: "文案",
    "after-dark": "深夜向 · 18+",
  },
  es: {
    "fit-check": "fit-check",
    rizz: "rizz",
    "room-vibe": "room-vibe",
    "main-character": "main character",
    caption: "caption",
    "after-dark": "after-dark · 18+",
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
