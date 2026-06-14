import type { RelayerLiveEvent } from "@/lib/relayer-event-bus";
import type { SpecialistCandidate } from "@/lib/agent-hiring";

type TreeNode = {
  id: string;
  label: string;
  cap: string;
  scope: string;
  status?: "active" | "blocked" | "relaying" | "hired";
  relayerStatus?: string;
};

export type ReputationUpdate = {
  role: string;
  name: string;
  scoreBefore: number;
  scoreAfter: number;
  feedbackScore?: number;
  animate?: boolean;
};

export type MarketLearned = {
  fromRole: string;
  fromName: string;
  toRole: string;
  toName: string;
};

type DelegationTreeProps = {
  nodes: TreeNode[];
  candidates?: SpecialistCandidate[];
  hiredRole?: string | null;
  previousRankOrder?: string[];
  overspendBlocked?: boolean;
  relayerEvents?: RelayerLiveEvent[];
  relayerTaskId?: string | null;
  reputationUpdate?: ReputationUpdate | null;
  marketLearned?: MarketLearned | null;
  explorerNftUrl?: string;
};

export function DelegationTree({
  nodes,
  candidates = [],
  hiredRole,
  previousRankOrder = [],
  overspendBlocked = false,
  relayerEvents = [],
  relayerTaskId,
  reputationUpdate,
  marketLearned,
  explorerNftUrl,
}: DelegationTreeProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="mb-4 font-semibold text-slate-200">Agent economy</h2>
      <ol className="space-y-3">
        {nodes.map((node, index) => (
          <li key={node.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  node.status === "blocked"
                    ? "bg-red-900 text-red-200"
                    : node.status === "relaying"
                      ? "bg-amber-900 text-amber-200"
                      : node.status === "hired"
                        ? "bg-emerald-900 text-emerald-200"
                        : "bg-slate-800 text-slate-300"
                }`}
              >
                {index + 1}
              </span>
              {index < nodes.length - 1 && (
                <span className="mt-1 h-6 w-px bg-slate-700" />
              )}
            </div>
            <div
              className={`flex-1 rounded-md border p-3 ${
                node.status === "blocked"
                  ? "border-red-900/60 bg-red-950/30"
                  : node.status === "relaying"
                    ? "border-amber-900/60 bg-amber-950/20"
                    : node.status === "hired"
                      ? "border-emerald-900/60 bg-emerald-950/20"
                      : "border-slate-800 bg-slate-950/40"
              }`}
            >
              <p className="font-medium text-slate-100">{node.label}</p>
              <p className="text-sm text-slate-400">Cap: {node.cap}</p>
              <p className="text-xs text-slate-500">{node.scope}</p>
              {node.relayerStatus && (
                <p className="mt-1 text-xs font-medium text-amber-300">
                  1Shot: {node.relayerStatus}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      {candidates.length > 0 && (
        <div className="mt-4 rounded-md border border-slate-700 bg-slate-950/50 p-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Specialist market (reputation-ranked)
          </h3>
          {marketLearned && (
            <p className="mt-2 animate-pulse text-sm font-medium text-emerald-300">
              Market learned — re-hired {marketLearned.toName} over{" "}
              {marketLearned.fromName}
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {candidates.map((candidate, index) => {
              const isHired = hiredRole === candidate.role;
              const prevIndex = previousRankOrder.indexOf(candidate.role);
              const rankDelta =
                prevIndex >= 0 && prevIndex !== index
                  ? prevIndex - index
                  : 0;
              return (
                <li
                  key={candidate.role}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-all duration-700 ${
                    isHired
                      ? "border-emerald-700 bg-emerald-950/40 ring-1 ring-emerald-600/50"
                      : rankDelta > 0
                        ? "border-sky-800/60 bg-sky-950/30"
                        : rankDelta < 0
                          ? "border-rose-900/40 bg-rose-950/20"
                          : "border-slate-800 bg-slate-900/40"
                  }`}
                >
                  <div>
                    <p className="font-medium text-slate-100">
                      #{index + 1} {candidate.name}
                      {isHired && (
                        <span className="ml-2 text-xs text-emerald-400">
                          HIRED
                        </span>
                      )}
                      {rankDelta > 0 && (
                        <span className="ml-2 text-xs text-sky-400">
                          ↑{rankDelta}
                        </span>
                      )}
                      {rankDelta < 0 && (
                        <span className="ml-2 text-xs text-rose-400">
                          ↓{Math.abs(rankDelta)}
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      agent #{candidate.agentId} · {candidate.address.slice(0, 10)}…
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold tabular-nums transition-all duration-700 ${
                        reputationUpdate?.role === candidate.role &&
                        reputationUpdate.animate
                          ? "scale-110 text-emerald-300"
                          : "text-slate-200"
                      }`}
                    >
                      {candidate.score.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {candidate.feedbackCount.toString()} feedback
                    </p>
                    {explorerNftUrl && (
                      <a
                        href={`${explorerNftUrl}/${candidate.agentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-400 underline"
                      >
                        explorer
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {reputationUpdate && (
        <div
          className={`mt-4 rounded-md border border-emerald-800/50 bg-emerald-950/20 p-3 text-sm transition-all duration-700 ${
            reputationUpdate.animate ? "opacity-100" : "opacity-90"
          }`}
        >
          <p className="font-medium text-emerald-200">
            Reputation write-back · {reputationUpdate.name}
          </p>
          <p className="mt-1 text-emerald-100/90">
            {reputationUpdate.scoreBefore.toFixed(2)} →{" "}
            <span
              className={`font-bold ${
                reputationUpdate.scoreAfter < reputationUpdate.scoreBefore
                  ? "text-rose-300"
                  : "text-emerald-300"
              }`}
            >
              {reputationUpdate.scoreAfter.toFixed(2)}
            </span>
            {reputationUpdate.feedbackScore !== undefined && (
              <span className="ml-2 text-emerald-200/70">
                (signal {reputationUpdate.feedbackScore})
              </span>
            )}
          </p>
        </div>
      )}

      {relayerTaskId && (
        <div className="mt-4 rounded-md border border-amber-900/40 bg-amber-950/10 p-3 text-xs">
          <p className="font-mono text-amber-200">TaskId: {relayerTaskId}</p>
          {relayerEvents.length > 0 && (
            <ul className="mt-2 space-y-1 text-amber-100/90">
              {relayerEvents.map((event) => (
                <li key={`${event.taskId}-${event.receivedAt}-${event.label}`}>
                  {event.label}
                  {event.transactionHash
                    ? ` · ${event.transactionHash.slice(0, 10)}…`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {overspendBlocked && (
        <p className="mt-4 text-sm font-medium text-red-400">
          Over-cap attempt blocked at Specialist node
        </p>
      )}
    </section>
  );
}
