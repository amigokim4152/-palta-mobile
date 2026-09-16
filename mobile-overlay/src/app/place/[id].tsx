import { SafeAreaView, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SafeAreaView><Text>Place: {id}</Text></SafeAreaView>;
}
