import { RealEstateUtilityScreen } from '../../features/realEstate/RealEstateUtilityScreen';

export default function SavedPropertiesRoute() {
  return (
    <RealEstateUtilityScreen
      title="Guardados"
      body="Las propiedades, edificios y búsquedas que guardes aparecerán aquí. La persistencia y las alertas se conectarán al account/event core."
    />
  );
}
