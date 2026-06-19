import json
import random
import sys

# ─── Locations ───────────────────────────────────────────────────────────────
VENUES = [
    # Kafeler
    {"name": "Mandabatmaz", "category": "Kafe"},
    {"name": "Kronotrop Karaköy", "category": "Kafe"},
    {"name": "Walter's Coffee Roastery", "category": "Kafe"},
    {"name": "Paper Coffee Nişantaşı", "category": "Kafe"},
    {"name": "Hafız Mustafa 1864 Kapalıçarşı", "category": "Kafe"},
    {"name": "Petra Roasting Co.", "category": "Kafe"},
    {"name": "MOC Coffee Beyoğlu", "category": "Kafe"},
    {"name": "Brew Lab Kadıköy", "category": "Kafe"},
    {"name": "Boğaziçi Kafe Bebek", "category": "Kafe"},
    {"name": "Kahve Dünyası Taksim", "category": "Kafe"},
    {"name": "Moda Sahili Kafe", "category": "Kafe"},
    {"name": "Karaköy Güllüoğlu Kafe", "category": "Kafe"},
    {"name": "Cihangir Bohemian Kafe", "category": "Kafe"},
    {"name": "Ortaköy Taş Fırın Kafe", "category": "Kafe"},
    {"name": "Arnavutköy Sahil Kafe", "category": "Kafe"},
    # Restoranlar
    {"name": "Çiya Sofrası Kadıköy", "category": "Restoran"},
    {"name": "Karaköy Lokantası", "category": "Restoran"},
    {"name": "Beyoğlu Balıkçısı", "category": "Restoran"},
    {"name": "Pandeli Mısır Çarşısı", "category": "Restoran"},
    {"name": "Asitane Balat", "category": "Restoran"},
    {"name": "Hamdi Restaurant Eminönü", "category": "Restoran"},
    {"name": "Mikla Pera Palace", "category": "Restoran"},
    {"name": "Neolokal Salt Galata", "category": "Restoran"},
    {"name": "Zübeyir Ocakbaşı Beşiktaş", "category": "Restoran"},
    {"name": "Tarihi Sultanahmet Köftecisi", "category": "Restoran"},
    {"name": "Reina Ortaköy", "category": "Restoran"},
    {"name": "Kıyı Restaurant Tarabya", "category": "Restoran"},
    # Kitabevleri
    {"name": "Robinson Crusoe 389 İstiklal", "category": "Kitabevi"},
    {"name": "Pandora Kitabevi Beyoğlu", "category": "Kitabevi"},
    {"name": "Homer Kitabevi Beyoğlu", "category": "Kitabevi"},
    {"name": "Remzi Kitabevi Kanyon", "category": "Kitabevi"},
    {"name": "D&R Cevahir AVM", "category": "Kitabevi"},
    {"name": "Babil Kitabevi Kadıköy", "category": "Kitabevi"},
    {"name": "Denizler Kitabevi Sahaflar", "category": "Kitabevi"},
    # Galeriler & Müzeler
    {"name": "İstanbul Modern Karaköy", "category": "Galeri"},
    {"name": "Salt Galata", "category": "Galeri"},
    {"name": "Pera Müzesi Tepebaşı", "category": "Galeri"},
    {"name": "Pilot Galeri Beyoğlu", "category": "Galeri"},
    {"name": "Anna Laudel Gallery Karaköy", "category": "Galeri"},
    {"name": "Türk ve İslam Eserleri Müzesi", "category": "Müze"},
    {"name": "Topkapı Sarayı Müzesi", "category": "Müze"},
    {"name": "Dolmabahçe Sarayı", "category": "Müze"},
    {"name": "Sakıp Sabancı Müzesi Emirgan", "category": "Müze"},
    # Kütüphaneler
    {"name": "Beyazıt Devlet Kütüphanesi", "category": "Kütüphane"},
    {"name": "Atatürk Kitaplığı Taksim", "category": "Kütüphane"},
    {"name": "Milli Kütüphane Bağcılar", "category": "Kütüphane"},
    {"name": "İBB Kütüphanesi Kadıköy", "category": "Kütüphane"},
    {"name": "Moda Sahili Kütüphanesi", "category": "Kütüphane"},
    {"name": "Rami Kütüphanesi", "category": "Kütüphane"},
    # Parklar & Açık Alanlar
    {"name": "Gezi Parkı Taksim", "category": "Park"},
    {"name": "Emirgan Korusu", "category": "Park"},
    {"name": "Yıldız Parkı Beşiktaş", "category": "Park"},
    {"name": "Fenerbahçe Parkı", "category": "Park"},
    {"name": "Maçka Demokrasi Parkı", "category": "Park"},
    {"name": "Büyükada Milli Parkı", "category": "Park"},
    {"name": "Polonezköy Tabiat Parkı", "category": "Park"},
    # Meydanlar & Semtler
    {"name": "Taksim Meydanı", "category": "Meydan"},
    {"name": "Beyazıt Meydanı", "category": "Meydan"},
    {"name": "Kadıköy Çarşı", "category": "Meydan"},
    {"name": "Kapalıçarşı Merkez", "category": "Meydan"},
    {"name": "Galata Meydanı", "category": "Meydan"},
    {"name": "Eminönü Meydanı", "category": "Meydan"},
    # Barlar & Gece Hayatı
    {"name": "Leb-i Derya Cihangir", "category": "Bar"},
    {"name": "360 İstanbul Beyoğlu", "category": "Bar"},
    {"name": "Nardis Jazz Club Galata", "category": "Bar"},
    {"name": "Jolly Joker Babylon", "category": "Bar"},
    {"name": "Kadıköy Bariyer Bar", "category": "Bar"},
    {"name": "Sortie Kuruçeşme", "category": "Bar"},
    # Alışveriş Merkezleri
    {"name": "Kanyon AVM Levent", "category": "AVM"},
    {"name": "Zorlu Center Zincirlikuyu", "category": "AVM"},
    {"name": "İstinyePark AVM", "category": "AVM"},
    {"name": "Cevahir AVM Şişli", "category": "AVM"},
    {"name": "Capitol AVM Kadıköy", "category": "AVM"},
    # Tarihi Yapılar
    {"name": "Ayasofya Camii", "category": "Tarihi"},
    {"name": "Sultanahmet Camii", "category": "Tarihi"},
    {"name": "Galata Kulesi", "category": "Tarihi"},
    {"name": "Kız Kulesi Üsküdar", "category": "Tarihi"},
    {"name": "Boğaz Köprüsü", "category": "Tarihi"},
    {"name": "Rumeli Hisarı", "category": "Tarihi"},
    {"name": "Yedikule Hisarları", "category": "Tarihi"},
]

FACTIONS = ["Red Reapers", "Blue Sentinels", "Green Guardians"]

COMMANDERS = [
    "NEXUS-ALPHA", "PHANTOM-X", "BLOOD-CIPHER", "NOVA-REAPER", "IRON-FANG",
    "SCARLET-PROTOCOL", "SENTINEL-PRIME", "GHOST-PROTOCOL", "AZURE-HAWK",
    "VECTOR-7", "CYBER-WARDEN", "BINARY-STORM", "ECO-TITAN", "VERDE-CIPHER",
    "NATURA-NODE", "FOREST-GHOST", "GAIA-PROTOCOL", "EMERALD-VEIL",
    "DARK-SIGNAL", "OMEGA-NULL", "NEON-EDGE", "CIPHER-ZERO", "STATIC-BLADE",
    "HEX-RUNNER", "VOID-STRIKE", "PULSE-WRAITH", "SHADOW-KERNEL", "FLUX-9",
    "OBSIDIAN-RUN", "SIGNAL-BREAK", "CHROME-SPECTER", "RED-MATRIX",
]

STATUSES = [f"Controlled by {f}" for f in FACTIONS] + ["Contested", "Liberated", "Under Attack"]

STATUS_TR = {
    "Controlled by Red Reapers":    "Kızıl Biçiciler'in kontrolünde",
    "Controlled by Blue Sentinels": "Mavi Sentineller'in kontrolünde",
    "Controlled by Green Guardians":"Yeşil Koruyucular'ın kontrolünde",
    "Contested":    "çekişmeli bir bölge — iki rakip güç arasında kritik gerilim tırmanıyor",
    "Liberated":    "özgürleştirilmiş — kalıcı kontrol için acil destek gerekiyor",
    "Under Attack": "ağır saldırı altında — savunma hatları çökmek üzere",
}

# ─── Briefings per status ────────────────────────────────────────────────────
BRIEFINGS = {
    "Controlled by Red Reapers": [
        "Kızıl Biçiciler bölgeye sinyal jammerları yerleştirmiş; iletişim kanalları bozulmuş durumda.",
        "İstihbarat raporları, düşmanın bölgeye şifreli komuta terminalleri kurduğunu doğruluyor.",
        "Kızıl Biçiciler bölge sınırlarını kilitleyerek çevre heksagonlara baskı uyguluyor.",
        "Düşman biyometrik tarama kapıları kurmuş; gizli sızma tek seçenek.",
        "Kızıl fraksiyon bu noktayı lojistik merkez olarak kullanıyor — kritik hedef.",
        "Bölge dedektörleri aktif; tespit edilmeden hareket etmek için pencere daralıyor.",
    ],
    "Controlled by Blue Sentinels": [
        "Mavi Sentineller dronelarla bölgeyi izliyor; görünmez kalman giderek zorlaşıyor.",
        "İstihbarat: Sentineller bu noktayı veri toplama merkezi olarak kullanıyor.",
        "Mavi fraksiyon çevre heksagonlara ağ tuzakları kurmuş; dikkatli ilerle.",
        "Sentineller bölge altyapısını şifreli kilitlerle mühürlemiş; erişim kodu gerekli.",
        "Mavi komuta zinciri bu noktadan koordinasyon yapıyor — hedefe öncelik ver.",
        "Bölgedeki sivil örtü kırılmak üzere; operasyona hız kazandır.",
    ],
    "Controlled by Green Guardians": [
        "Yeşil Koruyucular bölgeyi eko-sensörlerle örüyor; her hareketi izliyorlar.",
        "İstihbarat, Guardians'ın bölgeyi yenilenebilir enerji şebekesine bağladığını gösteriyor.",
        "Yeşil fraksiyon savunma ağı bu noktadan yönetiliyor — kritik bağlantı noktası.",
        "Guardians bu bölgeyi saha karargahı olarak kullanıyor; komuta düğümlerini hedef al.",
        "Biyolojik kamuflaj sistemi aktif — standart tarayıcılar işe yaramaz.",
        "Yeşil Koruyucular çevre güvenlik perimetrini kapatıyor; süre daralıyor.",
    ],
    "Contested": [
        "İki fraksiyon arasındaki güç boşluğu bu noktayı kargaşaya sürüklüyor.",
        "Sinyal karıştırma cihazları tüm taraflara ait — kim kimin olduğu belirsiz.",
        "Çatışma nedeniyle siviller tahliye edildi; bölge artık tam bir savaş alanı.",
        "İstihbarat birimleri çakışıyor; kim kazanacak bilinmez, ancak zaman daralıyor.",
        "Üç farklı fraksiyon aktarıcısı bölgede aktif — hepsini etkisiz kılmak gerekiyor.",
        "Nötr heksagon olma özelliği yavaş yavaş kayboluyor; sahip çık yoksa rakip kazanır.",
        "Arka sokak bağlantıları kesilmiş; çatışma her an tırmanabilir.",
    ],
    "Liberated": [
        "Bölge ele geçirildi ancak düşman karşı atak için hazırlanıyor.",
        "Özgürleştirme sonrası altyapı hasarlı; acil onarım ve güçlendirme şart.",
        "Civardaki düşman birimleri bu noktayı geri almak için strateji geliştiriyor.",
        "Savunma düğümleri henüz tam kapasite çalışmıyor; açık vardır — kapat.",
        "Bölge halkı kurtarıldı ancak fraksiyon varlığı güvenilir hale getirilmeli.",
        "Özgürleştirilmiş sektör, çevre heksagonlar stabilize edilmeden savunulamaz.",
        "İlk check-in yapıldı; kalıcı kontrol için ikinci dalga müdahalesi gerekiyor.",
    ],
    "Under Attack": [
        "Düşman dalgası hazırlıksız yakaladı; savunma perimetrinin yarısı çökmüş durumda.",
        "Acil! Bölge sinyal bombasıyla vuruldu — iletişim çöküşü başlamadan harekete geç.",
        "Saldırı koordineli geliyor; üç ayrı cepheden eş zamanlı baskı uygulanıyor.",
        "Kritik altyapı düğümleri hedef alınıyor — güvenlik açığı kapanmadan sistem düşer.",
        "Saldırı dalgası ikinci fazına geçiyor; takviye yolda ama sen şimdi hareket etmelisin.",
        "Bölge savunucuları geri çekilmeye başladı; moral ve fiziksel kaybı durdur.",
        "Düşman sızma timi içeride — tespit et, etkisiz kıl, noktayı geri al.",
    ],
}

# ─── Category-flavored objective fragments ───────────────────────────────────
CATEGORY_FLAVOR = {
    "Kafe": [
        "espresso makinesinin içine gizlenmiş veri çipini çıkar",
        "barista kılığına girerek müşteri akışını izle ve ajan profilini belgele",
        "kahve sayacının altına yerleştirilmiş sinyal vericisini devre dışı bırak",
        "WiFi yönlendiricisine erişim sağlayarak şifreli paketi ağa enjekte et",
        "müşteri kayıtlarını sil ve yerine sahte kimlik verilerini yükle",
    ],
    "Restoran": [
        "mutfak alanında gizli ağ aktarıcısını tespit et ve kopyasını çıkar",
        "şef ekibine sızarak düşman operasyon planını ele geçir",
        "rezervasyon sistemini hackleyerek koordinasyon toplantısını engelle",
        "ikmal rotasını izleyerek gizli lojistik ağı haritalandır",
        "menüde şifreli iletişim kanalı kurulduğunu doğrula ve akışı kes",
    ],
    "Kitabevi": [
        "raf kodlama sistemine gizlenmiş şifreli mesajı çöz",
        "nadir el yazması kataloğunu tara; içinde saklı koordinat verisini çıkar",
        "arka depo bölümündeki gizli toplantı alanını fotoğrafla ve belgele",
        "dijital katalog sistemine yerleştirilen arka kapıyı kapat",
        "dönüşümlü kitap kodlama şemasını deşifre ederek sonraki hareketi öğren",
    ],
    "Galeri": [
        "sergi katındaki gizli kamerayı tespit et ve gözetleme akışını kes",
        "sanat eserleri içine yerleştirilmiş veri depolama birimini bul ve çıkar",
        "küratör kimliğine bürünerek düşman toplantısına sız",
        "restorasyondaki tablonun arkasına gizlenmiş erişim kartını ele geçir",
        "galeri güvenlik sistemini geçici olarak devre dışı bırakarak noktayı güvenli hale getir",
    ],
    "Müze": [
        "sergilenen antikanın içine entegre edilmiş sinyal jokeyini söndür",
        "müze arşivlerindeki şifreli erişim günlüğünü ele geçir",
        "tarihi eser kataloğuna enjekte edilen zararlı kodu temizle",
        "müze zemin planını analiz ederek gizli geçidi belirle ve haritalandır",
        "güvenlik turunu manipüle ederek kör noktaları tespit et ve belgele",
    ],
    "Kütüphane": [
        "akademik veri tabanına sızarak düşman istihbarat dosyalarını indir",
        "okuyucu geçiş kayıtlarını analiz et; ajan kimliğini tespit et",
        "kütüphane sunucusundaki şifreli parçayı çöz ve merkeze aktar",
        "nadir belgeler bölümündeki gizli ağ düğümünü devre dışı bırak",
        "dijital arşiv sistemine arka kapı aç ve veri akışını yönlendir",
    ],
    "Park": [
        "yeşil alan içindeki gizli yayın istasyonunu bul ve sinyal frekansını değiştir",
        "dron gözetleme rotasını haritalandır ve kör noktalarda geçiş noktası oluştur",
        "park aydınlatma direklerine monte edilmiş sensörleri devre dışı bırak",
        "piknik alanındaki gizlenmiş veri paketi teslim noktasını temizle",
        "doğal örtü altına yerleştirilen toprağa gömülü aktarıcıyı geri al",
    ],
    "Meydan": [
        "meydandaki dijital reklam panosunu hackleyerek fraksiyon mesajını yayınla",
        "kalabalık içindeki düşman lojistik koordinatörünü tespit et ve takibe al",
        "meydan yer altı kanallarına erişerek gizli geçiş hatlarını haritalandır",
        "merkezi güvenlik kamerasının yazılımını güncelle ve körlük bölgesi oluştur",
        "meydanın ses sistemi altyapısını ele geçirerek iletişim frekanslarını sabote et",
    ],
    "Bar": [
        "DJ kulesinin içindeki şifreli yayın ekipmanını sabote et",
        "müşteri kalabalığı içinde buluşan ajan ikiliyi tespit et ve iletişimlerini kes",
        "arka depo güvenlik kilidi kodunu kır ve gizli bölmeye eriş",
        "VIP alanındaki özel ağ bağlantısını ele geçir; şifreli trafiği yönlendir",
        "içecek servisi örtüsü altında çalışan düşman koordinatörünü nötralize et",
    ],
    "AVM": [
        "perakende yönetim sistemine sız ve şifreli lojistik rotaları çıkar",
        "güvenlik merkezini geçici olarak kör bırakarak gizli harekâtı yürüt",
        "bina otomasyon ağına erişerek rakip birimler arasındaki iletişimi kes",
        "AVM içi konum takip sistemine sahte sinyal enjekte et ve rakibi yanılt",
        "depo katındaki gizli aktarım noktasını tespit et ve erişimi kapat",
    ],
    "Tarihi": [
        "tarihi yapı içine gizlenmiş eski dönem şifreleme aygıtını aktive et",
        "yapının mimarisi arasına yerleştirilmiş modern sinyal cihazını söndür",
        "turist akışı içine karışarak düşman keşif ekibini takibe al",
        "tarihi dokümanlara gömülü şifreli koordinat haritasını kopyala",
        "yapının gizli odalarından birinde kurulan komuta üssünü tespit et ve sabote et",
    ],
}

DEFAULT_FLAVOR = [
    "bölge ağına sız ve kritik düğümü devre dışı bırak",
    "hedef noktada konum damgalı check-in ile varlık sinyali ver",
    "altyapı açığını tespit et ve merkeze şifreli rapor ilet",
    "düşman veri akışını kes ve kanalı yeniden yönlendir",
]

# ─── Multi-step objective templates per status ───────────────────────────────
STEP_TEMPLATES = {
    "Controlled by Red Reapers": [
        ("{flavor1}, ardından Kızıl Biçiciler'in komuta ağını çökmek için H3 şifreleme anahtarını ele geçir",
         "yedek erişim terminaline bağlan ve kontrol bayrağını fraksiyonumuza devret",
         "bölgeden iz bırakmadan çekil; konumunu güvenli kanaldan merkeze rapor et"),
        ("düşman sinyal jeneratörünü tespit et ve {flavor1}",
         "Kızıl fraksiyon veri yükünü ele geçir; şifreli içeriği merkeze aktar",
         "bölge kontrolünü teslim alarak kalıcı check-in yap ve noktayı kilitle"),
        ("{flavor1} ve bölge savunma açıklarını belgele",
         "Kızıl Biçiciler komuta hattını keserek fraksiyon koordinasyon ağını çöküş moduna sok",
         "geri çekilme rotasını güvenli hale getir ve operasyon raporunu kapat"),
    ],
    "Controlled by Blue Sentinels": [
        ("Mavi Sentineller gözetim gridini geçmek için önce {flavor1}",
         "drone kör noktalarını kullanarak komuta terminaline ulaş ve erişim kodunu ele geçir",
         "Sentineller kontrol şemasını sıfırla ve heksagonu fraksiyonumuza devret"),
        ("{flavor1}, ardından Mavi fraksiyon sinyal ağını analiz ederek zayıf halkayı belirle",
         "tespit edilen açıktan içeri gir ve veri paketini indir",
         "çıkış rotasını temizle; bölge sahipliğini kayıt altına al ve merkeze bildir"),
        ("önce {flavor1} ve Mavi Sentineller güvenlik protokolünü devre dışı bırak",
         "iç ağa bağlanarak operasyonel tüm şifreli dosyaları ele geçir",
         "bölge kontrolünü devral; savunma düğümlerini bizim frekansa yeniden ayarla"),
    ],
    "Controlled by Green Guardians": [
        ("{flavor1} ve Yeşil Koruyucular eko-sensör ağını kör et",
         "kamuflajlı komuta üssüne sız ve şifreli koordinasyon verilerini indir",
         "bölge kontrolünü teslim al; yeni savunma matrisini aktive et ve check-in yap"),
        ("Guardians biyolojik tarama sistemini atlatmak için önce {flavor1}",
         "hedef noktadaki enerji düğümünü ele geçir ve fraksiyon frekansına yeniden bağla",
         "bölge sınırlarını mühürle; geri alma girişimlerine karşı çevre savunmasını güçlendir"),
        ("{flavor1} ile başla ve Yeşil fraksiyon veri aktarım hattını kes",
         "komuta ağına sızarak operasyon planlarını ele geçir ve merkeze ilet",
         "bölgeden çekil; koordinatları kayıt altına al ve kalıcı işaret fenerini etkinleştir"),
    ],
    "Contested": [
        ("çatışma hattı boyunca ilerleyerek önce {flavor1}",
         "rakip fraksiyon aktarıcılarını birer birer tespit et ve sinyallerini kes",
         "heksagon kontrolünü ilk ele geçiren taraf olarak check-in yap ve bölgeyi kilitle"),
        ("{flavor1} ile nötr bölgede üstünlük kur",
         "iki rakip ajanı tespit et; koordinatlarını kırmızı listeye ekle ve hareketlerini kısıtla",
         "çatışmadan önce H3 kilit kodunu sıfırla ve noktayı fraksiyonumuza devret"),
        ("çekişmeli noktaya sız ve {flavor1}",
         "istikrarsız bölge altyapısına erişerek şifreli ağ rotasyonunu bizim lehimize yeniden yaz",
         "rakip güçler toparlanmadan çekilme rotasını aç ve bölge transferini tamamla"),
    ],
    "Liberated": [
        ("özgürleştirilen bölgeyi güçlendirmek için ilk adım olarak {flavor1}",
         "savunma düğümlerini tam kapasite aktive et ve çevre H3 heksagonlarını tara",
         "yedek güç hatlarını bağla; bölge ağını kalıcı olarak fraksiyonumuza kilitle"),
        ("{flavor1} ve özgür bölgenin savunma perimetrini güçlendir",
         "düşman karşı atak hazırlığı tespit edilmeden önce bölge altyapısını sabitleştir",
         "kalıcı check-in yap; fraksiyon bayrağını dijital olarak dik ve yayını başlat"),
        ("bölge stabilizasyonu için {flavor1} ile başla",
         "çevre heksagonlardaki tehditleri haritalandır ve savunma öncelik sıralamasını güncelle",
         "bölge komuta ağını aktive et; takviye birimlerin koordinatlarını merkeze ilet"),
    ],
    "Under Attack": [
        ("acil! Saldırı dalgasını engellemek için hemen {flavor1}",
         "çöken savunma hattını yeniden kur; kritik altyapı düğümlerini düşmandan kurtar",
         "son savunma pozisyonunu kilitle; takviye gelene kadar H3 kontrol noktasını tut"),
        ("saldırı altındaki bölgede önce {flavor1} ile öncelikli güvenlik açığını kapat",
         "düşman sızma koordinatlarını analiz et ve karşı hamle için bölge verisini merkeze ilet",
         "tahliye edilemeyen varlıkları şifrele; savunma ağını son kapasiteyle çalıştır"),
        ("{flavor1} ile saldırı vektörünü tespit et ve yavaşlat",
         "operasyonel güvenlik ihlalini durdur; tüm gizli veriler şifrelenmeden önce aktar",
         "savunma hatlarını yeniden oluştur; bölgeyi düşmana kaptırmadan check-in yap"),
    ],
}


def get_flavor(category: str) -> str:
    flavors = CATEGORY_FLAVOR.get(category, DEFAULT_FLAVOR)
    return random.choice(flavors)


def build_output(venue: dict, status: str, commander: str) -> str:
    status_tr = STATUS_TR[status]
    briefing = random.choice(BRIEFINGS[status])

    templates = STEP_TEMPLATES[status]
    tpl = random.choice(templates)
    flavor1 = get_flavor(venue["category"])

    step1 = tpl[0].format(flavor1=flavor1)
    step2 = tpl[1].format(flavor1=flavor1)
    step3 = tpl[2].format(flavor1=flavor1)

    # Capitalize first letter of each step
    step1 = step1[0].upper() + step1[1:]
    step2 = step2[0].upper() + step2[1:]
    step3 = step3[0].upper() + step3[1:]

    return (
        f"[{commander} KOMUTANI]: {venue['name']} heksagonu şu an {status_tr}. "
        f"{briefing} "
        f"Görev: {step1}. "
        f"Ardından {step2}. "
        f"Son olarak {step3}!"
    )


def generate(target: int = 1500) -> list:
    entries = []
    seen = set()

    while len(entries) < target:
        venue = random.choice(VENUES)
        status = random.choice(STATUSES)
        commander = random.choice(COMMANDERS)

        output = build_output(venue, status, commander)
        key = (venue["name"], status, output[60:100])
        if key in seen:
            continue
        seen.add(key)

        entries.append({
            "instruction": "Generate a tactical cyberpunk quest for a player.",
            "input": f"Venue: {venue['name']}, Status: {status}",
            "output": output,
        })

    return entries


if __name__ == "__main__":
    random.seed(42)
    dataset = generate(1500)
    out_path = "dataset.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    lines = sum(1 for _ in open(out_path, encoding="utf-8"))
    avg_len = sum(len(e["output"]) for e in dataset) // len(dataset)
    sample = json.dumps(dataset[0], ensure_ascii=False, indent=2)
    print(f"Entries  : {len(dataset)}")
    print(f"Lines    : {lines}")
    print(f"Avg out  : {avg_len} chars")
    print("Sample   :")
    sys.stdout.buffer.write((sample + "\n").encode("utf-8"))
