import type { IdentityHasher } from "../../infrastructure/secrets/identity-hasher.js";
import type { Clock } from "../../shared/clock/clock.js";
import type { Logger } from "../../shared/logging/logger.js";
import type { CreditSettingsService } from "./credit-settings.service.js";
import type { WelcomeReason, WelcomeView } from "./credits.dto.js";
import type { CreditsRepository } from "./credits.repository.js";
import type { WelcomeState } from "./credits.service.js";
import type { WelcomeRepository } from "./welcome.repository.js";
import {
  RETRIABLE,
  WelcomePolicy,
  type WelcomeProfile,
} from "./welcome.policy.js";

/** Port (users): the Steam profile, refreshed now if possible. */
export interface ProfileSource {
  freshProfile(
    ownerId: string,
    steamId: string,
  ): Promise<WelcomeProfile | undefined>;
}

/**
 * Welcome credits, once per Steam account ever. Evaluated after every real Steam sign-in
 * (the auth module reports it with the sign-in IP) and re-evaluated when a retriable outcome
 * (private profile, account too new, network limit...) may have changed on a profile refresh.
 * Dev/local accounts never sign in through Steam, so they are never evaluated.
 */
export class WelcomeService implements WelcomeState {
  private readonly running = new Set<Promise<void>>();
  constructor(
    private readonly credits: CreditsRepository,
    private readonly grants: WelcomeRepository,
    private readonly settings: CreditSettingsService,
    private readonly hasher: IdentityHasher,
    private readonly profiles: ProfileSource,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  /** SignInListener: evaluate in the background after a Steam sign-in. */
  signedIn(ownerId: string, steamId: string, ip: string | undefined): void {
    const prefix = WelcomePolicy.networkPrefix(ip);
    const ipHash = prefix ? this.hasher.hash("net", prefix) : undefined;
    this.track(async () => {
      const profile = await this.profiles.freshProfile(ownerId, steamId);
      await this.evaluate(ownerId, steamId, ipHash ?? null, profile);
    });
  }

  /** ProfileListener: a refreshed profile may unlock a pending/retriable grant. */
  profileRefreshed(
    ownerId: string,
    steamId: string,
    profile: WelcomeProfile,
  ): void {
    this.track(async () => {
      const wallet = await this.credits.wallet(ownerId, this.clock.now());
      if (!wallet.welcomeStatus || wallet.welcomeStatus === "granted") return;
      if (wallet.welcomeReason && !RETRIABLE.has(wallet.welcomeReason)) return;
      await this.evaluate(ownerId, steamId, wallet.welcomeIpHash, profile);
    });
  }

  async view(ownerId: string, steamLinked: boolean): Promise<WelcomeView> {
    if (!steamLinked) return { status: "ineligible", reason: "not_steam" };
    const wallet = await this.credits.wallet(ownerId, this.clock.now());
    if (!wallet.welcomeStatus)
      return { status: "pending", reason: "not_evaluated" };
    return wallet.welcomeStatus === "granted"
      ? { status: "granted" }
      : {
          status: wallet.welcomeStatus,
          ...(wallet.welcomeReason ? { reason: wallet.welcomeReason } : {}),
        };
  }

  /** Waits for background evaluations (shutdown and tests). */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.running]);
  }

  async evaluate(
    ownerId: string,
    steamId: string,
    ipHash: string | null,
    profile: WelcomeProfile | undefined,
  ): Promise<WelcomeView> {
    const settings = await this.settings.settings();
    const steamHash = this.hasher.hash("steam", steamId);
    const save = async (
      status: "pending" | "ineligible",
      reason: WelcomeReason,
    ): Promise<WelcomeView> => {
      await this.credits.setWelcome(
        ownerId,
        status,
        reason,
        ipHash ?? undefined,
      );
      return { status, reason };
    };
    if (!steamHash) return save("pending", "not_evaluated");
    if (
      (await this.credits.wallet(ownerId, this.clock.now())).welcomeStatus ===
      "granted"
    )
      return { status: "granted" };
    if (settings.welcomeCredits <= 0) return save("ineligible", "disabled");
    if (await this.grants.claimed(steamHash))
      return save("ineligible", "already_claimed");
    const decision = WelcomePolicy.decide(profile, settings, this.clock.now());
    if (decision.status !== "eligible")
      return save(decision.status, decision.reason);
    const result = await this.grants.grant(
      {
        ownerId,
        steamIdHash: steamHash,
        ipPrefixHash: ipHash,
        credits: settings.welcomeCredits,
        maxPerNetwork: settings.maxGrantsPerNetwork,
        windowDays: settings.networkWindowDays,
      },
      this.clock.now(),
    );
    if (result !== "granted") return save("ineligible", result);
    await this.credits.setWelcome(
      ownerId,
      "granted",
      null,
      ipHash ?? undefined,
    );
    this.logger.info(
      { ownerId, credits: settings.welcomeCredits },
      "welcome credits granted",
    );
    return { status: "granted" };
  }

  private track(work: () => Promise<void>): void {
    const task = work()
      .catch((error: unknown) =>
        this.logger.info(
          { err: String(error) },
          "welcome credit evaluation failed",
        ),
      )
      .finally(() => this.running.delete(task));
    this.running.add(task);
  }
}
