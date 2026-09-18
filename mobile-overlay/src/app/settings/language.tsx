import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  surfaceT,
  type PaltaLocale,
} from '../../../../src/localization/index';
import { useLocalization } from '../../providers/LocalizationProvider';

const OPTIONS: Array<{
  locale: PaltaLocale;
  title: string;
  subtitle: string;
}> = [
  { locale: 'es-CL', title: 'Español', subtitle: 'Chile' },
  { locale: 'ko', title: '한국어', subtitle: 'Korean' },
  { locale: 'en', title: 'English', subtitle: 'English' },
  { locale: 'zh-Hans', title: '简体中文', subtitle: 'Chinese (Simplified)' },
];

export default function LanguageSettingsScreen() {
  const router = useRouter();
  const { locale, setLocale, t } = useLocalization();
  const [saving, setSaving] = useState<PaltaLocale | null>(null);
  const [error, setError] = useState(false);

  async function choose(next: PaltaLocale) {
    if (next === locale || saving) return;
    setSaving(next);
    setError(false);
    try {
      await setLocale(next);
    } catch {
      setError(true);
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('settings.language')}</Text>
      </View>

      <Text style={styles.description}>{t('settings.languageDescription')}</Text>

      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const selected = option.locale === locale;
          const pending = option.locale === saving;
          return (
            <Pressable
              key={option.locale}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: Boolean(saving) }}
              disabled={Boolean(saving)}
              onPress={() => void choose(option.locale)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              {pending ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.check}>{selected ? '✓' : ''}</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text style={styles.error}>{surfaceT('async.errorTitle', locale)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F3',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  backText: { fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700' },
  description: {
    marginTop: 20,
    marginBottom: 18,
    color: '#5E5E57',
    fontSize: 15,
    lineHeight: 22,
  },
  options: { gap: 10 },
  option: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DEDED7',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  optionSelected: { borderColor: '#111111' },
  optionCopy: { gap: 2 },
  optionTitle: { fontSize: 16, fontWeight: '600' },
  optionSubtitle: { fontSize: 12, color: '#77776F' },
  check: { width: 24, fontSize: 20, textAlign: 'center' },
  error: { marginTop: 16, color: '#8A1C16' },
});
