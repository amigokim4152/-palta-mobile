import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyActivityAlias() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/care/${encodeURIComponent(id ?? '')}`} />;
}
