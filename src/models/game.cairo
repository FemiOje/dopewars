// Dope collection integration removed - dope_world and dope_contracts no longer needed
use rollyourown::store::StoreImpl;
use rollyourown::utils::bytes16::{Bytes16, Bytes16Impl};
use starknet::ContractAddress;

pub type GearId = felt252;

// TokenId enum removed - Dope collection integration stripped
// All games now use default equipment


#[derive(Copy, Drop, Serde, PartialEq, IntrospectPacked, Default, DojoStore)]
pub enum GameMode {
    #[default]
    Ranked,
    Noob,
    Warrior,
}

// IntrospectPacked : doesnt supports array
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id: u32,
    #[key]
    pub player_id: ContractAddress,
    //
    pub season_version: u16,
    pub game_mode: GameMode,
    //
    pub player_name: Bytes16,
    pub multiplier: u8,
    //
    pub game_over: bool,
    pub final_score: u32,
    pub registered: bool,
    pub claimed: bool,
    pub claimable: u32,
    pub position: u16,
    //
    // token_id removed - Dope collection integration stripped
    // sorted by slot order 0,1,2,3 (always default equipment)
    pub equipment_by_slot: Span<GearId>,
    pub minigame_token_id: u64 // NFT token ID from game_components_minigame
}

#[generate_trait]
pub impl GameImpl of GameTrait {
    fn new(
        game_id: u32,
        player_id: ContractAddress,
        season_version: u16,
        game_mode: GameMode,
        player_name: felt252,
        multiplier: u8,
    ) -> Game {
        // Dope collection integration removed - always use default equipment
        let mut equipment = array![0, 256, 1280, 512];
        Game {
            game_id,
            player_id,
            //
            season_version,
            game_mode,
            //
            player_name: Bytes16Impl::from(player_name),
            multiplier,
            //
            game_over: false,
            final_score: 0,
            registered: false,
            claimed: false,
            claimable: 0,
            position: 0,
            //
            // token_id removed - Dope collection integration stripped
            minigame_token_id: 0, // Will be set after minting
            equipment_by_slot: equipment.span(),
        }
    }

    fn exists(self: Game) -> bool {
        self.season_version > 0
    }

    fn is_ranked(self: Game) -> bool {
        self.game_mode == GameMode::Ranked
    }
}


#[generate_trait]
pub impl GearIdImpl of GearIdTrait {
    fn item_id(self: @GearId) -> u8 {
        let value: u256 = (*self).into();
        (value & 0xff).try_into().unwrap()
    }
    fn slot_id(self: @GearId) -> u8 {
        let value: u256 = (*self).into();
        (value & 0xff00).try_into().unwrap()
    }
}
