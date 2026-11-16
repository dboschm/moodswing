import { useState } from 'react';
import { averageMood, bandCounts, moodBand } from '../../shared/mood';
import type { SessionSnapshot } from '../../shared/protocol';
import { FaceIcon } from './face-icon';

interface MoodSummaryProps {
  snapshot: SessionSnapshot;
  creating: boolean;
  onCopySummary: (text: string) => Promise<boolean>;
  onStartNew: () => void;
}

export function summaryText(snapshot: SessionSnapshot): string {
  const average = averageMood(snapshot.moods);

  if (average === null) {
    return `Mood Swing ${snapshot.code}: nobody shared a mood.`;
  }

  const counts = bandCounts(snapshot.moods)
    .filter(({ count }) => count > 0)
    .map(({ info, count }) => `${info.emoji}×${count}`)
    .join(' ');
  const people = snapshot.moods.length === 1 ? '1 mood' : `${snapshot.moods.length} moods`;

  return `Mood Swing ${snapshot.code}: ${people}, the team feels ${moodBand(average).label.toLowerCase()} (${Math.round(average)}/100). ${counts}`;
}

/** The results board shown to everyone once the session has ended. */
export function MoodSummary({ snapshot, creating, onCopySummary, onStartNew }: MoodSummaryProps) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const average = averageMood(snapshot.moods);
  const counts = bandCounts(snapshot.moods);
  const most = Math.max(1, ...counts.map(({ count }) => count));
  const happiestFirst = [...snapshot.moods].sort((a, b) => b - a);
  const endedAt = snapshot.closedAt ? new Date(snapshot.closedAt) : null;

  const copy = async () => {
    setCopied(await onCopySummary(summaryText(snapshot)));
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="card summary" aria-labelledby="summary-title">
      <p className="eyebrow">Final results · {snapshot.code}</p>
      <div className="summary__headline">
        <FaceIcon mood={average ?? 50} size={88} animated={average !== null} />
        <div>
          <h2 id="summary-title">
            {average === null ? 'Nobody shared a mood' : `The team is feeling ${moodBand(average).label.toLowerCase()}`}
          </h2>
          <p className="hint">
            {snapshot.moods.length === 1 ? '1 mood' : `${snapshot.moods.length} moods`}
            {average === null ? '' : ` · average ${Math.round(average)}/100`}
            {endedAt ? ` · ended ${endedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        </div>
      </div>

      <ul className="distribution" aria-label="Moods per band">
        {counts.map(({ info, count }) => (
          <li key={info.band}>
            <FaceIcon mood={info.sample} size={28} />
            <span className="distribution__label">{info.label}</span>
            <span className="distribution__bar" aria-hidden="true">
              <span style={{ width: `${(count / most) * 100}%` }} />
            </span>
            <span className="distribution__count">{count}</span>
          </li>
        ))}
      </ul>

      {happiestFirst.length > 0 && (
        <div className="all-moods">
          <p className="eyebrow">Every mood, happiest first</p>
          <div className="all-moods__faces">
            {happiestFirst.map((mood, index) => (
              <FaceIcon key={index} mood={mood} size={30} />
            ))}
          </div>
        </div>
      )}

      <div className="summary__actions">
        <button type="button" className="button button--secondary" onClick={copy}>
          {copied === true ? 'Copied!' : copied === false ? 'Copy failed' : 'Copy summary'}
        </button>
        <button type="button" className="button" onClick={onStartNew} disabled={creating}>
          {creating ? 'Starting…' : 'Start a new session'}
        </button>
      </div>
    </section>
  );
}
