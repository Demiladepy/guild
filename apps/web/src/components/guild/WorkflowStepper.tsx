import type { WorkflowStep } from "@/hooks/useGuildApp";

const STEPS: { id: WorkflowStep; label: string; hint: string }[] = [
  { id: "connect", label: "Connect", hint: "MetaMask on Base Sepolia" },
  { id: "grant", label: "Grant", hint: "ERC-7715 budget to Contractor" },
  { id: "register", label: "Register", hint: "Mint ERC-8004 agent IDs" },
  { id: "operate", label: "Operate", hint: "Hire, pay, write reputation" },
];

type WorkflowStepperProps = {
  current: WorkflowStep;
  mode: "demo" | "live";
};

export function WorkflowStepper({ current, mode }: WorkflowStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Guild workflow" className="guild-card">
      <div className="guild-stepper__head">
        <p className="guild-stepper__title">Setup workflow</p>
        <span
          className={`guild-pill ${
            mode === "live" ? "guild-pill--accent" : ""
          }`}
        >
          {mode === "live" ? "live chain" : "demo preview"}
        </span>
      </div>
      <ul className="guild-stepper__grid">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = step.id === current;
          return (
            <li
              key={step.id}
              className={`guild-step ${
                active ? "guild-step--active" : done ? "guild-step--done" : ""
              }`}
            >
              <p className="guild-step__num">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="guild-step__label">{step.label}</p>
              <p className="guild-step__hint">{step.hint}</p>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
