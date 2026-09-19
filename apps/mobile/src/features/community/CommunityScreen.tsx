import { View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { PaltaButton } from '../../components/common/PaltaButton';

const sections = [
  {
    title: 'Mis grupos',
    subtitle: 'Escuela, iglesia, organización o grupos privados que ya forman parte de tu vida.',
  },
  {
    title: 'Tu barrio',
    subtitle: 'Conversaciones y avisos locales con un alcance claro.',
  },
  {
    title: 'Descubrir',
    subtitle: 'Contenido público local sin revelar tus membresías privadas.',
  },
];

export function CommunityScreen() {
  return (
    <ScreenFrame
      title="Comunidad"
      subtitle="Personas y grupos, con límites claros"
    >
      <View style={{ gap: 24 }}>
        {sections.map((section) => (
          <View key={section.title} style={{ gap: 10 }}>
            <SectionHeading
              title={section.title}
              subtitle={section.subtitle}
            />
            <PaltaButton
              label="Ver"
              variant="secondary"
              onPress={() => {}}
            />
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}
