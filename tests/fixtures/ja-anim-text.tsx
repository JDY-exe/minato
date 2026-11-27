import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { JaAnimText } from '../../src/minato-design';
import type { JaAnimTextProps } from '../../src/minato-design';
import '../../src/minato-design/styles/index.css';

const root = createRoot(document.getElementById('root')!);
let props: JaAnimTextProps = {
  segments: [{ text: '東', typing: 'tou' }, { text: '京', typing: 'kyou' }],
  timings: { startDelay: 100, keystroke: 100, jitter: 0, conversionDelay: 200, segmentDelay: 100 },
};
Object.assign(window, {
  updateJaAnimText(next: Partial<JaAnimTextProps>) {
    props = { ...props, ...next };
    flushSync(() => root.render(<StrictMode><JaAnimText {...props} /></StrictMode>));
  },
  unmountJaAnimText() { flushSync(() => root.unmount()); },
});
window.updateJaAnimText({});
