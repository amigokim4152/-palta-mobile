import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { MarketTransactionView } from '../../../../src/market/marketApiContract';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

const STATUS_LABEL: Record<MarketTransactionView['status'], string> = {
  coordinating: 'Coordinando',
  reserved: 'Reservado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const PROGRESS_STEPS: Array<{
  status: Exclude<MarketTransactionView['status'], 'cancelled'>;
  label: string;
}> = [
  { status: 'coordinating', label: 'Contacto' },
  { status: 'reserved', label: 'Reserva' },
  { status: 'completed', label: 'Entrega' },
];

function statusRank(status: MarketTransactionView['status']) {
  if (status === 'completed') return 3;
  if (status === 'reserved') return 2;
  if (status === 'coordinating') return 1;
  return 0;
}

function formatSnapshotPrice(transaction: MarketTransactionView) {
  const price = transaction.listingSnapshot.priceClp;
  if (typeof price !== 'number') return 'A convenir';
  const value = `$${new Intl.NumberFormat('es-CL').format(price)}`;
  return String(transaction.listingSnapshot.tradeMode) === 'rent'
    ? `${value} / mes`
    : value;
}

function TransactionProgress({ transaction }: { transaction: MarketTransactionView }) {
  if (transaction.status === 'cancelled') {
    return (
      <View style={styles.cancelledBox}>
        <Text style={styles.cancelledText}>
          Este acuerdo fue cancelado. La publicación y tus otros acuerdos siguen separados.
        </Text>
      </View>
    );
  }

  const rank = statusRank(transaction.status);
  return (
    <View style={styles.progressRow}>
      {PROGRESS_STEPS.map((step, index) => {
        const complete = rank >= index + 1;
        return (
          <View key={step.status} style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                complete && styles.progressDotComplete,
              ]}
            >
              <Text style={styles.progressDotText}>{complete ? '✓' : index + 1}</Text>
            </View>
            <Text
              style={[
                styles.progressLabel,
                complete && styles.progressLabelComplete,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function MarketTransactionsScreen() {
  const runtime = useMemo(() => getMarketRuntime(), []);
  const [transactions, setTransactions] = useState<MarketTransactionView[]>();
  const [error, setError] = useState<string>();
  const [openingId, setOpeningId] = useState<string>();

  useEffect(() => {
    if (!runtime.read) {
      setTransactions([]);
      setError('Mercado no está disponible en este momento.');
      return;
    }
    let active = true;
    setError(undefined);
    runtime.read
      .listMyTransactions({ limit: 50 })
      .then((page) => {
        if (active) setTransactions(page.items);
      })
      .catch(() => {
        if (!active) return;
        setTransactions([]);
        setError('No pudimos cargar tus acuerdos.');
      });
    return () => {
      active = false;
    };
  }, [runtime]);

  async function openConversation(transaction: MarketTransactionView) {
    if (!runtime.messaging || !transaction.conversationId || openingId) return;
    setOpeningId(transaction.id);
    setError(undefined);
    try {
      await runtime.messaging.openConversation({
        conversationId: transaction.conversationId,
        focus: {
          sourceCore: 'market',
          resourceType: 'market_transaction',
          resourceId: transaction.id,
          label: transaction.listingSnapshot.title,
        },
      });
    } catch {
      setError('No pudimos abrir la conversación.');
    } finally {
      setOpeningId(undefined);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.heading}>Mis compras y acuerdos</Text>
          <Text style={styles.subtitle}>
            Sigue cada coordinación sin exponer datos privados.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {transactions === undefined ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Cargando acuerdos…</Text>
          </View>
        ) : null}

        {transactions?.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Todavía no tienes acuerdos activos</Text>
            <Text style={styles.stateBody}>
              Cuando contactes a alguien desde una publicación, el seguimiento aparecerá aquí.
            </Text>
          </View>
        ) : null}

        {transactions?.map((transaction) => {
          const counterparty = transaction.counterparty?.displayName ?? 'La otra persona';
          return (
            <View key={transaction.id} style={styles.card}>
              <View style={styles.cardTopLine}>
                <View style={styles.cardTitleBlock}>
                  <Text numberOfLines={2} style={styles.listingTitle}>
                    {transaction.listingSnapshot.title}
                  </Text>
                  <Text style={styles.locationText}>
                    {transaction.listingSnapshot.comunaName}
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{STATUS_LABEL[transaction.status]}</Text>
                </View>
              </View>

              <Text style={styles.price}>{formatSnapshotPrice(transaction)}</Text>
              <Text style={styles.counterpartyText}>Con {counterparty}</Text>
              {transaction.counterparty?.neighborhoodVerified ? (
                <Text style={styles.trustText}>Perfil local verificado</Text>
              ) : null}

              <TransactionProgress transaction={transaction} />

              <View style={styles.actions}>
                {transaction.conversationId ? (
                  <Pressable
                    disabled={openingId === transaction.id}
                    onPress={() => void openConversation(transaction)}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {openingId === transaction.id ? 'Abriendo…' : 'Mensaje'}
                    </Text>
                  </Pressable>
                ) : null}
                {transaction.status === 'completed' ? (
                  <Pressable
                    onPress={() => router.push(`/market/review/${transaction.id}`)}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Dejar reseña</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}

        <View style={styles.privacyNote}>
          <Text style={styles.privacyText}>
            El seguimiento conserva el contexto de la publicación y la conversación, no la dirección exacta ni el teléfono personal de la otra persona.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: paltaTheme.color.canvas },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paltaTheme.color.divider,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    color: paltaTheme.color.textPrimary,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -2,
  },
  headerCopy: { flex: 1 },
  heading: {
    color: paltaTheme.color.textPrimary,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 3,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  content: { padding: 18, paddingBottom: 42, gap: 12 },
  errorCard: {
    borderRadius: 14,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 12,
  },
  errorText: { color: paltaTheme.color.textSecondary, fontSize: 12 },
  stateCard: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    padding: 22,
  },
  stateTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    marginTop: 7,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    padding: 15,
  },
  cardTopLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitleBlock: { flex: 1 },
  listingTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  locationText: {
    marginTop: 4,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  statusPill: {
    borderRadius: paltaTheme.radius.pill,
    backgroundColor: paltaTheme.color.brandSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  price: {
    marginTop: 13,
    color: paltaTheme.color.textPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  counterpartyText: {
    marginTop: 9,
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  trustText: {
    marginTop: 3,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  progressRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStep: { flex: 1, alignItems: 'center' },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotComplete: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandPrimary,
  },
  progressDotText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  progressLabel: {
    marginTop: 6,
    color: paltaTheme.color.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  progressLabelComplete: { color: paltaTheme.color.textSecondary },
  cancelledBox: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 10,
  },
  cancelledText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: paltaTheme.color.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 40,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  privacyNote: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 12,
  },
  privacyText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
