# `packages/fcs/test/fixtures/`

**This directory is intentionally empty, and the emptiness is a decision, not an oversight.**

The FCS parser suite is deliberately **fixture-free**. `packages/fcs/test/synth.ts` is a
spec-correct FCS writer, so every parser test is self-contained (write → parse → assert) and
**no binary blobs are committed**. That keeps `bun test` fast, keeps the diff readable, and
above all keeps real patient data out of the repository. `*.fcs` is gitignored for exactly
that reason.

## Why the directory exists anyway

`.gitignore` carries an exception for this path (`!packages/fcs/test/fixtures/*.fcs`) because
there is one file we genuinely want here eventually, tracked as **V-3** in
[`docs/RESEARCH.md`](../../../../docs/RESEARCH.md):

> A real, licensed, redistributable FCS file from a vendor instrument.

The synthetic writer proves the parser handles **correct** files. It cannot prove the parser
handles the files people actually have, because real FCS files violate the spec constantly:
missing `$PnS`, header offsets that disagree with the TEXT segment, non-standard `$BYTEORD`,
`$PnR` narrower than the data it describes, vendor keywords everywhere. The parser is
*defensive* precisely because of this, and today those defensive paths are exercised only by
hand-written malformity.

It also blocks **V-2**, the end-to-end composite golden (parse → compensate → transform →
gate hierarchy → counts, against FlowKit or flowCore), which needs a real file both sides can
read.

## Before you add anything here

1. **Check the licence.** FlowRepository, ImmPort, and Cytobank public experiments are the
   right places to look; the licence is per-dataset and must permit redistribution. This is
   the actual blocker: the technique is not hard, the licensing decision is unmade.
2. **Never commit anything derived from patient data**, however de-identified it looks.
3. **Record its provenance**: the source, the accession or experiment ID, the retrieval date,
   and the licence, in this README (`CLAUDE.md` §1b: a cache preserves its origin).
4. **Keep it small.** This repo already carries a 1.6 MB golden; a multi-hundred-megabyte FCS
   file is not a fixture, it is a download step.
