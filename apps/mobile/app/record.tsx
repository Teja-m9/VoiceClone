import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  useAudioRecorder,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  interpolate,
  Easing,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, GradientButton, TextField } from '@/components';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/AuthProvider';
import { gradients, palette, spacing } from '@/theme';

const MAX_SECONDS = 60;
const MIN_SECONDS = 8;
const MIN_PEAK_DBFS = -38;
const WAVE_BARS = 13;

type Phase = 'idle' | 'recording' | 'recorded' | 'uploading';

/** One bar of the live waveform — height reacts to the mic level + its own wobble. */
function WaveBar({ level, index, active }: { level: SharedValue<number>; index: number; active: boolean }) {
  const wobble = useSharedValue(0);
  useEffect(() => {
    if (active) {
      wobble.value = withDelay(
        index * 45,
        withRepeat(withTiming(1, { duration: 520 + index * 40, easing: Easing.inOut(Easing.quad) }), -1, true),
      );
    } else {
      cancelAnimation(wobble);
      wobble.value = withTiming(0);
    }
  }, [active, index, wobble]);

  const style = useAnimatedStyle(() => {
    const amp = interpolate(level.value, [0, 1], [0.12, 1]);
    const h = 6 + amp * (18 + 40 * wobble.value);
    return { height: h };
  });
  return <Animated.View style={[styles.waveBar, style]} />;
}

/** Expanding ripple ring behind the mic button. */
function Ripple({ active, delay }: { active: boolean; delay: number }) {
  const r = useSharedValue(0);
  useEffect(() => {
    if (active) {
      r.value = withDelay(
        delay,
        withRepeat(withTiming(1, { duration: 1900, easing: Easing.out(Easing.ease) }), -1, false),
      );
    } else {
      cancelAnimation(r);
      r.value = withTiming(0);
    }
  }, [active, delay, r]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(r.value, [0, 1], [1, 2.6]) }],
    opacity: interpolate(r.value, [0, 1], [0.45, 0]),
  }));
  return <Animated.View style={[styles.ripple, style]} pointerEvents="none" />;
}

export default function RecordScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });

  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [name, setName] = useState('My voice');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  const peakDbfs = useRef<number>(-160);
  const level = useSharedValue(0); // 0..1 live mic level → drives the waveform
  const recording = phase === 'recording';

  const clearTimers = () => {
    if (timer.current) clearInterval(timer.current);
    if (meter.current) clearInterval(meter.current);
    timer.current = null;
    meter.current = null;
  };

  useEffect(() => clearTimers, []);

  const startRecording = async () => {
    setError(null);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission is required to record your voice.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();

      setSeconds(0);
      peakDbfs.current = -160;
      setPhase('recording');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Seconds counter (auto-stops at MAX_SECONDS).
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            void stopRecording();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);

      // Fast metering poll → drives the live waveform + tracks peak for the quality gate.
      meter.current = setInterval(() => {
        const status = recorder.getStatus();
        if (typeof status.metering === 'number') {
          peakDbfs.current = Math.max(peakDbfs.current, status.metering);
          const lv = Math.max(0, Math.min(1, (status.metering + 50) / 50));
          level.value = withTiming(lv, { duration: 130 });
        }
      }, 150);
    } catch {
      setError('Could not start recording. Try again.');
    }
  };

  const stopRecording = async () => {
    clearTimers();
    level.value = withTiming(0);
    try {
      await recorder.stop();
      const recordedUri = recorder.uri ?? null;
      const finalSeconds = seconds;

      if (finalSeconds < MIN_SECONDS) {
        setUri(null);
        setPhase('idle');
        setError(`Too short — record at least ${MIN_SECONDS}s of clear speech.`);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      if (peakDbfs.current > -159 && peakDbfs.current < MIN_PEAK_DBFS) {
        setUri(null);
        setPhase('idle');
        setError('That was too quiet or unclear. Find a quiet spot and record again.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      setUri(recordedUri);
      setPhase('recorded');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError('Could not save recording.');
      setPhase('idle');
    }
  };

  const upload = async () => {
    if (!uri || !session) return;
    if (!consent) {
      setError('Please confirm this is your own voice.');
      return;
    }
    setError(null);
    setPhase('uploading');
    try {
      const userId = session.user.id;
      const path = `${userId}/${Date.now()}.m4a`;
      const res = await FileSystem.uploadAsync(
        `${env.supabaseUrl}/storage/v1/object/voices/${path}`,
        uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: env.supabaseAnonKey,
            'Content-Type': 'audio/m4a',
            'x-upsert': 'true',
          },
        },
      );
      if (res.status < 200 || res.status >= 300) {
        throw new Error('Upload failed — check the "voices" storage bucket exists.');
      }
      const { error: insertError } = await supabase.from('voice_profiles').insert({
        user_id: userId,
        name: name.trim() || 'My voice',
        status: 'ready',
        ref_audio_key: path,
        duration_ms: seconds * 1000,
      });
      if (insertError) throw insertError;

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setPhase('recorded');
      setError(e instanceof Error ? e.message : 'Upload failed. Try again.');
    }
  };

  const reset = () => {
    setUri(null);
    setSeconds(0);
    setPhase('idle');
    setError(null);
  };

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={palette.textPrimary} />
        </Pressable>
        <Text variant="overline" color={palette.violet}>
          RECORD VOICE
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.center}>
        <Text variant="h1" center>
          {phase === 'recording' ? 'Listening…' : phase === 'recorded' ? 'Sounds great' : 'Read this aloud'}
        </Text>
        <Text variant="body" center style={{ marginTop: spacing.sm, paddingHorizontal: spacing.lg }}>
          {phase === 'recorded'
            ? `Captured ${seconds}s. Name your voice and confirm it's yours.`
            : '"I can turn any song into my own. My voice, my sound, my vibe — let\'s make something."'}
        </Text>

        {(phase === 'idle' || phase === 'recording') && (
          <View style={styles.ringWrap}>
            <Ripple active={recording} delay={0} />
            <Ripple active={recording} delay={950} />
            <Pressable
              onPress={recording ? stopRecording : startRecording}
              style={[styles.recBtn, recording && styles.recBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
            >
              <Ionicons
                name={recording ? 'stop' : 'mic'}
                size={44}
                color={recording ? palette.danger : palette.textInverse}
              />
            </Pressable>

            {/* Live waveform */}
            <View style={styles.wave}>
              {Array.from({ length: WAVE_BARS }).map((_, i) => (
                <WaveBar key={i} level={level} index={i} active={recording} />
              ))}
            </View>

            <Text variant="display" style={{ marginTop: spacing.md }}>
              {seconds}s
            </Text>
            <Text variant="caption">{recording ? 'Tap to stop' : 'Tap to record (quiet room, 8–60s)'}</Text>
          </View>
        )}

        {(phase === 'recorded' || phase === 'uploading') && (
          <View style={styles.review}>
            <Animated.View entering={ZoomIn.duration(360)} style={styles.successWrap}>
              <LinearGradient colors={gradients.success} style={styles.successCircle}>
                <Ionicons name="checkmark" size={36} color={palette.textInverse} />
              </LinearGradient>
            </Animated.View>
            <TextField label="Voice name" value={name} onChangeText={setName} />
            <Pressable style={styles.consent} onPress={() => setConsent((c) => !c)}>
              <Ionicons
                name={consent ? 'checkbox' : 'square-outline'}
                size={22}
                color={consent ? palette.violet : palette.textMuted}
              />
              <Text variant="caption" style={{ flex: 1 }}>
                This is my own voice and I consent to cloning it. I won't clone anyone else's
                voice without permission.
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {error && (
        <Text variant="caption" color={palette.danger} center style={{ marginBottom: spacing.md }}>
          {error}
        </Text>
      )}

      {phase === 'recorded' || phase === 'uploading' ? (
        <View style={{ gap: spacing.md }}>
          <GradientButton label="Use this voice" onPress={upload} loading={phase === 'uploading'} disabled={!consent} />
          <GradientButton label="Re-record" variant="outline" onPress={reset} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxxl },
  ripple: {
    position: 'absolute',
    top: 0,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: palette.lime,
  },
  recBtn: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBtnActive: { backgroundColor: palette.surface, borderWidth: 2, borderColor: palette.danger },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 64,
    marginTop: spacing.xl,
  },
  waveBar: { width: 5, borderRadius: 3, backgroundColor: palette.violet },
  review: { width: '100%', gap: spacing.lg, marginTop: spacing.xl },
  successWrap: { alignItems: 'center' },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  consent: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
