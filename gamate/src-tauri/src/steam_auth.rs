/// Steam 登录和用户数据获取
/// 
/// 功能：
/// 1. Steam OpenID 登录
/// 2. 获取用户 Steam 库中的游戏列表
/// 3. 获取用户基本信息

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Steam 用户信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamUser {
    pub steamid: String,
    pub personaname: String,
    pub profileurl: String,
    pub avatar: String,
    pub avatarmedium: String,
    pub avatarfull: String,
    pub personastate: u32, // 在线状态
    pub communityvisibilitystate: u32,
    pub profilestate: Option<u32>,
    pub lastlogoff: Option<u64>,
    pub timecreated: Option<u64>,
}

/// Steam 用户摘要响应
#[derive(Debug, Deserialize)]
struct GetPlayerSummariesResponse {
    response: PlayerSummariesData,
}

#[derive(Debug, Deserialize)]
struct PlayerSummariesData {
    players: Vec<SteamUser>,
}

/// 用户拥有的游戏
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnedGame {
    pub appid: u32,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub playtime_forever: u32,      // 总游戏时长（分钟）
    #[serde(default)]
    pub playtime_2weeks: Option<u32>, // 最近两周游戏时长（分钟）
    #[serde(default)]
    pub img_icon_url: String,
    #[serde(default)]
    pub img_logo_url: String,
    #[serde(default)]
    pub has_community_visible_stats: Option<bool>,
}

/// 获取拥有的游戏响应
#[derive(Debug, Deserialize)]
struct GetOwnedGamesResponse {
    response: OwnedGamesData,
}

#[derive(Debug, Deserialize)]
struct OwnedGamesData {
    game_count: u32,
    games: Option<Vec<OwnedGame>>,
}

/// Steam Web API 客户端
pub struct SteamAuthClient {
    api_key: String,
    client: reqwest::Client,
}

impl SteamAuthClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap(),
        }
    }

    /// 获取用户基本信息
    pub async fn get_player_summaries(&self, steamid: &str) -> Result<Option<SteamUser>, String> {
        let url = format!(
            "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key={}&steamids={}",
            self.api_key, steamid
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        let data: GetPlayerSummariesResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        Ok(data.response.players.into_iter().next())
    }

    /// 获取用户拥有的游戏列表
    pub async fn get_owned_games(
        &self,
        steamid: &str,
        include_appinfo: bool,
        include_played_free_games: bool,
    ) -> Result<Vec<OwnedGame>, String> {
        let url = format!(
            "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key={}&steamid={}&include_appinfo={}&include_played_free_games={}",
            self.api_key,
            steamid,
            if include_appinfo { 1 } else { 0 },
            if include_played_free_games { 1 } else { 0 }
        );

        log::info!("🎮 正在获取 Steam 游戏库...");

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        // 检查状态码
        let status = response.status();
        if !status.is_success() {
            return Err(format!("Steam API 返回错误状态码: {}", status));
        }

        // 先获取文本响应用于调试
        let text = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        println!("Steam API 响应: {}", &text[..text.len().min(500)]); // 只打印前500字符

        // 解析 JSON
        let data: GetOwnedGamesResponse = serde_json::from_str(&text)
            .map_err(|e| format!("解析响应失败: {}。响应内容: {}", e, &text[..text.len().min(200)]))?;

        let games = data.response.games.unwrap_or_default();
        log::info!("✅ 成功获取 {} 个游戏", games.len());

        Ok(games)
    }

    /// 获取最近玩过的游戏
    pub async fn get_recently_played_games(
        &self,
        steamid: &str,
        count: Option<u32>,
    ) -> Result<Vec<OwnedGame>, String> {
        let count = count.unwrap_or(10);
        let url = format!(
            "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key={}&steamid={}&count={}",
            self.api_key, steamid, count
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        let data: GetOwnedGamesResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        Ok(data.response.games.unwrap_or_default())
    }
}

/// Steam OpenID 认证帮助函数
pub mod openid {
    use super::*;
    use url::Url;

    /// 生成 Steam OpenID 登录 URL
    pub fn generate_login_url(return_url: &str) -> Result<String, String> {
        let mut url = Url::parse("https://steamcommunity.com/openid/login")
            .map_err(|e| format!("URL 解析失败: {}", e))?;

        url.query_pairs_mut()
            .append_pair("openid.ns", "http://specs.openid.net/auth/2.0")
            .append_pair("openid.mode", "checkid_setup")
            .append_pair("openid.return_to", return_url)
            .append_pair("openid.realm", return_url)
            .append_pair("openid.identity", "http://specs.openid.net/auth/2.0/identifier_select")
            .append_pair("openid.claimed_id", "http://specs.openid.net/auth/2.0/identifier_select");

        Ok(url.to_string())
    }

    /// 从回调 URL 中提取 Steam ID
    pub fn extract_steamid_from_callback(callback_url: &str) -> Result<String, String> {
        let url = Url::parse(callback_url)
            .map_err(|e| format!("URL 解析失败: {}", e))?;

        let params: HashMap<String, String> = url
            .query_pairs()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();

        // 验证 OpenID 响应
        if params.get("openid.mode") != Some(&"id_res".to_string()) {
            return Err("无效的 OpenID 响应".to_string());
        }

        // 从 claimed_id 中提取 Steam ID
        // 格式: https://steamcommunity.com/openid/id/76561198XXXXXXXXX
        if let Some(claimed_id) = params.get("openid.claimed_id") {
            if let Some(steamid) = claimed_id.split('/').last() {
                return Ok(steamid.to_string());
            }
        }

        Err("无法从回调中提取 Steam ID".to_string())
    }

    /// 验证 OpenID 响应
    pub async fn verify_openid_response(params: HashMap<String, String>) -> Result<bool, String> {
        let client = reqwest::Client::new();
        
        // 构建验证参数
        let mut verify_params = params.clone();
        verify_params.insert("openid.mode".to_string(), "check_authentication".to_string());

        let response = client
            .post("https://steamcommunity.com/openid/login")
            .form(&verify_params)
            .send()
            .await
            .map_err(|e| format!("验证请求失败: {}", e))?;

        let body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

        Ok(body.contains("is_valid:true"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_login_url() {
        let return_url = "http://localhost:3000/auth/steam/callback";
        let login_url = openid::generate_login_url(return_url).unwrap();
        
        println!("Steam 登录 URL:\n{}", login_url);
        
        assert!(login_url.contains("steamcommunity.com/openid/login"));
        assert!(login_url.contains("openid.mode=checkid_setup"));
    }

    #[test]
    fn test_extract_steamid() {
        let callback_url = "http://localhost:3000/auth/steam/callback?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=id_res&openid.claimed_id=https://steamcommunity.com/openid/id/76561198123456789";
        
        let steamid = openid::extract_steamid_from_callback(callback_url).unwrap();
        assert_eq!(steamid, "76561198123456789");
    }

    #[tokio::test]
    #[ignore] // 需要真实的 API Key
    async fn test_get_player_summaries() {
        let api_key = std::env::var("STEAM_API_KEY").expect("需要设置 STEAM_API_KEY 环境变量");
        let client = SteamAuthClient::new(api_key);
        
        // 测试 Steam ID (Gabe Newell 的公开 Steam ID)
        let steamid = "76561197960287930";
        
        let user = client.get_player_summaries(steamid).await.unwrap();
        
        if let Some(user) = user {
            println!("✅ 用户名: {}", user.personaname);
            println!("   Steam ID: {}", user.steamid);
            println!("   个人资料: {}", user.profileurl);
        }
    }

    #[tokio::test]
    #[ignore] // 需要真实的 API Key
    async fn test_get_owned_games() {
        let api_key = std::env::var("STEAM_API_KEY").expect("需要设置 STEAM_API_KEY 环境变量");
        let client = SteamAuthClient::new(api_key);
        
        let steamid = "76561197960287930";
        
        let games = client.get_owned_games(steamid, true, true).await.unwrap();
        
        println!("✅ 拥有 {} 个游戏", games.len());
        
        // 打印前 10 个游戏
        for game in games.iter().take(10) {
            println!("  - {} (AppID: {}, 游戏时长: {} 小时)", 
                game.name, 
                game.appid, 
                game.playtime_forever / 60
            );
        }
    }
}
