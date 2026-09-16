import { View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { PaltaButton } from '../../components/common/PaltaButton';

const sections = [
  {
    key: 'eat_drink',
    title: 'Comer y tomar algo',
    subtitle: 'Lugares cercanos y útiles, no un catálogo infinito.',
  },
  {
    key: 'events_culture',
    title: 'Eventos y cultura',
    subtitle: 'Qué pasa hoy o próximamente cerca de ti.',
  },
  {
    key: 'family',
    title: 'Familia',
    subtitle: 'Panoramas adecuados al momento y al contexto.',
  },
  {
    key: 'travel_stays',
    title: 'Viajes y estadías',
    subtitle: 'Explorar. Si el viaje se vuelve real, Palta crea un contexto temporal.',
  },
];

export function PlayScreen() {
  return (
    <ScreenFrame
      title="Panoramas"
      subtitle="Qué hacer con tu tiempo"
    >
      <View style={{ gap: 22 }}>
        {sections.map((section) => (
          <View key={section.key} style={{ gap: 10 }}>
            <SectionHeading
              title={section.title}
              subtitle={section.subtitle}
            />
            <PaltaButton
              label="Explorar"
              variant="secondary"
              onPress={() => {}}
            />
          </View>
        ))}
      </View>
    </ScreenFrame>
  );
}
