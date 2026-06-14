export {
  channelStats,
  extract,
  frequency,
  median,
  percentile,
} from "./descriptive.ts";
export type { ChannelStats, Frequency } from "./descriptive.ts";
export {
  benjaminiHochberg,
  coExpression,
  differentialAbundance,
  foldChange,
  log2FoldChange,
  mannWhitneyU,
  markerPositivity,
  shannonDiversity,
  simpsonDiversity,
} from "./comparative.ts";
export type {
  CoExpression,
  DifferentialAbundance,
  MannWhitney,
} from "./comparative.ts";
