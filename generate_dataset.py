import json
import random

# ─── Locations ───────────────────────────────────────────────────────────────
VENUES = [
    # Kafeler
    {"name": "Mandabatmaz", "category": "Kafe", "coordinates": [28.9740, 41.0338]},
    {"name": "Kronotrop Karaköy", "category": "Kafe", "coordinates": [28.9745, 41.0233]},
    {"name": "Walter's Coffee Roastery", "category": "Kafe", "coordinates": [28.9803, 41.0295]},
    {"name": "Paper Coffee Nişantaşı", "category": "Kafe", "coordinates": [28.9980, 41.0480]},
    {"name": "Hafız Mustafa 1864 Kapalıçarşı", "category": "Kafe", "coordinates": [28.9680, 41.0130]},
    {"name": "Petra Roasting Co.", "category": "Kafe", "coordinates": [28.9741, 41.0339]},
    {"name": "MOC Coffee Beyoğlu", "category": "Kafe", "coordinates": [28.9776, 41.0340]},
    {"name": "Brew Lab Kadıköy", "category": "Kafe", "coordinates": [29.0210, 40.9900]},
    {"name": "Boğaziçi Kafe Bebek", "category": "Kafe", "coordinates": [29.0430, 41.0780]},
    {"name": "Kahve Dünyası Taksim", "category": "Kafe", "coordinates": [28.9787, 41.0369]},
    {"name": "Moda Sahili Kafe", "category": "Kafe", "coordinates": [29.0270, 40.9860]},
    {"name": "Karaköy Güllüoğlu Kafe", "category": "Kafe", "coordinates": [28.9738, 41.0231]},
    {"name": "Cihangir Bohemian Kafe", "category": "Kafe", "coordinates": [28.9840, 41.0310]},
    {"name": "Ortaköy Taş Fırın Kafe", "category": "Kafe", "coordinates": [29.0280, 41.0580]},
    {"name": "Arnavutköy Sahil Kafe", "category": "Kafe", "coordinates": [29.0370, 41.0680]},
    # Restoranlar
    {"name": "Çiya Sofrası Kadıköy", "category": "Restoran", "coordinates": [29.0220, 40.9910]},
    {"name": "Karaköy Lokantası", "category": "Restoran", "coordinates": [28.9731, 41.0228]},
    {"name": "Beyoğlu Balıkçısı", "category": "Restoran", "coordinates": [28.9752, 41.0347]},
    {"name": "Pandeli Mısır Çarşısı", "category": "Restoran", "coordinates": [28.9700, 41.0168]},
    {"name": "Asitane Balat", "category": "Restoran", "coordinates": [28.9450, 41.0310]},
    {"name": "Hamdi Restaurant Eminönü", "category": "Restoran", "coordinates": [28.9702, 41.0190]},
    {"name": "Mikla Pera Palace", "category": "Restoran", "coordinates": [28.9775, 41.0360]},
    {"name": "Neolokal Salt Galata", "category": "Restoran", "coordinates": [28.9728, 41.0233]},
    {"name": "Zübeyir Ocakbaşı Beşiktaş", "category": "Restoran", "coordinates": [29.0058, 41.0420]},
    {"name": "Tarihi Sultanahmet Köftecisi", "category": "Restoran", "coordinates": [28.9760, 41.0057]},
    {"name": "Reina Ortaköy", "category": "Restoran", "coordinates": [29.0290, 41.0580]},
    {"name": "Kıyı Restaurant Tarabya", "category": "Restoran", "coordinates": [29.0615, 41.1250]},
    # Kitabevleri
    {"name": "Robinson Crusoe 389 İstiklal", "category": "Kitabevi", "coordinates": [28.9779, 41.0339]},
    {"name": "Pandora Kitabevi Beyoğlu", "category": "Kitabevi", "coordinates": [28.9776, 41.0338]},
    {"name": "Homer Kitabevi Beyoğlu", "category": "Kitabevi", "coordinates": [28.9780, 41.0336]},
    {"name": "Remzi Kitabevi Kanyon", "category": "Kitabevi", "coordinates": [28.9986, 41.0790]},
    {"name": "D&R Cevahir AVM", "category": "Kitabevi", "coordinates": [28.9868, 41.0610]},
    {"name": "Babil Kitabevi Kadıköy", "category": "Kitabevi", "coordinates": [29.0228, 40.9905]},
    {"name": "Denizler Kitabevi Sahaflar", "category": "Kitabevi", "coordinates": [28.9675, 41.0128]},
    # Galeriler & Müzeler
    {"name": "İstanbul Modern Karaköy", "category": "Galeri", "coordinates": [28.9730, 41.0239]},
    {"name": "Salt Galata", "category": "Galeri", "coordinates": [28.9726, 41.0237]},
    {"name": "Pera Müzesi Tepebaşı", "category": "Galeri", "coordinates": [28.9761, 41.0324]},
    {"name": "Pilot Galeri Beyoğlu", "category": "Galeri", "coordinates": [28.9768, 41.0331]},
    {"name": "Anna Laudel Gallery Karaköy", "category": "Galeri", "coordinates": [28.9740, 41.0240]},
    {"name": "Türk ve İslam Eserleri Müzesi", "category": "Müze", "coordinates": [28.9763, 41.0069]},
    {"name": "Topkapı Sarayı Müzesi", "category": "Müze", "coordinates": [28.9834, 41.0115]},
    {"name": "Dolmabahçe Sarayı", "category": "Müze", "coordinates": [29.0000, 41.0393]},
    {"name": "Sakıp Sabancı Müzesi Emirgan", "category": "Müze", "coordinates": [29.0553, 41.1005]},
    # Kütüphaneler
    {"name": "Beyazıt Devlet Kütüphanesi", "category": "Kütüphane", "coordinates": [28.9665, 41.0130]},
    {"name": "Atatürk Kitaplığı Taksim", "category": "Kütüphane", "coordinates": [28.9803, 41.0385]},
    {"name": "Milli Kütüphane Bağcılar", "category": "Kütüphane", "coordinates": [28.8630, 41.0380]},
    {"name": "İBB Kütüphanesi Kadıköy", "category": "Kütüphane", "coordinates": [29.0218, 40.9898]},
    {"name": "Moda Sahili Kütüphanesi", "category": "Kütüphane", "coordinates": [29.0268, 40.9858]},
    {"name": "Rami Kütüphanesi", "category": "Kütüphane", "coordinates": [28.8750, 41.0410]},
    # Parklar & Açık Alanlar
    {"name": "Gezi Parkı Taksim", "category": "Park", "coordinates": [28.9785, 41.0381]},
    {"name": "Emirgan Korusu", "category": "Park", "coordinates": [29.0543, 41.1000]},
    {"name": "Yıldız Parkı Beşiktaş", "category": "Park", "coordinates": [29.0145, 41.0502]},
    {"name": "Fenerbahçe Parkı", "category": "Park", "coordinates": [29.0408, 40.9695]},
    {"name": "Maçka Demokrasi Parkı", "category": "Park", "coordinates": [28.9988, 41.0458]},
    {"name": "Büyükada Milli Parkı", "category": "Park", "coordinates": [29.1249, 40.8736]},
    {"name": "Polonezköy Tabiat Parkı", "category": "Park", "coordinates": [29.2120, 41.1530]},
    # Meydanlar & Semtler
    {"name": "Taksim Meydanı", "category": "Meydan", "coordinates": [28.9787, 41.0369]},
    {"name": "Beyazıt Meydanı", "category": "Meydan", "coordinates": [28.9665, 41.0130]},
    {"name": "Kadıköy Çarşı", "category": "Meydan", "coordinates": [29.0218, 40.9903]},
    {"name": "Kapalıçarşı Merkez", "category": "Meydan", "coordinates": [28.9680, 41.0106]},
    {"name": "Galata Meydanı", "category": "Meydan", "coordinates": [28.9739, 41.0258]},
    {"name": "Eminönü Meydanı", "category": "Meydan", "coordinates": [28.9702, 41.0178]},
    # Barlar & Gece Hayatı
    {"name": "Leb-i Derya Cihangir", "category": "Bar", "coordinates": [28.9830, 41.0318]},
    {"name": "360 İstanbul Beyoğlu", "category": "Bar", "coordinates": [28.9778, 41.0343]},
    {"name": "Nardis Jazz Club Galata", "category": "Bar", "coordinates": [28.9741, 41.0262]},
    {"name": "Jolly Joker Babylon", "category": "Bar", "coordinates": [28.9795, 41.0350]},
    {"name": "Kadıköy Bariyer Bar", "category": "Bar", "coordinates": [29.0215, 40.9895]},
    {"name": "Sortie Kuruçeşme", "category": "Bar", "coordinates": [29.0338, 41.0695]},
    # Alışveriş Merkezleri
    {"name": "Kanyon AVM Levent", "category": "AVM", "coordinates": [28.9988, 41.0795]},
    {"name": "Zorlu Center Zincirlikuyu", "category": "AVM", "coordinates": [28.9975, 41.0713]},
    {"name": "İstinyePark AVM", "category": "AVM", "coordinates": [29.0618, 41.1103]},
    {"name": "Cevahir AVM Şişli", "category": "AVM", "coordinates": [28.9875, 41.0610]},
    {"name": "Capitol AVM Kadıköy", "category": "AVM", "coordinates": [29.0315, 40.9883]},
    # Tarihi Yapılar
    {"name": "Ayasofya Camii", "category": "Tarihi", "coordinates": [28.9800, 41.0086]},
    {"name": "Sultanahmet Camii", "category": "Tarihi", "coordinates": [28.9763, 41.0054]},
    {"name": "Galata Kulesi", "category": "Tarihi", "coordinates": [28.9739, 41.0258]},
    {"name": "Kız Kulesi Üsküdar", "category": "Tarihi", "coordinates": [29.0042, 41.0212]},
    {"name": "Boğaz Köprüsü", "category": "Tarihi", "coordinates": [29.0396, 41.0462]},
    {"name": "Rumeli Hisarı", "category": "Tarihi", "coordinates": [29.0590, 41.0866]},
    {"name": "Yedikule Hisarları", "category": "Tarihi", "coordinates": [28.9203, 40.9977]},
]

# ─── Factions (status references only) ───────────────────────────────────────
FACTIONS = ["Red Reapers", "Blue Sentinels", "Green Guardians"]

COMMANDERS = [
    "NEXUS-ALPHA", "PHANTOM-X", "BLOOD-CIPHER", "NOVA-REAPER", "IRON-FANG", "SCARLET-PROTOCOL",
    "SENTINEL-PRIME", "GHOST-PROTOCOL", "AZURE-HAWK", "VECTOR-7", "CYBER-WARDEN", "BINARY-STORM",
    "ECO-TITAN", "VERDE-CIPHER", "NATURA-NODE", "FOREST-GHOST", "GAIA-PROTOCOL", "EMERALD-VEIL",
    "DARK-SIGNAL", "OMEGA-NULL", "NEON-EDGE", "CIPHER-ZERO", "STATIC-BLADE", "HEX-RUNNER",
]

# ─── Statuses ─────────────────────────────────────────────────────────────────
STATUSES = [f"Controlled by {f}" for f in FACTIONS] + ["Contested", "Liberated", "Under Attack"]

STATUS_TR = {
    "Controlled by Red Reapers":   "Kızıl Biçiciler'in kontrolünde",
    "Controlled by Blue Sentinels": "Mavi Sentineller'in kontrolünde",
    "Controlled by Green Guardians": "Yeşil Koruyucular'ın kontrolünde",
    "Contested":  "çekişmeli bir bölge — iki güç arasında savaş sürüyor",
    "Liberated":  "özgürleştirilmiş; kalıcı kontrol için destek gerekiyor",
    "Under Attack": "saldırı altında — acil müdahale gerekiyor",
}

# ─── Quest templates per status ───────────────────────────────────────────────
QUESTS_CONTROLLED_ENEMY = [
    "Bölgeye sız, PostGIS konum doğrulamasını tamamla ve check-in yaparak düşman kodunu kır!",
    "H3 heksagon şifresini ele geçir ve fraksiyon veri yükünü sunucuya aktar!",
    "Düşman ajan kimliğini tespit et, koordinatlarını merkeze rapor et ve bölgeden çekil!",
    "Sahte kimlikle içeri gir, iç ağa bağlan ve kontrol paneli erişimini devral!",
    "Düşmanın sinyal jeneratorünü devre dışı bırak ve heksagona kendi işaret fenerimizi dik!",
    "Bölgedeki 3 stratejik noktada gözetleme yap; konum damgalı fotoğrafları aktar!",
    "Düşman operasyon dosyasına eriş, yedek kopyayı çal ve iz bırakmadan çekil!",
    "Bölge sakinlerini etkisiz kıl, H3 indeksini yeniden yaz ve kontrolü teslim al!",
]

QUESTS_CONTESTED = [
    "Çekişmeli heksagona ulaş, check-in yaparak taraf puanını üstüne çek!",
    "Bölgedeki son iki rakip ajanı tespit et; koordinatlarını kırmızı listeye al!",
    "İstikrarsız bölgede H3 şifreleme rotasyon anahtarını bul ve merkeze ilet!",
    "Çatışma hatlarının ortasına sız, ağ trafiğini dinle ve bağlantı noktalarını kilitle!",
    "Üç taraflı çatışmada tarafsız sivil varlıkları tahliye et ve bölge verisini koru!",
    "Rekabet eden sinyalleri karıştır, heksagon kilidini sıfırla ve ilk check-in'i yapan kazanır!",
]

QUESTS_LIBERATED = [
    "Özgür bölgeyi güçlendir: savunma düğümlerini aktive et ve check-in yap!",
    "Heksagona kendi ağ altyapımızı kur; kalıcı kontrol için istihbarat yükle!",
    "Bölgenin güvenli kalması için çevre H3 heksagonlarını tara ve tehditleri raporla!",
    "Özgürleştirilmiş konumda sivil varlıklarla iletişim kur ve fraksiyon ağımıza bağla!",
    "Bölge defans matrisini güncelle, yedek güç hatlarını aktif et ve pozisyonu koru!",
    "Konumu yeniden adlandır, fraksiyon bayrağımızı dijital olarak dik ve yayını başlat!",
]

QUESTS_UNDER_ATTACK = [
    "Acil! Bölgeyi savun — saldırı dalgasını geri it ve H3 kilidi koru!",
    "Kritik altyapı saldırı altında. Güvenlik duvarını yeniden yükle ve check-in yaparak varlık sinyali ver!",
    "Düşman baskını başladı. Bölgeden veri yedeklerini kurtar, kanalları şifrele, çekil!",
    "Konumu terk etme! Takviye gelene kadar H3 kontrol noktasını tut!",
    "Saldırı koordinatlarını analiz et, karşı hamleyi planla ve son savunma hattını kur!",
    "Operasyonel güvenlik ihlali var. Tüm gizli dosyaları şifrele ve bölge erişim kodlarını değiştir!",
]

QUESTS_CONTROLLED = QUESTS_CONTROLLED_ENEMY + [
    "Bölgeyi ele geçirmek için H3 heksagon kilidini kır ve kontrol bayrağını dik!",
    "Kontroldeki konuma sız, savunma açıklarını tespit et ve raporu merkeze ilet!",
    "Bölge altyapısını denetle: zayıf düğümleri belirle ve konumu güçlendir!",
    "Gizli toplanma noktasına ulaş, operasyon paketini teslim al ve bölge ağını güncelle!",
    "Konumda kamuflajlı sinyal vericisini aktive et ve merkez komutanla güvenli kanal kur!",
    "Kontrol hattını zorla: komşu heksagonları tara, zayıf noktaları rapor et!",
]

def pick_quests(status):
    if status == "Contested":
        return QUESTS_CONTESTED
    if status == "Liberated":
        return QUESTS_LIBERATED
    if status == "Under Attack":
        return QUESTS_UNDER_ATTACK
    return QUESTS_CONTROLLED  # all "Controlled by X" cases

# ─── Generate entries ──────────────────────────────────────────────────────────
def generate(target=875):
    entries = []
    seen = set()

    while len(entries) < target:
        venue = random.choice(VENUES)
        status = random.choice(STATUSES)
        commander = random.choice(COMMANDERS)
        quests = pick_quests(status)
        quest = random.choice(quests)

        key = (venue["name"], status, quest[:30])
        if key in seen:
            continue
        seen.add(key)

        status_tr = STATUS_TR[status]
        output = (
            f"[{commander} KOMUTANI]: {venue['name']} heksagonu şu an {status_tr}. "
            f"Görev: {quest}"
        )

        entries.append({
            "instruction": "Generate a tactical cyberpunk quest for a player.",
            "input": f"Venue: {venue['name']}, Status: {status}",
            "output": output,
        })

    return entries

if __name__ == "__main__":
    random.seed(42)
    dataset = generate(875)
    out_path = "dataset.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    lines = sum(1 for _ in open(out_path, encoding="utf-8"))
    print(f"Entries : {len(dataset)}")
    print(f"Lines   : {lines}")
    print(f"Sample  :\n{json.dumps(dataset[0], ensure_ascii=False, indent=2)}")
