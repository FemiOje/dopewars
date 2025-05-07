use starknet::ContractAddress;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use rollyourown::{utils::{bytes16::{Bytes16, Bytes16Impl, Bytes16Trait}}};
use rollyourown::config::game::{GameConfig};
use rollyourown::config::{
    drugs::{Drugs}, locations::{Locations},
    ryo::{RyoConfig}, ryo_address::{RyoAddress}, encounters::{Encounters}
};

// use debug::PrintTrait;
// use dojo::test_utils::{spawn_test_world};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
struct Game {
    #[key]
    game_id: u32,
    #[key]
    player_id: ContractAddress,
    //
    season_version: u16,
    game_mode: GameMode,
    //
    player_name: Bytes16,
    hustler_id: u16,
    //
    game_over: bool,
    final_score: u32,
    registered: bool,
    claimed: bool,
    claimable: u32,
    position: u16,
}

#[derive(Copy, Drop, Serde, PartialEq, IntrospectPacked)]
enum GameMode {
    Ranked,
    Noob,
    Warrior,
}

#[generate_trait]
impl GameImpl of GameTrait {
    fn new(
        game_id: u32,
        player_id: ContractAddress,
        season_version: u16,
        game_mode: GameMode,
        player_name: felt252,
        hustler_id: u16
    ) -> Game {
        Game {
            game_id,
            player_id,
            //
            season_version,
            game_mode,
            //
            player_name: Bytes16Impl::from(player_name),
            hustler_id,
            //
            game_over: false,
            final_score: 0,
            registered: false,
            claimed: false,
            claimable: 0,
            position: 0,
        }
    }

    fn exists(self: Game) -> bool {
        self.season_version > 0
    }

    fn is_ranked(self: Game) -> bool {
        self.game_mode == GameMode::Ranked
    }
}

// #[test]
// #[available_gas(100000000)]
// fn test_game_exists() {
//     let (world, contracts) = spawn_world();

//     let game = GameImpl::new(1, 1, 1, GameMode::Ranked, "test", 1);
//     game.exists().print();
// }
