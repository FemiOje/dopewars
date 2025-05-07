use dojo::meta::introspect::Introspect;

use rollyourown::{
    config::{locations::{Locations}, hustlers::{ItemSlot}}, packing::game_store::{GameMode},
    systems::helpers::{trading, shopping}, packing::game_store::{GameStore, GameStoreImpl}
};
use starknet::ContractAddress;


#[derive(Copy, Drop, Serde)]
pub enum Actions {
    Trade: trading::Trade,
    Shop: shopping::Action,
}

#[derive(Copy, Drop, Serde, PartialEq, Introspect)]
pub enum EncounterActions {
    Run,
    Pay,
    Fight,
}

#[starknet::interface]
trait IGameActions<T> {
    fn create_game(self: @T, game_mode: GameMode, hustler_id: u16, player_name: felt252);
    fn end_game(self: @T, game_id: u32, actions: Span<Actions>);
    fn travel(self: @T, game_id: u32, next_location: Locations, actions: Span<Actions>);
    fn decide(self: @T, game_id: u32, action: EncounterActions);
}

#[dojo::contract]
mod game {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use cartridge_vrf::{IVrfProviderDispatcher, IVrfProviderDispatcherTrait, Source};
    
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_token::erc721::interface::{IERC721Dispatcher, IERC721DispatcherTrait, IERC721Metadata};
    use openzeppelin_token::erc721::{ERC721Component, ERC721HooksEmptyImpl};

    use tournaments::components::game::game_component;
    use tournaments::components::interfaces::{IGameDetails, IGameToken, ISettings};
    use tournaments::components::libs::lifecycle::{LifecycleAssertionsImpl, LifecycleAssertionsTrait};
    use tournaments::components::models::game::TokenMetadata;
    use tournaments::components::models::lifecycle::Lifecycle;
    
    use rollyourown::{
        config::{
            drugs::{Drugs}, locations::{Locations}, game::{GameConfig, GameSettingsImpl}, ryo::{RyoConfig},
            ryo_address::{RyoAddress}, encounters::{Encounters}
        },
        models::{game_store_packed::GameStorePacked, game::{Game, GameImpl}, season::{Season}},
        packing::{game_store::{GameStore, GameStoreImpl, GameMode}, player::{Player, PlayerImpl},},
        systems::{
            helpers::{trading, shopping, traveling, traveling::EncounterOutcomes, game_loop},
            game::EncounterActions
        },
        helpers::season_manager::{SeasonManagerTrait},
        utils::{random::{Random, RandomImpl}, bytes16::{Bytes16, Bytes16Impl, Bytes16Trait},},
        interfaces::paper::{IPaperDispatcher, IPaperDispatcherTrait}, constants::{ETHER},
        store::{Store, StoreImpl, StoreTrait}, events::{GameCreated},
        constants::{DEFAULT_NS, SCORE_MODEL, SCORE_ATTRIBUTE, SETTINGS_MODEL}
    };

    component!(path: game_component, storage: game, event: GameEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: ERC721Component, storage: erc721, event: ERC721Event);

    #[abi(embed_v0)]
    impl GameComponentImpl = game_component::GameImpl<ContractState>;
    impl GameComponentInternalImpl = game_component::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl ERC721Impl = ERC721Component::ERC721Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC721CamelOnlyImpl = ERC721Component::ERC721CamelOnlyImpl<ContractState>;
    impl ERC721InternalImpl = ERC721Component::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        game: game_component::Storage,
        #[substorage(v0)]
        erc721: ERC721Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        GameEvent: game_component::Event,
        #[flat]
        ERC721Event: ERC721Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    // constructor
    fn dojo_init(ref self: ContractState, creator_address: ContractAddress) {
        self.erc721.initializer("Dope Wars", "DOPE", "dopewars.game");
        self
            .game
            .initializer(
                creator_address,
                'Dope Wars',
                "Dope Wars is an onchain adaptation of the classic Drug Wars game, built on Starknet using the Dojo Engine",
                'Cartridge',
                'Cartridge',
                'Simulation / Strategy',
                "https://github.com/cartridge-gg/dopewars/blob/main/assets/icon.png",
                DEFAULT_NS(),
                SCORE_MODEL(),
                SCORE_ATTRIBUTE(),
                SETTINGS_MODEL(),
            );
    }

    #[abi(embed_v0)]
    impl GameDetailsImpl of IGameDetails<ContractState> {
        fn score(self: @ContractState, game_id: u64) -> u32 {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let game: Game = world.read_model(game_id);
            game.final_score.into()
        }
    }

    #[abi(embed_v0)]
    impl SettingsImpl of ISettings<ContractState> {
        fn setting_exists(self: @ContractState, settings_id: u32) -> bool {
            let world: WorldStorage = self.world(@DEFAULT_NS());
            let settings: GameConfig = world.read_model(settings_id);
            settings.exists()
        }
    }

    #[abi(embed_v0)]
    impl GameActionsImpl of super::IGameActions<ContractState> {
        fn create_game(
            self: @ContractState, game_mode: GameMode, hustler_id: u16, player_name: felt252
        ) {
            self.assert_not_paused();
            // assert(game_mode == GameMode::Noob || game_mode == GameMode::Ranked, 'invalid game
            // mode!');

            let mut world = self.world(@"dopewars");
            let mut store = StoreImpl::new(world);

            let ryo_addresses = store.ryo_addresses();
            let player_id = get_caller_address();
            let random = IVrfProviderDispatcher { contract_address: ryo_addresses.vrf }
                .consume_random(Source::Nonce(player_id));
            let mut randomizer = RandomImpl::new(random);

            let game_id = world.dispatcher.uuid();

            // get season version
            let mut season_manager = SeasonManagerTrait::new(store);
            let season_version = season_manager.get_current_version();

            // if RANKED
            if game_mode == GameMode::Ranked {
                // pay paper_fee
                season_manager.on_game_start();
            }

            // create game
            let mut game_config = store.game_config(season_version);
            let mut game = GameImpl::new(
                game_id, player_id, season_version, game_mode, player_name, hustler_id
            );

            // save Game
            store.set_game(@game);

            // create & save GameStorePacked
            let game_store = GameStoreImpl::new(store, ref game, ref game_config, ref randomizer);
            game_store.save();

            // emit GameCreated
            world
                .emit_event(
                    @GameCreated { game_id, player_id, game_mode, player_name, hustler_id }
                );
        }

        fn end_game(self: @ContractState, game_id: u32, actions: Span<super::Actions>) {
            let player_id = get_caller_address();

            let mut store = StoreImpl::new(self.world(@"dopewars"));
            let mut game_store = GameStoreImpl::load(ref store, game_id, player_id);

            // execute actions (trades & shop)
            let mut actions = actions;
            self.execute_actions(ref game_store, ref actions);

            //save & on_game_over
            game_loop::on_game_over(ref game_store, ref store);
        }


        fn travel(
            self: @ContractState,
            game_id: u32,
            next_location: Locations,
            actions: Span<super::Actions>,
        ) {
            let mut store = StoreImpl::new(self.world(@"dopewars"));

            let ryo_addresses = store.ryo_addresses();
            let player_id = get_caller_address();
            let random = IVrfProviderDispatcher { contract_address: ryo_addresses.vrf }
                .consume_random(Source::Nonce(player_id));

            //
            let mut game_store = GameStoreImpl::load(ref store, game_id, player_id);

            // check if can travel
            assert(game_store.can_continue(), 'player cannot travel');
            assert(next_location != Locations::Home, 'cannot travel to Home');
            assert(game_store.player.location != next_location, 'already at location');

            // execute actions (trades & shop)
            let mut actions = actions;
            self.execute_actions(ref game_store, ref actions);

            let mut randomizer = RandomImpl::new(random);
            let mut season_settings = store.season_settings(game_store.game.season_version);
            // save next_location
            game_store.player.next_location = next_location;

            // traveling
            let (is_dead, has_encounter) = game_loop::on_travel(
                ref game_store, ref season_settings, ref randomizer
            );

            // check if dead
            if is_dead {
                // save & gameover RIP
                game_loop::on_game_over(ref game_store, ref store);
            } else {
                if has_encounter {
                    // save & no end turn
                    game_store.save();
                } else {
                    // save & on_turn_end
                    game_loop::on_turn_end(ref game_store, ref randomizer, ref store);
                }
            }
        }

        fn decide(self: @ContractState, game_id: u32, action: super::EncounterActions,) {
            let mut store = StoreImpl::new(self.world(@"dopewars"));

            let ryo_addresses = store.ryo_addresses();
            let player_id = get_caller_address();
            let random = IVrfProviderDispatcher { contract_address: ryo_addresses.vrf }
                .consume_random(Source::Nonce(player_id));

            //
            let mut game_store = GameStoreImpl::load(ref store, game_id, player_id);

            // check player status
            assert(game_store.player.can_decide(), 'player cannot decide');

            let mut randomizer = RandomImpl::new(random);
            let mut season_settings = store.season_settings(game_store.game.season_version);

            // // resolve decision
            let is_dead = traveling::decide(
                ref game_store, ref season_settings, ref randomizer, action
            );

            // check if dead
            if is_dead {
                // save & gameover RIP
                game_loop::on_game_over(ref game_store, ref store);
            } else {
                // on_turn_end & save
                game_loop::on_turn_end(ref game_store, ref randomizer, ref store);
            };
        }
    }


    #[generate_trait]
    impl InternalImpl of InternalTrait {
        // #[inline(always)]
        fn assert_not_paused(self: @ContractState) {
            let mut store = StoreImpl::new(self.world(@"dopewars"));
            let ryo_config = store.ryo_config();
            assert(!ryo_config.paused, 'game is paused');
        }

        fn execute_actions(
            self: @ContractState, ref game_store: GameStore, ref actions: Span<super::Actions>
        ) {
            let mut has_shopped = false;

            while let Option::Some(action) = actions.pop_front() {
                match action {
                    super::Actions::Trade(trade_action) => {
                        trading::execute_trade(ref game_store, *trade_action);
                    },
                    super::Actions::Shop(shop_action) => {
                        assert(has_shopped == false, 'one upgrade by turn');
                        shopping::execute_action(ref game_store, *shop_action);
                        has_shopped = true;
                    },
                };
            };
        }
    }
}
