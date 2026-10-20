// Türkçe (tr) strings of the coach feature. Keys are the English source texts.
import { tr2 } from "./tr-2";

export const tr: Record<string, string> = {
  "{done} of {total} analyses on parser {v} · {pending} pending · {failed} failed":
    "Parser {v} ile {total} analizin {done} tanesi · {pending} bekliyor · {failed} başarısız",
  "#{r} of {n}": "{n} içinde #{r}",
  "A player": "Bir oyuncu",
  "Admins are never charged.": "Yöneticilerden asla ücret alınmaz.",
  "AI quality": "AI kalitesi",
  "Analyses on the current parser": "Güncel parser'daki analizler",
  "Analyze my new demos automatically": "Yeni demolarımı otomatik analiz et",
  "Automatic reviews are off.": "Otomatik analizler kapalı.",
  "Automatic reviews are on.": "Otomatik analizler açık.",
  "Automatic reviews": "Otomatik analizler",
  "Average latency": "Ortalama gecikme",
  Average: "Ortalama",
  "Back to my review": "Analizime dön",
  "Claims the match facts don't support are corrected or dropped. Uses the “Claim verifier” AI assignment.":
    "Maç verilerinin desteklemediği ifadeler düzeltilir ya da kaldırılır. “İfade doğrulayıcı” AI atamasını kullanır.",
  Cost: "Ücret",
  "Each automatic review uses credits. If you don't have enough, it is skipped and the match shows “Not enough credits”. Demos you're not in are never reviewed.":
    "Her otomatik analiz kredi kullanır. Yeterli kredin yoksa atlanır ve maçta “Yetersiz kredi” görünür. İçinde olmadığın demolar asla analiz edilmez.",
  "Every player's role": "Her oyuncunun rolü",
  "Grounded claims": "Dayanaklı ifadeler",
  "How players rate each prompt version, and the latest automated check of grounding, language and cost.":
    "Oyuncuların her prompt sürümünü nasıl puanladığı ve dayanak, dil ve maliyetin son otomatik kontrolü.",
  "Key rounds": "Kilit rauntlar",
  "Latest eval": "Son değerlendirme",
  "Match integrity": "Maç dürüstlüğü",
  Prompt: "Prompt",
  Purpose: "Kullanım",
  Rated: "Puanlanan",
  Ratings: "Puanlar",
  "Rejected by the verifier": "Doğrulayıcının reddettiği",
  "Report in game via the scoreboard.": "Oyun içinde skor tablosundan raporla.",
  "Right language": "Doğru dil",
  "Round {n}: {title}": "Raunt {n}: {title}",
  Runs: "Çalıştırma",
  "Statistically unusual aim": "İstatistiksel olarak alışılmadık aim",
  "Statistically unusual player. This death doesn't count against you":
    "İstatistiksel olarak alışılmadık oyuncu. Bu ölüm aleyhine sayılmaz",
  "Team patterns": "Takım kalıpları",
  "Team plan for the next match": "Bir sonraki maç için takım planı",
  "Team review cost": "Takım analizi ücreti",
  "Team scores vs the enemy team": "Rakip takıma göre takım puanları",
  Teammate: "Takım arkadaşı",
  "The team review could not be finished.": "Takım analizi tamamlanamadı.",
  "This is a statistical signal, not proof. Deaths to these players aren't counted against you.":
    "Bu bir istatistiksel sinyal, kanıt değil. Bu oyunculara karşı ölümler aleyhine sayılmaz.",
  "To fix": "Düzeltilecek",
  Variant: "Varyant",
  "Verify every review's claims with a second AI pass":
    "Her analizin ifadelerini ikinci bir AI geçişiyle doğrula",
  "What to do instead": "Bunun yerine ne yapmalı",
  "When a demo of yours finishes processing, the AI Coach reviews it right away.":
    "Bir demon işlendiğinde AI Koç onu hemen analiz eder.",
  "Whole team": "Tüm takım",
  "You {v} · lobby {m} · best {b}": "Sen {v} · lobi {m} · en iyi {b}",
  "You vs the lobby": "Sen ve lobi",
  "Your place among the {n} players of this match (1 = best).":
    "Bu maçtaki {n} oyuncu arasında sıran (1 = en iyi).",
  "Your team, reviewed": "Takımın analiz edildi",
  "{k} very fast snaps landing exactly on the head (in {n} fights)":
    "Tam kafaya inen {k} çok hızlı flick ({n} çatışmada)",
  "Headshot rate far above the rest of the lobby ({n} kills)":
    "Lobinin geri kalanının çok üstünde headshot oranı ({n} kill)",
  "Unusually many head hits per shot ({n} shots)":
    "Atış başına alışılmadık derecede çok kafa isabeti ({n} atış)",
  "Hit back in {ms} ms on average after being shot ({n} times)":
    "Vurulduktan sonra ortalama {ms} ms içinde karşılık verdi ({n} kez)",
  "{pct}% of kills through smoke or walls ({n} kills)":
    "Kill'lerin %{pct} kadarı smoke ya da duvar arkasından ({n} kill)",
  "Statistically unusual play": "İstatistiksel olarak alışılmadık oyun",
  "Account banned by VAC {d} days after this match":
    "Hesap bu maçtan {d} gün sonra VAC banı yedi",
  "Account received a game ban {d} days after this match":
    "Hesap bu maçtan {d} gün sonra oyun banı aldı",
  "Account banned by VAC after this match":
    "Hesap bu maçtan sonra VAC banı yedi",
  "Account received a game ban after this match":
    "Hesap bu maçtan sonra oyun banı aldı",
  Entry: "Entry",
  Support: "Destek",
  Lurker: "Lurker",
  AWPer: "AWPer",
  Anchor: "Çapa",
  Flex: "Flex",
  Openings: "Açılışlar",
  "Converting advantages": "Avantajı kazanca çevirme",
  "Run Team review": "Takım analizini başlat",
  "Five players, one game plan": "Beş oyuncu, tek oyun planı",
  "Your whole team, reviewed like an IGL would":
    "Tüm takımın, bir IGL'in yapacağı gibi analiz edildi",
  "Team scores: trading, utility, openings, economy, conversion":
    "Takım puanları: trade, utility, açılışlar, ekonomi, kazanca çevirme",
  "Each player's role with strengths and fixes":
    "Güçlü yanları ve düzeltmeleriyle her oyuncunun rolü",
  "Key rounds with 2D clips": "2D klipli kilit rauntlar",
  "A team plan with who does what":
    "Kimin ne yapacağını gösteren bir takım planı",
  New: "Yeni",
  "Claim verifier": "İfade doğrulayıcı",
  "Team review: the IGL view of a whole team. A strong model with a large context.":
    "Takım analizi: tüm takıma IGL gözüyle bakış. Geniş bağlamlı güçlü bir model.",
  "Double-checks every claim of a review against the match facts. A fast, cheap model is enough.":
    "Bir analizdeki her ifadeyi maç verileriyle tekrar kontrol eder. Hızlı ve ucuz bir model yeterli.",
  "Credits per Team review (Pro pays one less).":
    "Takım analizi başına kredi (Pro bir eksik öder).",
  "{traded} of {deaths} traded":
    "{deaths} ölümden {traded} tanesi trade edildi",
  "nearest teammate about {m} m away on average":
    "en yakın takım arkadaşı ortalama yaklaşık {m} m uzakta",
  "{n, plural, one {# death} other {# deaths}} in a crossfire":
    "çapraz ateşte {n} ölüm",
  "{nade} into {place}": "{place} içine {nade}",
  "{nade} at {place}": "{place} noktasında {nade}",
  "Round {round}: blinded {n, plural, one {# enemy} other {# enemies}} for {s} s.":
    "Raunt {round}: {n} rakibi {s} sn kör etti.",
  "Round {round}: {damage} damage.": "Raunt {round}: {damage} hasar.",
  "The lobby threw it here {n, plural, one {once} other {# times}}; you died here {d, plural, one {once} other {# times}}.":
    "Lobi burayı {n} kez attı; sen burada {d} kez öldün.",
  "Thrown from {place}.": "{place} noktasından atıldı.",
  "Multi-kill": "Multi-kill",
  "You got two or more kills this round.":
    "Bu rauntta iki ya da daha fazla kill aldın.",
  "Clutch won": "Kazanılan clutch",
  "You were the last one alive and won the round.":
    "Hayatta kalan son kişiydin ve rauntu kazandın.",
  "You got the first kill of the round.": "Rauntun ilk kill'ini aldın.",
  "First death": "İlk ölüm",
  "You were the first player to die this round.":
    "Bu rauntta ölen ilk oyuncu sendin.",
  "Untraded death": "Trade edilmeyen ölüm",
  "No teammate killed your killer within 5 seconds.":
    "Hiçbir takım arkadaşın seni öldüreni 5 saniye içinde öldürmedi.",
  "Early death": "Erken ölüm",
  "You died in the first 20 seconds of the round.":
    "Rauntun ilk 20 saniyesinde öldün.",
  "You died without damaging an enemy.": "Hiçbir rakibe hasar vermeden öldün.",
  "Unused utility": "Kullanılmayan utility",
  "You died with two or more grenades still in your inventory.":
    "Envanterinde iki ya da daha fazla bomba varken öldün.",
  "Pistol round": "Tabanca raundu",
  "Force buy": "Force buy",
  "Buy type": "Satın alma türü",
  "Enemies blinded per flash": "Flash başına kör edilen rakip",
  "Team-flash rate": "Takım arkadaşını kör etme oranı",
  "{n, plural, one {# kill} other {# kills}}": "{n} kill",
  "opening duel": "açılış düellosu",
  untraded: "trade edilmedi",
  "at {place}": "{place} noktasında",
  "Crosshair already on the enemy in {n} of {total} duels":
    "{total} düellonun {n} tanesinde crosshair zaten rakipteydi",
  "{place}: crosshair off target in {n} of {total} duels":
    "{place}: {total} düellonun {n} tanesinde crosshair hedef dışında",
  "Where your crosshair was when each duel started":
    "Her düello başladığında crosshair'in neredeydi",
  "Duel won": "Düello kazanıldı",
  "Duel lost": "Düello kaybedildi",
  "No winner": "Kazanan yok",
  "Your crosshair tends to sit too high, above the head.":
    "Crosshair'in genelde fazla yüksekte, kafanın üstünde duruyor.",
  "Lower it a touch: aim where heads appear, not over them.":
    "Biraz indir: kafaların çıktığı yere nişan al, üstüne değil.",
  "Your crosshair usually sits at head height.":
    "Crosshair'in genelde kafa hizasında duruyor.",
  "Good height. Keep it there while you move.":
    "İyi yükseklik. Hareket ederken de böyle tut.",
  "Your crosshair tends to sit a little low: around neck height.":
    "Crosshair'in genelde biraz alçakta: boyun hizasında.",
  "Raise it slightly so the first bullet goes to the head.":
    "İlk mermi kafaya gitsin diye biraz yükselt.",
  "Your crosshair tends to sit low: around chest height.":
    "Crosshair'in genelde alçakta: göğüs hizasında.",
  "Raise it to head height before you peek.":
    "Peek atmadan önce kafa hizasına kaldır.",
  "Your crosshair tends to sit very low: around stomach height.":
    "Crosshair'in genelde çok alçakta: karın hizasında.",
  "Raise it to head height before you peek; check it every time you stop.":
    "Peek atmadan önce kafa hizasına kaldır; her durduğunda kontrol et.",
  "Your crosshair tends to sit very low: around the legs.":
    "Crosshair'in genelde çok alçakta: bacak hizasında.",
  "It also tends to be to the left of where enemies appear: check the other side of the angle first.":
    "Ayrıca rakiplerin çıktığı yerin soluna kayıyor: önce açının diğer tarafını kontrol et.",
  "It also tends to be to the right of where enemies appear: check the other side of the angle first.":
    "Ayrıca rakiplerin çıktığı yerin sağına kayıyor: önce açının diğer tarafını kontrol et.",
  "On target": "Hedefte",
  "Your crosshair was already on the enemy.": "Crosshair'in zaten rakipteydi.",
  Near: "Yakın",
  "One small adjustment away.": "Küçük bir düzeltme yeterdi.",
  "Big flick": "Büyük flick",
  "You needed a big flick.": "Büyük bir flick gerekti.",
  "Duels with the crosshair already on the enemy":
    "Crosshair'in zaten rakipte olduğu düellolar",
  "Crosshair already on the enemy": "Crosshair zaten rakipte",
  Strength: "Güçlü yan",
  "To improve": "Geliştirilecek",
  "Your AI coach": "AI koçun",
  "Pick a match and a player. The coach reviews every round and shows you the moments that matter in 2D replay.":
    "Bir maç ve bir oyuncu seç. Koç her rauntu inceler ve önemli anları 2D tekrarla gösterir.",
  "Choose a match": "Bir maç seç",
  "No analyzed matches yet": "Henüz analiz edilmiş maç yok",
  "Upload a demo and come back: the coach needs a match to review.":
    "Bir demo yükle ve geri gel: koçun analiz edecek bir maça ihtiyacı var.",
  Change: "Değiştir",
  "Change match": "Maçı değiştir",
  "Choose the player": "Oyuncuyu seç",
  "Who should the coach review?": "Koç kimi analiz etsin?",
  "Started as CT": "CT olarak başladı",
  "Started as T": "T olarak başladı",
  Match: "Maç",
  Review: "Analiz",
  Steps: "Adımlar",
  Reviewed: "Analiz edildi",
  "Choose the player to review": "Analiz edilecek oyuncuyu seç",
  "The coach is offline right now": "Koç şu anda çevrimdışı",
  "The review could not be finished.": "Analiz tamamlanamadı.",
  "Please try again later.": "Lütfen daha sonra tekrar dene.",
  "Reading {n} events…": "{n} olay okunuyor…",
  "Tracking your crosshair…": "Crosshair'in takip ediliyor…",
  "Mapping every duel you took…": "Girdiğin her düello işaretleniyor…",
  "Checking who traded whom…": "Kimin kimi trade ettiği kontrol ediliyor…",
  "Counting your utility…": "Utility'lerin sayılıyor…",
  "Calling the IGL…": "IGL çağrılıyor…",
  "Comparing you with the lobby…": "Lobiyle karşılaştırılıyorsun…",
  "Checking every claim against the demo…":
    "Her ifade demoyla kontrol ediliyor…",
  "Writing your plan for the next match…":
    "Bir sonraki maç için planın yazılıyor…",
  "{coach} is reviewing {name}": "{coach}, {name} oyuncusunu analiz ediyor",
  "A real review takes 10 to 60 seconds. Keep this tab open.":
    "Gerçek bir analiz 10 ile 60 saniye sürer. Bu sekmeyi açık tut.",
  "Your match, reviewed": "Maçın analiz edildi",
  "Saved review from {date}": "{date} tarihli kayıtlı analiz",
  "Overall score {n} of 100": "Genel puan 100 üzerinden {n}",
  Overall: "Genel",
  "Your scores vs the lobby": "Lobiye göre puanların",
  "Lobby average": "Lobi ortalaması",
  "Key moments": "Kilit anlar",
  Priorities: "Öncelikler",
  "The coach found nothing it could back with evidence for this player.":
    "Koç bu oyuncu için kanıtla destekleyebileceği bir şey bulamadı.",
  Drills: "Çalışmalar",
  "Ask again": "Yeniden sor",
  "Open match analysis": "Maç analizini aç",
  "Watch clip": "Klibi izle",
  Highlight: "Öne çıkan an",
  Mistake: "Hata",
  Instead: "Bunun yerine",
  "About {n} minutes in total": "Toplam yaklaşık {n} dakika",
  "{done} of {n} done": "{n} adımdan {done} tanesi bitti",
  "{n} min": "{n} dk",
  Goal: "Hedef",
  "Get {name}'s full review": "{name} için tam analizi al",
  "Scores against the lobby, key moments as 2D replays, drills and a plan for your next match.":
    "Lobiye göre puanlar, 2D tekrar olarak kilit anlar, çalışmalar ve bir sonraki maçın için bir plan.",
  "Open in the coach": "Koçta aç",
  Players: "Oyuncular",
  "Evidence: rounds {rounds}": "Kanıt: rauntlar {rounds}",
  "Evidence: {n} metric(s)": "Kanıt: {n} metrik",
  "Keep doing": "Böyle devam",
  "Limits of this review": "Bu analizin sınırları",
  Practice: "Antrenman",
  "Review for {name}": "{name} için analiz",
  "Plan for your next match": "Bir sonraki maçın için plan",
  "Saved to your progress.": "İlerlemene kaydedildi.",
  "A Deep review uses a stronger AI and can take a few minutes. Keep this tab open.":
    "Deep analiz daha güçlü bir AI kullanır ve birkaç dakika sürebilir. Bu sekmeyi açık tut.",
  ...tr2,
};
