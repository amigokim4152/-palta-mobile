import { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { RealEstateMediaRef } from '../../../../src/realEstate/realEstateMedia';
import {
  REAL_ESTATE_MAX_MEDIA_ITEMS,
  mediaRefFromUploadCompletion,
  type RealEstateUploadContentType,
} from '../../../../src/realEstate/realEstateMediaUpload';
import { PaltaButton } from '../../components/common/PaltaButton';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';

function inferContentType(asset: ImagePicker.ImagePickerAsset, blob: Blob): RealEstateUploadContentType | null {
  const raw = (asset.mimeType || blob.type || '').toLowerCase();
  if (raw === 'image/jpeg' || raw === 'image/png' || raw === 'image/webp' || raw === 'image/heic' || raw === 'image/heif') {
    return raw;
  }

  const fileName = asset.fileName?.toLowerCase() ?? '';
  if (/\.(jpe?g)$/.test(fileName)) return 'image/jpeg';
  if (/\.png$/.test(fileName)) return 'image/png';
  if (/\.webp$/.test(fileName)) return 'image/webp';
  if (/\.heic$/.test(fileName)) return 'image/heic';
  if (/\.heif$/.test(fileName)) return 'image/heif';
  return null;
}

function normalizeRoles(items: readonly RealEstateMediaRef[]): readonly RealEstateMediaRef[] {
  let imageIndex = 0;
  let floorPlanIndex = 0;
  return items.map((item) => {
    if (item.kind === 'floor_plan') {
      const sortOrder = floorPlanIndex;
      floorPlanIndex += 1;
      return { ...item, role: 'floor_plan', sortOrder };
    }
    const sortOrder = imageIndex;
    const role = imageIndex === 0 ? 'cover' : 'gallery';
    imageIndex += 1;
    return { ...item, role, sortOrder };
  });
}

export function RealEstateDraftMediaPicker({
  draftId,
  items,
  onChange,
}: {
  draftId: string;
  items: readonly RealEstateMediaRef[];
  onChange: (items: readonly RealEstateMediaRef[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUris, setPreviewUris] = useState<Record<string, string>>({});
  const imageItems = useMemo(() => items.filter((item) => item.kind === 'image'), [items]);
  const remaining = Math.max(0, REAL_ESTATE_MAX_MEDIA_ITEMS - imageItems.length);

  async function addPhotos() {
    if (remaining <= 0 || uploading) return;
    setMessage(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage('Necesitas permitir acceso a las fotos que elijas para agregarlas a la publicación.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
      orderedSelection: true,
    });
    if (result.canceled || !result.assets.length) return;
    if (mobileRuntime.status !== 'ready') {
      setMessage('La conexión de Palta no está lista para cargar fotos.');
      return;
    }

    setUploading(true);
    try {
      let next = [...items];
      const nextPreviews = { ...previewUris };
      for (const asset of result.assets.slice(0, remaining)) {
        const localResponse = await fetch(asset.uri);
        if (!localResponse.ok) throw new Error('No pudimos leer una de las fotos seleccionadas.');
        const blob = await localResponse.blob();
        const contentType = inferContentType(asset, blob);
        if (!contentType) throw new Error('Una foto usa un formato que todavía no admitimos.');

        const currentImageCount = next.filter((item) => item.kind === 'image').length;
        const role = currentImageCount === 0 ? 'cover' : 'gallery';
        const session = await mobileRuntime.client.realEstateMediaUpload.createUploadSession({
          draftId,
          kind: 'image',
          role,
          contentType,
          byteSize: blob.size,
          ...(asset.fileName ? { fileName: asset.fileName } : {}),
        });
        const uploadResponse = await fetch(session.uploadUrl, {
          method: session.uploadMethod,
          headers: { ...session.requiredHeaders },
          body: blob,
        });
        if (!uploadResponse.ok) throw new Error(`No pudimos cargar la foto (${uploadResponse.status}).`);

        const completion = await mobileRuntime.client.realEstateMediaUpload.completeUpload(session.uploadId);
        const ref = mediaRefFromUploadCompletion({
          completion,
          role,
          kind: 'image',
          sortOrder: currentImageCount,
          altText: currentImageCount === 0 ? 'Foto principal de la propiedad' : `Foto ${currentImageCount + 1} de la propiedad`,
        });
        next.push(ref);
        nextPreviews[ref.mediaAssetId] = asset.uri;
      }

      next = [...normalizeRoles(next)];
      setPreviewUris(nextPreviews);
      onChange(next);
      setMessage(next.length === 1 ? 'Foto cargada.' : `${next.filter((item) => item.kind === 'image').length} fotos cargadas.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos cargar las fotos.');
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(mediaAssetId: string) {
    const next = normalizeRoles(items.filter((item) => item.mediaAssetId !== mediaAssetId));
    setPreviewUris((current) => {
      const copy = { ...current };
      delete copy[mediaAssetId];
      return copy;
    });
    onChange(next);
    setMessage(null);
  }

  return (
    <View style={{ gap: paltaTheme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '900', color: paltaTheme.color.textPrimary }}>
            Fotos {imageItems.length}/{REAL_ESTATE_MAX_MEDIA_ITEMS}
          </Text>
          <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>
            La primera foto queda como portada. Las imágenes se cargan directo al Media Core; Palta guarda el ID del archivo, no una copia dentro del aviso.
          </Text>
        </View>
        <PaltaButton
          label={uploading ? 'Cargando…' : 'Agregar fotos'}
          variant="secondary"
          loading={uploading}
          disabled={remaining <= 0 || uploading}
          onPress={() => void addPhotos()}
        />
      </View>

      {imageItems.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
            {imageItems.map((item, index) => {
              const uri = item.deliveryUrl ?? previewUris[item.mediaAssetId];
              return (
                <View
                  key={item.mediaAssetId}
                  style={{
                    width: 132,
                    gap: 6,
                    padding: 6,
                    borderRadius: paltaTheme.radius.control,
                    borderWidth: 1,
                    borderColor: index === 0 ? paltaTheme.color.brandPrimary : paltaTheme.color.divider,
                    backgroundColor: paltaTheme.color.surfaceMuted,
                  }}
                >
                  {uri ? (
                    <Image
                      source={{ uri }}
                      resizeMode="cover"
                      style={{ width: 118, height: 92, borderRadius: paltaTheme.radius.control }}
                    />
                  ) : (
                    <View style={{ width: 118, height: 92, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>Procesando foto</Text>
                    </View>
                  )}
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: paltaTheme.color.textSecondary }}>
                    {index === 0 ? 'Portada' : `Foto ${index + 1}`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar foto ${index + 1}`}
                    onPress={() => removePhoto(item.mediaAssetId)}
                    style={({ pressed }) => ({
                      minHeight: 34,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: paltaTheme.radius.pill,
                      backgroundColor: pressed ? paltaTheme.color.surface : 'transparent',
                    })}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: paltaTheme.color.textSecondary }}>Eliminar</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      {message ? <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>{message}</Text> : null}
    </View>
  );
}
