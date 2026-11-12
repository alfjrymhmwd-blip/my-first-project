import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {AMIRI, CREAM, GOLD, Line, ramp, Scene, Stars, Svg, TextBlock} from './ui';

const Ayah: React.FC<{at: number; dimAt?: number; size?: number; children: React.ReactNode}> = ({children, size = 66, ...p}) => (
  <Line {...p} font={AMIRI} weight={700} size={size} color={GOLD}>
    {children}
  </Line>
);

/* 1 — الغيب لله: a figure on a hill looking at the night sky */
export const SceneGhayb: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#070b24, #141a4a 55%, #2a3376)'}} />
      <Svg>
        <Stars seed="a" />
        <circle cx={850} cy={1080} r={150} fill="#f6f1dc" opacity={0.08} />
        <circle cx={850} cy={1080} r={78} fill="#f6f1dc" />
        <circle cx={822} cy={1060} r={78} fill="#141a4a" opacity={0.0} />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${-80 + i * 380 + f * (0.25 + i * 0.1)}, ${1330 + i * 45})`} fill="#343f8f" opacity={0.75}>
            <circle cx={0} cy={0} r={70} />
            <circle cx={80} cy={-35} r={90} />
            <circle cx={175} cy={0} r={75} />
            <rect x={-40} y={0} width={260} height={70} rx={35} />
          </g>
        ))}
        <path d="M0 1640 Q260 1470 520 1600 T1080 1560 V1920 H0Z" fill="#0a0f33" />
        <path d="M0 1740 Q300 1560 620 1700 T1080 1690 V1920 H0Z" fill="#05081c" />
        {/* seated figure */}
        <g transform="translate(300 1560)" fill="#05081c">
          <circle cx={0} cy={-98} r={24} />
          <path d="M-30 -70 Q0 -84 26 -66 L40 6 L96 20 L98 40 L-44 40 Z" />
          <path d="M22 -50 L78 -24 L74 -8 L18 -22Z" />
        </g>
      </Svg>
      <TextBlock>
        <Line at={10} dimAt={62}>يقول الله سبحانه وتعالى</Line>
        <Ayah at={62}>﴿قُل لَّا يَعْلَمُ مَن فِي السَّمَاوَاتِ وَالْأَرْضِ الْغَيْبَ إِلَّا اللَّهُ﴾</Ayah>
        <Line at={150} size={40} color="#c9cdf0">[النمل: ٦٥]</Line>
        <Line at={190}>الغيبُ لله وحده.. لا لنجمٍ ولا لبُرج</Line>
      </TextBlock>
    </Scene>
  );
};

/* 2 — الأبراج: a zodiac wheel that gets struck out */
export const SceneZodiac: React.FC = () => {
  const f = useCurrentFrame();
  const cx = 540;
  const cy = 1330;
  const struck = ramp(f, 150, 200);
  const stroke = (from: number) => 1000 * (1 - ramp(f, from, from + 16));
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#150d20, #2a1838 60%, #3a2146)'}} />
      <Svg>
        <Stars seed="z" count={50} maxY={1900} opacity={0.5} />
        <g transform={`rotate(${f * 0.18} ${cx} ${cy})`} opacity={1 - struck * 0.6} stroke="#d9b56c" fill="none" strokeWidth={4}>
          <circle cx={cx} cy={cy} r={340} />
          <circle cx={cx} cy={cy} r={215} />
          <circle cx={cx} cy={cy} r={70} strokeDasharray="6 12" />
          {Array.from({length: 12}, (_, i) => {
            const a = (i * Math.PI) / 6;
            const m = a + Math.PI / 12;
            const pts = Array.from({length: 4}, (_, k) => {
              const rr = 240 + random(`c${i}r${k}`) * 75;
              const aa = m + (random(`c${i}a${k}`) - 0.5) * 0.36;
              return [cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr];
            });
            return (
              <g key={i}>
                <line x1={cx + Math.cos(a) * 215} y1={cy + Math.sin(a) * 215} x2={cx + Math.cos(a) * 340} y2={cy + Math.sin(a) * 340} />
                <polyline points={pts.map((p) => p.join(',')).join(' ')} strokeWidth={2} opacity={0.7} />
                {pts.map((p, k) => (
                  <circle key={k} cx={p[0]} cy={p[1]} r={6} fill="#f4e3b0" stroke="none" />
                ))}
              </g>
            );
          })}
        </g>
        <g stroke="#e4503f" strokeWidth={34} strokeLinecap="round" fill="none">
          <path d="M250 1040 Q560 1300 840 1620" strokeDasharray={1000} strokeDashoffset={stroke(150)} />
          <path d="M840 1050 Q520 1340 250 1610" strokeDasharray={1000} strokeDashoffset={stroke(168)} />
        </g>
      </Svg>
      <TextBlock>
        <Line at={8} dimAt={75}>«برجك اليوم».. «حظّك هذا الأسبوع»</Line>
        <Line at={75} dimAt={150}>«صفات مواليد بُرج كذا»</Line>
        <Line at={150} dimAt={215} size={74} weight={700}>كلُّها ادّعاءٌ لعلم الغيب</Line>
        <Line at={215} size={74} weight={700} color={GOLD}>والغيبُ لا يعلمه إلا الله</Line>
      </TextBlock>
    </Scene>
  );
};

/* 3 — الحديث: a phone showing a horoscope goes dark */
export const SceneHadith: React.FC = () => {
  const f = useCurrentFrame();
  const on = 1 - ramp(f, 125, 150);
  const wave = (y: number, ph: number) =>
    'M-20 ' + y + Array.from({length: 12}, (_, i) => ` Q${i * 100 + 30} ${y + (i % 2 ? 90 : -90) * Math.sin(ph + i)} ${i * 100 + 80} ${y}`).join('');
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#352e2b, #4a403b)'}} />
      <Svg>
        <path d={wave(1500, 1)} stroke="#e8c15a" strokeWidth={5} fill="none" strokeDasharray={2400} strokeDashoffset={2400 * (1 - ramp(f, 0, 90))} />
        {Array.from({length: 70}, (_, i) => (
          <circle
            key={i}
            cx={random(`d${i}`) * 1080}
            cy={1560 + random(`e${i}`) * 300}
            r={2 + random(`g${i}`) * 3}
            fill="#e8c15a"
            opacity={(0.3 + 0.5 * Math.sin(f / 12 + i)) * ramp(f, 20, 80)}
          />
        ))}
        <g transform={`translate(540 1330) rotate(${-7 + Math.sin(f / 40) * 1.5})`}>
          <rect x={-230} y={-330} width={460} height={660} rx={54} fill={`rgba(244,226,160,${0.1 * on})`} />
          <rect x={-170} y={-290} width={340} height={580} rx={44} fill="#161210" />
          <rect x={-150} y={-268} width={300} height={536} rx={28} fill="#1f2a63" opacity={0.15 + 0.85 * on} />
          <g opacity={on}>
            <circle cx={0} cy={-80} r={92} fill="none" stroke="#f2d488" strokeWidth={5} />
            <path d="M0 -150 L18 -98 L72 -98 L28 -66 L44 -14 L0 -46 L-44 -14 L-28 -66 L-72 -98 L-18 -98Z" fill="#f2d488" />
            {[70, 115, 160].map((y, i) => (
              <rect key={y} x={-110 + i * 15} y={y} width={220 - i * 30} height={16} rx={8} fill="#c9cdf0" opacity={0.7} />
            ))}
          </g>
          <circle cx={0} cy={-279} r={6} fill="#35302c" />
        </g>
      </Svg>
      <TextBlock>
        <Line at={8} dimAt={62}>
          قال رسول الله <span style={{fontFamily: AMIRI}}>ﷺ</span>
        </Line>
        <Line at={62} size={70} weight={700}>«مَنِ اقتبسَ علمًا من النجوم</Line>
        <Line at={122} size={70} weight={700} color={GOLD}>اقتبسَ شُعبةً من السِّحر»</Line>
        <Line at={190} size={40} color="#d9cfc4">رواه أبو داود</Line>
      </TextBlock>
    </Scene>
  );
};

/* 4 — لماذا خُلقت النجوم: a boat guided by a star */
export const ScenePurpose: React.FC = () => {
  const f = useCurrentFrame();
  const bob = Math.sin(f / 18) * 10;
  const shoot = ramp(f, 128, 158);
  const guide = ramp(f, 190, 235);
  const sea = (y: number, amp: number, ph: number, fill: string) => (
    <path
      d={`M-60 ${y}` + Array.from({length: 8}, (_, i) => ` q40 ${-amp} 80 0 t80 0`).join('') + ' V1920 H-60Z'}
      fill={fill}
      transform={`translate(${Math.sin(f / 30 + ph) * 40} 0)`}
    />
  );
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#040b22, #0b2148 60%, #133a66)'}} />
      <Svg>
        <Stars seed="p" count={110} maxY={1450} />
        {/* shooting star */}
        <line
          x1={180 + shoot * 420}
          y1={1010 + shoot * 230}
          x2={180 + Math.max(0, shoot - 0.3) * 420}
          y2={1010 + Math.max(0, shoot - 0.3) * 230}
          stroke="#fff"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={shoot > 0 && shoot < 1 ? 1 : 0}
        />
        {/* guiding star */}
        <g transform="translate(810 1090)">
          <circle r={90 + Math.sin(f / 10) * 12} fill="#f2d488" opacity={0.12} />
          <path d="M0 -52Q0 0 52 0Q0 0 0 52Q0 0 -52 0Q0 0 0 -52Z" fill="#fbeab8" transform={`scale(${1 + Math.sin(f / 10) * 0.08})`} />
        </g>
        <line x1={790} y1={1130} x2={470} y2={1440} stroke="#f2d488" strokeWidth={4} strokeDasharray="4 18" strokeLinecap="round" opacity={guide * 0.9} />
        {sea(1560, 26, 0, '#0c2c57')}
        <g transform={`translate(380 ${1545 + bob}) rotate(${Math.sin(f / 18 + 1) * 2.5})`}>
          <path d="M-130 0 H130 L95 62 H-95Z" fill="#05081c" />
          <rect x={-5} y={-230} width={10} height={232} fill="#05081c" />
          <path d="M10 -222 L112 -24 H10Z" fill="#efe6cf" />
          <path d="M-10 -190 L-88 -24 H-10Z" fill="#cfc4a6" />
        </g>
        {sea(1640, 30, 2, '#082043')}
        {sea(1740, 34, 4, '#05142e')}
      </Svg>
      <TextBlock>
        <Line at={8} dimAt={65}>فلماذا خلق اللهُ النجوم؟</Line>
        <Line at={65} dimAt={125} size={70}>زينةً للسماء</Line>
        <Line at={125} dimAt={185} size={70}>ورُجومًا للشياطين</Line>
        <Line at={185} dimAt={250} size={70}>وعلاماتٍ يُهتدى بها</Line>
        <Ayah at={250} size={72}>﴿وَبِالنَّجْمِ هُمْ يَهْتَدُونَ﴾</Ayah>
        <Line at={275} size={40} color="#c9cdf0">[النحل: ١٦]</Line>
      </TextBlock>
    </Scene>
  );
};

/* 5 — الخاتمة: dawn over a mosque skyline */
export const SceneDawn: React.FC = () => {
  const f = useCurrentFrame();
  const dawn = ramp(f, 0, 255);
  return (
    <Scene>
      <AbsoluteFill style={{background: 'linear-gradient(#0a0f2e, #2d2558 55%, #8a4f6e 80%, #f0a066)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(transparent 55%, #ffc98a)', opacity: dawn * 0.55}} />
      <Svg>
        <Stars seed="w" count={70} maxY={1300} opacity={1 - dawn * 0.75} />
        <g fill="#070818">
          <rect x={0} y={1640} width={1080} height={280} />
          <rect x={40} y={1560} width={170} height={120} />
          <rect x={230} y={1600} width={120} height={80} />
          <rect x={860} y={1570} width={190} height={110} />
          {/* mosque */}
          <rect x={420} y={1520} width={330} height={150} />
          <path d="M470 1522 A115 115 0 0 1 700 1522Z" />
          <rect x={581} y={1372} width={8} height={40} />
          <rect x={770} y={1300} width={46} height={370} />
          <path d="M760 1300 H826 L793 1210Z" />
          <rect x={756} y={1400} width={74} height={16} />
        </g>
        <path d="M585 1338 a26 26 0 1 0 22 40 a20 20 0 1 1 -22 -40Z" fill={GOLD} />
      </Svg>
      <TextBlock top={260}>
        <Line at={8} dimAt={75} size={70}>النجومُ لا تكتبُ قدَرَك</Line>
        <Line at={75} dimAt={150} size={70}>قدَرُك بيدِ مَن خلقَ النجوم</Line>
        <Line at={150} size={92} weight={700} color={GOLD}>فعلِّق قلبَك بالله وحده</Line>
      </TextBlock>
    </Scene>
  );
};
