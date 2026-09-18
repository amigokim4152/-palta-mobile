import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { FilterChip } from '../../components/common/FilterChip';
import { paltaTheme } from '../../theme/paltaTheme';

type CommunityKind = 'school' | 'church' | 'neighborhood' | 'interest';

type CommunityFeedItem = {
  id: string;
  communityName: string;
  kind: CommunityKind;
  author: string;
  timeLabel: string;
  body: string;
  announcement?: boolean;
  commentCount: number;
  reactionCount: number;
};

const joinedCommunities = [
  { id: 'school-1', name: 'Southern Cross School', meta: 'Familias · 4º básico' },
  { id: 'church-1', name: 'Comunidad de la iglesia', meta: 'Jóvenes y familias' },
  { id: 'neighborhood-1', name: 'Lo Curro', meta: 'Vecindario' },
];

const feed: CommunityFeedItem[] = [
  {
    id: 'post-1',
    communityName: 'Southern Cross School',
    kind: 'school',
    author: 'Familias 4º básico',
    timeLabel: 'Hace 18 min',
    body: '¿Alguien sabe si mañana deben llevar el cuaderno de ciencias? Podemos dejar la confirmación aquí para que no se pierda entre mensajes.',
    commentCount: 6,
    reactionCount: 4,
  },
  {
    id: 'post-2',
    communityName: 'Lo Curro',
    kind: 'neighborhood',
    author: 'Vecinos del sector',
    timeLabel: 'Hace 1 h',
    body: 'Aviso: hay trabajos en la calle esta tarde. Si cambia el acceso, actualizamos este mismo hilo.',
    announcement: true,
    commentCount: 3,
    reactionCount: 8,
  },
  {
    id: 'post-3',
    communityName: 'Comunidad de la iglesia',
    kind: 'church',
    author: 'Grupo de jóvenes',
    timeLabel: 'Ayer',
    body: 'Después de la reunión tendremos un momento para compartir. Quien necesite coordinar transporte puede responder aquí.',
    commentCount: 5,
    reactionCount: 7,
  },
];

const kindLabel: Record<CommunityKind, string> = {
  school: 'Escuela',
  church: 'Iglesia',
  neighborhood: 'Barrio',
  interest: 'Interés',
};

export function CommunityScreen() {
  const [filter, setFilter] = useState<'all' | CommunityKind>('all');
  const visibleFeed = useMemo(
    () => (filter === 'all' ? feed : feed.filter((item) => item.kind === filter)),
    [filter],
  );

  return (
    <ScreenFrame title="Comunidad" subtitle="Lo que está pasando en tus comunidades">
      <View style={{ gap: paltaTheme.spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs, flexWrap: 'wrap' }}>
          <FilterChip label="Para ti" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip label="Escuela" selected={filter === 'school'} onPress={() => setFilter('school')} />
          <FilterChip label="Barrio" selected={filter === 'neighborhood'} onPress={() => setFilter('neighborhood')} />
          <FilterChip label="Iglesia" selected={filter === 'church'} onPress={() => setFilter('church')} />
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Mis comunidades</Text>
            <Pressable accessibilityRole="button" onPress={() => {}}>
              <Text style={{ color: paltaTheme.color.brandPrimary, fontWeight: '600' }}>Ver todas</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
            {joinedCommunities.map((community) => (
              <Pressable
                key={community.id}
                accessibilityRole="button"
                onPress={() => {}}
                style={{
                  flex: 1,
                  minHeight: 92,
                  padding: paltaTheme.spacing.sm,
                  borderRadius: paltaTheme.radius.surface,
                  backgroundColor: paltaTheme.color.surface,
                  borderWidth: 1,
                  borderColor: paltaTheme.color.divider,
                }}
              >
                <Text numberOfLines={2} style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>
                  {community.name}
                </Text>
                <Text numberOfLines={2} style={{ marginTop: 6, fontSize: 12, color: paltaTheme.color.textSecondary }}>
                  {community.meta}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {}}
          style={{
            padding: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: paltaTheme.color.brandSoft,
          }}
        >
          <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>Encuentra tu comunidad</Text>
          <Text style={{ marginTop: 4, color: paltaTheme.color.textSecondary }}>
            Escuela, edificio, iglesia, barrio, actividades e intereses.
          </Text>
        </Pressable>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: paltaTheme.color.textPrimary }}>Cerca de ti</Text>
          {visibleFeed.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => {}}
              style={{
                paddingVertical: paltaTheme.spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: paltaTheme.color.divider,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ fontWeight: '700', color: paltaTheme.color.textPrimary }}>{item.communityName}</Text>
                <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{kindLabel[item.kind]}</Text>
                {item.announcement ? (
                  <Text style={{ fontSize: 12, fontWeight: '700', color: paltaTheme.color.brandPrimary }}>Aviso</Text>
                ) : null}
              </View>
              <Text style={{ marginTop: 3, fontSize: 12, color: paltaTheme.color.textMuted }}>
                {item.author} · {item.timeLabel}
              </Text>
              <Text style={{ marginTop: 9, fontSize: 15, lineHeight: 21, color: paltaTheme.color.textPrimary }}>
                {item.body}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                <Text style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>Comentarios {item.commentCount}</Text>
                <Text style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>Reacciones {item.reactionCount}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenFrame>
  );
}
