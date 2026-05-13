import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
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
  Alert
} from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import Svg, { Polygon, G, Text as SvgText } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// --- Types ---
type AuthMode = 'login' | 'register';

// --- Constants ---
const FACTIONS = [
  { id: 1, name: 'Red Reapers', color: '#ef4444' }, // slate-500 red
  { id: 2, name: 'Blue Sentinels', color: '#3b82f6' }, // blue-500
  { id: 3, name: 'Green Guardians', color: '#10b981' }, // emerald-500
];

// --- Components ---

const HexGrid = () => {
  const hexSize = 40;
  const hexWidth = hexSize * Math.sqrt(3);
  const hexHeight = hexSize * 2;
  
  const columns = 5;
  const rows = 5;

  const renderHex = (col: number, row: number) => {
    const x = col * hexWidth + (row % 2 === 1 ? hexWidth / 2 : 0) + 50;
    const y = row * (hexHeight * 0.75) + 50;
    
    // Random faction or neutral
    const factionIdx = Math.floor(Math.random() * 4);
    const color = factionIdx < 3 ? FACTIONS[factionIdx].color : '#1e293b';
    
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      points.push(`${x + hexSize * Math.cos(angle)},${y + hexSize * Math.sin(angle)}`);
    }

    return (
      <G key={`${col}-${row}`}>
        <Polygon
          points={points.join(' ')}
          fill={color}
          stroke="#334155"
          strokeWidth="1"
          opacity={0.8}
        />
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
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>Territory Control</Text>
      <Text style={styles.screenSubtitle}>H3 hex grid visualization of faction dominance</Text>
      
      <View style={styles.hexContainer}>
        <Svg height="400" width={width - 40}>
          {hexes}
        </Svg>
      </View>
      
      <View style={styles.legend}>
        {FACTIONS.map(f => (
          <View key={f.id} style={styles.legendItem}>
            <View style={[styles.colorBox, { backgroundColor: f.color }]} />
            <Text style={styles.legendText}>{f.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const AuthScreen = ({ mode, setMode }: { mode: AuthMode, setMode: (m: AuthMode) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = () => {
    if (mode === 'login') {
      Alert.alert('Sign In', `Logging in as ${email}`);
    } else {
      Alert.alert('Register', `Creating account for ${username}`);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.authContainer}
    >
      <ScrollView contentContainerStyle={styles.authScroll}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>📍</Text>
          <Text style={styles.logoText}>PLACE FINDER</Text>
        </View>

        <Text style={styles.authTitle}>
          {mode === 'login' ? 'Welcome Back' : 'Join the Faction'}
        </Text>
        <Text style={styles.authSubtitle}>
          {mode === 'login' 
            ? 'Sign in to continue your territory capture' 
            : 'Register to start claiming your neighborhood'}
        </Text>

        <View style={styles.form}>
          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Choose a callsign"
                placeholderTextColor="#64748b"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
            <Text style={styles.primaryButtonText}>
              {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.switchMode} 
            onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login' 
                ? "Don't have an account? Register" 
                : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      
      <View style={styles.main}>
        {activeTab === 'map' && (
          <View style={styles.flex1}>
            <MapView 
              style={styles.map}
              initialRegion={{
                latitude: 41.0082,
                longitude: 28.9784,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              userInterfaceStyle="dark"
              customMapStyle={darkMapStyle}
            >
              <Circle 
                center={{ latitude: 41.0082, longitude: 28.9784 }}
                radius={1000}
                fillColor="rgba(59, 130, 246, 0.2)"
                strokeColor="#3b82f6"
              />
            </MapView>
            <View style={styles.mapOverlay}>
              <Text style={styles.overlayText}>Istanbul Core</Text>
            </View>
          </View>
        )}
        
        {activeTab === 'hex' && <HexGrid />}
        
        {activeTab === 'profile' && (
          <AuthScreen mode={authMode} setMode={setAuthMode} />
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('map')}
        >
          <Text style={[styles.tabIcon, activeTab === 'map' && styles.activeTabIcon]}>📍</Text>
          <Text style={[styles.tabText, activeTab === 'map' && styles.activeTabText]}>Map</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('hex')}
        >
          <Text style={[styles.tabIcon, activeTab === 'hex' && styles.activeTabIcon]}>⬡</Text>
          <Text style={[styles.tabText, activeTab === 'hex' && styles.activeTabText]}>Hex</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabIcon, activeTab === 'profile' && styles.activeTabIcon]}>👤</Text>
          <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{"color": "#1e293b"}]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#94a3b8"}]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{"color": "#0f172a"}]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#cbd5e1"}]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#94a3b8"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{"color": "#334155"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{"color": "#1e293b"}]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#64748b"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{"color": "#020617"}]
  }
];

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  flex1: {
    flex: 1,
  },
  main: {
    flex: 1,
    backgroundColor: '#020617',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  overlayText: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  screenContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 30,
  },
  hexContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  legend: {
    flexDirection: 'row',
    marginTop: 30,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  colorBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  authContainer: {
    flex: 1,
  },
  authScroll: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#3b82f6',
    letterSpacing: 2,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 12,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 16,
    color: '#f8fafc',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  switchMode: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 24,
    opacity: 0.5,
    marginBottom: 4,
  },
  activeTabIcon: {
    opacity: 1,
  },
  tabText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
});
