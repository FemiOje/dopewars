import { ConfigStoreClass } from "../stores/config";
import { GamePropertyClass } from "./ GameProperty";
import { DrugMarket, GameClass, MarketsByLocation } from "./Game";
import Bits from "./utils/Bits";

export class MarketsClass extends GamePropertyClass {
  drugCountByLocation = 4n;
  bitsSize = 6n;
  //
  marketsByLocation: MarketsByLocation = new Map();

  constructor(game: GameClass, packed: bigint) {
    super(game, packed);

    const drugLevel = game.player?.drugLevel || 0;

    for (let locationId of [1, 2, 3, 4, 5, 6]) {
      const location = game.configStore.getLocationById(locationId)!;

      for (let drugId of [0, 1, 2, 3 /*4, 5*/]) {
        const drugIdWithDrugLevel = drugId + drugLevel;

        try {
          const drug = game.configStore.getDrugById(game.seasonSettings.drugs_mode, drugIdWithDrugLevel);
          if (!drug) {
            console.warn(
              `[Market] Drug config not found: drugs_mode=${game.seasonSettings.drugs_mode}, drug_id=${drugIdWithDrugLevel}, drugLevel=${drugLevel}`,
            );
            continue;
          }

          const price = this.getDrugPrice(locationId, drugIdWithDrugLevel);

          const drugMarket: DrugMarket = {
            drug: drug.drug,
            drugId: drug.drug_id,
            price: price,
            weight: drug.weight,
          };

          if (this.marketsByLocation.has(location.location)) {
            this.marketsByLocation.get(location.location)?.push(drugMarket);
          } else {
            this.marketsByLocation.set(location.location, [drugMarket]);
          }
        } catch (error) {
          console.error(
            `[Market] Failed to generate market for drug_id=${drugIdWithDrugLevel} at location=${locationId}:`,
            error,
          );
          // Continue to next drug instead of failing entire market generation
        }
      }
    }
  }

  getTick(locationId: number, drugId: number) {
    const start = BigInt(
      (BigInt(locationId - 1) * this.drugCountByLocation + (BigInt(drugId) % this.drugCountByLocation)) * this.bitsSize,
    );
    return Bits.extract(this.packed, start, this.bitsSize);
  }

  getDrugPriceByTick(drugId: number, tick: bigint) {
    const drugConfig = this.game.configStore.getDrugById(this.game.seasonSettings.drugs_mode, drugId)!;
    return Number(tick) * Number(drugConfig.step) + Number(drugConfig.base);
  }

  getDrugPrice(locationId: number, drugId: number): number {
    const tick = this.getTick(locationId, drugId);
    return this.getDrugPriceByTick(drugId, tick);
  }
}
