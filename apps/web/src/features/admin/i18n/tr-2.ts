// Türkçe (tr) strings of the admin feature, part 2.
export const tr2: Record<string, string> = {
  "Each purpose runs on its own model. Unassigned purposes fall back: Deep review and Monthly report use Quick review, Personal Coach uses Deep review, then the .env defaults.":
    "Her kullanım kendi modelinde çalışır. Atanmamış kullanımlar yedeğe düşer: Deep analiz ve aylık rapor Quick analizi, Personal Coach Deep analizi, sonra .env varsayılanlarını kullanır.",
  "Search {n} models": "{n} model içinde ara",
  "Reload the model list": "Model listesini yeniden yükle",
  "Loading this provider's models…": "Bu sağlayıcının modelleri yükleniyor…",
  "This provider doesn't list “{model}”. Pick one from the list.":
    "Bu sağlayıcı “{model}” modelini listelemiyor. Listeden birini seç.",
  "Type the model id manually.": "Model kimliğini elle yaz.",
  "This provider has no model list. Type the model id manually.":
    "Bu sağlayıcının model listesi yok. Model kimliğini elle yaz.",
  "≈ {cost} per call at list price": "Liste fiyatıyla çağrı başına ≈ {cost}",
  "Price not published by this provider.": "Bu sağlayıcı fiyat yayınlamıyor.",
  "Answered in {ms} ms": "{ms} ms içinde yanıtladı",
  "Saved: {model} · {date}": "Kaydedildi: {model} · {date}",
  "Not assigned": "Atanmadı",
  "Save {purpose}": "{purpose} kaydet",
  "Same as Quick review": "Quick analizle aynı",
  "Same as Deep review": "Deep analizle aynı",
  Assigned: "Atandı",
  "Uses {purpose}": "{purpose} kullanır",
  "Falls back to .env": ".env'ye düşer",
  "Not configured": "Yapılandırılmadı",
  "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.":
    "Bir oyuncunun tüm maçlarından Personal Coach planları (Pro). En güçlü uzun bağlamlı modelin.",
  "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.":
    'Ek gövdeyi provider.data_collection = "deny" ile önceden doldurduk: böylece OpenRouter yalnızca prompt\'larını (oyuncuların maç verileri) saklamayan ve onlarla eğitim yapmayan sağlayıcılara yönlendirir. Bunu kabul ediyorsan kaldır.',
  "{n}k context": "{n}k bağlam",
  "no structured outputs": "yapılandırılmış çıktı yok",
  Integrations: "Entegrasyonlar",
  "Changes apply immediately and are stored encrypted in the database. No restart needed.":
    "Değişiklikler hemen uygulanır ve veritabanında şifreli saklanır. Yeniden başlatma gerekmez.",
  "Configured · Database": "Yapılandırıldı · Veritabanı",
  "From .env (read-only bootstrap)": ".env'den (salt okunur başlangıç)",
  "Testing…": "Test ediliyor…",
  Connected: "Bağlandı",
  "{ms} ms": "{ms} ms",
  "Live mode": "Canlı mod",
  "Test mode": "Test modu",
  "The test failed.": "Test başarısız oldu.",
  "Steam Web API": "Steam Web API",
  "Profiles, avatars and the account checks behind welcome credits.":
    "Profiller, avatarlar ve hoş geldin kredilerinin arkasındaki hesap kontrolleri.",
  "Create a key on the Steam developer page (signed in with the account that owns this site):":
    "Steam geliştirici sayfasında bir anahtar oluştur (bu sitenin sahibi olan hesapla giriş yaparak):",
  "Web API key": "Web API anahtarı",
  "Remove the stored Steam key?": "Kayıtlı Steam anahtarı kaldırılsın mı?",
  Stripe: "Stripe",
  "Plan subscriptions and credit pack checkout.":
    "Plan abonelikleri ve kredi paketi satın alımı.",
  "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.":
    "Anahtarlar: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, sonra signing secret'ını kopyala.",
  "Webhook URL": "Webhook URL'si",
  "Secret key": "Gizli anahtar",
  "Remove the stored Stripe secret key?":
    "Kayıtlı Stripe gizli anahtarı kaldırılsın mı?",
  "Webhook signing secret": "Webhook imza anahtarı",
  "Remove the stored webhook secret?":
    "Kayıtlı webhook anahtarı kaldırılsın mı?",
  "Publishable key (public)": "Yayınlanabilir anahtar (herkese açık)",
  "Accept payments": "Ödeme kabul et",
  "When off, checkout buttons show “Coming soon”.":
    "Kapalıyken ödeme düğmeleri “Yakında” gösterir.",
  "Add the secret key first.": "Önce gizli anahtarı ekle.",
  "Add key": "Anahtar ekle",
  "Save key": "Anahtarı kaydet",
  Copy: "Kopyala",
  Copied: "Kopyalandı",
  Save: "Kaydet",
  "Enter a value.": "Bir değer gir.",
  "Keys never contain spaces.": "Anahtarlar asla boşluk içermez.",
  "A Steam Web API key is 32 hexadecimal characters.":
    "Steam Web API anahtarı 32 onaltılık karakterdir.",
  "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).":
    "Stripe gizli anahtarları sk_live_, sk_test_ ile (kısıtlı anahtarlarda rk_ ile) başlar.",
  "Stripe webhook secrets start with whsec_.":
    "Stripe webhook anahtarları whsec_ ile başlar.",
  "Publishable keys start with pk_live_ or pk_test_.":
    "Yayınlanabilir anahtarlar pk_live_ ya da pk_test_ ile başlar.",
  "Steam key saved.": "Steam anahtarı kaydedildi.",
  "Steam key removed.": "Steam anahtarı kaldırıldı.",
  "Stripe secret key saved.": "Stripe gizli anahtarı kaydedildi.",
  "Stripe secret key removed.": "Stripe gizli anahtarı kaldırıldı.",
  "Webhook secret saved.": "Webhook anahtarı kaydedildi.",
  "Webhook secret removed.": "Webhook anahtarı kaldırıldı.",
  "Publishable key saved.": "Yayınlanabilir anahtar kaydedildi.",
  "Payments enabled.": "Ödemeler açıldı.",
  "Payments disabled.": "Ödemeler kapatıldı.",
  Product: "Ürün",
  "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.":
    "Günlük sınırlar ve aylık raporlar için saat dilimi, Personal Coach sıklığı ve yükleme boyutu.",
  "Time zone": "Saat dilimi",
  "Days and months start at midnight in this zone.":
    "Günler ve aylar bu dilimde gece yarısı başlar.",
  "Not available on this server yet.": "Bu sunucuda henüz yok.",
  "Personal Coach: days between new plans":
    "Personal Coach: yeni planlar arası gün",
  "Personal Coach: new matches for a rewrite":
    "Personal Coach: yeniden yazım için yeni maç",
  "Demo upload limit (MB)": "Demo yükleme sınırı (MB)",
  "A player can ask for a new plan after this many days.":
    "Oyuncu bu kadar gün sonra yeni plan isteyebilir.",
  "…or sooner after this many new matches (also the automatic rewrite).":
    "…ya da bu kadar yeni maçtan sonra daha erken (otomatik yeniden yazım için de geçerli).",
  "Default 500 MB. The web proxy streams uploads up to this size.":
    "Varsayılan 500 MB. Web proxy bu boyuta kadar yüklemeleri iletir.",
  "Between 1 and 90 days.": "1 ile 90 gün arası.",
  "Between 1 and 50 matches.": "1 ile 50 maç arası.",
  "Between 1 and 1024 MB.": "1 ile 1024 MB arası.",
};
