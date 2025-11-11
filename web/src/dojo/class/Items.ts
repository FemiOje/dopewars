import { GearItemFull } from "@/dojo/stores/config";
import { computed, makeObservable, observable } from "mobx";
import { ItemSlot, ShopAction } from "../types";
import { GamePropertyClass } from "./ GameProperty";
import { GameClass, isShopAction } from "./Game";
import Bits from "./utils/Bits";
import { GearItem, getGearItem } from "@/dope/helpers";
import { Car } from "@/components/icons";
import { Kevlar, Knife, Shoes } from "@/components/icons/items";
import { dopeLootSlotIdToItemSlot } from "../helpers";

export interface ItemInfos {
  icon: React.FC;
  level: number;
  slot: ItemSlot;
  stat: number;
  cost: number;
  name: string;
  id?: number;
  tier?: number;
}

const gearItemFullToItemInfos = (level: number, item: GearItemFull, icon: React.FC): ItemInfos => {
  // Ensure levels array exists and level index is valid
  const levels = item.levels || [];
  const levelData = levels[level] || { stat: 0, cost: 0 };

  return {
    icon,
    level,
    slot: dopeLootSlotIdToItemSlot[item.gearItem.slot as keyof typeof dopeLootSlotIdToItemSlot],
    stat: levelData.stat,
    cost: levelData.cost,
    name: item.name,
    tier: item.tier,
    id: item.gearItem.item,
  };
};

export class ItemsClass extends GamePropertyClass {
  bitsSize = 2n;
  maxLevel = 3;
  //
  attackLevelInit: number;
  defenseLevelInit: number;
  speedLevelInit: number;
  transportLevelInit: number;
  levelByItemSlot: number[];
  //
  gearItems: GearItem[];

  constructor(game: GameClass, packed: bigint) {
    super(game, packed);

    this.attackLevelInit = Number(Bits.extract(this.packed, BigInt(ItemSlot.Weapon) * this.bitsSize, this.bitsSize));
    this.defenseLevelInit = Number(Bits.extract(this.packed, BigInt(ItemSlot.Clothes) * this.bitsSize, this.bitsSize));
    this.speedLevelInit = Number(Bits.extract(this.packed, BigInt(ItemSlot.Feet) * this.bitsSize, this.bitsSize));
    this.transportLevelInit = Number(
      Bits.extract(this.packed, BigInt(ItemSlot.Transport) * this.bitsSize, this.bitsSize),
    );

    this.levelByItemSlot = [this.attackLevelInit, this.defenseLevelInit, this.speedLevelInit, this.transportLevelInit];

    this.gearItems = [];
    if (game.gameInfos) {
      // Map equipment_by_slot array to gearItems, overriding slot to match ItemSlot enum
      // The slot in the gear item ID is from Dope collection encoding, not dopewars ItemSlot
      this.gearItems = (game.gameInfos.equipment_by_slot || []).map((gearItemId, index) => {
        const gearItem = getGearItem(BigInt(gearItemId));
        // Override slot to match ItemSlot enum: 0=Weapon, 1=Clothes, 2=Feet, 3=Transport
        return {
          ...gearItem,
          slot: index, // Use array index as the slot (matches ItemSlot enum)
        };
      });
    }

    makeObservable(this, {
      attackLevel: computed,
      defenseLevel: computed,
      speedLevel: computed,
      transportLevel: computed,
      attack: computed,
      defense: computed,
      speed: computed,
      transport: computed,
      game: observable,
    });
  }

  get attackLevel() {
    let level = this.attackLevelInit;
    if (this.game?.pending && this.game?.pending?.length > 0) {
      level += this.game.pending
        .filter(isShopAction)
        .map((i) => i as ShopAction)
        .filter((i) => i.slot === ItemSlot.Weapon).length;
    }
    return level;
  }

  get defenseLevel() {
    let level = this.defenseLevelInit;
    if (this.game?.pending && this.game?.pending?.length > 0) {
      level += this.game.pending
        .filter(isShopAction)
        .map((i) => i as ShopAction)
        .filter((i) => i.slot === ItemSlot.Clothes).length;
    }
    return level;
  }

  get speedLevel() {
    let level = this.speedLevelInit;
    if (this.game?.pending && this.game?.pending?.length > 0) {
      level += this.game.pending
        .filter(isShopAction)
        .map((i) => i as ShopAction)
        .filter((i) => i.slot === ItemSlot.Feet).length;
    }
    return level;
  }

  get transportLevel() {
    let level = this.transportLevelInit;
    if (this.game?.pending && this.game?.pending?.length > 0) {
      level += this.game.pending
        .filter(isShopAction)
        .map((i) => i as ShopAction)
        .filter((i) => i.slot === ItemSlot.Transport).length;
    }
    return level;
  }

  get attack() {
    let level = this.attackLevelInit;
    if (this.game?.pending && this.game?.pending?.length > 0) {
      level += this.game.pending
        .filter(isShopAction)
        .map((i) => i as ShopAction)
        .filter((i) => i.slot === ItemSlot.Weapon).length;
    }

    const item = this.game.configStore.getGearItemFull(this.gearItems[ItemSlot.Weapon]);
    return gearItemFullToItemInfos(level, item, Knife);
  }

  get defense() {
    let level = this.defenseLevelInit;
    if (this.game?.pending && this.game?.pending?.length > 0) {
      level += this.game.pending
        .filter(isShopAction)
        .map((i) => i as ShopAction)
        .filter((i) => i.slot === ItemSlot.Clothes).length;
    }

    const item = this.game.configStore.getGearItemFull(this.gearItems[ItemSlot.Clothes]);
    return gearItemFullToItemInfos(level, item, Kevlar);
  }

  get speed() {
    let level = this.speedLevelInit;
    if (this.game?.pending && this.game?.pending?.length > 0) {
      level += this.game.pending
        .filter(isShopAction)
        .map((i) => i as ShopAction)
        .filter((i) => i.slot === ItemSlot.Feet).length;
    }

    const item = this.game.configStore.getGearItemFull(this.gearItems[ItemSlot.Feet]);
    return gearItemFullToItemInfos(level, item, Shoes);
  }

  get transport() {
    let level = this.transportLevelInit;
    if (this.game?.pending && this.game?.pending?.length > 0) {
      level += this.game.pending
        .filter(isShopAction)
        .map((i) => i as ShopAction)
        .filter((i) => i.slot === ItemSlot.Transport).length;
    }

    const transportGearItem = this.gearItems[ItemSlot.Transport];
    if (!transportGearItem) {
      console.warn(
        `[Items] Transport gear item is missing! gearItems:`,
        this.gearItems,
        `ItemSlot.Transport:`,
        ItemSlot.Transport,
      );
    }
    const item = this.game.configStore.getGearItemFull(transportGearItem);
    return gearItemFullToItemInfos(level, item, Car);
  }
}
