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
import * as Location from 'expo-location';
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

      {/* Header */}
      <View style={sheetStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={sheetStyles.venueName} numberOfLines={1}>{venue.name}</Text>
          {venue.amenity ? <Text style={sheetStyles.venueAmenity}>{venue.amenity}</Text> : null}
        </View>
        <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn} activeOpacity={0.7}>
          <Text style={{ color: C.textMuted, fontSize: 20, lineHeight: 22 }}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Distance pill */}
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

      {/* Body */}
      {!authUser ? (
        <Text style={sheetStyles.prompt}>Log in to write a review.</Text>
      ) : submitted ? (
        <Text style={sheetStyles.success}>✓ Review submitted!</Text>
      ) : (
        <>
          {/* Stars */}
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
          {/* Comment */}
          <TextInput
            style={[sheetStyles.commentInput, !isNearby && { opacity: 0.3 }]}
            placeholder="Share your experience (optional)"
            placeholderTextColor={C.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            editable={isNearby}
          />
          {/* Submit */}
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

// ─── FactionScreen ────────────────────────────────────────────────────────────

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

const FactionScreen = ({ user }: { user: AuthUser }) => {
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [members,   setMembers]   = useState<FactionMember[]>([]);
  const [text,      setText]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [venues,    setVenues]    = useState<string[]>([]);
  const [venueSearch, setVenueSearch] = useState('');
  const scrollRef = React.useRef<ScrollView>(null);

  const faction = FACTIONS.find(f => f.id === user.factionId);

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content: content.trim(), type }),
      });
      await fetchMessages();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  };

  const filteredVenues = venues.filter(v =>
    v.toLowerCase().includes(venueSearch.toLowerCase())
  ).slice(0, 25);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={[factionStyles.header, { borderTopColor: faction?.color ?? C.primary }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: faction?.color ?? C.primary }} />
          <Text style={factionStyles.headerName}>{faction?.name ?? 'Faction'}</Text>
          <View style={factionStyles.memberBadge}>
            <Text style={factionStyles.memberBadgeText}>{members.length} members</Text>
          </View>
        </View>
      </View>

      {/* Members row */}
      {members.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={factionStyles.membersRow} contentContainerStyle={{ padding: 10, gap: 8 }}>
          {members.map(m => (
            <View key={m.id} style={factionStyles.memberChip}>
              <View style={[factionStyles.memberAvatar, { borderColor: faction?.color ?? C.primary }]}>
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

      {/* Messages */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={factionStyles.messagesList} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
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
                  <Text style={[factionStyles.msgAuthor, isOwn && { color: faction?.color ?? C.primary }]}>{msg.user.username}</Text>
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

      {/* Venue picker */}
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

      {/* Input bar */}
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
            style={[factionStyles.sendBtn, { borderColor: faction?.color ?? C.primary }, (!text.trim() || sending) && { opacity: 0.35 }]}
            onPress={() => { sendMessage(text); setText(''); }}
            disabled={!text.trim() || sending}
          >
            <Text style={[factionStyles.sendBtnText, { color: faction?.color ?? C.primary }]}>▶</Text>
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
  const [activeTab,     setActiveTab]     = useState('map');
  const [authMode,      setAuthMode]      = useState<AuthMode>('login');
  const [venues,        setVenues]        = useState<any[]>([]);
  const [authUser,      setAuthUser]      = useState<AuthUser | null>(null);
  const [userLocation,  setUserLocation]  = useState<UserLocation | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);

  // Request location permission and watch position
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
              onPress={() => setSelectedVenue(null)}
            >
              <Circle
                center={{ latitude: 40.9882, longitude: 29.0267 }}
                radius={1000}
                fillColor="rgba(232, 160, 0, 0.08)"
                strokeColor="rgba(232, 160, 0, 0.35)"
                strokeWidth={1}
              />
              {/* User location dot */}
              {userLocation && (
                <Circle
                  center={{ latitude: userLocation.lat, longitude: userLocation.lon }}
                  radius={8}
                  fillColor={C.primary}
                  strokeColor="#fff"
                  strokeWidth={2}
                />
              )}
              {/* User proximity ring */}
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

            {/* Review sheet */}
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

        {activeTab === 'hex' && <HexGrid />}

        {activeTab === 'faction' && (
          authUser
            ? <FactionScreen user={authUser} />
            : <AuthScreen mode={authMode} setMode={setAuthMode} onLoginSuccess={setAuthUser} />
        )}

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
          { key: 'faction', icon: '⚔️', label: 'Faction' },
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
