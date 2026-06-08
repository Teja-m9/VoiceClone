import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, Text, TextField, GradientButton } from '@/components';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { gradients, palette, spacing } from '@/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = (name || session?.user.email || '?').charAt(0).toUpperCase();

  const onSave = async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ display_name: name.trim() })
        .eq('id', session.user.id);
      if (dbError) throw dbError;
      await supabase.auth.updateUser({ data: { display_name: name.trim() } });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="chevron-down" size={28} color={palette.textPrimary} />
        </Pressable>
        <Text variant="h2">Edit profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.avatarWrap}>
          <LinearGradient colors={gradients.aurora} style={styles.avatar}>
            <Text variant="display" color={palette.textInverse}>
              {initial}
            </Text>
          </LinearGradient>
          <Text variant="caption" color={palette.textMuted}>
            {session?.user.email}
          </Text>
        </View>

        <View style={styles.form}>
          <TextField label="Display name" value={name} onChangeText={setName} placeholder="Your name" />
          <TextField
            label="Bio (optional)"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell the community about your sound"
            multiline
          />
          {error && (
            <Text variant="caption" color={palette.danger}>
              {error}
            </Text>
          )}
          <View style={{ marginTop: spacing.md }}>
            <GradientButton label="Save changes" onPress={onSave} loading={saving} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  avatarWrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  form: { gap: spacing.lg },
});
