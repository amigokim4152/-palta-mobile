import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { FilterChip } from '../../components/common/FilterChip';
import { paltaTheme } from '../../theme/paltaTheme';
import { communityRuntime, type CommunityKind, type CommunityTabData } from './communityRuntime';

const kindLabel: Record<CommunityKind, string> = {
  school: 'Escuela', church: 'Iglesia', neighborhood: 'Barrio', interest: 'Interés', activity: 'Actividad', apartment: 'Edificio',
};

export function CommunityScreen() {
  const [filter, setFilter] = useState<'all' | CommunityKind>('all');
  const [data, setData] = useState<CommunityTabData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    communityRuntime.loadTab().then(
      (next) => active && setData(next),
      () => active && setError('No pudimos cargar la comunidad. Intenta nuevamente.'),
    );
    return () => { active = false; };
  }, []);

  const visibleFeed = useMemo(() => {
    if (!data) return [];
    return filter === 'all' ? data.feed : data.feed.filter((item) => item.kind === filter);
  }, [data, filter]);

  return (
    <ScreenFrame title="Comunidad" subtitle="Lo que está pasando en tus comunidades">
      <View style={{ gap: paltaTheme.spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs, flexWrap: 'wrap' }}>
          <FilterChip label="Para ti" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Escuela" selected={filter === 'school'} onPress={() => setFilter('school')} />
          <FilterChip label="Barrio" selected={filter === 'neighborhood'} onPress={() => setFilter('neighborhood')} />
          <FilterChip label="Iglesia" selected={filter === 'church'} onPress={() => setFilter('church')} />
        </View>

        {!data && !error ? <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando comunidad…</Text> : null}
        {error ? <Text style={{ color: paltaTheme.color.danger }}>{error}</Text> : null}

        {data ? <>
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Mis comunidades</Text>
            {data.communities.length === 0 ? <Text style={{ color: paltaTheme.color.textSecondary }}>Todavía no te has unido a una comunidad.</Text> : (
              <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm, flexWrap: 'wrap' }}>
                {data.communities.map((community) => (
                  <Pressable key={community.id} accessibilityRole="button" accessibilityLabel={`Abrir ${community.name}`} onPress={() => {}} style={{ width: '48%', minHeight: paltaTheme.touch.minimum, padding: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface, borderWidth: 1, borderColor: paltaTheme.color.divider }}>
                    <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>{community.name}</Text>
                    <Text style={{ marginTop: 6, fontSize: 12, color: paltaTheme.color.textSecondary }}>{community.meta}</Text>
                    {community.unreadCount > 0 || community.actionRequiredCount > 0 ? <Text style={{ marginTop: 8, fontSize: 12, color: paltaTheme.color.brandPrimary }}>
                      {community.unreadCount > 0 ? `${community.unreadCount} nuevos` : ''}{community.unreadCount > 0 && community.actionRequiredCount > 0 ? ' · ' : ''}{community.actionRequiredCount > 0 ? `${community.actionRequiredCount} pendiente` : ''}
                    </Text> : null}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Encontrar una comunidad" onPress={() => {}} style={{ minHeight: paltaTheme.touch.minimum, padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
            <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>Encuentra tu comunidad</Text>
            <Text style={{ marginTop: 4, color: paltaTheme.color.textSecondary }}>Escuela, edificio, iglesia, barrio, actividades e intereses.</Text>
          </Pressable>

          <View style={{ gap: paltaTheme.spacing.sm }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Para ti</Text>
            {visibleFeed.length === 0 ? <Text style={{ color: paltaTheme.color.textSecondary }}>No hay publicaciones para este filtro.</Text> : visibleFeed.map((item) => (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Publicación de ${item.communityName}`} onPress={() => {}} style={{ minHeight: paltaTheme.touch.minimum, paddingVertical: paltaTheme.spacing.md, borderBottomWidth: 1, borderBottomColor: paltaTheme.color.divider }}>
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
        </> : null}
      </View>
    </ScreenFrame>
  );
}
