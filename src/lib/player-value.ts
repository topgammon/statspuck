import { prospectTier, type TierResult } from "./archetypes";
import { playerContract } from "./cap";
import { toRating } from "./rating";
import type { PickRow } from "./types";
import { assetFor, prospectUsd, scale, type PlayerAsset } from "./valuation";

// One Asset Value for every player profile, on the same 0-100 scale as the Trade Machine.
//   contract  - under an NHL contract: the full Asset Value (recent Impact, age curve, contract surplus)
//   prospect  - drafted, still developing, not on an NHL contract: priced from draft slot and projection tier
//   inactive  - retired or no longer active: 0
//   unsigned  - active but with no NHL contract and not a prospect: 0, there is nothing to trade

export type PlayerValue =
  | { kind: "contract"; rating: number; asset: PlayerAsset }
  | { kind: "prospect"; rating: number; usd: number; tier: TierResult; draftPlus: number; overall: number }
  | { kind: "inactive"; rating: 0 }
  | { kind: "unsigned"; rating: 0 };

export function playerValue({ playerId, pick, retired }: { playerId: number | null; pick?: PickRow | null; retired: boolean }): PlayerValue {
  if (retired) return { kind: "inactive", rating: 0 };
  const asset = playerContract(playerId) ? assetFor(playerId) : null;
  if (asset) return { kind: "contract", rating: asset.rating, asset };
  if (pick) {
    const tier = prospectTier(pick);
    if (tier) {
      const usd = prospectUsd(pick.overall, tier.level, pick.draftPlus);
      return { kind: "prospect", rating: Math.max(0, toRating(usd, scale.uref)), usd, tier, draftPlus: pick.draftPlus, overall: pick.overall };
    }
  }
  return { kind: "unsigned", rating: 0 };
}
