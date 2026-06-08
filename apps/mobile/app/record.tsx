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
  cancelAnimation,
} from 'react-native-reanimated';
import { Screen, Text, GradientButton, TextField } from '@/components';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { useAuth } from '@/providers/AuthProvider';
import { palette, spacing } from '@/theme';

const MAX_SECONDS = 60;
const MIN_SECONDS = 8;
/** dBFS peak below this = effectively silence / unusably quiet → ask for a re-record. */
const MIN_PEAK_DBFS = -38;

type Phase = 'idle' | 'recording' | 'recorded' | 'uploading';

export default function RecordScreen() {
  const router = useRouter();
  const { session } = useAuth();
  // Metering enabled so we can gate on how loud/clear the recording actually was.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });

  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [name, setName] = useState('My voice');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const peakDbfs = useRef<number>(-160);
  const ring = useSharedValue(1);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ring.value }] }));

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
      cancelAnimation(ring);
    };
  }, [ring]);

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
      ring.value = withRepeat(withTiming(1.18, { duration: 700 }), -1, true);

      timer.current = setInterval(() => {
        // Track the loudest moment to judge audio quality after stopping.
        const status = recorder.getStatus();
        if (typeof status.metering === 'number') {
          peakDbfs.current = Math.max(peakDbfs.current, status.metering);
        }
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            void stopRecording();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('Could not start recording. Try again.');
    }
  };

  const stopRecording = async () => {
    if (timer.current) clearInterval(timer.current);
    cancelAnimation(ring);
    ring.value = withTiming(1);
    try {
      await recorder.stop();
      const recordedUri = recorder.uri ?? null;
      const finalSeconds = seconds;

      // --- Quality gate: too short, or too quiet/unclear → require a re-record ---
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
        setError("That was too quiet or unclear. Find a quiet spot and record again.");
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

      // Upload straight to Supabase Storage via the storage REST endpoint (binary, reliable
      // on RN). RLS lets a user write only into their own folder.
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

      // Record the voice profile (RLS: owner insert). Zero-shot → ready immediately.
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
          {phase === 'recording'
            ? 'Listening…'
            : phase === 'recorded'
              ? 'Sounds great'
              : 'Read this aloud'}
        </Text>
        <Text variant="body" center style={{ marginTop: spacing.sm, paddingHorizontal: spacing.lg }}>
          {phase === 'recorded'
            ? `Captured ${seconds}s. Name your voice and confirm it's yours.`
            : '"I can turn any song into my own. My voice, my sound, my vibe — let\'s make something."'}
        </Text>

        {(phase === 'idle' || phase === 'recording') && (
          <View style={styles.ringWrap}>
            <Animated.View style={[styles.ringGlow, ringStyle]} />
            <Pressable
              onPress={phase === 'recording' ? stopRecording : startRecording}
              style={[styles.recBtn, phase === 'recording' && styles.recBtnActive]}
              accessibilityRole="button"
              accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Start recording'}
            >
              <Ionicons
                name={phase === 'recording' ? 'stop' : 'mic'}
                size={44}
                color={phase === 'recording' ? palette.danger : palette.textInverse}
              />
            </Pressable>
            <Text variant="display" style={{ marginTop: spacing.xl }}>
              {seconds}s
            </Text>
            <Text variant="caption">
              {phase === 'recording' ? 'Tap to stop' : 'Tap to record (quiet room, 8–60s)'}
            </Text>
          </View>
        )}

        {(phase === 'recorded' || phase === 'uploading') && (
          <View style={styles.review}>
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
          <GradientButton
            label="Use this voice"
            onPress={upload}
            loading={phase === 'uploading'}
            disabled={!consent}
          />
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
  ringWrap: { alignItems: 'center', marginTop: spacing.xxxl },
  ringGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(201,242,75,0.40)',
    top: -16,
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
  review: { width: '100%', gap: spacing.lg, marginTop: spacing.xl },
  consent: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
});
