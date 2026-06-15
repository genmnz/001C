import { matchPopulations } from "./match.ts";

/**
 * Population tracking across an ordered series of samples (e.g. a time course):
 * chain populations sample-to-sample by nearest-centroid matching. Returns one
 * track per sample-0 population; track[s] is the matched cluster index in sample
 * s, or -1 if it could not be followed.
 */
export function trackPopulations(centroidsBySample: number[][][]): number[][] {
  const S = centroidsBySample.length;
  if (S === 0) return [];
  const tracks: number[][] = centroidsBySample[0].map((_, c) => [c]);

  for (let s = 1; s < S; s++) {
    const match = matchPopulations(centroidsBySample[s - 1], centroidsBySample[s]);
    for (const track of tracks) {
      const prev = track[s - 1];
      track.push(prev >= 0 && prev < match.length ? match[prev] : -1);
    }
  }
  return tracks;
}
