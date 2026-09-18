import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { FilterChip } from '../../components/common/FilterChip';
import { paltaTheme } from '../../theme/paltaTheme';
import { communityRuntime, type CommunityKind, type CommunityTabData } from './communityRuntime';

const kindLabel: Record<CommunityKind, string> = { school: 'Escuela', church: 'Iglesia', neighborhood: 'Barrio', interest: 'Interés', activity: 'Actividad', apartment: 'Edificio' };
const filters: Array<{ key: 'all' | CommunityKind; label: string }> = [
  { key: 'all', label: 'Para ti' },
  { key: 'school', label: 'Escuela' },
  { key: 'neighborhood', label: 'Barrio' },
  { key: 'church', label: 'Iglesia' },
  { key: 'apartment', label: 'Edificio' },
  { key: 'activity', label: 'Actividades' },
  { key: 'interest', label: 'Intereses' },
];

export function CommunityScreen() {
  const [filter, setFilter] = useState<'all' | CommunityKind>('all');
  const [data, setData] = useState<CommunityTabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { let active = true; communityRuntime.loadTab().then((next) => active && setData(next), () => active && setError('No pudimos cargar la comunidad. Intenta nuevamente.')); return () => { active = false; }; }, []);
  const visibleFeed = useMemo(() => !data ? [] : filter === 'all' ? data.feed : data.feed.filter((item) => item.kind === filter), [data, filter]);
  const visibleDiscover = useMemo(() => !data ? [] : filter === 'all' ? data.discover : data.discover.filter((item) => item.kind === filter), [data, filter]);

  return (
    <ScreenFrame title="Comunidad" subtitle="Tus grupos, avisos y conversaciones en un solo lugar">
      <View style={{ gap: paltaTheme.spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs, flexWrap: 'wrap' }}>
          {filters.map((item) => <FilterChip key={item.key} label={item.label} selected={filter === item.key} onPress={() => setFilter(item.key)} />)}
        </View>

        {!data && !error ? <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando comunidad…</Text> : null}
        {error ? <Text style={{ color: paltaTheme.color.danger }}>{error}</Text> : null}

        {data ? <>
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Mis comunidades</Text>
              <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>{data.communities.length}</Text>
            </View>
            {data.communities.length === 0 ? (
              <View style={{ paddingVertical: paltaTheme.spacing.md }}>
                <Text style={{ color: paltaTheme.color.textPrimary, fontWeight: '700' }}>Todavía no tienes comunidades.</Text>
                <Text style={{ marginTop: 5, color: paltaTheme.color.textSecondary, lineHeight: 20 }}>Aquí podrás reunir escuela, barrio, iglesia, edificio y grupos que realmente usas.</Text>
              </View>
            ) : (
              <View style={{ gap: paltaTheme.spacing.xs }}>
                {data.communities.map((community) => (
                  <Pressable key={community.id} accessibilityRole="button" accessibilityLabel={`Abrir ${community.name}`} onPress={() => router.push(`/community/${community.id}`)} style={({ pressed }) => ({ minHeight: 64, paddingVertical: paltaTheme.spacing.sm, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider, opacity: pressed ? 0.72 : 1 })}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{kindLabel[community.kind]}</Text>
                        <Text style={{ marginTop: 2, fontSize: 16, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{community.name}</Text>
                        <Text style={{ marginTop: 4, fontSize: 13, color: paltaTheme.color.textSecondary }}>{community.meta}</Text>
                      </View>
                      {community.unreadCount > 0 || community.actionRequiredCount > 0 ? (
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                          {community.unreadCount > 0 ? <Text style={{ fontSize: 12, fontWeight: '700', color: paltaTheme.color.brandPrimary }}>{community.unreadCount} nuevos</Text> : null}
                          {community.actionRequiredCount > 0 ? <Text style={{ marginTop: 3, fontSize: 12, color: paltaTheme.color.textSecondary }}>{community.actionRequiredCount} pendiente</Text> : null}
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={{ gap: paltaTheme.spacing.sm }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Para ti</Text>
            {visibleFeed.length === 0 ? <Text style={{ color: paltaTheme.color.textSecondary }}>No hay publicaciones para este filtro.</Text> : visibleFeed.map((item) => (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Publicación de ${item.communityName}`} onPress={() => router.push(`/community/${item.communityId}/post/${item.id}`)} style={({ pressed }) => ({ minHeight: paltaTheme.touch.minimum, paddingVertical: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider, opacity: pressed ? 0.72 : 1 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>{item.communityName}</Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{kindLabel[item.kind]}</Text>
                  {item.announcement ? <Text style={{ fontSize: 12, fontWeight: '700', color: paltaTheme.color.brandPrimary }}>Aviso</Text> : null}
                </View>
                <Text style={{ marginTop: 3, fontSize: 12, color: paltaTheme.color.textMuted }}>{item.author} · {item.timeLabel}</Text>
                <Text style={{ marginTop: 9, fontSize: 15, lineHeight: 21, color: paltaTheme.color.textPrimary }}>{item.body}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                  <Text style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>Comentarios {item.commentCount}</Text>
                  <Text style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>Reacciones {item.reactionCount}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {visibleDiscover.length > 0 ? (
            <View style={{ gap: paltaTheme.spacing.sm }}>
              <Text style={{ fontSize: 19, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Descubrir</Text>
              {visibleDiscover.map((community) => (
                <Pressable key={community.id} accessibilityRole="button" accessibilityLabel={`Descubrir ${community.name}`} onPress={() => router.push(`/community/${community.id}`)} style={({ pressed }) => ({ minHeight: paltaTheme.touch.minimum, padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft, opacity: pressed ? 0.72 : 1 })}>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{kindLabel[community.kind]}</Text>
                  <Text style={{ marginTop: 2, fontWeight: '700', color: paltaTheme.color.textPrimary }}>{community.name}</Text>
                  <Text style={{ marginTop: 4, color: paltaTheme.color.textSecondary }}>{community.meta}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </> : null}
      </View>
    </ScreenFrame>
  );
}
