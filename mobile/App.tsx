import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import Svg, { Polygon, G } from 'react-native-svg';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register';

interface AuthUser {
  id: number;
  username: string;
  factionId: number;
}

interface RecentReview {
  id: number;
  venueName: string;
  rating: number;
  content: string | null;
  createdAt: string;
}

interface ProfileData {
  id: number;
  username: string;
  factionId: number;
  factionName: string;
  factionColor: string;
  totalPoints: number;
  level: number;
  profilePicture: string | null;
  streak: number;
  recentReviews: RecentReview[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const C = {
  bg:           '#0C0B10',
  card:         '#15131C',
  tabBar:       '#0A0912',
  primary:      '#E8A000',
  primaryDark:  '#CF8E00',
  secondary:    '#D44A6B',
  textMain:     '#F2EDE0',
  textMuted:    '#7D7690',
  border:       'rgba(232, 160, 0, 0.14)',
  borderStrong: 'rgba(232, 160, 0, 0.32)',
  error:        '#f87171',
  success:      '#34d399',
};

const FACTIONS = [
  { id: 1, name: 'Red Reapers',     color: '#ef4444' },
  { id: 2, name: 'Blue Sentinels',  color: '#3b82f6' },
  { id: 3, name: 'Green Guardians', color: '#10b981' },
];

// Note: Adjust this URL based on your environment
// iOS Simulator: http://localhost:3000
// Android Emulator: http://10.0.2.2:3000
// Real Device: http://<your-ip>:3000
const API_BASE_URL = 'http://10.0.2.2:3000';

// ─── HexGrid ──────────────────────────────────────────────────────────────────

const HexGrid = () => {
  const hexSize = 38;
  const hexWidth = hexSize * Math.sqrt(3);
  const hexHeight = hexSize * 2;
  const columns = 5;
  const rows = 5;

  const renderHex = (col: number, row: number) => {
    const x = col * hexWidth + (row % 2 === 1 ? hexWidth / 2 : 0) + 48;
    const y = row * (hexHeight * 0.75) + 48;
    const factionIdx = Math.floor(Math.random() * 4);
    const color = factionIdx < 3 ? FACTIONS[factionIdx].color : '#1C1A24';
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      points.push(`${x + hexSize * Math.cos(angle)},${y + hexSize * Math.sin(angle)}`);
    }
    return (
      <G key={`${col}-${row}`}>
        <Polygon points={points.join(' ')} fill={color} stroke={C.border} strokeWidth="1.5" opacity={0.85} />
      </G>
    );
  };

  const hexes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      hexes.push(renderHex(c, r));
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={styles.screenContainer}>
      <Text style={styles.screenTitle}>Territory Control</Text>
      <Text style={styles.screenSubtitle}>H3 hex grid — faction dominance overview</Text>
      <View style={styles.hexContainer}>
        <Svg height="400" width={width - 48}>{hexes}</Svg>
      </View>
      <View style={styles.legend}>
        {FACTIONS.map(f => (
          <View key={f.id} style={styles.legendItem}>
            <View style={[styles.colorBox, { backgroundColor: f.color }]} />
            <Text style={styles.legendText}>{f.name}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// ─── AuthScreen ───────────────────────────────────────────────────────────────

const AuthScreen = ({
  mode,
  setMode,
  onLoginSuccess,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onLoginSuccess: (user: AuthUser) => void;
}) => {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [username,  setUsername]  = useState('');
  const [factionId, setFactionId] = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [errorMsg,  setErrorMsg]  = useState('');

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!email || !password || (mode === 'register' && !username)) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { email, username, password, factionId };

      const res  = await fetch(`${API_BASE_URL}${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong');
        return;
      }
      onLoginSuccess({ id: data.id, username: data.username, factionId: data.factionId });
    } catch {
      setErrorMsg('Cannot connect to server. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.authContainer}
    >
      <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>◎</Text>
          <Text style={styles.logoText}>PLACE FINDER</Text>
          <Text style={styles.logoTagline}>Claim your territory</Text>
        </View>

        {/* Mode tabs */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
            onPress={() => { setMode('login'); setErrorMsg(''); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>
              SIGN IN
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}
            onPress={() => { setMode('register'); setErrorMsg(''); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeTabText, mode === 'register' && styles.modeTabTextActive]}>
              REGISTER
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form card */}
        <View style={styles.authCard}>
          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CALLSIGN</Text>
              <TextInput
                style={styles.input}
                placeholder="Choose a username"
                placeholderTextColor={C.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={C.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={C.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FACTION</Text>
              <View style={styles.factionRow}>
                {FACTIONS.map(f => (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.factionBtn,
                      factionId === f.id && { borderColor: f.color, backgroundColor: f.color + '18' },
                    ]}
                    onPress={() => setFactionId(f.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.factionDot, { backgroundColor: f.color }]} />
                    <Text style={[styles.factionBtnText, factionId === f.id && { color: f.color }]}>
                      {f.name}
                    </Text>
                    {factionId === f.id && (
                      <View style={[styles.factionCheck, { backgroundColor: f.color }]}>
                        <Text style={styles.factionCheckMark}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.bg} />
              : <Text style={styles.primaryButtonText}>
                  {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                </Text>
            }
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── ProfileScreen ────────────────────────────────────────────────────────────

const ProfileScreen = ({ user, onLogout }: { user: AuthUser; onLogout: () => void }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/users/${user.id}/profile`);
      if (!res.ok) throw new Error('Failed');
      setProfile(await res.json());
    } catch {
      setError('Could not load profile. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel',  style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: onLogout },
    ]);

  if (loading) {
    return (
      <View style={[styles.screenContainer, { justifyContent: 'center', backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={[styles.screenSubtitle, { marginTop: 16 }]}>Loading profile…</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.screenContainer, { justifyContent: 'center', backgroundColor: C.bg }]}>
        <Text style={styles.errorText}>{error || 'Profile not found.'}</Text>
        <TouchableOpacity style={[styles.primaryButton, { marginTop: 20, alignSelf: 'center', width: 160 }]} onPress={fetchProfile}>
          <Text style={styles.primaryButtonText}>RETRY</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.profileScroll} contentContainerStyle={styles.profileScrollContent}>

      {/* Avatar */}
      <View style={styles.profileHeader}>
        <View style={[styles.profileAvatar, { borderColor: profile.factionColor }]}>
          {profile.profilePicture
            ? <Image source={{ uri: profile.profilePicture }} style={styles.profileAvatarImage} />
            : <Text style={styles.profileAvatarInitial}>{profile.username.charAt(0).toUpperCase()}</Text>
          }
        </View>
        <Text style={styles.profileUsername}>{profile.username}</Text>
        <View style={[
          styles.factionBadge,
          { backgroundColor: profile.factionColor + '1A', borderColor: profile.factionColor + '50' },
        ]}>
          <Text style={[styles.factionBadgeText, { color: profile.factionColor }]}>
            {profile.factionName.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>Lv.{profile.level}</Text>
          <Text style={styles.statLabel}>LEVEL</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{profile.totalPoints}</Text>
          <Text style={styles.statLabel}>POINTS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: C.primary }]}>{profile.streak}🔥</Text>
          <Text style={styles.statLabel}>STREAK</Text>
        </View>
      </View>

      {/* Streak banner */}
      <View style={styles.streakBanner}>
        <Text style={styles.streakEmoji}>🔥</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.streakTitle}>
            {profile.streak > 0 ? `${profile.streak}-day discovery streak!` : 'No active streak'}
          </Text>
          <Text style={styles.streakSub}>
            {profile.streak > 0
              ? 'Keep exploring new places every day'
              : 'Discover a new place today to start your streak'}
          </Text>
        </View>
      </View>

      {/* Recent reviews */}
      <Text style={styles.sectionTitle}>Recent Reviews</Text>

      {profile.recentReviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyText}>No reviews yet. Go explore some places!</Text>
        </View>
      ) : (
        profile.recentReviews.map(review => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewCardTop}>
              <Text style={styles.reviewVenueName} numberOfLines={1}>{review.venueName}</Text>
              <Text style={styles.reviewStars}>
                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
              </Text>
            </View>
            <Text style={styles.reviewDate}>
              {new Date(review.createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </Text>
            {review.content ? <Text style={styles.reviewContent}>{review.content}</Text> : null}
          </View>
        ))
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout} activeOpacity={0.75}>
        <Text style={styles.logoutText}>LOG OUT</Text>
      </TouchableOpacity>

    </ScrollView>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [authMode,  setAuthMode]  = useState<AuthMode>('login');
  const [venues,    setVenues]    = useState<any[]>([]);
  const [authUser,  setAuthUser]  = useState<AuthUser | null>(null);

  useEffect(() => {
    if (activeTab === 'map') fetchVenues();
  }, [activeTab]);

  const fetchVenues = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/venues`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setVenues(data.features || []);
    } catch (error) {
      console.warn('Failed to fetch venues. Make sure the server is running.', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.main}>
        {activeTab === 'map' && (
          <View style={styles.flex1}>
            <MapView
              style={styles.map}
              initialRegion={{ latitude: 40.9882, longitude: 29.0267, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
              userInterfaceStyle="dark"
              customMapStyle={darkMapStyle}
            >
              <Circle
                center={{ latitude: 40.9882, longitude: 29.0267 }}
                radius={1000}
                fillColor="rgba(232, 160, 0, 0.08)"
                strokeColor="rgba(232, 160, 0, 0.35)"
                strokeWidth={1}
              />
              {venues.map((venue: any) => (
                <Marker
                  key={venue.id || venue.properties['@id']}
                  coordinate={{
                    latitude:  venue.geometry.coordinates[1],
                    longitude: venue.geometry.coordinates[0],
                  }}
                  title={venue.properties.name || 'Venue'}
                  description={venue.properties.amenity}
                  pinColor="#ff451b"
                />
              ))}
            </MapView>
            <View style={styles.mapOverlay}>
              <Text style={styles.overlayText}>Kadıköy District</Text>
            </View>
          </View>
        )}

        {activeTab === 'hex' && <HexGrid />}

        {activeTab === 'profile' && (
          authUser
            ? <ProfileScreen user={authUser} onLogout={() => setAuthUser(null)} />
            : <AuthScreen mode={authMode} setMode={setAuthMode} onLoginSuccess={setAuthUser} />
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'map',     icon: '📍', label: 'Map'     },
          { key: 'hex',     icon: '⬡',  label: 'Hex'     },
          { key: 'profile', icon: '👤', label: 'Profile' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            {activeTab === tab.key && <View style={styles.tabActiveBar} />}
            <Text style={[styles.tabIcon, activeTab === tab.key && styles.activeTabIcon]}>
              {tab.icon}
            </Text>
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ─── Map style ────────────────────────────────────────────────────────────────

const darkMapStyle = [
  { elementType: 'geometry',            stylers: [{ color: '#1A1720' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#9C9080' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#0E0C14' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#C8B896' }] },
  { featureType: 'poi',                 elementType: 'labels.text.fill',    stylers: [{ color: '#7A7260' }] },
  { featureType: 'road',                elementType: 'geometry',            stylers: [{ color: '#2C2830' }] },
  { featureType: 'road',                elementType: 'geometry.stroke',     stylers: [{ color: '#1A1720' }] },
  { featureType: 'road',                elementType: 'labels.text.fill',    stylers: [{ color: '#58524E' }] },
  { featureType: 'water',               elementType: 'geometry',            stylers: [{ color: '#070610' }] },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const SERIF  = Platform.OS === 'ios' ? 'Georgia'  : 'serif';
const MONO   = Platform.OS === 'ios' ? 'Courier'  : 'monospace';

const styles = StyleSheet.create({
  // Layout
  safeArea: { flex: 1, backgroundColor: C.bg },
  flex1:    { flex: 1 },
  main:     { flex: 1, backgroundColor: C.bg },
  map:      { width: '100%', height: '100%' },

  // Map overlay
  mapOverlay: {
    position:        'absolute',
    top:             20,
    left:            20,
    backgroundColor: 'rgba(12, 11, 16, 0.82)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius:    4,
    borderWidth:     1,
    borderColor:     C.border,
    borderTopWidth:  2,
    borderTopColor:  C.primary,
  },
  overlayText: {
    color:       C.textMain,
    fontWeight:  '600',
    fontSize:    13,
    letterSpacing: 0.5,
  },

  // Hex screen
  screenContainer: {
    alignItems: 'center',
    padding:    24,
    paddingTop: 40,
    backgroundColor: C.bg,
  },
  screenTitle: {
    fontSize:      26,
    fontWeight:    'bold',
    color:         C.textMain,
    marginBottom:  6,
    fontFamily:    SERIF,
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    fontSize:     14,
    color:        C.textMuted,
    textAlign:    'center',
    marginBottom: 28,
  },
  hexContainer: {
    backgroundColor: C.card,
    borderRadius:    8,
    padding:         12,
    borderWidth:     1,
    borderColor:     C.border,
    borderTopWidth:  2,
    borderTopColor:  C.primary,
  },
  legend: {
    flexDirection: 'row',
    marginTop:     28,
    flexWrap:      'wrap',
    justifyContent: 'center',
    gap:            4,
  },
  legendItem: {
    flexDirection:   'row',
    alignItems:      'center',
    marginHorizontal: 10,
    marginVertical:   6,
  },
  colorBox: {
    width:        14,
    height:       14,
    borderRadius: 3,
    marginRight:  8,
  },
  legendText: {
    color:    C.textMuted,
    fontSize: 13,
  },

  // Auth
  authContainer: { flex: 1, backgroundColor: C.bg },
  authScroll:    { padding: 24, paddingTop: 48, flexGrow: 1 },

  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: {
    fontSize:   44,
    marginBottom: 10,
    color:      C.primary,
  },
  logoText: {
    fontSize:      20,
    fontWeight:    '900',
    color:         C.primary,
    letterSpacing: 7,
    fontFamily:    SERIF,
  },
  logoTagline: {
    fontSize:      11,
    color:         C.textMuted,
    letterSpacing: 3,
    marginTop:     6,
    textTransform: 'uppercase',
  },

  // Mode tabs
  modeTabs: {
    flexDirection:   'row',
    backgroundColor: C.card,
    borderRadius:    6,
    borderWidth:     1,
    borderColor:     C.border,
    marginBottom:    24,
    overflow:        'hidden',
  },
  modeTab: {
    flex:            1,
    paddingVertical: 14,
    alignItems:      'center',
  },
  modeTabActive: {
    backgroundColor: C.primary,
  },
  modeTabText: {
    color:         C.textMuted,
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 2,
  },
  modeTabTextActive: {
    color: C.bg,
  },

  // Auth card
  authCard: {
    backgroundColor: C.card,
    borderRadius:    6,
    borderWidth:     1,
    borderColor:     C.border,
    borderTopWidth:  2,
    borderTopColor:  C.primary,
    padding:         20,
  },

  // Form
  inputGroup: { marginBottom: 20 },
  label: {
    color:         C.textMuted,
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    marginBottom:  10,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    4,
    paddingVertical: 16,
    paddingHorizontal: 16,
    color:           C.textMain,
    fontSize:        16,
    minHeight:       52,
  },

  // Faction picker
  factionRow: { gap: 10 },
  factionBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    paddingVertical:  16,
    paddingHorizontal: 16,
    borderRadius:     4,
    borderWidth:      1,
    borderColor:      C.border,
    backgroundColor:  'rgba(0,0,0,0.2)',
    minHeight:        52,
  },
  factionDot: {
    width:        10,
    height:       10,
    borderRadius: 2,
  },
  factionBtnText: {
    color:      C.textMuted,
    fontWeight: '600',
    fontSize:   15,
    flex:       1,
  },
  factionCheck: {
    width:          22,
    height:         22,
    borderRadius:   3,
    alignItems:     'center',
    justifyContent: 'center',
  },
  factionCheckMark: {
    color:      C.bg,
    fontSize:   13,
    fontWeight: '700',
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth:     1,
    borderColor:     'rgba(248,113,113,0.25)',
    borderRadius:    4,
    padding:         12,
    marginBottom:    16,
  },
  errorText: {
    color:     C.error,
    fontSize:  13,
    textAlign: 'center',
  },

  // Buttons
  primaryButton: {
    backgroundColor:  C.primary,
    borderRadius:     4,
    paddingVertical:  18,
    paddingHorizontal: 24,
    alignItems:       'center',
    marginTop:        8,
    minHeight:        56,
    justifyContent:   'center',
  },
  primaryButtonText: {
    color:         C.bg,
    fontWeight:    '700',
    fontSize:      15,
    letterSpacing: 2,
  },

  // Profile
  profileScroll:        { flex: 1, backgroundColor: C.bg },
  profileScrollContent: { padding: 20, paddingBottom: 48 },

  profileHeader: { alignItems: 'center', marginBottom: 24, paddingTop: 16 },
  profileAvatar: {
    width:          88,
    height:         88,
    borderRadius:   6,
    borderWidth:    2,
    backgroundColor: C.card,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
    marginBottom:   14,
  },
  profileAvatarImage:   { width: '100%', height: '100%' },
  profileAvatarInitial: {
    fontSize:   34,
    fontWeight: 'bold',
    color:      C.primary,
    fontFamily: SERIF,
  },
  profileUsername: {
    fontSize:      22,
    fontWeight:    'bold',
    color:         C.textMain,
    marginBottom:  10,
    fontFamily:    SERIF,
  },
  factionBadge: {
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderRadius:      99,
    borderWidth:       1,
  },
  factionBadgeText: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
  },

  // Stats
  statsRow: {
    flexDirection:  'row',
    backgroundColor: C.card,
    borderRadius:   6,
    borderWidth:    1,
    borderColor:    C.border,
    borderTopWidth: 2,
    borderTopColor: C.primary,
    marginBottom:   12,
    overflow:       'hidden',
  },
  statCell: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 18,
  },
  statDivider: { width: 1, backgroundColor: C.border },
  statValue: {
    fontSize:     20,
    fontWeight:   'bold',
    color:        C.textMain,
    marginBottom: 3,
    fontFamily:   SERIF,
  },
  statLabel: {
    fontSize:      10,
    color:         C.textMuted,
    letterSpacing: 1.5,
    fontFamily:    MONO,
  },

  // Streak
  streakBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            14,
    backgroundColor: 'rgba(232,160,0,0.08)',
    borderWidth:    1,
    borderColor:    'rgba(232,160,0,0.22)',
    borderRadius:   6,
    padding:        16,
    marginBottom:   24,
  },
  streakEmoji: { fontSize: 26 },
  streakTitle: {
    fontSize:   14,
    fontWeight: 'bold',
    color:      C.primary,
  },
  streakSub: {
    fontSize:   12,
    color:      C.textMuted,
    marginTop:  3,
    lineHeight: 16,
  },

  // Section title
  sectionTitle: {
    fontSize:      11,
    fontWeight:    '700',
    color:         C.textMuted,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom:  14,
    fontFamily:    MONO,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyEmoji: { fontSize: 36 },
  emptyText:  { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Review cards
  reviewCard: {
    backgroundColor: C.card,
    borderWidth:     1,
    borderColor:     C.border,
    borderLeftWidth: 2,
    borderLeftColor: C.primary,
    borderRadius:    4,
    padding:         16,
    marginBottom:    10,
  },
  reviewCardTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   5,
  },
  reviewVenueName: {
    flex:       1,
    fontSize:   14,
    fontWeight: '600',
    color:      C.textMain,
    marginRight: 10,
  },
  reviewStars: {
    fontSize: 13,
    color:    C.primary,
  },
  reviewDate: {
    fontSize:   11,
    color:      C.textMuted,
    fontFamily: MONO,
    marginBottom: 8,
  },
  reviewContent: {
    fontSize:   14,
    color:      C.textMain,
    lineHeight: 20,
    opacity:    0.85,
  },

  // Logout
  logoutButton: {
    marginTop:        28,
    paddingVertical:  18,
    paddingHorizontal: 24,
    borderRadius:     4,
    borderWidth:      1,
    borderColor:      'rgba(248,68,68,0.35)',
    alignItems:       'center',
    minHeight:        56,
    justifyContent:   'center',
  },
  logoutText: {
    color:         C.error,
    fontWeight:    '700',
    letterSpacing: 2,
    fontSize:      13,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.tabBar,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom:  Platform.OS === 'ios' ? 26 : 10,
    paddingTop:     10,
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position:       'relative',
    minHeight:      48,
  },
  tabActiveBar: {
    position:        'absolute',
    top:             0,
    left:            '25%',
    right:           '25%',
    height:          2,
    backgroundColor: C.primary,
    borderRadius:    1,
  },
  tabIcon: {
    fontSize:     22,
    opacity:      0.35,
    marginBottom: 5,
  },
  activeTabIcon: { opacity: 1 },
  tabText: {
    fontSize:  11,
    color:     C.textMuted,
    letterSpacing: 0.4,
  },
  activeTabText: {
    color:      C.primary,
    fontWeight: '700',
  },
});
