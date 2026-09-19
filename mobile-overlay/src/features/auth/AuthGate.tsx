import React, { useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthRuntime } from '../../providers/AuthRuntimeProvider';
import { useLocalization } from '../../providers/LocalizationProvider';

export function AuthGate({ children, qaMode = false }: { children: ReactNode; qaMode?: boolean }) {
  const { t } = useLocalization();
  const {
    state,
    capabilities,
    busy,
    signInWithEmail,
    signInWithOAuth,
    signOut,
    retry,
  } = useAuthRuntime();
  const showGate01Evidence = process.env.EXPO_PUBLIC_ENV === 'development';
  const goldenUserEmail = showGate01Evidence
    ? (process.env.EXPO_PUBLIC_GOLDEN_USER_EMAIL?.trim() ?? '')
    : '';
  const [email, setEmail] = useState(goldenUserEmail);
  const [testMagicLink, setTestMagicLink] = useState('');
  const [testLinkError, setTestLinkError] = useState('');
  const [showEvidence, setShowEvidence] = useState(false);

  const openTestMagicLink = async () => {
    const link = testMagicLink.trim();
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
    if (!link || !supabaseUrl || !link.startsWith(`${supabaseUrl}/auth/`)) {
      setTestLinkError('palta-dev에서 받은 Supabase 로그인 링크를 붙여넣어 주세요.');
      return;
    }
    setTestLinkError('');
    await Linking.openURL(link);
  };

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
        {showGate01Evidence ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showEvidence ? 'Ocultar verificación Gate 01' : 'Mostrar verificación Gate 01'}
            onPress={() => setShowEvidence((visible) => !visible)}
            style={styles.evidenceToggle}
          >
            <Text style={styles.evidenceTitle}>Gate 01</Text>
          </Pressable>
        ) : null}
        {showGate01Evidence && showEvidence ? (
          <View style={styles.evidencePanel}>
            <Text style={styles.evidenceTitle}>Gate 01 · 개발 검증</Text>
            <Text style={styles.evidenceLabel}>Canonical account</Text>
            <Text style={styles.evidenceOk}>해결됨 ✓</Text>
            <Text style={styles.evidenceLabel}>Palta ID</Text>
            <Text selectable style={styles.evidenceValue}>
              {state.session.paltaUserId}
            </Text>
            <Text style={styles.evidenceLabel}>Auth ID</Text>
            <Text selectable style={styles.evidenceValue}>
              {state.session.authUserId}
            </Text>
            {state.session.expiresAt ? (
              <Text style={styles.evidenceMeta}>
                세션 만료 예정: {state.session.expiresAt}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('auth.signOut')}
          disabled={busy}
          onPress={() => void signOut()}
          style={styles.signOutButton}
        >
          <Text style={styles.signOutText}>{busy ? t('common.processing') : t('auth.signOut')}</Text>
        </Pressable>
      </View>
    );
  }

  const socialLoginAvailable =
    capabilities?.apple === true || capabilities?.google === true;
  const emailLoginAvailable = capabilities?.email === true;
  const goldenUserTestAvailable =
    showGate01Evidence && emailLoginAvailable && Boolean(goldenUserEmail);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {qaMode ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{t('common.back')}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>Somos Palta</Text>
        <Text style={styles.subtitle}>{t('auth.signInOrSignUp')}</Text>

        {state.status === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {state.code === 'configuration_error' ? t('auth.errorConfiguration') :
                state.code === 'account_bootstrap_missing' || state.code === 'account_lookup_failed'
                  ? t('auth.errorAccount') : t('auth.errorGeneral')}
            </Text>
            {showGate01Evidence && state.code ? <Text style={styles.errorCode}>{state.code}</Text> : null}
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
              {t('auth.emailLinkSent')} {state.email}. {t('auth.openSameDevice')}
            </Text>
          </View>
        ) : null}

        {goldenUserTestAvailable ? (
          <View style={styles.testBox}>
            <Text style={styles.testTitle}>Golden User 001 테스트</Text>
            <Text style={styles.testText}>
              개발 모드 전용입니다. 실제 palta-dev Magic Link 경로를 사용하며
              비밀번호·관리자 키 우회는 사용하지 않습니다.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void signInWithEmail(goldenUserEmail)}
              style={styles.testButton}
            >
              <Text style={styles.testButtonText}>테스트 로그인 링크 보내기</Text>
            </Pressable>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              onChangeText={setTestMagicLink}
              placeholder="받은 Magic Link 붙여넣기"
              style={styles.input}
              value={testMagicLink}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || !testMagicLink.trim()}
              onPress={() => void openTestMagicLink()}
              style={[
                styles.secondaryButton,
                (busy || !testMagicLink.trim()) && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>붙여넣은 링크로 로그인 테스트</Text>
            </Pressable>
            {testLinkError ? (
              <Text style={styles.testError}>{testLinkError}</Text>
            ) : null}
          </View>
        ) : null}

        {capabilities?.apple ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void signInWithOAuth('apple')}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{t('auth.continueApple')}</Text>
          </Pressable>
        ) : null}

        {capabilities?.google ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void signInWithOAuth('google')}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>{t('auth.continueGoogle')}</Text>
          </Pressable>
        ) : null}

        {emailLoginAvailable ? (
          <>
            {socialLoginAvailable || goldenUserTestAvailable ? (
              <View style={styles.divider} />
            ) : null}
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
          </>
        ) : null}

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
  subtitle: { fontSize: 16, marginBottom: 8 },
  divider: {
    height: 1,
    backgroundColor: '#E4E4DE',
    marginVertical: 2,
  },
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
  testBox: {
    gap: 9,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8D1BE',
    backgroundColor: '#F5F8F1',
  },
  testTitle: { fontSize: 14, fontWeight: '700', color: '#2E432B' },
  testText: { fontSize: 12, lineHeight: 17, color: '#4C5C48' },
  testButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#2F4A2A',
    paddingHorizontal: 14,
  },
  testButtonText: { color: '#FFFFFF', fontWeight: '700' },
  testError: { fontSize: 11, color: '#8A1C16' },
  evidencePanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 94,
    zIndex: 100,
    gap: 3,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#D9D9D2',
  },
  evidenceToggle: {
    position: 'absolute',
    top: 48,
    left: 16,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  evidenceTitle: { fontSize: 12, fontWeight: '700' },
  evidenceLabel: { marginTop: 2, fontSize: 10, color: '#66665F' },
  evidenceOk: { fontSize: 11, fontWeight: '700', color: '#2F6A2A' },
  evidenceValue: { fontSize: 11 },
  evidenceMeta: { marginTop: 3, fontSize: 10, color: '#66665F' },
  signOutButton: {
    position: 'absolute',
    top: 48,
    right: 16,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  signOutText: { fontWeight: '600' },
});
