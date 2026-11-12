import React from 'react';
import {AbsoluteFill, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/fonts';

export const RUQAA = 'Aref Ruqaa';
export const AMIRI = 'Amiri';
export const CREAM = '#f4efe1';
export const GOLD = '#f2d488';

loadFont({family: RUQAA, url: staticFile('fonts/aref-ruqaa-arabic-400-normal.woff2'), weight: '400'});
loadFont({family: RUQAA, url: staticFile('fonts/aref-ruqaa-arabic-700-normal.woff2'), weight: '700'});
loadFont({family: AMIRI, url: staticFile('fonts/amiri-arabic-700-normal.woff2'), weight: '700'});

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const ramp = (f: number, from: number, to: number, a = 0, b = 1) => interpolate(f, [from, to], [a, b], clamp);

/** A line of text that fades in at `at` and dims when the next line arrives (`dimAt`). */
export const Line: React.FC<{
  at: number;
  dimAt?: number;
  size?: number;
  color?: string;
  font?: string;
  weight?: number;
  children: React.ReactNode;
}> = ({at, dimAt, size = 64, color = CREAM, font = RUQAA, weight = 400, children}) => {
  const f = useCurrentFrame();
  const appear = ramp(f, at, at + 20);
  const dim = dimAt === undefined ? 1 : ramp(f, dimAt, dimAt + 18, 1, 0.42);
  return (
    <div
      style={{
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.7,
        color,
        opacity: appear * dim,
        transform: `translateY(${(1 - appear) * 18}px)`,
        filter: `blur(${(1 - appear) * 10}px)`,
        textShadow: '0 4px 24px rgba(0,0,0,0.55)',
      }}
    >
      {children}
    </div>
  );
};

export const TextBlock: React.FC<{top?: number; children: React.ReactNode}> = ({top = 230, children}) => (
  <div
    style={{
      position: 'absolute',
      top,
      left: 70,
      right: 70,
      direction: 'rtl',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}
  >
    {children}
  </div>
);

/** Fades a scene in and out at its edges. */
export const Scene: React.FC<{children: React.ReactNode}> = ({children}) => {
  const f = useCurrentFrame();
  const {durationInFrames: d} = useVideoConfig();
  const opacity = Math.min(ramp(f, 0, 14), ramp(f, d - 14, d - 1, 1, 0));
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

export const Stars: React.FC<{count?: number; seed: string; maxY?: number; opacity?: number}> = ({
  count = 90,
  seed,
  maxY = 1500,
  opacity = 1,
}) => {
  const f = useCurrentFrame();
  return (
    <g opacity={opacity}>
      {Array.from({length: count}, (_, i) => {
        const x = random(`${seed}x${i}`) * 1080;
        const y = random(`${seed}y${i}`) * maxY;
        const r = 1.2 + random(`${seed}r${i}`) * 2.6;
        const tw = 0.55 + 0.45 * Math.sin(f / (9 + random(`${seed}s${i}`) * 14) + i);
        const big = random(`${seed}b${i}`) > 0.9;
        return big ? (
          <path
            key={i}
            d={`M${x} ${y - 13}Q${x} ${y} ${x + 13} ${y}Q${x} ${y} ${x} ${y + 13}Q${x} ${y} ${x - 13} ${y}Q${x} ${y} ${x} ${y - 13}Z`}
            fill="#fff"
            opacity={tw}
          />
        ) : (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={tw * 0.9} />
        );
      })}
    </g>
  );
};

/** Film grain + vignette, to give the flat illustrations a printed feel. */
export const Grain: React.FC = () => (
  <AbsoluteFill>
    <svg width="1080" height="1920">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="1080" height="1920" filter="url(#grain)" opacity="0.1" />
    </svg>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)'}} />
  </AbsoluteFill>
);

export const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{position: 'absolute'}}>
    {children}
  </svg>
);
