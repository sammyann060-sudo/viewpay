export type AdminFinanceInputs = {
  completedViews: number;
  pointsAwarded: number;
  pointsOutstanding: number;
};

export function summarizeAdminFinances({
  completedViews,
  pointsAwarded,
  pointsOutstanding,
}: AdminFinanceInputs) {
  const advertiserRevenueEstimateKes = completedViews * 2;
  const rewardsEstimateKes = pointsAwarded * 0.2;

  return {
    walletLiabilityEstimateKes: pointsOutstanding * 0.2,
    advertiserRevenueEstimateKes,
    rewardsEstimateKes,
    grossSpreadEstimateKes: advertiserRevenueEstimateKes - rewardsEstimateKes,
  };
}
