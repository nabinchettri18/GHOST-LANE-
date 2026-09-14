export type GhostObservation = {
  contractedVolume: number
  priorRealization: number
  priorGhostRate: number
  priorContractCount: number
  priorShipmentCount: number
  contractMonth: number
  modeRoad: number
  label?: number
}

export type RiskPrediction = {
  probability: number
  risk: number
  band: 'low' | 'watch' | 'high'
  confidence: number
}

type TreeNode = { feature?: number; threshold?: number; left?: TreeNode; right?: TreeNode; probability: number }

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x))
const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))))
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const gini = (ys: number[]) => {
  if (!ys.length) return 0
  const p = mean(ys)
  return 1 - p * p - (1 - p) * (1 - p)
}

function seedRandom(seed: number) {
  let s = seed >>> 0
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296 }
}

function buildTree(X: number[][], y: number[], depth: number, maxDepth: number, minLeaf: number, rand: () => number): TreeNode {
  const probability = mean(y)
  if (!y.length || depth >= maxDepth || y.length <= minLeaf * 2 || probability === 0 || probability === 1) return { probability }

  const featureCount = X[0]?.length ?? 0
  const featureSample = Math.max(1, Math.floor(Math.sqrt(featureCount)))
  const features = Array.from({ length: featureCount }, (_, i) => i).sort(() => rand() - 0.5).slice(0, featureSample)
  let best: { feature: number; threshold: number; score: number; left: number[]; right: number[] } | null = null

  for (const f of features) {
    const values = [...new Set(X.map(r => r[f]).filter(Number.isFinite))].sort((a, b) => a - b)
    if (values.length < 2) continue
    const step = Math.max(1, Math.floor(values.length / 12))
    for (let i = 1; i < values.length; i += step) {
      const threshold = (values[i - 1] + values[i]) / 2
      const left: number[] = [], right: number[] = []
      for (let j = 0; j < X.length; j++) (X[j][f] <= threshold ? left : right).push(j)
      if (left.length < minLeaf || right.length < minLeaf) continue
      const score = (left.length * gini(left.map(j => y[j])) + right.length * gini(right.map(j => y[j]))) / y.length
      if (!best || score < best.score) best = { feature: f, threshold, score, left, right }
    }
  }
  if (!best) return { probability }
  return {
    probability,
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(best.left.map(i => X[i]), best.left.map(i => y[i]), depth + 1, maxDepth, minLeaf, rand),
    right: buildTree(best.right.map(i => X[i]), best.right.map(i => y[i]), depth + 1, maxDepth, minLeaf, rand),
  }
}

function predictTree(node: TreeNode, x: number[]): number {
  if (node.feature === undefined || node.threshold === undefined || !node.left || !node.right) return node.probability
  return x[node.feature] <= node.threshold ? predictTree(node.left, x) : predictTree(node.right, x)
}

export class GhostRiskForest {
  private trees: TreeNode[] = []
  private positiveRate = 0.5
  readonly featureNames = ['contracted_volume_log', 'prior_realization', 'prior_ghost_rate', 'prior_contract_count_log', 'prior_shipment_count_log', 'contract_month_sin', 'contract_month_cos', 'mode_road']

  fit(observations: GhostObservation[], seed = 42) {
    const labeled = observations.filter(o => o.label === 0 || o.label === 1)
    if (labeled.length < 12) throw new Error(`At least 12 historical contract outcomes are required; found ${labeled.length}. Import more contract/shipment history to train the model.`)
    const X = labeled.map(toFeatures)
    const y = labeled.map(o => o.label as number)
    this.positiveRate = mean(y)
    const rand = seedRandom(seed)
    this.trees = []
    for (let t = 0; t < 31; t++) {
      const bx: number[][] = [], by: number[] = []
      for (let i = 0; i < X.length; i++) { const j = Math.floor(rand() * X.length); bx.push(X[j]); by.push(y[j]) }
      this.trees.push(buildTree(bx, by, 0, 5, 2, rand))
    }
    return this
  }

  predict(observation: GhostObservation): RiskPrediction {
    const x = toFeatures(observation)
    const probability = this.trees.length ? mean(this.trees.map(t => predictTree(t, x))) : this.positiveRate
    const risk = Math.round(clamp(probability) * 100)
    return { probability: clamp(probability), risk, band: risk >= 70 ? 'high' : risk >= 40 ? 'watch' : 'low', confidence: this.trees.length ? Math.min(0.99, 0.55 + this.trees.length / 100) : 0.35 }
  }

  evaluate(observations: GhostObservation[]) {
    const labeled = observations.filter(o => o.label === 0 || o.label === 1)
    if (!this.trees.length || !labeled.length) return { accuracy: null, precision: null, recall: null, samples: labeled.length }
    let correct = 0, tp = 0, fp = 0, fn = 0
    for (const o of labeled) { const pred = this.predict(o).risk >= 50 ? 1 : 0; const actual = o.label as number; if (pred === actual) correct++; if (pred && actual) tp++; if (pred && !actual) fp++; if (!pred && actual) fn++ }
    return { accuracy: correct / labeled.length, precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0, samples: labeled.length }
  }
}

export function toFeatures(o: GhostObservation): number[] {
  const month = Math.max(1, Math.min(12, o.contractMonth || 1))
  return [
    Math.log1p(Math.max(0, o.contractedVolume)),
    clamp(o.priorRealization / 100),
    clamp(o.priorGhostRate / 100),
    Math.log1p(Math.max(0, o.priorContractCount)),
    Math.log1p(Math.max(0, o.priorShipmentCount)),
    Math.sin((month / 12) * Math.PI * 2),
    Math.cos((month / 12) * Math.PI * 2),
    o.modeRoad ? 1 : 0,
  ]
}

export function ghostLabel(contracted: number, materialized: number) {
  if (contracted <= 0) return null
  return materialized / contracted < 0.7 ? 1 : 0
}

export function historicalFeatures(input: { contractedVolume: number; contractDate: string; mode: string; priorContracts: number; priorShipments: number; priorRealization: number; priorGhostRate: number }): GhostObservation {
  return {
    contractedVolume: input.contractedVolume,
    priorRealization: input.priorRealization,
    priorGhostRate: input.priorGhostRate,
    priorContractCount: input.priorContracts,
    priorShipmentCount: input.priorShipments,
    contractMonth: new Date(input.contractDate).getUTCMonth() + 1,
    modeRoad: input.mode.toLowerCase() === 'road' ? 1 : 0,
  }
}
