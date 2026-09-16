import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { ScreenFrame } from '../../components/ScreenFrame';
import { ReadingToolbar } from '../../components/reading/ReadingToolbar';
import { paltaTheme } from '../../theme/paltaTheme';

export function ReadingReferenceScreen() {
  const [textScale, setTextScale] = useState(1);
  const [focusMode, setFocusMode] = useState(false);
  const [listening, setListening] = useState(false);

  const bodySize = useMemo(
    () => Math.min(28, Math.max(17, 18 * textScale)),
    [textScale],
  );

  return (
    <ScreenFrame
      title={focusMode ? '읽기' : 'Palta'}
      subtitle={focusMode ? undefined : 'Reading Surface reference'}
    >
      <View
        style={{
          gap: 22,
          maxWidth: 680,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <ReadingToolbar
          listening={listening}
          onToggleListen={() => setListening((value) => !value)}
          onIncreaseText={() => setTextScale((value) => Math.min(1.55, value + 0.1))}
          onDecreaseText={() => setTextScale((value) => Math.max(0.95, value - 0.1))}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((value) => !value)}
        />

        <View style={{ gap: 8 }}>
          <Text
            allowFontScaling
            style={{
              fontSize: bodySize * 0.78,
              lineHeight: bodySize * 1.08,
              color: paltaTheme.color.textSecondary,
            }}
          >
            생활 · 오늘
          </Text>
          <Text
            allowFontScaling
            style={{
              fontSize: bodySize * 1.62,
              lineHeight: bodySize * 1.92,
              fontWeight: '800',
              color: paltaTheme.color.textPrimary,
            }}
          >
            긴 글은 화면보다 내용에 집중해서 읽을 수 있어야 합니다
          </Text>
        </View>

        {listening ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              padding: 14,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: paltaTheme.color.brandSoft,
            }}
          >
            <Text
              allowFontScaling
              style={{
                fontWeight: '750',
                color: paltaTheme.color.brandPrimary,
              }}
            >
              읽어주기 준비 상태
            </Text>
            <Text
              allowFontScaling
              style={{
                marginTop: 4,
                color: paltaTheme.color.textSecondary,
              }}
            >
              실제 TTS adapter는 컴퓨터/기기에서 연결 후 검증합니다.
            </Text>
          </View>
        ) : null}

        {[
          'Palta의 긴 콘텐츠는 주변 인터페이스보다 본문이 먼저 보이도록 설계합니다. 뉴스, 정부 안내, 건강 정보처럼 읽어야 가치가 생기는 글은 충분한 글자 크기와 행간을 가져야 합니다.',
          '글자를 크게 설정한 경우에도 문장을 작게 줄이거나 한 줄로 자르지 않습니다. 대신 정보의 우선순위를 다시 정하고, 한 번에 보여주는 부가정보를 줄여 본문을 편안하게 읽을 수 있도록 합니다.',
          '읽어주기는 화면의 모든 버튼을 기계적으로 읽는 기능이 아닙니다. 제목, 요약, 본문처럼 실제 콘텐츠를 의미 순서대로 전달하고, 사용자가 눈으로 읽다가 듣기로 바꾸더라도 같은 위치에서 이어갈 수 있도록 설계합니다.',
        ].map((paragraph, index) => (
          <Text
            key={String(index)}
            allowFontScaling
            style={{
              fontSize: bodySize,
              lineHeight: bodySize * 1.62,
              color: paltaTheme.color.textPrimary,
            }}
          >
            {paragraph}
          </Text>
        ))}

        {!focusMode ? (
          <View
            style={{
              paddingTop: 18,
              borderTopWidth: 1,
              borderColor: paltaTheme.color.divider,
            }}
          >
            <Text
              allowFontScaling
              style={{
                color: paltaTheme.color.textSecondary,
              }}
            >
              출처와 관련 콘텐츠는 본문 뒤에서 조용하게 제공됩니다.
            </Text>
          </View>
        ) : null}
      </View>
    </ScreenFrame>
  );
}
