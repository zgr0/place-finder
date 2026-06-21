export type Lang = 'en' | 'tr';

export interface Translations {
  // Nav
  placeFinder: string;
  venues: string;
  hexGrid: string;
  factions: string;
  profile: string;
  factionChat: string;
  lightMode: string;
  darkMode: string;
  loggedInAs: string;
  logout: string;
  login: string;
  register: string;
  language: string;
  // Login
  loginTitle: string;
  email: string;
  password: string;
  signingIn: string;
  signIn: string;
  noAccount: string;
  // Register
  joinVenueFinder: string;
  username: string;
  factionOptional: string;
  noFaction: string;
  registering: string;
  initializeAccount: string;
  alreadyHaveAccount: string;
  // Profile
  signInToViewProfile: string;
  signInToSeeStats: string;
  loadingProfile: string;
  profileNotFound: string;
  retry: string;
  level: string;
  points: string;
  dayStreak: string;
  discoveryStreak: (n: number) => string;
  noActiveStreak: string;
  keepExploring: string;
  discoverToStart: string;
  recentReviews: string;
  noReviewsYet: string;
  // Review
  reviewVenue: string;
  shareExperience: string;
  posting: string;
  postReview: string;
  pastReviews: string;
  loadingReviews: string;
  noReviews: string;
  beFirst: string;
  noTextProvided: string;
  // Faction
  factionChatTitle: string;
  loginToChat: string;
  noFactionYet: string;
  joinFactionToChat: string;
  browseFactions: string;
  createFaction: string;
  members: string;
  hide: string;
  memberRankings: string;
  noMessages: string;
  messageFaction: string;
  sharePlace: string;
  searchVenues: string;
  noVenuesFound: string;
  sharedPlace: string;
  // FactionList
  joinFactionCompete: string;
  createFactionBtn: string;
  noFactionsYet: string;
  yourFaction: string;
  joined: string;
  join: string;
  loginToJoin: string;
  // CreateFaction
  mustBeLoggedIn: string;
  backToFactions: string;
  factionName: string;
  factionIcon: string;
  factionColor: string;
  factionDescription: string;
  creating: string;
  factionNameRequired: string;
  // Map popup
  loadingDetails: string;
  loadMissingInfo: string;
  generateDescription: string;
  generating: string;
  viewAndWriteReviews: string;
  // Map UI
  mapCannotBeDisplayed: string;
  couldNotLoadVenues: string;
  loadingMapVenues: string;
  factionRankings: string;
  noDataYet: string;
  // MissionPanel
  missions: string;
  generateMissions: string;
  generatingMissions: string;
  inferenceOffline: string;
  allMissionsComplete: (pts: number) => string;
  complete: string;
}

export const translations: Record<Lang, Translations> = {
  en: {
    placeFinder: 'Venue War',
    venues: 'Venues',
    hexGrid: 'Hex Grid',
    factions: 'Clans',
    profile: 'Profile',
    factionChat: 'Clan Chat',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    loggedInAs: 'Logged in as',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    language: '🌐 Türkçe',
    loginTitle: 'LOGIN',
    email: 'Email',
    password: 'Password',
    signingIn: 'Signing in...',
    signIn: 'SIGN IN',
    noAccount: "Don't have an account?",
    joinVenueFinder: 'Join Venue Finder',
    username: 'Username',
    factionOptional: 'Clan (optional — you can join later)',
    noFaction: 'No clan (join later)',
    registering: 'Registering...',
    initializeAccount: 'Initialize Account',
    alreadyHaveAccount: 'Already have an account?',
    signInToViewProfile: 'Sign In to View Profile',
    signInToSeeStats: 'Log in to see your reviews, streak, and stats.',
    loadingProfile: 'LOADING PROFILE...',
    profileNotFound: 'Profile not found.',
    retry: 'Retry',
    level: 'Level',
    points: 'Points',
    dayStreak: 'Day Streak',
    discoveryStreak: (n) => `${n}-day discovery streak!`,
    noActiveStreak: 'No active streak',
    keepExploring: 'Keep exploring new places every day',
    discoverToStart: 'Discover a new place today to start your streak',
    recentReviews: 'Recent Reviews',
    noReviewsYet: 'No reviews yet. Go explore some places!',
    reviewVenue: 'Review Venue',
    shareExperience: 'Share details of your own experience at this place...',
    posting: 'Posting...',
    postReview: 'Post Review',
    pastReviews: 'Past Reviews',
    loadingReviews: 'Loading reviews...',
    noReviews: 'No reviews yet',
    beFirst: 'Be the first to share your experience!',
    noTextProvided: 'No text provided.',
    factionChatTitle: 'Clan Chat',
    loginToChat: 'Log in to communicate with your clan.',
    noFactionYet: 'No Clan Yet',
    joinFactionToChat: 'Join or create a clan to access clan chat.',
    browseFactions: 'Browse Clans',
    createFaction: 'Create Clan',
    members: 'Members',
    hide: 'Hide',
    memberRankings: 'Member Rankings',
    noMessages: 'No messages yet. Start the conversation!',
    messageFaction: 'Message your clan…',
    sharePlace: 'Share a place',
    searchVenues: 'Search venues…',
    noVenuesFound: 'No venues found',
    sharedPlace: 'Shared place',
    joinFactionCompete: 'Join a clan to compete for territory',
    createFactionBtn: '+ Create Clan',
    noFactionsYet: 'No clans yet. Be the first to create one!',
    yourFaction: 'Your Clan',
    joined: 'Joined',
    join: 'Join',
    loginToJoin: 'Login to Join',
    mustBeLoggedIn: 'You must be logged in to create a clan.',
    backToFactions: '← Clans',
    factionName: 'Clan name',
    factionIcon: 'Clan icon',
    factionColor: 'Clan color',
    factionDescription: 'Description (optional) — what is your clan about?',
    creating: 'Creating…',
    factionNameRequired: 'Clan name is required',
    loadingDetails: 'Loading details...',
    loadMissingInfo: 'Load missing info',
    generateDescription: '✨ Generate Description',
    generating: 'Generating...',
    viewAndWriteReviews: 'View & Write Reviews',
    mapCannotBeDisplayed: 'Map cannot be displayed',
    couldNotLoadVenues: 'Could not load venues. Is the server running on port 3000?',
    loadingMapVenues: 'Loading Map & Venues...',
    factionRankings: 'Clan Rankings',
    noDataYet: 'No data yet',
    missions: 'Missions',
    generateMissions: '⚡ Generate Missions',
    generatingMissions: 'Generating...',
    inferenceOffline: 'Inference server offline. Run: python inference_server.py',
    allMissionsComplete: (pts) => `🏆 All missions complete! +${pts} XP`,
    complete: '✓ Complete',
  },
  tr: {
    placeFinder: 'Venue War',
    venues: 'Mekanlar',
    hexGrid: 'Hex Grid',
    factions: 'Klanlar',
    profile: 'Profil',
    factionChat: 'Klan Sohbeti',
    lightMode: 'Açık Tema',
    darkMode: 'Koyu Tema',
    loggedInAs: 'Giriş yapıldı:',
    logout: 'Çıkış Yap',
    login: 'Giriş Yap',
    register: 'Kayıt Ol',
    language: '🌐 English',
    loginTitle: 'GİRİŞ',
    email: 'E-posta',
    password: 'Şifre',
    signingIn: 'Giriş yapılıyor...',
    signIn: 'GİRİŞ YAP',
    noAccount: 'Hesabın yok mu?',
    joinVenueFinder: "Yer Bulucu'ya Katıl",
    username: 'Kullanıcı Adı',
    factionOptional: 'Klan (isteğe bağlı — sonra katılabilirsin)',
    noFaction: 'Klan yok (sonra katıl)',
    registering: 'Kayıt olunuyor...',
    initializeAccount: 'Hesabı Oluştur',
    alreadyHaveAccount: 'Zaten hesabın var mı?',
    signInToViewProfile: 'Profili Görmek İçin Giriş Yap',
    signInToSeeStats: 'Yorumlarını, serisini ve istatistiklerini görmek için giriş yap.',
    loadingProfile: 'PROFİL YÜKLENİYOR...',
    profileNotFound: 'Profil bulunamadı.',
    retry: 'Tekrar Dene',
    level: 'Seviye',
    points: 'Puan',
    dayStreak: 'Günlük Seri',
    discoveryStreak: (n) => `${n} günlük keşif serisi!`,
    noActiveStreak: 'Aktif seri yok',
    keepExploring: 'Her gün yeni yerler keşfetmeye devam et',
    discoverToStart: 'Seri başlatmak için bugün yeni bir yer keşfet',
    recentReviews: 'Son Yorumlar',
    noReviewsYet: 'Henüz yorum yok. Yeni yerler keşfet!',
    reviewVenue: 'Mekanı Yorumla',
    shareExperience: 'Bu mekandaki deneyimini paylaş...',
    posting: 'Gönderiliyor...',
    postReview: 'Yorum Yap',
    pastReviews: 'Geçmiş Yorumlar',
    loadingReviews: 'Yorumlar yükleniyor...',
    noReviews: 'Henüz yorum yok',
    beFirst: 'Bu mekanı ilk yorumlayan sen ol!',
    noTextProvided: 'Metin girilmedi.',
    factionChatTitle: 'Klan Sohbeti',
    loginToChat: 'Klanınla iletişim kurmak için giriş yap.',
    noFactionYet: 'Henüz Klan Yok',
    joinFactionToChat: 'Klan sohbetine erişmek için bir klana katıl veya oluştur.',
    browseFactions: 'Klanları Gör',
    createFaction: 'Klan Oluştur',
    members: 'Üyeler',
    hide: 'Gizle',
    memberRankings: 'Üye Sıralaması',
    noMessages: 'Henüz mesaj yok. Sohbeti başlat!',
    messageFaction: 'Klanına mesaj yaz…',
    sharePlace: 'Yer paylaş',
    searchVenues: 'Mekan ara…',
    noVenuesFound: 'Mekan bulunamadı',
    sharedPlace: 'Paylaşılan yer',
    joinFactionCompete: 'Toprak ele geçirmek için bir klana katıl',
    createFactionBtn: '+ Klan Oluştur',
    noFactionsYet: 'Henüz klan yok. İlk sen oluştur!',
    yourFaction: 'Senin Klanın',
    joined: 'Katıldın',
    join: 'Katıl',
    loginToJoin: 'Katılmak için giriş yap',
    mustBeLoggedIn: 'Klan oluşturmak için giriş yapmalısın.',
    backToFactions: '← Klanlar',
    factionName: 'Klan adı',
    factionIcon: 'Klan simgesi',
    factionColor: 'Klan rengi',
    factionDescription: 'Açıklama (isteğe bağlı) — klanın hakkında ne söylemek istersin?',
    creating: 'Oluşturuluyor…',
    factionNameRequired: 'Klan adı gerekli',
    loadingDetails: 'Detaylar yükleniyor...',
    loadMissingInfo: 'Eksik bilgileri yükle',
    generateDescription: '✨ Açıklama Oluştur',
    generating: 'Oluşturuluyor...',
    viewAndWriteReviews: 'Yorumları Gör & Yaz',
    mapCannotBeDisplayed: 'Harita gösterilemiyor',
    couldNotLoadVenues: 'Mekanlar yüklenemedi. Sunucu 3000 portunda çalışıyor mu?',
    loadingMapVenues: 'Harita ve Mekanlar Yükleniyor...',
    factionRankings: 'Klan Sıralaması',
    noDataYet: 'Henüz veri yok',
    missions: 'Görevler',
    generateMissions: '⚡ Görev Oluştur',
    generatingMissions: 'Oluşturuluyor...',
    inferenceOffline: 'Çıkarım sunucusu çevrimdışı. Çalıştır: python inference_server.py',
    allMissionsComplete: (pts) => `🏆 Tüm görevler tamamlandı! +${pts} XP`,
    complete: '✓ Tamamlandı',
  },
};
