import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import timing from './aghani-timing.json';
import {SceneDawn} from './scenes';
import {CREAM, GOLD, Grain, Line, ramp, Scene, Stars, Svg, TextBlock} from './ui';

/* Captions follow the voice-over: timing[i] is the start/end (seconds) of spoken line i. */
const FPS = 30;
const CORAL = '#ef6a55';
const INK = '#05081c';
const at = (i: number) => Math.round(timing[i].start * FPS);

// [first line index, scene start frame]
const CUTS = [0, at(2) - 5, at(6) - 5, at(8) - 5, at(10) - 5];
export const AGHANI_FRAMES = 1335;

/** Caption line `i`, positioned relative to the scene that starts at frame `from`. */
const Cap: React.FC<{i: number; from: number; last?: boolean; size?: number; color?: string; weight?: number; children: React.ReactNode}> = ({
  i,
  from,
  last,
  ...p
}) => (
  <Line at={at(i) - from - 3} dimAt={last ? undefined : at(i + 1) - from - 3} size={66} {...p} />
);

const Bust: React.FC<{fill?: string}> = ({fill = INK}) => (
  <g fill={fill}>
    <circle cx={0} cy={-250} r={125} />
    <path d="M-62 -150 H62 V-96 Q270 -76 300 130 V520 H-300 V130 Q-270 -76 -62 -96Z" />
  </g>
);

/* 1 — headphones on, then taken off */
const SceneHeadphones: React.FC<{from: number}> = ({from}) => {
  const f = useCurrentFrame();
  const off = ramp(f, at(1) - from + 60, at(1) - from + 110);
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#070b24, #141a4a 60%, #232b68)'}} />
      <Svg>
        <Stars seed="h" count={70} maxY={1150} />
        {[0, 1, 2, 3].map((k) => {
          const p = ((f + k * 22) % 88) / 88;
          return (
            <g key={k} stroke={CORAL} strokeWidth={7} fill="none" strokeLinecap="round" opacity={(1 - p) * (1 - off) * 0.9}>
              <path d={`M${330 - p * 190} ${1140 - p * 130} Q${270 - p * 230} 1250 ${330 - p * 190} ${1360 + p * 130}`} />
              <path d={`M${750 + p * 190} ${1140 - p * 130} Q${810 + p * 230} 1250 ${750 + p * 190} ${1360 + p * 130}`} />
            </g>
          );
        })}
        <g transform="translate(540 1500)">
          <Bust />
          <g transform={`translate(0 ${-off * 260}) rotate(${off * -14})`} opacity={1 - off * 0.85}>
            <path d="M-140 -250 A140 150 0 0 1 140 -250" stroke={CORAL} strokeWidth={22} fill="none" strokeLinecap="round" />
            <rect x={-176} y={-300} width={58} height={112} rx={24} fill={CORAL} />
            <rect x={118} y={-300} width={58} height={112} rx={24} fill={CORAL} />
          </g>
        </g>
      </Svg>
      <TextBlock>
        <Cap i={0} from={from} size={84} weight={700} color={GOLD}>تجربة ترك الأغاني</Cap>
        <Cap i={1} from={from} last>التجربة هذي أقدر أسمّيها حاليًا.. الأكثر تأثيرًا</Cap>
      </TextBlock>
    </Scene>
  );
};

/* 2 — a calm candle flame that gets disturbed */
const SceneCandle: React.FC<{from: number}> = ({from}) => {
  const f = useCurrentFrame();
  const shake = ramp(f, at(3) - from, at(3) - from + 40) * (1 - ramp(f, at(5) - from, at(5) - from + 30) * 0.6);
  const sway = Math.sin(f / 7) * (3 + shake * 16) + Math.sin(f / 2.3) * shake * 7;
  const squiggle = (y: number, dir: 1 | -1) =>
    `M${dir === 1 ? -40 : 1120} ${y}` + Array.from({length: 5}, (_, k) => ` q${dir * 28} ${k % 2 ? 46 : -46} ${dir * 56} 0`).join('');
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#2b2523, #463c37)'}} />
      <Svg>
        <circle cx={540} cy={1180} r={330 - shake * 90 + Math.sin(f / 9) * 10} fill="#f4c56a" opacity={0.1} />
        <circle cx={540} cy={1180} r={190 - shake * 50} fill="#f4c56a" opacity={0.12} />
        {[1080, 1210, 1340].map((y, k) => (
          <g key={y} stroke={CORAL} strokeWidth={7} fill="none" strokeLinecap="round" opacity={shake * 0.85}>
            <path d={squiggle(y, 1)} transform={`translate(${shake * 130 + Math.sin(f / 5 + k) * 14} 0)`} />
            <path d={squiggle(y + 60, -1)} transform={`translate(${-shake * 130 + Math.sin(f / 5 + k) * 14} 0)`} />
          </g>
        ))}
        <g transform="translate(540 1260)">
          <path
            d={`M0 0 C-62 -50 -40 -120 ${sway} ${-200 + shake * 50} C40 -120 62 -50 0 0Z`}
            fill="#f6c453"
          />
          <path d={`M0 -6 C-28 -34 -18 -70 ${sway * 0.5} ${-108 + shake * 25} C18 -70 28 -34 0 -6Z`} fill="#fff3cf" />
          <rect x={-4} y={-6} width={8} height={34} fill="#1a1412" />
          <rect x={-70} y={24} width={140} height={330} rx={12} fill="#efe6cf" />
          <rect x={-70} y={24} width={52} height={330} rx={12} fill="#d8ccb0" />
          <ellipse cx={0} cy={356} rx={190} ry={30} fill="#1a1412" />
        </g>
      </Svg>
      <TextBlock>
        <Cap i={2} from={from}>أصلًا قال عنها ابن تيمية رحمه الله</Cap>
        <Cap i={3} from={from} size={76} weight={700} color={GOLD}>تُذهِب السكينة</Cap>
        <Cap i={4} from={from}>ويبدأ الإنسان يهذي بها فترة طويلة</Cap>
        <Cap i={5} from={from} last size={76} weight={700}>وكان على حق</Cap>
      </TextBlock>
    </Scene>
  );
};

/* 3 — the tune looping around the head, even in prayer */
const SceneLoop: React.FC<{from: number}> = ({from}) => {
  const f = useCurrentFrame();
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#150d20, #2a1838 60%, #3a2146)'}} />
      <Svg>
        <g transform="translate(540 1420)">
          <Bust fill="#0b0714" />
          {[0, 1].map((k) => (
            <g key={k} transform={`translate(0 -250) rotate(${(k ? -1 : 1) * f * 3 + k * 140})`} stroke={CORAL} fill="none" strokeLinecap="round">
              <path d={`M${205 + k * 55} 0 A${205 + k * 55} ${205 + k * 55} 0 1 1 0 ${-205 - k * 55}`} strokeWidth={9 - k * 3} opacity={0.95 - k * 0.4} />
              <path d={`M-22 ${-227 - k * 55} L4 ${-205 - k * 55} L-22 ${-183 - k * 55}`} strokeWidth={9 - k * 3} opacity={0.95 - k * 0.4} />
            </g>
          ))}
          <path
            d={'M-70 -250' + Array.from({length: 5}, (_, k) => ` q14 ${(k % 2 ? 1 : -1) * (26 + Math.sin(f / 4 + k) * 14)} 28 0`).join('')}
            stroke={CORAL}
            strokeWidth={7}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </Svg>
      <TextBlock>
        <Line at={at(6) - from - 3} dimAt={at(6) - from + 52} size={66}>الأغنية تتكرر في مخّك</Line>
        <Line at={at(6) - from + 52} dimAt={at(7) - from - 3} size={70} weight={700}>تصلّي.. والأغنية تتكرر في مخّك</Line>
        <Line at={at(7) - from - 3} color={GOLD} size={62}>تقول: «هالأغنية ما تطلع من راسي!»</Line>
      </TextBlock>
    </Scene>
  );
};

/* 4 — sound carving a groove in the mind */
const SceneGroove: React.FC<{from: number}> = ({from}) => {
  const f = useCurrentFrame();
  const carve = ramp(f, at(9) - from, at(9) - from + 100);
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#040b22, #0b2148 60%, #133a66)'}} />
      <Svg>
        <Stars seed="g" count={50} maxY={1000} opacity={0.6} />
        {[0, 1, 2].map((k) => {
          const p = ((f + k * 26) % 78) / 78;
          return (
            <path
              key={k}
              d={`M${1010 - p * 260} ${1130 - (1 - p) * 90} Q${950 - p * 260} 1250 ${1010 - p * 260} ${1370 + (1 - p) * 90}`}
              stroke={CREAM}
              strokeWidth={7}
              fill="none"
              strokeLinecap="round"
              opacity={Math.sin(p * Math.PI) * 0.8}
            />
          );
        })}
        <g transform="translate(500 1500)">
          <Bust fill="#030716" />
          <g transform="translate(0 -250)" fill="none" stroke={GOLD} strokeLinecap="round">
            {[36, 62, 88].map((r, k) => {
              const len = 2 * Math.PI * r;
              return (
                <circle
                  key={r}
                  r={r}
                  strokeWidth={8}
                  strokeDasharray={len}
                  strokeDashoffset={len * (1 - ramp(carve, k * 0.3, k * 0.3 + 0.4))}
                  transform={`rotate(${-90 + k * 60})`}
                />
              );
            })}
            <circle r={8} fill={GOLD} stroke="none" opacity={carve > 0 ? 1 : 0} />
          </g>
        </g>
      </Svg>
      <TextBlock>
        <Cap i={8} from={from} size={72} weight={700}>هذا هو السر: الإنسان سَماعي</Cap>
        <Cap i={9} from={from} last size={72} weight={700} color={GOLD}>فالأغنية خلاص.. حفرت مكانها في المخ</Cap>
      </TextBlock>
    </Scene>
  );
};

export const AghaniClip: React.FC = () => {
  const scenes: React.FC<{from: number}>[] = [
    SceneHeadphones,
    SceneCandle,
    SceneLoop,
    SceneGroove,
    ({from}) => (
      <SceneDawn>
        <TextBlock top={260}>
          <Line at={at(10) - from - 3} size={66}>إن شاء الله..</Line>
          <Line at={at(10) - from + 22} size={84} weight={700} color={GOLD}>أتمنى من الله أن يعيننا على الثبات</Line>
        </TextBlock>
      </SceneDawn>
    ),
  ];
  return (
    <AbsoluteFill style={{backgroundColor: '#05071a'}}>
      {scenes.map((C, i) => {
        const from = CUTS[i];
        const end = i + 1 < CUTS.length ? CUTS[i + 1] : AGHANI_FRAMES;
        return (
          <Sequence key={i} from={from} durationInFrames={end - from}>
            <C from={from} />
          </Sequence>
        );
      })}
      <Grain />
      <Audio src={staticFile('voice.mp3')} />
      <Audio src={staticFile('ambience.mp3')} volume={0.18} />
    </AbsoluteFill>
  );
};
