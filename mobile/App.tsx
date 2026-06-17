import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Circle, Marker, Polygon } from 'react-native-maps';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = 'login' | 'register';
type Tab = 'map' | 'hex' | 'factions' | 'profile';
type SubScreen = null | 'createFaction' | 'factionChat';

interface AuthUser {
  id: number;
  username: string;
  factionId: number;
}

interface FactionInfo {
  id: number;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  memberCount: number;
  totalPoints: number;
  createdAt: string;
  creatorName: string | null;
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

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

const EMOJI_OPTIONS = [
  '⚔️','🛡️','🏰','👑','🔥','⚡','🌊','🌪️',
  '🐉','🦁','🐺','🦅','🦊','🐻','🦈','🦂',
  '💀','🗡️','🪓','🏹','🔱','⚜️','🌟','💥',
  '🧊','🌑','☠️','🎯','🪬','🔮','🧿','🪄',
];

// Note: Adjust this URL based on your environment
// iOS Simulator: http://localhost:3000
// Android Emulator: http://10.0.2.2:3000
// Real Device: http://<your-ip>:3000
const API_BASE_URL = 'http://10.0.2.2:3000';

const REVIEW_RADIUS = 300; // metres


function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toR = (d: number) => d * Math.PI / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// ─── VenueReviewSheet ─────────────────────────────────────────────────────────

interface SelectedVenue { name: string; lat: number; lon: number; amenity: string }
interface UserLocation  { lat: number; lon: number }

const VenueReviewSheet = ({
  venue, userLocation, authUser, onClose, onSubmitted,
}: {
  venue: SelectedVenue;
  userLocation: UserLocation | null;
  authUser: AuthUser | null;
  onClose: () => void;
  onSubmitted: () => void;
}) => {
  const [rating,     setRating]     = useState(5);
  const [content,    setContent]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  const distance = userLocation
    ? haversineDistance(userLocation.lat, userLocation.lon, venue.lat, venue.lon)
    : null;
  const isNearby = distance !== null && distance <= REVIEW_RADIUS;
  const canReview = isNearby && !!authUser && !submitted;

  const handleSubmit = async () => {
    if (!canReview || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reviews`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authUser!.id,
          venueName: venue.name,
          rating,
          content: content.trim() || undefined,
        }),
      });
      if (res.ok) { setSubmitted(true); setTimeout(onSubmitted, 1400); }
    } finally { setSubmitting(false); }
  };

  return (
    <View style={sheetStyles.sheet}>
      <View style={sheetStyles.handle} />

      <View style={sheetStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={sheetStyles.venueName} numberOfLines={1}>{venue.name}</Text>
          {venue.amenity ? <Text style={sheetStyles.venueAmenity}>{venue.amenity}</Text> : null}
        </View>
        <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn} activeOpacity={0.7}>
          <Text style={{ color: C.textMuted, fontSize: 20, lineHeight: 22 }}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={[sheetStyles.distancePill, { borderColor: isNearby ? '#10b981' : distance === null ? C.border : '#f87171' }]}>
        <Text style={{ fontSize: 13 }}>{isNearby ? '✅' : distance === null ? '📡' : '📍'}</Text>
        <Text style={[sheetStyles.distanceText, { color: isNearby ? '#10b981' : distance === null ? C.textMuted : '#f87171' }]}>
          {distance === null
            ? 'Locating you…'
            : isNearby
              ? `${fmtDist(distance)} away — close enough to review`
              : `${fmtDist(distance)} away — must be within ${REVIEW_RADIUS} m`}
        </Text>
      </View>

      {!authUser ? (
        <Text style={sheetStyles.prompt}>Log in to write a review.</Text>
      ) : submitted ? (
        <Text style={sheetStyles.success}>✓ Review submitted!</Text>
      ) : (
        <>
          <View style={sheetStyles.stars}>
            {[1, 2, 3, 4, 5].map(s => (
              <TouchableOpacity key={s} onPress={() => isNearby && setRating(s)} activeOpacity={0.7}>
                <Text style={[sheetStyles.star, {
                  color:   s <= rating ? C.primary : C.textMuted,
                  opacity: isNearby ? 1 : 0.3,
                }]}>
                  {s <= rating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[sheetStyles.commentInput, !isNearby && { opacity: 0.3 }]}
            placeholder="Share your experience (optional)"
            placeholderTextColor={C.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            editable={isNearby}
          />
          <TouchableOpacity
            style={[sheetStyles.submitBtn, !canReview && { opacity: 0.35 }]}
            onPress={handleSubmit}
            disabled={!canReview || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={C.bg} size="small" />
              : <Text style={sheetStyles.submitBtnText}>SUBMIT REVIEW</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const sheetStyles = StyleSheet.create({
  sheet: {
    position:            'absolute',
    bottom:              0,
    left:                0,
    right:               0,
    backgroundColor:     C.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth:      2,
    borderTopColor:      C.primary,
    padding:             16,
    paddingBottom:       Platform.OS === 'ios' ? 36 : 20,
    shadowColor:         '#000',
    shadowOffset:        { width: 0, height: -6 },
    shadowOpacity:       0.45,
    shadowRadius:        14,
    elevation:           12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center', marginBottom: 14,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 12, gap: 10,
  },
  venueName: {
    fontSize: 16, fontWeight: '700', color: C.textMain, marginBottom: 2,
  },
  venueAmenity: {
    fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1,
  },
  closeBtn: {
    width: 28, height: 28, borderRadius: 4,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  distancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 14, backgroundColor: 'rgba(0,0,0,0.2)',
  },
  distanceText: { fontSize: 13, flex: 1, lineHeight: 18 },
  prompt:  { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  success: { color: '#10b981',   fontSize: 15, textAlign: 'center', paddingVertical: 12, fontWeight: '700' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 14 },
  star:  { fontSize: 32 },
  commentInput: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1, borderColor: C.border, borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    color: C.textMain, fontSize: 14, minHeight: 72,
    marginBottom: 12, textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: C.primary, borderRadius: 4,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnText: {
    color: C.bg, fontWeight: '700', fontSize: 14, letterSpacing: 2,
  },
});

// ─── BackHeader ───────────────────────────────────────────────────────────────

const BackHeader = ({ onBack, title }: { onBack: () => void; title: string }) => (
  <View style={backHeaderStyles.container}>
    <TouchableOpacity onPress={onBack} style={backHeaderStyles.backBtn} activeOpacity={0.7}>
      <Text style={backHeaderStyles.backText}>← Back</Text>
    </TouchableOpacity>
    <Text style={backHeaderStyles.title} numberOfLines={1}>{title}</Text>
    <View style={{ width: 70 }} />
  </View>
);

const backHeaderStyles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 16,
    paddingVertical:  14,
    backgroundColor:  C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderTopWidth:   2,
    borderTopColor:   C.primary,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
    width: 70,
  },
  backText: {
    color:     C.primary,
    fontSize:  14,
    fontWeight: '600',
  },
  title: {
    flex:          1,
    textAlign:     'center',
    color:         C.textMain,
    fontWeight:    '700',
    fontSize:      15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

// ─── RealHexGrid ─────────────────────────────────────────────────────────────
// Hex cells + boundaries are computed server-side (h3-js v4 / Node.js).
// Mobile only renders the polygons returned by /territory/hexgrid.

interface HexCell {
  h3Index: string;
  factionId: number | null;
  boundary: { latitude: number; longitude: number }[];
}

const RealHexGrid = ({ factions }: { factions: FactionInfo[] }) => {
  const [hexData,      setHexData]      = useState<HexCell[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [tooZoomedOut, setTooZoomedOut] = useState(false);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build faction color map from live faction list
  const colorMap = useCallback((): Record<number, string> => {
    const map: Record<number, string> = { 1: '#FF3333', 2: '#3333FF', 3: '#33FF33' };
    factions.forEach(f => { map[f.id] = f.color; });
    return map;
  }, [factions]);

  const updateHexes = useCallback(async (region: {
    latitude: number; longitude: number;
    latitudeDelta: number; longitudeDelta: number;
  }) => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

    if (latitudeDelta > 0.18) {
      setTooZoomedOut(true);
      setHexData([]);
      return;
    }
    setTooZoomedOut(false);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/territory/hexgrid`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          north: latitude + latitudeDelta / 2,
          south: latitude - latitudeDelta / 2,
          east:  longitude + longitudeDelta / 2,
          west:  longitude - longitudeDelta / 2,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.tooLarge) { setTooZoomedOut(true); setHexData([]); }
        return;
      }

      setHexData(await res.json());
    } catch {
      // silent — backend might be down
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRegionChange = useCallback((region: any) => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => updateHexes(region), 600);
  }, [updateHexes]);

  const initialRegion = {
    latitude: 40.9882, longitude: 29.0267,
    latitudeDelta: 0.05, longitudeDelta: 0.05,
  };

  const colors = colorMap();

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        userInterfaceStyle="dark"
        customMapStyle={darkMapStyle}
        onRegionChangeComplete={handleRegionChange}
        onMapReady={() => updateHexes(initialRegion)}
      >
        {hexData.map(hex => {
          const fill = hex.factionId != null
            ? (colors[hex.factionId] ?? '#888888') + '66'
            : '#44444466';
          return (
            <Polygon
              key={hex.h3Index}
              coordinates={hex.boundary}
              fillColor={fill}
              strokeColor="rgba(255,255,255,0.18)"
              strokeWidth={0.5}
            />
          );
        })}
      </MapView>

      {loading && (
        <View style={hexGridStyles.loadingOverlay}>
          <ActivityIndicator color={C.primary} size="small" />
        </View>
      )}

      {tooZoomedOut && (
        <View style={hexGridStyles.zoomHint}>
          <Text style={hexGridStyles.zoomHintText}>Zoom in to see territory</Text>
        </View>
      )}

      <View style={hexGridStyles.legend}>
        {[
          { color: '#FF3333', name: 'Red' },
          { color: '#3333FF', name: 'Blue' },
          { color: '#33FF33', name: 'Green' },
          { color: '#444444', name: 'Unclaimed' },
        ].map(f => (
          <View key={f.name} style={hexGridStyles.legendItem}>
            <View style={[hexGridStyles.legendDot, { backgroundColor: f.color }]} />
            <Text style={hexGridStyles.legendText}>{f.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const hexGridStyles = StyleSheet.create({
  loadingOverlay: {
    position:        'absolute',
    top:             16,
    right:           16,
    backgroundColor: 'rgba(12,11,16,0.75)',
    borderRadius:    6,
    padding:         8,
    borderWidth:     1,
    borderColor:     C.border,
  },
  zoomHint: {
    position:        'absolute',
    top:             20,
    alignSelf:       'center',
    backgroundColor: 'rgba(12,11,16,0.85)',
    borderRadius:    6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth:     1,
    borderColor:     C.border,
    borderTopWidth:  2,
    borderTopColor:  C.primary,
  },
  zoomHintText: {
    color:     C.textMuted,
    fontSize:  13,
    fontWeight: '600',
  },
  legend: {
    position:        'absolute',
    bottom:          20,
    left:            16,
    backgroundColor: 'rgba(12,11,16,0.85)',
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap:             6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  legendDot: {
    width: 10, height: 10, borderRadius: 2,
  },
  legendText: {
    color:    C.textMuted,
    fontSize: 12,
  },
});

// ─── AuthScreen ───────────────────────────────────────────────────────────────

const AuthScreen = ({
  mode, setMode, onLoginSuccess, factions,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onLoginSuccess: (user: AuthUser) => void;
  factions: FactionInfo[];
}) => {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [username,  setUsername]  = useState('');
  const [factionId, setFactionId] = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [errorMsg,  setErrorMsg]  = useState('');

  useEffect(() => {
    if (factionId === 0 && factions.length > 0) {
      setFactionId(factions[0].id);
    }
  }, [factions]);

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!email || !password || (mode === 'register' && !username)) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (mode === 'register' && factionId === 0) {
      setErrorMsg('Please select a faction.');
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

        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>◎</Text>
          <Text style={styles.logoText}>PLACE FINDER</Text>
          <Text style={styles.logoTagline}>Claim your territory</Text>
        </View>

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
              {factions.length === 0 ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator color={C.primary} />
                  <Text style={[styles.label, { marginTop: 8 }]}>Loading factions…</Text>
                </View>
              ) : (
                <View style={styles.factionRow}>
                  {factions.map(f => (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.factionBtn,
                        factionId === f.id && { borderColor: f.color, backgroundColor: f.color + '18' },
                      ]}
                      onPress={() => setFactionId(f.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 14 }}>{f.icon}</Text>
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
              )}
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

// ─── FactionListScreen ────────────────────────────────────────────────────────

const FactionListScreen = ({
  factions, authUser, onJoin, onCreatePress, onOpenChat, onRefresh,
}: {
  factions: FactionInfo[];
  authUser: AuthUser | null;
  onJoin: (user: AuthUser) => void;
  onCreatePress: () => void;
  onOpenChat: () => void;
  onRefresh: () => Promise<void>;
}) => {
  const [joiningId,  setJoiningId]  = useState<number | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleJoin = async (factionId: number) => {
    if (!authUser) {
      Alert.alert('Login Required', 'Log in to join a faction.', [{ text: 'OK' }]);
      return;
    }
    setJoiningId(factionId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/factions/${factionId}/join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: authUser.id }),
      });
      if (res.ok) {
        const data = await res.json();
        onJoin({ ...authUser, factionId: data.factionId });
        await onRefresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to join faction');
      }
    } catch {
      setError('Cannot connect to server');
    } finally {
      setJoiningId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={listStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={listStyles.title}>Factions</Text>
          <Text style={listStyles.subtitle}>Join a faction to compete for territory</Text>
        </View>
        <TouchableOpacity style={listStyles.createBtn} onPress={onCreatePress} activeOpacity={0.8}>
          <Text style={listStyles.createBtnText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={listStyles.errorBanner}>
          <Text style={listStyles.errorBannerText}>{error}</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={listStyles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />
        }
      >
        {factions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⚔️</Text>
            <Text style={styles.emptyText}>No factions yet. Be the first to create one!</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 16, paddingHorizontal: 24 }]}
              onPress={onCreatePress}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>CREATE FACTION</Text>
            </TouchableOpacity>
          </View>
        ) : (
          factions.map(faction => {
            const isMine = authUser?.factionId === faction.id;
            return (
              <View key={faction.id} style={[listStyles.card, { borderLeftColor: faction.color }]}>
                <View style={[listStyles.cardIcon, { backgroundColor: faction.color }]}>
                  <Text style={{ fontSize: 20 }}>{faction.icon}</Text>
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={listStyles.cardName} numberOfLines={1}>{faction.name}</Text>
                    {isMine && (
                      <View style={[listStyles.mineBadge, { backgroundColor: faction.color }]}>
                        <Text style={listStyles.mineBadgeText}>YOURS</Text>
                      </View>
                    )}
                  </View>
                  {faction.description ? (
                    <Text style={listStyles.cardDesc} numberOfLines={2}>{faction.description}</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Text style={listStyles.cardMeta}>{faction.memberCount} member{faction.memberCount !== 1 ? 's' : ''}</Text>
                    <Text style={listStyles.cardMeta}>{faction.totalPoints.toLocaleString()} pts</Text>
                  </View>
                </View>

                <View style={{ flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
                  {isMine ? (
                    <TouchableOpacity style={listStyles.chatBtn} onPress={onOpenChat} activeOpacity={0.8}>
                      <Text style={listStyles.chatBtnText}>Chat</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[listStyles.joinBtn, joiningId === faction.id && { opacity: 0.5 }]}
                      onPress={() => handleJoin(faction.id)}
                      disabled={joiningId === faction.id}
                      activeOpacity={0.8}
                    >
                      <Text style={listStyles.joinBtnText}>
                        {joiningId === faction.id ? '…' : authUser ? 'Join' : 'Login'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const listStyles = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingVertical:  16,
    backgroundColor:  C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderTopWidth:   2,
    borderTopColor:   C.primary,
    gap:              12,
  },
  title: {
    fontSize:   18,
    fontWeight: '800',
    color:      C.textMain,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize:  12,
    color:     C.textMuted,
    marginTop: 2,
  },
  createBtn: {
    backgroundColor: C.primary,
    borderRadius:    6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  createBtnText: {
    color:      C.bg,
    fontWeight: '700',
    fontSize:   13,
  },
  errorBanner: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(248,113,113,0.3)',
    padding: 12,
  },
  errorBannerText: {
    color: C.error, fontSize: 13, textAlign: 'center',
  },
  list: {
    padding: 12,
    gap:     10,
  },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: C.card,
    borderWidth:     1,
    borderColor:     C.border,
    borderLeftWidth: 4,
    borderRadius:    8,
    padding:         14,
  },
  cardIcon: {
    width:          44,
    height:         44,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  cardName: {
    fontSize:   15,
    fontWeight: '700',
    color:      C.textMain,
    flex:       1,
  },
  mineBadge: {
    borderRadius:     4,
    paddingHorizontal: 6,
    paddingVertical:  2,
  },
  mineBadgeText: {
    fontSize:  9,
    fontWeight: '800',
    color:     '#000',
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize:   12,
    color:      C.textMuted,
    marginTop:  3,
    lineHeight: 17,
  },
  cardMeta: {
    fontSize: 11,
    color:    C.textMuted,
  },
  joinBtn: {
    borderWidth:     1,
    borderColor:     C.primary,
    borderRadius:    6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  joinBtnText: {
    color:      C.primary,
    fontWeight: '700',
    fontSize:   13,
  },
  chatBtn: {
    backgroundColor: C.primary,
    borderRadius:    6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chatBtnText: {
    color:      C.bg,
    fontWeight: '700',
    fontSize:   13,
  },
});

// ─── CreateFactionScreen ──────────────────────────────────────────────────────

const CreateFactionScreen = ({
  authUser, onBack, onCreated,
}: {
  authUser: AuthUser | null;
  onBack: () => void;
  onCreated: (updatedUser: AuthUser) => void;
}) => {
  const [name,        setName]        = useState('');
  const [color,       setColor]       = useState('#3b82f6');
  const [icon,        setIcon]        = useState('⚔️');
  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Faction name is required'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/factions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:        name.trim(),
          color,
          icon,
          description: description.trim() || null,
          createdBy:   authUser!.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated({ ...authUser!, factionId: data.id });
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.details || data?.error || 'Failed to create faction');
      }
    } catch {
      setError('Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (!authUser) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <BackHeader onBack={onBack} title="Create Faction" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
          <Text style={{ fontSize: 40 }}>🏰</Text>
          <Text style={styles.screenTitle}>Login Required</Text>
          <Text style={styles.screenSubtitle}>You must be logged in to create a faction.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <BackHeader onBack={onBack} title="Create Faction" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={createStyles.scroll} keyboardShouldPersistTaps="handled">

          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>FACTION NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter faction name"
              placeholderTextColor={C.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={40}
            />
          </View>

          {/* Icon picker */}
          <View>
            <Text style={[styles.label, { marginBottom: 10 }]}>FACTION ICON</Text>
            <View style={createStyles.emojiGrid}>
              {EMOJI_OPTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    createStyles.emojiBtn,
                    icon === emoji && { borderColor: color, backgroundColor: color + '22' },
                  ]}
                  onPress={() => setIcon(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Color picker */}
          <View>
            <Text style={[styles.label, { marginBottom: 10 }]}>FACTION COLOR</Text>
            <View style={createStyles.colorRow}>
              {PRESET_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    createStyles.colorBtn,
                    { backgroundColor: c },
                    color === c && { borderWidth: 2.5, borderColor: '#fff' },
                  ]}
                  onPress={() => setColor(c)}
                  activeOpacity={0.75}
                />
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }]}
              placeholder="What is your faction about?"
              placeholderTextColor={C.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={280}
            />
          </View>

          {/* Live preview */}
          <View style={[createStyles.preview, { borderLeftColor: color }]}>
            <View style={[createStyles.previewIcon, { backgroundColor: color }]}>
              <Text style={{ fontSize: 22 }}>{icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={createStyles.previewName}>{name || 'Faction Name'}</Text>
              {description ? (
                <Text style={createStyles.previewDesc} numberOfLines={2}>{description}</Text>
              ) : null}
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.bg} />
              : <Text style={styles.primaryButtonText}>CREATE FACTION</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const createStyles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap:     20,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           6,
    backgroundColor: C.card,
    borderWidth:   1,
    borderColor:   C.border,
    borderRadius:  8,
    padding:       10,
  },
  emojiBtn: {
    width:          40,
    height:         40,
    borderRadius:   6,
    borderWidth:    2,
    borderColor:    'transparent',
    alignItems:     'center',
    justifyContent: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    gap:           10,
    flexWrap:      'wrap',
  },
  colorBtn: {
    width:        34,
    height:       34,
    borderRadius: 6,
    borderWidth:  2,
    borderColor:  'transparent',
  },
  preview: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backgroundColor: C.card,
    borderWidth:     1,
    borderColor:     C.border,
    borderLeftWidth: 4,
    borderRadius:    8,
    padding:         14,
  },
  previewIcon: {
    width:          42,
    height:         42,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  previewName: {
    fontSize:   15,
    fontWeight: '700',
    color:      C.textMain,
  },
  previewDesc: {
    fontSize:   12,
    color:      C.textMuted,
    marginTop:  3,
    lineHeight: 17,
  },
});

// ─── FactionScreen (chat) ─────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  userId: number;
  content: string;
  type: string;
  createdAt: string;
  user: { username: string; profilePicture: string | null };
}

interface FactionMember {
  id: number;
  username: string;
  profilePicture: string | null;
  level: number;
}

const FactionScreen = ({ user, factions }: { user: AuthUser; factions: FactionInfo[] }) => {
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [members,     setMembers]     = useState<FactionMember[]>([]);
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [showPicker,  setShowPicker]  = useState(false);
  const [venues,      setVenues]      = useState<string[]>([]);
  const [venueSearch, setVenueSearch] = useState('');
  const scrollRef = React.useRef<ScrollView>(null);

  const faction = factions.find(f => f.id === user.factionId);
  const factionColor = faction?.color ?? C.primary;
  const factionName  = faction?.name  ?? 'Faction';

  useEffect(() => {
    fetchMessages();
    fetchMembers();
    fetchVenues();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/factions/${user.factionId}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch { /* silent */ }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/factions/${user.factionId}/members`);
      if (res.ok) setMembers(await res.json());
    } catch { /* silent */ }
  };

  const fetchVenues = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/venues`);
      if (!res.ok) return;
      const data = await res.json();
      const names: string[] = (data.features || [])
        .map((f: any) => f.properties?.name)
        .filter(Boolean);
      setVenues([...new Set(names)] as string[]);
    } catch { /* silent */ }
  };

  const sendMessage = async (content: string, type = 'text') => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`${API_BASE_URL}/factions/${user.factionId}/messages`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: user.id, content: content.trim(), type }),
      });
      await fetchMessages();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  };

  const filteredVenues = venues
    .filter(v => v.toLowerCase().includes(venueSearch.toLowerCase()))
    .slice(0, 25);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[factionStyles.header, { borderTopColor: factionColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: factionColor }} />
          <Text style={factionStyles.headerName}>{factionName}</Text>
          <View style={factionStyles.memberBadge}>
            <Text style={factionStyles.memberBadgeText}>{members.length} members</Text>
          </View>
        </View>
      </View>

      {members.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={factionStyles.membersRow} contentContainerStyle={{ padding: 10, gap: 8 }}>
          {members.map(m => (
            <View key={m.id} style={factionStyles.memberChip}>
              <View style={[factionStyles.memberAvatar, { borderColor: factionColor }]}>
                {m.profilePicture
                  ? <Image source={{ uri: m.profilePicture }} style={{ width: '100%', height: '100%' }} />
                  : <Text style={factionStyles.memberInitial}>{m.username.charAt(0).toUpperCase()}</Text>
                }
              </View>
              <Text style={factionStyles.memberName} numberOfLines={1}>{m.username}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={factionStyles.messagesList}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⚔️</Text>
            <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
          </View>
        )}
        {messages.map(msg => {
          const isOwn = msg.userId === user.id;
          return (
            <View key={msg.id} style={factionStyles.msgRow}>
              <View style={factionStyles.msgAvatar}>
                {msg.user.profilePicture
                  ? <Image source={{ uri: msg.user.profilePicture }} style={{ width: 30, height: 30, borderRadius: 4 }} />
                  : <Text style={factionStyles.msgAvatarText}>{msg.user.username.charAt(0).toUpperCase()}</Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <View style={factionStyles.msgMeta}>
                  <Text style={[factionStyles.msgAuthor, isOwn && { color: factionColor }]}>{msg.user.username}</Text>
                  <Text style={factionStyles.msgTime}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {msg.type === 'venue' ? (
                  <View style={factionStyles.venueCard}>
                    <Text style={{ fontSize: 14 }}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={factionStyles.venueCardLabel}>Shared place</Text>
                      <Text style={factionStyles.venueCardName} numberOfLines={1}>{msg.content}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={factionStyles.msgText}>{msg.content}</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {showPicker && (
        <View style={factionStyles.venuePicker}>
          <View style={factionStyles.venuePickerHeader}>
            <Text style={factionStyles.venuePickerTitle}>Share a place</Text>
            <TouchableOpacity onPress={() => { setShowPicker(false); setVenueSearch(''); }}>
              <Text style={{ color: C.textMuted, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { marginBottom: 8 }]}
            placeholder="Search venues…"
            placeholderTextColor={C.textMuted}
            value={venueSearch}
            onChangeText={setVenueSearch}
          />
          <ScrollView style={{ maxHeight: 200 }}>
            {filteredVenues.map(v => (
              <TouchableOpacity
                key={v}
                style={factionStyles.venueItem}
                onPress={() => { setShowPicker(false); setVenueSearch(''); sendMessage(v, 'venue'); }}
              >
                <Text style={{ fontSize: 13 }}>📍</Text>
                <Text style={factionStyles.venueItemText} numberOfLines={1}>{v}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={factionStyles.inputBar}>
          <TouchableOpacity style={factionStyles.shareBtn} onPress={() => setShowPicker(v => !v)}>
            <Text style={{ fontSize: 16 }}>📍</Text>
          </TouchableOpacity>
          <TextInput
            style={factionStyles.textInput}
            placeholder="Message your faction…"
            placeholderTextColor={C.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[factionStyles.sendBtn, { borderColor: factionColor }, (!text.trim() || sending) && { opacity: 0.35 }]}
            onPress={() => { sendMessage(text); setText(''); }}
            disabled={!text.trim() || sending}
          >
            <Text style={[factionStyles.sendBtnText, { color: factionColor }]}>▶</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const factionStyles = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 16,
    paddingVertical:  14,
    backgroundColor:  C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderTopWidth:   2,
  },
  headerName: {
    fontWeight:    '800',
    fontSize:      15,
    color:         C.textMain,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  memberBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    99,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  memberBadgeText: {
    fontSize:   10,
    color:      C.textMuted,
    letterSpacing: 0.5,
  },
  membersRow: {
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexShrink:      0,
    maxHeight:       80,
  },
  memberChip: {
    alignItems:  'center',
    gap:         4,
    width:       52,
  },
  memberAvatar: {
    width:          36,
    height:         36,
    borderRadius:   4,
    borderWidth:    1,
    backgroundColor: C.bg,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  memberInitial: { fontSize: 16, fontWeight: '700', color: C.primary },
  memberName:    { fontSize: 9, color: C.textMuted, textAlign: 'center' },
  messagesList:  { padding: 12, gap: 12 },
  msgRow:        { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  msgAvatar: {
    width:          30,
    height:         30,
    borderRadius:   4,
    backgroundColor: C.card,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    overflow:       'hidden',
  },
  msgAvatarText: { fontSize: 13, fontWeight: '700', color: C.primary },
  msgMeta:       { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  msgAuthor:     { fontSize: 13, fontWeight: '600', color: C.textMain },
  msgTime:       { fontSize: 10, color: C.textMuted },
  msgText:       { fontSize: 14, color: C.textMain, lineHeight: 20, opacity: 0.9 },
  venueCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth:     1,
    borderColor:     C.border,
    borderLeftWidth: 2,
    borderLeftColor: C.primary,
    borderRadius:    4,
    padding:         10,
    maxWidth:        240,
  },
  venueCardLabel: { fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  venueCardName:  { fontSize: 13, fontWeight: '600', color: C.textMain },
  venuePicker: {
    backgroundColor: C.card,
    borderTopWidth:  2,
    borderTopColor:  C.primary,
    borderColor:     C.border,
    borderWidth:     1,
    borderRadius:    6,
    padding:         14,
    margin:          10,
  },
  venuePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  venuePickerTitle:  { fontSize: 13, fontWeight: '700', color: C.textMain, letterSpacing: 0.5 },
  venueItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  venueItemText: { fontSize: 13, color: C.textMain, flex: 1 },
  inputBar: {
    flexDirection:    'row',
    alignItems:       'flex-end',
    gap:              8,
    padding:          10,
    paddingBottom:    Platform.OS === 'ios' ? 20 : 10,
    backgroundColor:  C.card,
    borderTopWidth:   1,
    borderTopColor:   C.border,
  },
  shareBtn: {
    width:          40,
    height:         40,
    borderRadius:   4,
    borderWidth:    1,
    borderColor:    C.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  textInput: {
    flex:              1,
    backgroundColor:   'rgba(0,0,0,0.25)',
    borderWidth:       1,
    borderColor:       C.border,
    borderRadius:      4,
    paddingVertical:   10,
    paddingHorizontal: 12,
    color:             C.textMain,
    fontSize:          14,
    maxHeight:         90,
  },
  sendBtn: {
    width:          40,
    height:         40,
    borderRadius:   4,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sendBtnText: { fontSize: 14, fontWeight: '700' },
});

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

function App() {
  const [activeTab,     setActiveTab]     = useState<Tab>('map');
  const [subScreen,     setSubScreen]     = useState<SubScreen>(null);
  const [authMode,      setAuthMode]      = useState<AuthMode>('login');
  const [venues,        setVenues]        = useState<any[]>([]);
  const [authUser,      setAuthUser]      = useState<AuthUser | null>(null);
  const [userLocation,  setUserLocation]  = useState<UserLocation | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);
  const [factions,      setFactions]      = useState<FactionInfo[]>([]);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        loc => setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude }),
      );
    })();
    return () => { sub?.remove(); };
  }, []);

  useEffect(() => {
    fetchFactions();
    if (activeTab === 'map') fetchVenues();
  }, [activeTab]);

  const fetchFactions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/factions`);
      if (res.ok) setFactions(await res.json());
    } catch { /* silent */ }
  }, []);

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

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'map',      icon: '📍', label: 'Map'      },
    { key: 'hex',      icon: '🔷',  label: 'Hex'      },
    { key: 'factions', icon: '⚔️', label: 'Factions' },
    { key: 'profile',  icon: '👤', label: 'Profile'  },
  ];

  // Sub-screens render full-screen, hiding tabs
  if (subScreen === 'createFaction') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <CreateFactionScreen
          authUser={authUser}
          onBack={() => setSubScreen(null)}
          onCreated={(updatedUser) => {
            setAuthUser(updatedUser);
            setSubScreen(null);
            fetchFactions();
          }}
        />
      </SafeAreaView>
    );
  }

  if (subScreen === 'factionChat' && authUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <BackHeader onBack={() => setSubScreen(null)} title="Faction Chat" />
        <FactionScreen user={authUser} factions={factions} />
      </SafeAreaView>
    );
  }

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
              onPress={() => setSelectedVenue(null)}
            >
              <Circle
                center={{ latitude: 40.9882, longitude: 29.0267 }}
                radius={1000}
                fillColor="rgba(232, 160, 0, 0.08)"
                strokeColor="rgba(232, 160, 0, 0.35)"
                strokeWidth={1}
              />
              {userLocation && (
                <Circle
                  center={{ latitude: userLocation.lat, longitude: userLocation.lon }}
                  radius={8}
                  fillColor={C.primary}
                  strokeColor="#fff"
                  strokeWidth={2}
                />
              )}
              {userLocation && (
                <Circle
                  center={{ latitude: userLocation.lat, longitude: userLocation.lon }}
                  radius={REVIEW_RADIUS}
                  fillColor="rgba(232,160,0,0.06)"
                  strokeColor="rgba(232,160,0,0.3)"
                  strokeWidth={1}
                />
              )}
              {venues.map((venue: any) => (
                <Marker
                  key={venue.id || venue.properties['@id']}
                  coordinate={{
                    latitude:  venue.geometry.coordinates[1],
                    longitude: venue.geometry.coordinates[0],
                  }}
                  pinColor="#ff451b"
                  onPress={() => setSelectedVenue({
                    name:     venue.properties.name || 'Venue',
                    amenity:  venue.properties.amenity || '',
                    lat:      venue.geometry.coordinates[1],
                    lon:      venue.geometry.coordinates[0],
                  })}
                />
              ))}
            </MapView>

            <View style={styles.mapOverlay}>
              <Text style={styles.overlayText}>Kadıköy District</Text>
            </View>

            {selectedVenue && (
              <VenueReviewSheet
                venue={selectedVenue}
                userLocation={userLocation}
                authUser={authUser}
                onClose={() => setSelectedVenue(null)}
                onSubmitted={() => setSelectedVenue(null)}
              />
            )}
          </View>
        )}

        {activeTab === 'hex' && <RealHexGrid factions={factions} />}

        {activeTab === 'factions' && (
          <FactionListScreen
            factions={factions}
            authUser={authUser}
            onJoin={(updatedUser) => setAuthUser(updatedUser)}
            onCreatePress={() => setSubScreen('createFaction')}
            onOpenChat={() => setSubScreen('factionChat')}
            onRefresh={fetchFactions}
          />
        )}

        {activeTab === 'profile' && (
          authUser
            ? <ProfileScreen user={authUser} onLogout={() => setAuthUser(null)} />
            : <AuthScreen mode={authMode} setMode={setAuthMode} onLoginSuccess={setAuthUser} factions={factions} />
        )}
      </View>

      <View style={styles.tabBar}>
        {tabs.map(tab => (
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

export default function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
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
  map:      { flex: 1 },

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

  // Hex / generic screen
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
    textAlign:     'center',
  },
  screenSubtitle: {
    fontSize:     14,
    color:        C.textMuted,
    textAlign:    'center',
    marginBottom: 28,
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
  modeTabActive:     { backgroundColor: C.primary },
  modeTabText: {
    color:         C.textMuted,
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 2,
  },
  modeTabTextActive: { color: C.bg },

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

  // Faction picker (register)
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
