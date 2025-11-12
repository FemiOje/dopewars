use rollyourown::models::settings::GameSettings;
use game_components_minigame::extensions::settings::structs::GameSetting;

pub fn generate_settings_array(game_settings: GameSettings) -> Span<GameSetting> {
    array![
        GameSetting { name: "Initial Cash", value: format!("{}", game_settings.initial_cash) },
        GameSetting { name: "Initial Health", value: format!("{}", game_settings.initial_health) },
        GameSetting { name: "Max Turns", value: format!("{}", game_settings.max_turns) },
        GameSetting { name: "Season Version", value: format!("{}", game_settings.season_version) },
    ]
        .span()
}

