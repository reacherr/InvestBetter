import "server-only";

export interface MarketSnapshot {
  niftyPE: number;
  pe5yrAvg: number;
  niftyClose: number;
  ma200: number;
  vix: number;
  monthsBelow200DMA: number;
  drawdownFrom52wHigh: number;
}

export interface SignalResult {
  multiplier: number;
  peSignal: number;
  trendSignal: number;
  vixSignal: number;
  geoOverride: boolean;
  breakdown: SignalBreakdownItem[];
}

export interface SignalBreakdownItem {
  signal: string;
  condition: string;
  contribution: number;
  status: "active" | "inactive" | "warning";
}

export function calculateMultiplier(market: MarketSnapshot): SignalResult {
  const FLOOR = 0.5;
  const CAP = 4.0;

  let peSignal = 0;
  let trendSignal = 0;
  let vixSignal = 0;
  let geoOverride = false;
  const breakdown: SignalBreakdownItem[] = [];

  const pe5yrAvgSafe =
    Number.isFinite(market.pe5yrAvg) && market.pe5yrAvg > 0
      ? market.pe5yrAvg
      : Number.isFinite(market.niftyPE) && market.niftyPE > 0
        ? market.niftyPE
        : 1;

  const peRatio = market.niftyPE / pe5yrAvgSafe;

  // --- PE Signal ---
  if (market.niftyPE > 30) {
    peSignal = -0.5;
    breakdown.push({
      signal: "Valuation",
      condition: "Valuation is expensive",
      contribution: -0.5,
      status: "warning",
    });
  } else if (peRatio < 0.8 || market.niftyPE < 18) {
    peSignal = 1.0;
    breakdown.push({
      signal: "Valuation",
      condition: "Valuation is very attractive",
      contribution: 1.0,
      status: "active",
    });
  } else if (peRatio < 0.9 || market.niftyPE < 22) {
    peSignal = 0.5;
    breakdown.push({
      signal: "Valuation",
      condition: "Valuation is attractive",
      contribution: 0.5,
      status: "active",
    });
  } else {
    breakdown.push({
      signal: "Valuation",
      condition: "Valuation looks neutral",
      contribution: 0,
      status: "inactive",
    });
  }

  // --- Trend Signal (200DMA) ---
  if (market.niftyClose < market.ma200) {
    trendSignal = 1.0;
    breakdown.push({
      signal: "Trend",
      condition: "Trend is weak versus the long-term average",
      contribution: 1.0,
      status: "active",
    });
  } else {
    breakdown.push({
      signal: "Trend",
      condition: "Trend is stable versus the long-term average",
      contribution: 0,
      status: "inactive",
    });
  }

  // --- VIX Signal ---
  if (market.vix > 35) {
    vixSignal = 1.0;
    breakdown.push({
      signal: "Volatility",
      condition: "Volatility is extremely elevated",
      contribution: 1.0,
      status: "active",
    });
  } else if (market.vix > 25) {
    vixSignal = 0.5;
    breakdown.push({
      signal: "Volatility",
      condition: "Volatility is elevated",
      contribution: 0.5,
      status: "active",
    });
  } else {
    breakdown.push({
      signal: "Volatility",
      condition: "Volatility is calm",
      contribution: 0,
      status: "inactive",
    });
  }

  // --- Geopolitical Override (inputs not yet populated from market_data in v1) ---
  const isGeoCorrection =
    market.monthsBelow200DMA >= 3 && market.drawdownFrom52wHigh >= 15;
  if (isGeoCorrection) {
    geoOverride = true;
    breakdown.push({
      signal: "Geo Override",
      condition: "Deep and persistent correction conditions detected",
      contribution: 0,
      status: "active",
    });
  }

  let multiplier = 1.0 + peSignal + trendSignal + vixSignal;

  if (geoOverride && multiplier < 2.0) {
    multiplier = 2.0;
  }

  multiplier = Math.max(FLOOR, Math.min(CAP, multiplier));

  return { multiplier, peSignal, trendSignal, vixSignal, geoOverride, breakdown };
}

export function calculateFundDeployment(
  baseSip: number,
  multiplier: number,
  funds: {
    name: string;
    weightPercent: number;
    applyMultiplier: boolean;
  }[],
): { name: string; amount: number; weight: number }[] {
  const totalDeployment = Math.round(baseSip * multiplier);

  return funds.map((fund) => {
    const baseAmount = Math.round(baseSip * (fund.weightPercent / 100));
    if (!fund.applyMultiplier) {
      return { name: fund.name, amount: baseAmount, weight: fund.weightPercent };
    }
    const amount = Math.round(totalDeployment * (fund.weightPercent / 100));
    return { name: fund.name, amount, weight: fund.weightPercent };
  });
}
