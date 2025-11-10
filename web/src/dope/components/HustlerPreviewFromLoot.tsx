import { useEffect, useMemo, useState } from "react";
import { defaultHustlerMetadata, HustlerBody, HustlerEquipment, HustlerPreview } from "./HustlerPreview";
import { useDopeStore } from "../store/DopeProvider";
import { dopeRandomness } from "../helpers";

export const HustlerPreviewFromLoot = ({
  tokenId,
  renderMode = 0,
  ...props
}: {
  tokenId: number;
  renderMode?: number;
}) => {
  const [hustlerMeta, setHustlerMeta] = useState({
    ...defaultHustlerMetadata,
    name: `#${tokenId}`,
    foreground: 4,
    background: 0, // tokenId % 6,
    render_mode: renderMode,
  });
  const hustlerBody = useMemo<HustlerBody>(() => {
    return {
      Gender: tokenId % 2,
      Body: tokenId % 5,
      Hair: tokenId % 19,
      Beard: tokenId % 13,
    };
  }, [tokenId]);

  useEffect(() => {
    setHustlerMeta({
      ...hustlerMeta,
      name: `#${tokenId}`,
    });
  }, [tokenId]);

  const getComponentValuesBySlug = useDopeStore((state) => state.getComponentValuesBySlug);

  //

  const renderOptions = useMemo(() => {
    let pixelSize = 5;
    let imageWidth = 64;
    let imageHeight = 64;
    let transform = "translate(0,0)";

    if (hustlerMeta.render_mode === 1) {
      pixelSize = 2;
      imageWidth = 160;
      imageHeight = 160;
      transform = "translate(18.75%,3%)";
    }
    if (hustlerMeta.render_mode === 2) {
      transform = "scale(3) translate(-1%,23.75%)";
    }

    return {
      pixelSize,
      imageWidth,
      imageHeight,
      transform,
    };
  }, [hustlerMeta]);

  const dummyProps = {
    contract_address: "",
    name: "",
    symbol: "",
    metadata: {},
    decimals: 0,
  };

  // Helper function to safely get token_id with division by zero protection
  const getSafeTokenId = (randomnessKey: string, slotSlug: string, tokenId: number): bigint => {
    const items = getComponentValuesBySlug("DopeGear", slotSlug);
    const length = items?.length || 0;
    if (length === 0) {
      return 0n; // Return 0 if no items available
    }
    return dopeRandomness(randomnessKey, tokenId) % BigInt(length);
  };

  const hustlerEquipment: HustlerEquipment = {
    Clothe: {
      token_id: getSafeTokenId("CLOTHES", "Clothe", tokenId),
      ...dummyProps,
    },
    Vehicle: {
      token_id: getSafeTokenId("VEHICLE", "Vehicle", tokenId),
      ...dummyProps,
    },
    Drug: {
      token_id: getSafeTokenId("DRUGS", "Drug", tokenId),
      ...dummyProps,
    },
    Waist: {
      token_id: getSafeTokenId("WAIST", "Waist", tokenId),
      ...dummyProps,
    },
    Foot: {
      token_id: getSafeTokenId("FOOT", "Foot", tokenId),
      ...dummyProps,
    },
    Hand: {
      token_id: getSafeTokenId("HAND", "Hand", tokenId),
      ...dummyProps,
    },
    Neck: {
      token_id: getSafeTokenId("NECK", "Neck", tokenId),
      ...dummyProps,
    },
    Ring: {
      token_id: getSafeTokenId("RING", "Ring", tokenId),
      ...dummyProps,
    },
    Weapon: {
      token_id: getSafeTokenId("WEAPON", "Weapon", tokenId),
      ...dummyProps,
    },
  };

  return (
    <>
      <HustlerPreview
        tokenId={Number(9999)}
        hustlerMeta={hustlerMeta}
        setHustlerMeta={setHustlerMeta}
        hustlerEquipment={hustlerEquipment}
        hustlerBody={hustlerBody}
        renderOptions={renderOptions}
        noInput={true}
        {...props}
      />
    </>
  );
};
