"use client";

import { ActionBar } from "@/components/guild/ActionBar";
import { AuthorityLadder } from "@/components/guild/AuthorityLadder";
import { Footer } from "@/components/guild/Footer";
import { JobLog } from "@/components/guild/JobLog";
import { Standings } from "@/components/guild/Standings";
import { TopBar } from "@/components/guild/TopBar";
import { VeniceCard } from "@/components/guild/VeniceCard";
import { useGuildSim } from "@/hooks/useGuildSim";

export function GuildDashboard() {
  const sim = useGuildSim();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <TopBar />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Standings
          agents={sim.agents}
          hiredId={sim.hiredId}
          eligibleCount={sim.eligibleCount}
          scoreDeltaFlash={sim.scoreDeltaFlash}
          displayScore={sim.displayScore}
        />

        <div className="flex flex-col gap-5">
          <AuthorityLadder
            hiredName={sim.hiredAgent?.name ?? null}
            shake={sim.overspendShake}
          />
          <VeniceCard output={sim.veniceOutput} active={sim.veniceActive} />
          <JobLog lines={sim.logLines} />
          <ActionBar
            primaryLabel={sim.primaryLabel}
            onPrimary={sim.postJobAndHire}
            onOverspend={sim.attemptOverspend}
            isRunning={sim.isRunning}
            canOverspend={sim.canOverspend}
          />
        </div>
      </div>

      <Footer />
    </div>
  );
}
