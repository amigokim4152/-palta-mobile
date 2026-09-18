import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import {
  SANTIAGO_MAP,
  deleteOfflineMap,
  downloadOfflineMap,
  getPreferredMapSource,
  hasOfflineMap,
} from '../../map/offlineMapManager';
import { createSantiagoMapStyle } from '../../map/santiagoMapStyle';

const SANTIAGO_CENTER = {
  latitude: -33.4489,
  longitude: -70.6693,
};

export default function SharedMapScreen() {
  const [offline, setOffline] = useState(() =>
    hasOfflineMap(SANTIAGO_MAP),
  );
  const [downloading, setDownloading] = useState(false);

  const mapStyle = useMemo(
    () =>
      createSantiagoMapStyle(
        getPreferredMapSource(SANTIAGO_MAP),
      ),
    [offline],
  );

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadOfflineMap(SANTIAGO_MAP);
      setOffline(true);
    } catch (error) {
      Alert.alert(
        'No se pudo descargar el mapa',
        error instanceof Error
          ? error.message
          : 'Inténtalo nuevamente.',
      );
    } finally {
      setDownloading(false);
    }
  }

  function handleDelete() {
    deleteOfflineMap(SANTIAGO_MAP);
    setOffline(false);
  }

  return (
    <ScreenFrame title="Mapa" subtitle="Santiago" scroll={false}>
      <View style={styles.container}>
        <View style={styles.map}>
          <NeighborhoodMap
            mapStyle={JSON.stringify(mapStyle)}
            features={[]}
            initialCenter={SANTIAGO_CENTER}
            initialZoom={11}
          />
        </View>

        <View style={styles.offlineBar}>
          <View style={styles.offlineText}>
            <Text style={styles.title}>Mapa sin conexión</Text>
            <Text style={styles.status}>
              {offline
                ? 'Santiago está descargado'
                : 'Santiago · aproximadamente 38 MB'}
            </Text>
          </View>

          {downloading ? (
            <ActivityIndicator />
          ) : (
            <Pressable
              onPress={offline ? handleDelete : handleDownload}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {offline ? 'Eliminar' : 'Descargar'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  offlineText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  status: {
    marginTop: 2,
    fontSize: 12,
    opacity: 0.65,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#1f1f1f',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
