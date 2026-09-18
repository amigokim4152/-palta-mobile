import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {
  ConversationTimelineApiItem,
  MessageApiItem,
} from '../../../../src/api/messagingApiClient';
import { getAuthenticatedMobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';

function createClientMessageId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function messageFallback(type: MessageApiItem['message_type']): string {
  switch (type) {
    case 'voice':
      return 'Mensaje de voz';
    case 'image':
      return 'Imagen';
    case 'file':
      return 'Archivo';
    case 'location':
      return 'Ubicación compartida';
    case 'resource_card':
      return 'Información compartida';
    case 'action_card':
      return 'Acción compartida';
    case 'text':
      return 'Mensaje';
  }
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function TimelineRow({ item }: { item: ConversationTimelineApiItem }) {
  if (item.kind === 'domain_event') {
    return (
      <View style={{ alignItems: 'center', paddingVertical: paltaTheme.spacing.xs }}>
        <View
          style={{
            maxWidth: '86%',
            paddingHorizontal: paltaTheme.spacing.sm,
            paddingVertical: 7,
            borderRadius: paltaTheme.radius.pill,
            backgroundColor: paltaTheme.color.surfaceMuted,
          }}
        >
          <Text style={{ fontSize: 12, textAlign: 'center', color: paltaTheme.color.textMuted }}>
            Actualización · {item.event.event_type.replaceAll('_', ' ')}
          </Text>
        </View>
      </View>
    );
  }

  const message = item.message;
  const outgoing = message.sender.actor_type === 'user';
  const body = message.body?.trim() || messageFallback(message.message_type);

  return (
    <View style={{ alignItems: outgoing ? 'flex-end' : 'flex-start' }}>
      <View
        style={{
          maxWidth: '82%',
          paddingHorizontal: paltaTheme.spacing.sm,
          paddingVertical: 10,
          borderRadius: paltaTheme.radius.surface,
          backgroundColor: outgoing
            ? paltaTheme.color.brandSoft
            : paltaTheme.color.surface,
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 15, lineHeight: 20, color: paltaTheme.color.textPrimary }}>
          {body}
        </Text>
        <Text
          style={{
            alignSelf: 'flex-end',
            fontSize: 11,
            color: paltaTheme.color.textMuted,
          }}
        >
          {timeLabel(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

export function ConversationScreen() {
  const { conversationId, businessName } = useLocalSearchParams<{
    conversationId?: string;
    businessId?: string;
    businessName?: string;
  }>();
  const [items, setItems] = useState<ConversationTimelineApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const title = useMemo(() => businessName?.trim() || 'Consulta', [businessName]);

  const loadTimeline = useCallback(async (mode: 'initial' | 'refresh' = 'refresh') => {
    if (!conversationId) {
      setError('No encontramos esta conversación.');
      setLoading(false);
      return;
    }

    const runtime = getAuthenticatedMobileRuntime();
    if (runtime.status !== 'ready') {
      setError(runtime.message);
      setLoading(false);
      return;
    }

    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const collected: ConversationTimelineApiItem[] = [];
      let afterSequence = 0;
      let latestSequence = 0;

      for (let page = 0; page < 10; page += 1) {
        const response = await runtime.client.messaging.listConversationTimeline({
          conversationId,
          afterSequence,
          limit: 100,
        });
        collected.push(...response.items);
        for (const item of response.items) latestSequence = Math.max(latestSequence, item.sequence);
        if (!response.has_more) break;
        if (response.next_after_sequence <= afterSequence) break;
        afterSequence = response.next_after_sequence;
      }

      setItems(collected);
      if (latestSequence > 0) {
        await runtime.client.messaging.advanceMessageRead({
          conversationId,
          throughSequence: latestSequence,
        });
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: mode === 'refresh' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar la conversación.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadTimeline('initial');
  }, [loadTimeline]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!conversationId || !text || sending) return;
    const runtime = getAuthenticatedMobileRuntime();
    if (runtime.status !== 'ready') {
      setError(runtime.message);
      return;
    }

    setSending(true);
    setError(null);
    try {
      await runtime.client.messaging.sendMessage({
        conversationId,
        clientMessageId: createClientMessageId(),
        messageType: 'text',
        body: text.slice(0, 4000),
      });
      setDraft('');
      await loadTimeline('refresh');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos enviar el mensaje.');
    } finally {
      setSending(false);
    }
  }, [conversationId, draft, loadTimeline, sending]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            minHeight: 58,
            paddingHorizontal: paltaTheme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: paltaTheme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: paltaTheme.color.divider,
            backgroundColor: paltaTheme.color.surface,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              minHeight: paltaTheme.touch.minimum,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontWeight: '800', color: paltaTheme.color.textSecondary }}>Volver</Text>
          </Pressable>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}
          >
            {title}
          </Text>
          <Pressable
            disabled={refreshing}
            onPress={() => void loadTimeline('refresh')}
            style={({ pressed }) => ({
              minHeight: paltaTheme.touch.minimum,
              justifyContent: 'center',
              opacity: refreshing || pressed ? 0.55 : 1,
            })}
          >
            <Text style={{ fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
              {refreshing ? '…' : 'Actualizar'}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: paltaTheme.spacing.md,
            gap: paltaTheme.spacing.sm,
            flexGrow: 1,
            justifyContent: items.length ? 'flex-start' : 'center',
          }}
          onContentSizeChange={() => {
            if (!loading) scrollRef.current?.scrollToEnd({ animated: false });
          }}
        >
          {loading ? (
            <Text style={{ textAlign: 'center', color: paltaTheme.color.textMuted }}>
              Cargando conversación…
            </Text>
          ) : items.length ? (
            items.map((item) => (
              <TimelineRow
                key={item.kind === 'message' ? item.message.message_id : item.event.projection_id}
                item={item}
              />
            ))
          ) : (
            <View style={{ alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                Inicia la consulta
              </Text>
              <Text style={{ textAlign: 'center', lineHeight: 20, color: paltaTheme.color.textMuted }}>
                Escribe tu mensaje. El negocio podrá responder en esta misma conversación.
              </Text>
            </View>
          )}
        </ScrollView>

        {error ? (
          <View style={{ paddingHorizontal: paltaTheme.spacing.md, paddingBottom: paltaTheme.spacing.xs }}>
            <Text style={{ fontSize: 12, color: paltaTheme.color.textSecondary }}>{error}</Text>
          </View>
        ) : null}

        <View
          style={{
            paddingHorizontal: paltaTheme.spacing.md,
            paddingTop: paltaTheme.spacing.xs,
            paddingBottom: paltaTheme.spacing.sm,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: paltaTheme.spacing.xs,
            borderTopWidth: 1,
            borderTopColor: paltaTheme.color.divider,
            backgroundColor: paltaTheme.color.surface,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Escribe tu consulta"
            placeholderTextColor={paltaTheme.color.textMuted}
            multiline
            maxLength={4000}
            style={{
              flex: 1,
              minHeight: paltaTheme.touch.minimum,
              maxHeight: 120,
              paddingHorizontal: paltaTheme.spacing.sm,
              paddingVertical: 11,
              borderRadius: paltaTheme.radius.control,
              backgroundColor: paltaTheme.color.surfaceMuted,
              color: paltaTheme.color.textPrimary,
              fontSize: 15,
            }}
          />
          <Pressable
            disabled={sending || !draft.trim()}
            onPress={() => void send()}
            style={({ pressed }) => ({
              minWidth: 76,
              minHeight: paltaTheme.touch.minimum,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: paltaTheme.radius.control,
              backgroundColor: paltaTheme.color.brandPrimary,
              opacity: sending || !draft.trim() || pressed ? 0.55 : 1,
            })}
          >
            <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>
              {sending ? '…' : 'Enviar'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
