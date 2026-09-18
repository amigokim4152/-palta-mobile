import { RealEstateUtilityScreen } from '../../features/realEstate/RealEstateUtilityScreen';

export default function CreatePropertyRoute() {
  return (
    <RealEstateUtilityScreen
      title="Publicar una propiedad"
      body="El flujo V1 pedirá tipo de operación, tipo de propiedad, ubicación, precio, superficie, dormitorios, baños, estacionamiento, gastos comunes, fotos y forma de contacto. La publicación real se conectará después al account/trust core y al inventario de Propiedades."
      primaryLabel="Comenzar publicación"
    />
  );
}
