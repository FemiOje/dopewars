use dojo::event::EventStorage;
use dojo::world::WorldStorageTrait;
use rollyourown::config::ryo::RyoConfigTrait;
use rollyourown::config::settings::{SeasonSettingsImpl, SeasonSettingsTrait};
use rollyourown::events::NewHighScore;
use rollyourown::models::season::{SeasonImpl, SeasonTrait};
use rollyourown::packing::game_store::GameStore;
use rollyourown::store::{Store, StoreImpl, StoreTrait};
use rollyourown::utils::random::Random;

#[derive(Drop, Copy)]
pub struct SeasonManager {
    store: Store,
}


#[generate_trait]
pub impl SeasonManagerImpl of SeasonManagerTrait {
    fn new(store: Store) -> SeasonManager {
        SeasonManager { store }
    }

    fn get_current_version(ref self: SeasonManager) -> u16 {
        let ryo_config = self.store.ryo_config();
        ryo_config.season_version
    }

    fn get_next_version_timestamp(ref self: SeasonManager) -> u64 {
        let current_timestamp = starknet::get_block_timestamp();
        let ryo_config = self.store.ryo_config();

        current_timestamp + ryo_config.season_duration.into()
    }

    fn new_season(ref self: SeasonManager, ref randomizer: Random, version: u16) {
        let mut store = self.store;
        let ryo_config = store.ryo_config();

        let season = ryo_config.build_season(version);
        let season_settings = SeasonSettingsImpl::random(ref randomizer, version);
        let game_config = season_settings.build_game_config();

        store.save_season(@season);
        store.save_season_settings(@season_settings);
        store.save_game_config(@game_config);
    }

    fn on_register_score(ref self: SeasonManager, ref game_store: GameStore) -> bool {
        let mut store = self.store;
        // check if new high_score & update high_score & next_version_timestamp if necessary
        let current_version = self.get_current_version();
        let mut season = store.season(current_version);

        // new high score
        if game_store.player.cash > season.high_score {
            //set highscore
            season.high_score = game_store.player.cash;

            // reset current version timer
            season.next_version_timestamp = self.get_next_version_timestamp();

            // save season
            store.save_season(@season);

            // // emit NewHighScore
            store
                .world
                .emit_event(
                    @NewHighScore {
                        game_id: game_store.game.game_id,
                        player_id: game_store.game.player_id,
                        season_version: game_store.game.season_version,
                        player_name: game_store.game.player_name.into(),
                        // token_id removed - Dope collection integration stripped
                        cash: game_store.player.cash,
                        health: game_store.player.health,
                        reputation: game_store.player.reputation,
                    },
                );

            true
        } else {
            false
        }
    }
}
