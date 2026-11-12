import React from 'react';
import {Composition} from 'remotion';
import {Clip, TOTAL_FRAMES} from './Clip';

export const Root: React.FC = () => (
  <Composition id="NujoomClip" component={Clip} durationInFrames={TOTAL_FRAMES} fps={30} width={1080} height={1920} />
);
