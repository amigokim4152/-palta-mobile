import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';

export default function SearchScreen() {
  return (
    <ScreenFrame title="Buscar" subtitle="Una búsqueda, múltiples tipos de resultado">
      <View style={{ gap: 16 }}>
        <View>
          <SectionHeading
            title="Libros y bibliotecas"
            subtitle="Busca un título, autor o ISBN; Palta prioriza acceso público o gratuito antes de comprar."
          />
          <Pressable
            onPress={() => router.push('/books')}
            accessibilityRole="button"
            style={{ paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1 }}
          >
            <Text allowFontScaling style={{ fontSize: 18, fontWeight: '700' }}>
              Buscar libros
            </Text>
            <Text allowFontScaling style={{ marginTop: 5, opacity: 0.68, lineHeight: 20 }}>
              Bibliotecas cercanas · acceso digital · actividades · catálogo público
            </Text>
            <Text allowFontScaling style={{ marginTop: 10, fontWeight: '800' }}>
              Abrir →
            </Text>
          </Pressable>
        </View>

        <View>
          <SectionHeading title="Más resultados" />
          <Text allowFontScaling style={{ opacity: 0.7, lineHeight: 20 }}>
            Places · Businesses · Public actions · Events · Market · Personal state when appropriate
          </Text>
        </View>
      </View>
    </ScreenFrame>
  );
}
