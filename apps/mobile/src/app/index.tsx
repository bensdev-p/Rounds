import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Disclaimer } from '@/components/Disclaimer';
import { getPimpableScripts } from '@/lib/content';
import { space, useTheme } from '@/theme';

export default function PimpHome() {
  const theme = useTheme();
  const scripts = getPimpableScripts();

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={scripts}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
          Pick a script
        </Text>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.meta, { color: theme.muted }]}>{item.rotation.join(' · ')}</Text>
          <Button
            label="Pimp me"
            accessibilityLabel={`Pimp me on ${item.name}`}
            accessibilityHint="Starts a question ladder that ends on your first miss"
            onPress={() =>
              router.push({ pathname: '/ladder/[scriptId]', params: { scriptId: item.id } })
            }
          />
        </View>
      )}
      ListFooterComponent={<Disclaimer />}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: space.md, gap: space.md },
  heading: { fontSize: 22, fontWeight: '700' },
  card: { padding: space.md, borderRadius: 12, borderWidth: 1, gap: space.sm },
  name: { fontSize: 18, fontWeight: '600' },
  meta: { fontSize: 14 },
});
