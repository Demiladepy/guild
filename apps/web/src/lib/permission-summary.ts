import type { GetGrantedExecutionPermissionsResult } from "@metamask/smart-accounts-kit/actions";
import { formatUnits } from "viem";

type GrantedPermission = GetGrantedExecutionPermissionsResult[number];

function formatDuration(seconds: number): string {
  if (seconds % 604800 === 0) {
    const weeks = seconds / 604800;
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  if (seconds % 86400 === 0) {
    const days = seconds / 86400;
    return days === 1 ? "1 day" : `${days} days`;
  }
  return `${seconds} seconds`;
}

export function formatPermissionSummary(
  permission: GrantedPermission,
): string[] {
  const lines: string[] = [];
  const { permission: spec, to, from, delegationManager } = permission;
  const expiry =
    "expiry" in permission
      ? (permission as GrantedPermission & { expiry?: number }).expiry
      : undefined;

  lines.push("Granted: ERC-7715 execution permission");
  lines.push(`Type: ${spec.type}`);
  lines.push(`Justification: ${spec.data.justification ?? "(none)"}`);

  if (spec.type === "erc20-token-periodic") {
    const amount = formatUnits(spec.data.periodAmount, 6);
    const period = formatDuration(spec.data.periodDuration);
    lines.push(`Budget: ${amount} USDC every ${period}`);
    lines.push(`Token: ${spec.data.tokenAddress}`);
  }

  if (from) {
    lines.push(`Delegator (user smart account): ${from}`);
  }
  lines.push(`Contractor session account: ${to}`);
  if (expiry) {
    lines.push(`Expires: ${new Date(expiry * 1000).toLocaleString()}`);
  }
  lines.push(`Adjustment allowed: ${spec.isAdjustmentAllowed ? "yes" : "no"}`);
  lines.push(`Delegation manager: ${delegationManager}`);

  return lines;
}
