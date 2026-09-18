import React, { useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { PaltaLocale } from '../../../../src/localization/index';
import { useAuthRuntime } from '../../providers/AuthRuntimeProvider';
import { useLocalization } from '../../providers/LocalizationProvider';

const LOGIN_LOCALES: Array<{ locale: PaltaLocale; label: string }> = [
  { locale: 'es-CL', label: 'ES' },
  { locale: 'ko', label: '한국어' },
  { locale: 'en', label: 'EN' },
  { locale: 'zh-Hans', label: '中文' },
];

export function AuthGate({ children }: { children: ReactNode }) {
  const { state, busy, signInWithEmail, signInWithOAuth, signOut, retry } =
    useAuthRuntime();
  const { locale, setLocale, t } = useLocalization();
  const router = useRouter();
  const [email, setEmail] = useState('');

  if (state.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.helper}>{t('auth.checkingSession')}</Text>
      </View>
    );
  }

  if (state.status === 'signed_in') {
    return (
      <View style={styles.appContainer}>
        {children}
        <View style={styles.accountActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.language')}
            onPress={() => router.push('/settings/language')}
            style={styles.utilityButton}
          >
            <Text style={styles.utilityText}>{t('common.language')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.signOut')}
            disabled={busy}
            onPress={() => void signOut()}
            style={styles.utilityButton}
          >
            <Text style={styles.utilityText}>
              {busy ? t('common.processing') : t('auth.signOut')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Somos Palta</Text>
        <Text style={styles.subtitle}>{t('auth.signInOrSignUp')}</Text>

        <View style={styles.localeRow}>
          {LOGIN_LOCALES.map((option) => (
            <Pressable
              key={option.locale}
              accessibilityRole="button"
              accessibilityState={{ selected: locale === option.locale }}
              onPress={() => void setLocale(option.locale)}
              style={[
                styles.localeButton,
                locale === option.locale && styles.localeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.localeText,
                  locale === option.locale && styles.localeTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {state.status === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{state.message}</Text>
            {state.code ? <Text style={styles.errorCode}>{state.code}</Text> : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void retry()}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'email_sent' ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              {t('auth.emailLinkSent')} {state.email}{'\n'}
              {t('auth.openSameDevice')}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void signInWithOAuth('apple')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{t('auth.continueApple')}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void signInWithOAuth('google')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{t('auth.continueGoogle')}</Text>
        </Pressable>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          style={styles.input}
          value={email}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || !email.trim()}
          onPress={() => void signInWithEmail(email.trim())}
          style={[
            styles.secondaryButton,
            (busy || !email.trim()) && styles.disabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>{t('auth.sendEmailLink')}</Text>
        </Pressable>

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator />
            <Text style={styles.helper}>{t('common.processing')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: { flex: 1 },
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F7F7F3',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F7F7F3',
  },
  card: {
    gap: 12,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, marginBottom: 2 },
  localeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  localeButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D4D4CC',
  },
  localeButtonSelected: { backgroundColor: '#111111', borderColor: '#111111' },
  localeText: { fontSize: 13, fontWeight: '600' },
  localeTextSelected: { color: '#FFFFFF' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#C9C9C2',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600' },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#77776F',
    paddingHorizontal: 14,
  },
  secondaryButtonText: { fontWeight: '600' },
  disabled: { opacity: 0.45 },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  helper: { color: '#66665F' },
  errorBox: {
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF1F0',
  },
  errorText: { color: '#8A1C16' },
  errorCode: { fontSize: 12, color: '#8A1C16' },
  noticeBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5EC',
  },
  noticeText: { color: '#32452E' },
  accountActions: {
    position: 'absolute',
    top: 48,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  utilityButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  utilityText: { fontWeight: '600' },
});
