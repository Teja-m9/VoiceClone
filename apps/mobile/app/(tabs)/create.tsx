import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, BentoCard, GradientButton, SongCard } from '@/components';
import { useVoiceProfiles } from '@/hooks/useVoiceProfiles';
import { useProfile } from '@/hooks/useProfile';
import { useSongSearch } from '@/hooks/useSongSearch';
import { jiosaavn } from '@/lib/jiosaavn';
import { api, ApiError } from '@/lib/api';
import { palette, radius, spacing, typography } from '@/theme';
import type { Track } from '@/types/track';
import type { VoiceProfileRow } from '@/types/db';

function makeKey(songId: string, voiceId: string): string {
  return `${voiceId}:${songId}:${Date.now()}`;
}

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ trackId?: string }>();
  const { readyProfiles } = useVoiceProfiles();
  const { quotaRemaining, isPremium } = useProfile();

  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [query, setQuery] = useState('');
  const { tracks, loading } = useSongSearch(query, 'Telugu');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve a track passed from Home (fetches full details incl. stream URL).
  useEffect(() => {
    if (params.trackId && !selectedTrack) {
      void jiosaavn.getSongById(params.trackId).then((t) => t && setSelectedTrack(t));
    }
  }, [params.trackId, selectedTrack]);

  const outOfQuota = !isPremium && quotaRemaining <= 0;
  const canSubmit = !!voiceId && !!selectedTrack && !outOfQuota && !submitting;

  const pickTrack = async (track: Track) => {
    // Ensure we have the stream URL (search results already include it; resolve if missing).
    if (!track.streamUrl) {
      const full = await jiosaavn.getSongById(track.id);
      setSelectedTrack(full ?? track);
    } else {
      setSelectedTrack(track);
    }
  };

  const onGenerate = async () => {
    if (!voiceId || !selectedTrack) return;
    setError(null);
    setSubmitting(true);
    try {
      const job = await api.createJob(
        selectedTrack.id,
        voiceId,
        makeKey(selectedTrack.id, voiceId),
        selectedTrack.streamUrl,
      );
      router.push({ pathname: '/processing/[jobId]', params: { jobId: job.id } });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'QUOTA_EXCEEDED') {
        setError('You have used all 3 free covers today. Upgrade for unlimited.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not start generation');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <Text variant="overline" color={palette.violet}>
        NEW COVER
      </Text>
      <Text variant="h1" style={{ marginBottom: spacing.xl }}>
        Make a cover
      </Text>

      {/* Step 1: choose voice */}
      <Text variant="h2" style={styles.step}>
        1 · Your voice
      </Text>
      {readyProfiles.length === 0 ? (
        <BentoCard accent="primary" onPress={() => router.push('/record')}>
          <View style={styles.recordRow}>
            <Ionicons name="add-circle" size={28} color={palette.violet} />
            <View style={{ flex: 1 }}>
              <Text variant="title">Record your voice</Text>
              <Text variant="caption">You need one cloned voice to start.</Text>
            </View>
          </View>
        </BentoCard>
      ) : (
        <View style={styles.voiceRow}>
          {readyProfiles.map((vp: VoiceProfileRow) => {
            const active = vp.id === voiceId;
            return (
              <Pressable
                key={vp.id}
                onPress={() => setVoiceId(vp.id)}
                style={[styles.voiceChip, active && styles.voiceChipActive]}
              >
                <Ionicons
                  name="person-circle"
                  size={20}
                  color={active ? palette.violet : palette.textMuted}
                />
                <Text variant="label" color={active ? palette.textPrimary : palette.textSecondary}>
                  {vp.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => router.push('/record')} style={styles.voiceChip}>
            <Ionicons name="add" size={20} color={palette.textSecondary} />
            <Text variant="label">New</Text>
          </Pressable>
        </View>
      )}

      {/* Step 2: choose song */}
      <Text variant="h2" style={styles.step}>
        2 · The track
      </Text>
      {selectedTrack ? (
        <SongCard track={selectedTrack} selected onPress={() => setSelectedTrack(null)} />
      ) : (
        <>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={palette.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a song…"
              placeholderTextColor={palette.textMuted}
              selectionColor={palette.violet}
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>
          {loading ? (
            <ActivityIndicator color={palette.violet} style={{ marginTop: spacing.lg }} />
          ) : (
            <View style={styles.list}>
              {tracks.slice(0, 8).map((track, i) => (
                <SongCard key={track.id} track={track} index={Math.min(i, 6)} onPress={pickTrack} />
              ))}
            </View>
          )}
        </>
      )}

      {/* Submit */}
      {error && (
        <Text variant="caption" color={palette.danger} style={{ marginTop: spacing.lg }}>
          {error}
        </Text>
      )}
      <View style={{ marginTop: spacing.xl }}>
        <GradientButton
          label={outOfQuota ? 'Daily limit reached' : 'Generate cover'}
          onPress={onGenerate}
          loading={submitting}
          disabled={!canSubmit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { marginTop: spacing.xl, marginBottom: spacing.md },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  voiceChipActive: { borderColor: palette.violet, backgroundColor: palette.surfaceHover },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.lg,
  },
  searchInput: { ...typography.body, color: palette.textPrimary, flex: 1, paddingVertical: 0 },
  list: { gap: spacing.md },
});
