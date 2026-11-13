import type { ColorToken, FontToken, TypeToken } from '@rounds/shared/theme';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { fonts, type, useTheme } from '@/theme';

interface TxtProps extends TextProps {
  variant?: TypeToken;
  /** Colour token. Defaults to `text`. */
  tone?: ColorToken;
  /** Overrides the variant's font (e.g. `bodyMedium` for row titles). */
  weight?: FontToken;
  /** Override size, for one-off sizes taken from the mockups. */
  fontSize?: number;
  lineHeight?: number;
  tabular?: boolean;
  align?: TextStyle['textAlign'];
}

/** Text in one of the design's type styles. Scales with the system text size. */
export function Txt({
  variant = 'body',
  tone = 'text',
  weight,
  fontSize,
  lineHeight,
  tabular,
  align,
  style,
  ...rest
}: TxtProps) {
  const { c } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        type(variant, { tabular }),
        { color: c[tone] },
        weight && { fontFamily: fonts[weight] },
        fontSize !== undefined && { fontSize },
        lineHeight !== undefined && { lineHeight },
        align && { textAlign: align },
        style,
      ]}
    />
  );
}
