import { useState } from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { publishDemoVehicle } from './autosDemoState';

function digits(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textSecondary }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={paltaTheme.color.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 104 : 50,
          paddingHorizontal: paltaTheme.spacing.md,
          paddingVertical: multiline ? paltaTheme.spacing.sm : 0,
          borderRadius: paltaTheme.radius.control,
          borderWidth: 1,
          borderColor: paltaTheme.color.divider,
          backgroundColor: paltaTheme.color.surface,
          color: paltaTheme.color.textPrimary,
        }}
      />
    </View>
  );
}

export function VehicleSellDemoScreen() {
  const [plate, setPlate] = useState('LXXX00');
  const [make, setMake] = useState('Toyota');
  const [model, setModel] = useState('RAV4');
  const [year, setYear] = useState('2021');
  const [mileage, setMileage] = useState('48.200');
  const [price, setPrice] = useState('18.990.000');
  const [comuna, setComuna] = useState('Las Condes');
  const [description, setDescription] = useState('Uso familiar, mantenciones al día y dos llaves.');
  const [error, setError] = useState<string | null>(null);

  function publish() {
    const yearValue = digits(year);
    const mileageValue = digits(mileage);
    const priceValue = digits(price);

    if (!make.trim() || !model.trim() || !comuna.trim()) {
      setError('Completa marca, modelo y comuna.');
      return;
    }
    if (yearValue < 1980 || yearValue > new Date().getFullYear() + 1) {
      setError('Revisa el año del vehículo.');
      return;
    }
    if (priceValue <= 0) {
      setError('Ingresa un precio válido.');
      return;
    }

    const item = publishDemoVehicle({
      make,
      model,
      year: yearValue,
      mileageKm: mileageValue,
      priceClp: priceValue,
      comuna,
      description,
    });
    setError(null);
    router.replace(`/autos/listing/${encodeURIComponent(item.listing.id)}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 25, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Vender mi auto</Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>Publicación demo interactiva</Text>
          </View>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>1 de 3 · Identifica el vehículo</Text>
          <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 17, color: paltaTheme.color.textSecondary }}>
            La patente se usa sólo para identificación y verificación. No se publicará completa en la ficha pública.
          </Text>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Field label="Patente" value={plate} onChangeText={setPlate} />
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
            <View style={{ flex: 1 }}><Field label="Marca" value={make} onChangeText={setMake} /></View>
            <View style={{ flex: 1 }}><Field label="Modelo" value={model} onChangeText={setModel} /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
            <View style={{ flex: 1 }}><Field label="Año" value={year} onChangeText={setYear} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Kilometraje" value={mileage} onChangeText={setMileage} keyboardType="number-pad" /></View>
          </View>
        </View>

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Tu publicación</Text>
          <Field label="Precio CLP" value={price} onChangeText={setPrice} keyboardType="number-pad" />
          <Field label="Comuna" value={comuna} onChangeText={setComuna} />
          <Field label="Descripción" value={description} onChangeText={setDescription} multiline />
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => ({
              minHeight: 120,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: paltaTheme.radius.surface,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: paltaTheme.color.border,
              backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: paltaTheme.color.textPrimary }}>Agregar fotos</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: paltaTheme.color.textMuted }}>Frente · interior · laterales · detalles</Text>
          </Pressable>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Antes de publicar</Text>
          <Text style={{ marginTop: 5, fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            Los datos privados del propietario quedan separados de la información pública del aviso. Documentos y patente completa no se exponen.
          </Text>
        </View>

        {error ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: paltaTheme.color.danger }}>{error}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={publish}
          style={({ pressed }) => ({
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
          })}
        >
          <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.surface }}>Publicar demo</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
