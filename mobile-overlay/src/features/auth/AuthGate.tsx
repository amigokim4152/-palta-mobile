import React, { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthRuntime } from '../../providers/AuthRuntimeProvider';

export function AuthGate({ children }: { children: ReactNode }) {
  const { state, busy, signInWithEmail, signInWithOAuth, signOut, retry } =
    useAuthRuntime();
  const [email, setEmail] = useState('');

  if (state.status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.helper}>로그인 상태를 확인하고 있습니다.</Text>
      </View>
    );
  }

  if (state.status === 'signed_in') {
    return (
      <View style={styles.appContainer}>
        {children}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          disabled={busy}
          onPress={() => void signOut()}
          style={styles.signOutButton}
        >
          <Text style={styles.signOutText}>{busy ? '처리 중…' : '로그아웃'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Somos Palta</Text>
        <Text style={styles.subtitle}>로그인 또는 회원가입</Text>

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
              <Text style={styles.secondaryButtonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {state.status === 'email_sent' ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              {state.email} 주소로 로그인 링크를 보냈습니다. 같은 기기에서 링크를
              열면 Palta로 돌아옵니다.
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void signInWithOAuth('apple')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Apple로 계속</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void signInWithOAuth('google')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Google로 계속</Text>
        </Pressable>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          editable={!busy}
          inputMode="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="이메일"
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
          <Text style={styles.secondaryButtonText}>이메일 링크 보내기</Text>
        </Pressable>

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator />
            <Text style={styles.helper}>처리 중입니다.</Text>
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
