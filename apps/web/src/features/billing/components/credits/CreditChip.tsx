"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/shared/i18n";
import { Coin } from "@/shared/icons";
import { CountUp } from "@/shared/ui";
import { useCredits } from "../../hooks/useCredits";

/** Credit balance with a coin; counts up/down and flashes when the balance changes. */
export function CreditChip({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { balance } = useCredits();
  const last = useRef(balance);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    const before = last.current;
    last.current = balance;
    if (before === null || balance === null || before === balance) return;
    setFlash(balance > before ? "up" : "down");
    const id = setTimeout(() => setFlash(null), 1200);
    return () => clearTimeout(id);
  }, [balance]);
  if (balance === null) return null;
  return (
    <span
      className={`credit-chip ${flash ? `flash-${flash}` : ""} ${className}`}
      title={t("{n} credits", { n: balance })}
      data-testid="credit-balance"
    >
      <Coin size={14} />
      <b className="tabular">
        <CountUp value={balance} duration={700} />
      </b>
      <span className="visually-hidden">{t("credits")}</span>
    </span>
  );
}
