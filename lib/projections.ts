export type RetirementInputs = {
  currentAge: number;
  retirementAge: number;
  monthlyExpensesUsd: number;
  inflationRate: number;
  withdrawalRate: number;
  currentPortfolioUsd: number;
  monthlyContribution: number;
  annualReturnRate: number;
};

export type RetirementGoal = {
  capitalNeeded: number;
  currentGap: number;
  yearsToGoal: number;
  yearsRemaining: number;
  isOnTrack: boolean;
  capitalAtRetirement: number;
};

export function calculateRetirementGoal(inputs: RetirementInputs): RetirementGoal {
  const {
    currentAge,
    retirementAge,
    monthlyExpensesUsd,
    inflationRate,
    withdrawalRate,
    currentPortfolioUsd,
    monthlyContribution,
    annualReturnRate,
  } = inputs;

  const yearsRemaining = retirementAge - currentAge;

  const inflationAdjustedExpenses =
    monthlyExpensesUsd * Math.pow(1 + inflationRate, yearsRemaining);
  const annualExpenses = inflationAdjustedExpenses * 12;
  const capitalNeeded = withdrawalRate > 0 ? annualExpenses / withdrawalRate : 0;

  const monthlyRate = annualReturnRate / 12;
  const months = yearsRemaining * 12;

  let capitalAtRetirement: number;
  if (monthlyRate === 0) {
    capitalAtRetirement = currentPortfolioUsd * months + monthlyContribution * months;
  } else {
    capitalAtRetirement =
      currentPortfolioUsd * Math.pow(1 + monthlyRate, months) +
      monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  }

  const currentGap = Math.max(0, capitalNeeded - currentPortfolioUsd);

  let yearsToGoal = 0;
  if (capitalAtRetirement >= capitalNeeded) {
    let balance = currentPortfolioUsd;
    let months2 = 0;
    while (balance < capitalNeeded && months2 < months * 2) {
      balance = balance * (1 + monthlyRate) + monthlyContribution;
      months2++;
    }
    yearsToGoal = months2 / 12;
  } else {
    yearsToGoal = yearsRemaining + 10;
  }

  return {
    capitalNeeded,
    currentGap,
    yearsToGoal,
    yearsRemaining,
    isOnTrack: capitalAtRetirement >= capitalNeeded,
    capitalAtRetirement,
  };
}

export type ProjectionPoint = {
  year: number;
  age: number;
  projected: number;
  goal?: number;
};

export function buildProjectionCurve(
  inputs: RetirementInputs
): ProjectionPoint[] {
  const { currentAge, retirementAge, currentPortfolioUsd, monthlyContribution, annualReturnRate, capitalNeeded } =
    inputs as RetirementInputs & { capitalNeeded?: number };

  const monthlyRate = annualReturnRate / 12;
  const points: ProjectionPoint[] = [];

  let balance = currentPortfolioUsd;
  const endAge = Math.max(retirementAge + 10, currentAge + 40);

  for (let age = currentAge; age <= endAge; age++) {
    const cn = (inputs as RetirementInputs & { capitalNeeded?: number }).capitalNeeded;
    points.push({
      year: age - currentAge,
      age,
      projected: Math.round(balance),
      goal: cn,
    });

    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + monthlyRate) + monthlyContribution;
    }
  }

  return points;
}

export type MonteCarloResult = {
  percentile10: number[];
  percentile50: number[];
  percentile90: number[];
  successProbability: number;
  years: number[];
};

export function runMonteCarlo(
  inputs: RetirementInputs,
  simulations = 1000
): MonteCarloResult {
  const {
    currentAge,
    retirementAge,
    currentPortfolioUsd,
    monthlyContribution,
    annualReturnRate,
  } = inputs;

  const years = retirementAge - currentAge;
  const months = years * 12;

  const meanMonthlyReturn = annualReturnRate / 12;
  const stdDevMonthly = 0.04;

  const finalValues: number[] = [];
  const allPaths: number[][] = [];

  for (let sim = 0; sim < simulations; sim++) {
    let balance = currentPortfolioUsd;
    const path: number[] = [balance];

    for (let m = 0; m < months; m++) {
      // Guard against u1=0 which makes log(0)=-Infinity and blows up z
      const u1 = Math.max(Math.random(), Number.EPSILON);
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      // Clamp monthly return to ±50% to prevent single-month explosions
      const monthlyReturn = Math.min(
        Math.max(meanMonthlyReturn + stdDevMonthly * z, -0.5),
        0.5
      );

      balance = balance * (1 + monthlyReturn) + monthlyContribution;
      if (balance < 0) balance = 0;

      if ((m + 1) % 12 === 0) {
        path.push(balance);
      }
    }

    finalValues.push(balance);
    allPaths.push(path);
  }

  finalValues.sort((a, b) => a - b);

  const yearsArray = Array.from({ length: years + 1 }, (_, i) => currentAge + i);

  const getPercentilePath = (pct: number): number[] => {
    return yearsArray.map((_, yearIdx) => {
      const values = allPaths.map((p) => p[yearIdx] ?? 0).sort((a, b) => a - b);
      return Math.round(values[Math.floor((pct / 100) * values.length)] ?? 0);
    });
  };

  const yearsToRetirement = inputs.retirementAge - inputs.currentAge;
  const adjExpenses =
    inputs.monthlyExpensesUsd * Math.pow(1 + inputs.inflationRate, yearsToRetirement);
  const goalAmount =
    inputs.withdrawalRate > 0
      ? (adjExpenses * 12) / inputs.withdrawalRate
      : adjExpenses * 12 * 25;
  const successes = finalValues.filter((v) => v >= goalAmount).length;

  return {
    percentile10: getPercentilePath(10),
    percentile50: getPercentilePath(50),
    percentile90: getPercentilePath(90),
    successProbability: (successes / simulations) * 100,
    years: yearsArray,
  };
}
