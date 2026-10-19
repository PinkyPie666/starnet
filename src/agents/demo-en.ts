// English demo scripts, used when the interface language is English.

import type { ClassId } from '../core/types';

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

const NOTE = '> Sample output from Demo mode, to show how this crew member works. For a real answer to your task, add an API key in Settings and choose Live.\n\n';

const upstreamNote = (input: string | null) =>
  input ? `> Building on the previous crew member's ${input.length.toLocaleString()} characters of output.\n\n` : '';

export const SCRIPTS_EN: Record<ClassId, (topic: string, seed: number, input: string | null) => string> = {
  researcher: (topic, seed, input) => `# Briefing: ${topic}

${NOTE}${upstreamNote(input)}**Question.** What do we need to know about ${topic.toLowerCase()} to make a good call this week?

## Key findings
- **Demand is real but uneven** (confidence: medium). Interest clusters around ${pick(['small teams', 'solo builders', 'agencies'], seed)} who already pay for two or more tools.
- **Switching cost is the main blocker** (confidence: high). Users keep their current workflow unless the new option saves time on day one.
- **Price anchors are low** (confidence: medium). Comparable tools sit between $8 and $20 per seat per month.
- **Trust signals matter more than features** (confidence: medium). Clear data handling and a visible changelog beat long feature lists.

## Landscape
| Approach | Strength | Weakness |
|---|---|---|
| All-in-one suite | One bill, one login | Slow to adopt, shallow features |
| Focused tool | Fast value, easy to explain | Needs integrations to stick |
| Open source | Trust, extensibility | Support burden |

## Open questions
1. Which segment converts fastest from free to paid? Run a two-week test with two landing pages.
2. How sensitive are users to running in the browser versus a desktop app?

## Implications
- Lead with the one workflow that saves time on day one.
- Publish a plain-language data policy before launch.
- Price below $15 per seat until retention data says otherwise.
`,
  strategist: (topic, seed, input) => `# Plan: ${topic}

${NOTE}${upstreamNote(input)}**Objective.** Reach ${pick(['500', '1,000', '250'], seed)} weekly active users within 30 days, with a team of two and no paid ads.

## Options
1. **Community-first.** Bet: a niche community adopts and spreads it. Cost: low. Risk: slow. Wrong if fewer than 50 sign-ups after week one.
2. **Launch spike.** Bet: one big launch day creates momentum. Cost: medium. Risk: traffic without retention.
3. **Partner channel.** Bet: an existing tool's users want this. Cost: high effort. Risk: dependency.

**Recommendation: option 1, with a small launch spike in week three.** It compounds and keeps the team focused.

## Phases
| Week | Owner | Actions | Success metric |
|---|---|---|---|
| 1 | Founder | 20 user interviews, fix top 3 frictions | 10 users return twice |
| 2 | Builder | Ship onboarding and share links | 30% day-7 retention |
| 3 | Both | Launch post, demo GIF, community AMA | 300 sign-ups |
| 4 | Founder | Double down on the best channel | 500 WAU |

## Risks and mitigations
- **Launch flops:** keep the community plan running, the spike is a bonus.
- **Support overload:** canned answers and a public FAQ by week two.

## First three moves this week
1. Book interviews from the waitlist.
2. Record the 30-second demo.
3. Write the launch post draft.
`,
  coder: (topic, _seed, input) => `# Implementation: ${topic}

${NOTE}${upstreamNote(input)}Approach: a small, dependency-free TypeScript module with explicit types and tests. Assumes Node 20+ or any modern browser.

\`\`\`ts
export interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number,
  { leading = false, trailing = true }: DebounceOptions = {},
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const debounced = (...args: A) => {
    const callNow = leading && timer === null;
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs && !callNow) fn(...lastArgs);
      lastArgs = null;
    }, wait);
    if (callNow) fn(...args);
  };

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return debounced;
}
\`\`\`

## Tests
\`\`\`ts
import { describe, it, expect, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  it('calls once after the wait', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const d = debounce(spy, 100);
    d(1); d(2); d(3);
    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(3);
  });
});
\`\`\`

## Notes
- O(1) per call. \`cancel()\` drops pending work.
- Next: add \`flush()\` and a \`maxWait\` option for throttle-like behavior.
`,
  copywriter: (topic, seed, input) => `# Copy: ${topic}

${NOTE}${upstreamNote(input)}**Audience:** busy builders who want results without babysitting tools. **Voice:** calm, sharp, a little playful.

## Hero
**${pick(['Your AI crew, working while you watch.', 'Hand off the work. Watch it get done.', 'A control room for the work you delegate.'], seed)}**

Assign a task, watch a crew member walk to a desk and get to work, then pick up the finished result from the Outbox.

[ Start a mission ]

## Features
- **Real work, visible.** Every agent streams its output live, so you see progress instead of a spinner.
- **Chain your crew.** Send research to strategy to writing on one conveyor belt.
- **Your key, your browser.** Nothing is stored on our servers, because there are none.

## Alternative headlines
1. Delegate like a station commander.
2. Less prompting. More shipping.

**Rationale:** the first hero line names the outcome and the feeling of watching it happen, which is what makes this product different.
`,
  reviewer: (topic, _seed, input) => `# Review: ${topic}

${NOTE}${upstreamNote(input)}**Verdict: ship with fixes.**

## Issues
1. **Critical - no success metric.** "Launch it" is not a goal. Fix: commit to one number, such as 300 sign-ups in 7 days.
2. **Major - timing.** Friday launches lose the weekend audience on most platforms. Fix: launch Tuesday to Thursday, early morning US Pacific.
3. **Major - no waitlist.** You start from zero. Fix: run a two-week waitlist page and collect at least 200 emails first.
4. **Minor - vague call to action.** "Learn more" invites hesitation. Fix: "Start free" or "Run a demo".

## Keep
- The demo-first approach. A working demo with no sign-up is the strongest asset here.
- The short feature list. Three clear points beat ten.

## Next step
Rewrite the plan with the metric, date and waitlist, then send it back for a second pass.
`,
  ops: (topic, _seed, input) => `# Runbook: ${topic}

${NOTE}${upstreamNote(input)}**Scope:** static site, deployed from the main branch, run by whoever is on call. Done means the new version is live and verified.

## Deploy checklist
1. \`git pull && npm ci\` - expect a clean install with no peer warnings.
2. \`npm test\` - all green. **Stop if anything fails.**
3. \`npm run build\` - check that \`dist/index.html\` exists and the bundle size is within budget.
4. \`netlify deploy --dir=dist\` - open the draft URL, click through the main flows.
5. \`netlify deploy --dir=dist --prod\` - note the deploy ID.
6. Verify: load the live URL in a private window, check the console for errors.

## Rollback
1. Netlify dashboard, Deploys, pick the last good deploy, "Publish deploy".
2. Or CLI: \`netlify api restoreSiteDeploy --data '{"site_id":"...","deploy_id":"..."}'\`.
3. Post in the team channel: what broke, what was rolled back, next step.

## Failure modes
| Symptom | Detect | Fix |
|---|---|---|
| Blank page | Console error on load | Roll back, check asset paths |
| 404 on refresh | Deep links fail | Add SPA redirect rule |
| Stale content | Old hash in HTML | Purge cache, redeploy |

## Automate next
Run steps 1 to 4 in CI on every pull request and post the draft URL as a comment.
`,
};

