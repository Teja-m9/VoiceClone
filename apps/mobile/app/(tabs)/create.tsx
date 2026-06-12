import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, BentoCard, GradientButton, SongCard, SongTile } from '@/components';
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
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [vocalLevel, setVocalLevel] = useState<'soft' | 'balanced' | 'loud'>('balanced');
  const [style, setStyle] = useState<'studio' | 'live' | 'lofi' | 'reverb'>('studio');
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

  const outOfQuota = quotaRemaining <= 0; // Infinity for unlimited; finite for free + plan caps
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
        gender,
        vocalLevel,
        style,
      );
      const voiceName = readyProfiles.find((v) => v.id === voiceId)?.name ?? 'My voice';
      router.push({
        pathname: '/processing/[jobId]',
        params: {
          jobId: job.id,
          title: selectedTrack.title,
          artist: selectedTrack.artist,
          cover: selectedTrack.coverUrl ?? '',
          voice: voiceName,
        },
      });
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

      {/* Your voice type → pitches the cover to your register (so a male voice isn't girly) */}
      <Text variant="h2" style={styles.step}>
        2 · Your voice type
      </Text>
      <View style={styles.voiceRow}>
        {(['male', 'female'] as const).map((g) => {
          const active = gender === g;
          return (
            <Pressable
              key={g}
              onPress={() => setGender(g)}
              style={[styles.voiceChip, active && styles.voiceChipActive]}
            >
              <Ionicons
                name={g === 'male' ? 'male' : 'female'}
                size={18}
                color={active ? palette.violet : palette.textMuted}
              />
              <Text variant="label" color={active ? palette.textPrimary : palette.textSecondary}>
                {g === 'male' ? 'Male' : 'Female'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Step 3: choose song */}
      <Text variant="h2" style={styles.step}>
        3 · The track
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
            <>
              <View style={styles.grid}>
                {tracks.slice(0, 10).map((track, i) => (
                  <SongTile key={track.id} track={track} index={Math.min(i, 8)} onPress={pickTrack} />
                ))}
              </View>
              <Pressable onPress={() => router.push('/search' as Href)} style={styles.moreBtn}>
                <Ionicons name="search" size={16} color={palette.violet} />
                <Text variant="label" color={palette.violet}>
                  More songs & albums
                </Text>
                <Ionicons name="arrow-forward" size={16} color={palette.violet} />
              </Pressable>
            </>
          )}
        </>
      )}

      {/* Step 4: sound — vocal balance + style preset */}
      <Text variant="h2" style={styles.step}>
        4 · Sound
      </Text>
      <Text variant="label" color={palette.textSecondary} style={{ marginBottom: spacing.sm }}>
        Voice level
      </Text>
      <View style={styles.voiceRow}>
        {(['soft', 'balanced', 'loud'] as const).map((lv) => {
          const active = vocalLevel === lv;
          return (
            <Pressable
              key={lv}
              onPress={() => setVocalLevel(lv)}
              style={[styles.voiceChip, active && styles.voiceChipActive]}
            >
              <Text variant="label" color={active ? palette.textPrimary : palette.textSecondary}>
                {lv === 'soft' ? 'Softer' : lv === 'loud' ? 'Louder' : 'Balanced'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="label" color={palette.textSecondary} style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
        Style
      </Text>
      <View style={styles.voiceRow}>
        {(['studio', 'live', 'lofi', 'reverb'] as const).map((st) => {
          const active = style === st;
          const label = { studio: 'Studio', live: 'Live', lofi: 'Lo-fi', reverb: 'Reverb' }[st];
          return (
            <Pressable
              key={st}
              onPress={() => setStyle(st)}
              style={[styles.voiceChip, active && styles.voiceChipActive]}
            >
              <Text variant="label" color={active ? palette.textPrimary : palette.textSecondary}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Submit */}
      {error && (
        <Text variant="caption" color={palette.danger} style={{ marginTop: spacing.lg }}>
          {error}
        </Text>
      )}
      <View style={{ marginTop: spacing.xl }}>
        <GradientButton
          label={outOfQuota ? (isPremium ? 'Plan limit reached' : 'Daily limit reached') : 'Generate cover'}
          onPress={onGenerate}
          loading={submitting}
          disabled={!canSubmit}
        />
        <Text variant="caption" center color={palette.textMuted} style={{ marginTop: spacing.md }}>
          {isPremium ? 'Premium · full song' : 'Free · 30s preview · upgrade for the full song'}
        </Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
});
