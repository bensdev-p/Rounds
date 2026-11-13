import Svg, { Path } from 'react-native-svg';

/** The ladder mark (rank chip, Pimp me, badges). Lucide has no ladder, so it's drawn in the same 2 pt style. */
export function LadderIcon({ size = 24, color }: { size?: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M7 3v18M17 3v18M7 7.5h10M7 12h10M7 16.5h10" />
    </Svg>
  );
}
