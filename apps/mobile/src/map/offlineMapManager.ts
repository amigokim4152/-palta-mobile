import { Directory, File, Paths } from 'expo-file-system';

export type OfflineMapRegion = {
  id: string;
  name: string;
  version: string;
  remoteUrl: string;
  expectedBytes?: number;
};

export const SANTIAGO_MAP: OfflineMapRegion = {
  id: 'santiago',
  name: 'Santiago',
  version: '2026-09-11',
  remoteUrl:
    'https://palta-edge-preflight.kimeuisin.workers.dev/maps/santiago.pmtiles',
  expectedBytes: 38_388_602,
};

const mapsDirectory = new Directory(Paths.document, 'palta-maps');

function ensureMapsDirectory() {
  if (!mapsDirectory.exists) {
    mapsDirectory.create({ intermediates: true });
  }
}

function mapFile(region: OfflineMapRegion) {
  ensureMapsDirectory();
  return new File(
    mapsDirectory,
    `${region.id}-${region.version}.pmtiles`,
  );
}

function temporaryMapFile(region: OfflineMapRegion) {
  ensureMapsDirectory();
  return new File(
    mapsDirectory,
    `${region.id}-${region.version}.download`,
  );
}

export function hasOfflineMap(region: OfflineMapRegion): boolean {
  const file = mapFile(region);

  if (!file.exists) {
    return false;
  }

  if (
    region.expectedBytes !== undefined &&
    file.size !== region.expectedBytes
  ) {
    return false;
  }

  return true;
}

export function getOfflineMapUri(
  region: OfflineMapRegion,
): string | null {
  const file = mapFile(region);
  return hasOfflineMap(region) ? file.uri : null;
}

export function getPreferredMapSource(
  region: OfflineMapRegion,
): string {
  const localUri = getOfflineMapUri(region);
  const source = localUri
    ? `pmtiles://${localUri}`
    : `pmtiles://${region.remoteUrl}`;

  return source;
}

export async function downloadOfflineMap(
  region: OfflineMapRegion,
): Promise<string> {
  ensureMapsDirectory();

  const destination = mapFile(region);
  const temporary = temporaryMapFile(region);

  if (temporary.exists) {
    temporary.delete();
  }

  const downloaded = await File.downloadFileAsync(
    region.remoteUrl,
    temporary,
  );

  if (
    region.expectedBytes !== undefined &&
    downloaded.size !== region.expectedBytes
  ) {
    downloaded.delete();
    throw new Error(
      `Offline map size mismatch: expected ${region.expectedBytes}, received ${downloaded.size}`,
    );
  }

  if (destination.exists) {
    destination.delete();
  }

  await downloaded.move(destination);

  if (!destination.exists) {
    throw new Error('Offline map was not saved.');
  }

  if (
    region.expectedBytes !== undefined &&
    destination.size !== region.expectedBytes
  ) {
    destination.delete();
    throw new Error(
      `Offline map verification failed: expected ${region.expectedBytes}, received ${destination.size}`,
    );
  }

  return destination.uri;
}

export function deleteOfflineMap(
  region: OfflineMapRegion,
): void {
  const file = mapFile(region);
  const temporary = temporaryMapFile(region);

  if (temporary.exists) {
    temporary.delete();
  }

  if (file.exists) {
    file.delete();
  }
}
