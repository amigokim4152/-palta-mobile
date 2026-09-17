import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { SectionHeading } from '../../../../components/common/SectionHeading';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';

type Audience = 'public' | 'followers';

const durationOptions = [7, 14, 30] as const;

export default function BusinessBasicCouponScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instruction, setInstruction] = useState('Muéstralo antes de pagar.');
  const [audience, setAudience] = useState<Audience>('public');
  const [durationDays, setDurationDays] = useState<(typeof durationOptions)[number]>(14);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const [business, ownerCoupon] = await Promise.all([
      mobileRuntime.client.getBusiness(businessId),
      mobileRuntime.client.getOwnerBusinessBasicCoupon(businessId),
    ]);
    return { business, coupon: ownerCoupon.coupon };
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);
  const business = state.data?.business;
  const activeCoupon = state.data?.coupon;

  useEffect(() => {
    if (!business || initializedFor === business.id) return;
    if (activeCoupon) {
      setTitle(activeCoupon.title);
      setDescription(activeCoupon.description ?? '');
      setInstruction(activeCoupon.redemption_instruction ?? 'Muéstralo antes de pagar.');
      setAudience(activeCoupon.audience);
    }
    setInitializedFor(business.id);
  }, [business, activeCoupon, initializedFor]);

  async function saveCoupon() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    if (!title.trim()) {
      setMessage('Escribe el beneficio que recibirá el cliente.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      await mobileRuntime.client.upsertBusinessBasicCoupon(businessId, {
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(instruction.trim() ? { redemptionInstruction: instruction.trim() } : {}),
        audience,
        expiresAt,
      });
      setInitializedFor(null);
      await refresh();
      setMessage('Tu cupón básico quedó publicado.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No se pudo publicar: ${error.message}`
          : 'No se pudo publicar el cupón.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function revokeCoupon() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    setMessage(null);
    try {
      await mobileRuntime.client.revokeBusinessBasicCoupon(businessId);
      setTitle('');
      setDescription('');
      setInstruction('Muéstralo antes de pagar.');
      setAudience('public');
      setInitializedFor(null);
      await refresh();
      setMessage('El cupón dejó de mostrarse.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No se pudo detener: ${error.message}`
          : 'No se pudo detener el cupón.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Cupón básico">
        <LoadingState label="Cargando beneficio…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Cupón básico">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  if (!business) return null;

  if (business.verification_status !== 'verified') {
    return (
      <ScreenFrame
        title="Cupón básico"
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
            El cupón básico es gratuito. La verificación sólo evita que otra persona publique descuentos en nombre del negocio; no es un requisito de pago.
          </Text>
        </View>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame
      title="Cupón básico"
      subtitle={business.name}
      action={
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '800' }}>Volver</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>Un beneficio simple · SIN COSTO</Text>
          <Text style={{ opacity: 0.68, lineHeight: 21 }}>
            Mantén un solo cupón básico activo. Programación, segmentación y campañas automáticas son herramientas distintas y no hacen falta para publicar este beneficio.
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '700' }}>Beneficio</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ej. 10% en tu próxima visita"
            style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '700' }}>Detalle opcional</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Qué incluye o cuándo aplica"
            multiline
            style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, minHeight: 72 }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: '700' }}>Cómo usarlo</Text>
          <TextInput
            value={instruction}
            onChangeText={setInstruction}
            placeholder="Ej. Muéstralo antes de pagar"
            style={{ borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 }}
          />
        </View>

        <SectionHeading title="Quién puede verlo" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([
            ['public', 'Todos'],
            ['followers', 'Seguidores'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setAudience(value)}
              style={{
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 9,
                opacity: audience === value ? 1 : 0.55,
              }}
            >
              <Text style={{ fontWeight: '800' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {audience === 'followers' ? (
          <Text style={{ opacity: 0.62, lineHeight: 20 }}>
            Sólo lo verán quienes hayan elegido seguir tu negocio. Esto no autoriza notificaciones promocionales automáticamente.
          </Text>
        ) : null}

        <SectionHeading title="Duración" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {durationOptions.map((days) => (
            <Pressable
              key={days}
              onPress={() => setDurationDays(days)}
              style={{
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 9,
                opacity: durationDays === days ? 1 : 0.55,
              }}
            >
              <Text style={{ fontWeight: '800' }}>{days} días</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          disabled={saving}
          onPress={() => void saveCoupon()}
          style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: saving ? 0.55 : 1 }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>
            {saving ? 'Guardando…' : activeCoupon ? 'Actualizar cupón' : 'Publicar cupón'}
          </Text>
        </Pressable>

        {activeCoupon ? (
          <Pressable
            disabled={saving}
            onPress={() => void revokeCoupon()}
            style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: saving ? 0.55 : 1 }}
          >
            <Text style={{ textAlign: 'center', fontWeight: '700' }}>Dejar de mostrar cupón</Text>
          </Pressable>
        ) : null}

        {message ? <Text style={{ opacity: 0.72 }}>{message}</Text> : null}
        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
