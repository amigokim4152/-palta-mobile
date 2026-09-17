import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { createClientMutationId } from '../../../../../../src/api/retryPolicy';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { SectionHeading } from '../../../../components/common/SectionHeading';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';

export default function BusinessPostsScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.getBusiness(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);
  const business = state.data;

  async function publish() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle) {
      setMessage('Escribe un título breve para la novedad.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await mobileRuntime.client.publishBusinessBasicPost(businessId, {
        title: cleanTitle,
        ...(cleanBody ? { body: cleanBody } : {}),
        idempotencyKey: createClientMutationId(Date.now(), Math.random()),
      });
      setTitle('');
      setBody('');
      await refresh();
      setMessage('La novedad quedó publicada en tu perfil.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No se pudo publicar: ${error.message}`
          : 'No se pudo publicar la novedad.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive(postId: string) {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    setMessage(null);
    try {
      await mobileRuntime.client.archiveBusinessBasicPost(businessId, postId);
      await refresh();
      setMessage('La novedad dejó de mostrarse en el perfil.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No se pudo retirar: ${error.message}`
          : 'No se pudo retirar la novedad.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Novedades">
        <LoadingState label="Cargando novedades…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Novedades">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  if (!business) return null;

  if (business.verification_status !== 'verified') {
    return (
      <ScreenFrame
        title="Novedades"
        subtitle={business.name}
        action={
          <Pressable onPress={() => router.back()} style={{ paddingVertical: 8 }}>
            <Text style={{ fontWeight: '800' }}>Volver</Text>
          </Pressable>
        }
      >
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Primero verifica que administras este negocio</Text>
          <Text style={{ opacity: 0.68, lineHeight: 21 }}>
            Publicar novedades es parte del perfil gratuito. La verificación evita que otra persona publique información en nombre del negocio; no es un requisito de pago.
          </Text>
        </View>
      </ScreenFrame>
    );
  }

  const posts = business.posts ?? [];

  return (
    <ScreenFrame
      title="Novedades"
      subtitle={business.name}
      action={
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '800' }}>Volver</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Publica algo útil · SIN COSTO</Text>
          <Text style={{ opacity: 0.68, lineHeight: 21 }}>
            Horario especial, disponibilidad, producto nuevo o una noticia concreta. Aquí no hay programación, segmentación ni publicación automática en otras redes.
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '700' }}>Título</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="Ej. Abrimos también este sábado"
            style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }}
          />
          <Text style={{ opacity: 0.5, fontSize: 12 }}>{title.length}/120</Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '700' }}>Detalle opcional</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            maxLength={2000}
            multiline
            placeholder="Explica sólo lo necesario para que el cliente entienda la novedad."
            style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, minHeight: 96 }}
          />
          <Text style={{ opacity: 0.5, fontSize: 12 }}>{body.length}/2000</Text>
        </View>

        <Pressable
          disabled={saving}
          onPress={() => void publish()}
          style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: saving ? 0.55 : 1 }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>
            {saving ? 'Publicando…' : 'Publicar ahora'}
          </Text>
        </Pressable>

        <SectionHeading
          title="Publicadas"
          subtitle="Las novedades aparecen en el mismo perfil del negocio. Seguir un negocio no activa notificaciones promocionales automáticamente."
        />

        {posts.length ? (
          posts.slice(0, 10).map((post) => (
            <View key={post.id} style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '800' }}>{post.title}</Text>
              {post.body ? <Text style={{ lineHeight: 20 }}>{post.body}</Text> : null}
              {post.published_at ? (
                <Text style={{ opacity: 0.55, fontSize: 12 }}>
                  {new Date(post.published_at).toLocaleString('es-CL')}
                </Text>
              ) : null}
              <Pressable disabled={saving} onPress={() => void archive(post.id)}>
                <Text style={{ fontWeight: '700', opacity: 0.7 }}>Dejar de mostrar</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={{ opacity: 0.62 }}>Todavía no has publicado novedades.</Text>
        )}

        {message ? <Text style={{ opacity: 0.72 }}>{message}</Text> : null}
        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
