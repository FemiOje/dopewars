use rollyourown::models::season::{Season, SeasonImpl};
use starknet::get_block_timestamp;

const TWO_MIN: u16 = 120;
// const ONE_HOUR: u16 = 3600;
// const HALF_HOUR: u16 = 1800;
//
const HALF_HOUR: u32 = 1800;
const ONE_HOUR: u32 = 3600;
const HALF_DAY: u32 = 43_200;
const ONE_DAY: u32 = 86_400;
const ONE_WEEK: u32 = 604_800;

const TEMP_VALUE: u32 = 900;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct RyoConfig {
    #[key]
    pub key: u8,
    pub initialized: bool,
    pub paused: bool,
    //
    pub season_version: u16,
    pub season_duration: u32,
    pub season_time_limit: u16,
    //
    pub treasury_balance: u32,
}


#[generate_trait]
pub impl RyoConfigImpl of RyoConfigTrait {
    fn build_initial_ryo_config() -> RyoConfig {
        RyoConfig {
            key: 0,
            initialized: true,
            paused: false,
            season_version: 1,
            season_duration: ONE_WEEK, //ONE_WEEK, 
            season_time_limit: TWO_MIN, // HALF_HOUR, 
            treasury_balance: 0,
        }
    }

    fn build_season(self: RyoConfig, season_version: u16) -> Season {
        Season {
            version: season_version,
            //
            // season config copied from RyoConfig
            season_duration: self.season_duration,
            season_time_limit: self.season_time_limit,
            // season datas
            next_version_timestamp: get_block_timestamp() + self.season_duration.into(),
            high_score: 0,
        }
    }
}
