import React from 'react';
import {AbsoluteFill, Audio, Series, staticFile} from 'remotion';
import {Grain} from './ui';
import {SceneDawn, SceneGhayb, SceneHadith, ScenePurpose, SceneZodiac} from './scenes';

const SCENES: [React.FC, number][] = [
  [SceneGhayb, 285],
  [SceneZodiac, 300],
  [SceneHadith, 270],
  [ScenePurpose, 360],
  [SceneDawn, 255],
];

export const TOTAL_FRAMES = SCENES.reduce((a, [, d]) => a + d, 0);

export const Clip: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#05071a'}}>
    <Series>
      {SCENES.map(([C, d], i) => (
        <Series.Sequence key={i} durationInFrames={d}>
          <C />
        </Series.Sequence>
      ))}
    </Series>
    <Grain />
    <Audio src={staticFile('ambience.mp3')} volume={0.6} />
  </AbsoluteFill>
);
