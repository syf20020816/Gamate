/// Tauri 命令: Steam 登录相关
use crate::settings::{AppSettings, SteamUserData};
use crate::steam_auth::{openid, OwnedGame, SteamAuthClient, SteamUser};
use crate::steam_config;
use std::collections::HashMap;
use tauri::State;
use tokio::sync::Mutex;

/// Steam 认证状态
pub struct SteamAuthState {
    pub current_user: Mutex<Option<SteamUser>>,
    pub owned_games: Mutex<Vec<OwnedGame>>,
}

impl Default for SteamAuthState {
    fn default() -> Self {
        Self {
            current_user: Mutex::new(None),
            owned_games: Mutex::new(Vec::new()),
        }
    }
}

/// 获取 Steam API Client（使用编译时的 API Key）
fn get_steam_client() -> Result<SteamAuthClient, String> {
    let api_key = steam_config::require_steam_api_key()?;
    Ok(SteamAuthClient::new(api_key.to_string()))
}

/// 检查 Steam 功能是否可用
#[tauri::command]
pub fn is_steam_available() -> Result<bool, String> {
    Ok(steam_config::is_steam_enabled())
}

/// 保存 Steam 用户到配置
async fn save_steam_user_to_config(user: &SteamUser) -> Result<(), String> {
    let mut settings = AppSettings::load().map_err(|e| format!("加载配置失败: {}", e))?;
    
    settings.user.steam = Some(SteamUserData {
        steamid: user.steamid.clone(),
        personaname: user.personaname.clone(),
        profileurl: user.profileurl.clone(),
        avatar: user.avatarfull.clone(),
        last_login: Some(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        ),
    });
    
    settings.save().map_err(|e| format!("保存配置失败: {}", e))?;
    
    log::info!("✅ Steam 用户信息已保存到配置文件");
    Ok(())
}

/// 生成 Steam 登录 URL
#[tauri::command]
pub fn generate_steam_login_url(return_url: String) -> Result<String, String> {
    openid::generate_login_url(&return_url)
}

/// 处理 Steam 登录回调
#[tauri::command]
pub async fn handle_steam_callback(
    state: State<'_, SteamAuthState>,
    callback_url: String,
) -> Result<SteamUser, String> {
    // 1. 从回调 URL 中提取 Steam ID
    let steamid = openid::extract_steamid_from_callback(&callback_url)?;

    // 2. 使用编译时的 API Key 创建客户端
    let client = get_steam_client()?;

    // 3. 获取用户信息
    let user = client
        .get_player_summaries(&steamid)
        .await?
        .ok_or_else(|| "无法获取用户信息".to_string())?;

    // 4. 保存到配置文件
    save_steam_user_to_config(&user).await?;

    // 5. 保存用户信息到状态
    let mut current_user = state.current_user.lock().await;
    *current_user = Some(user.clone());

    log::info!("✅ Steam 登录成功: {}", user.personaname);

    Ok(user)
}

/// 获取当前登录的 Steam 用户
#[tauri::command]
pub async fn get_current_steam_user(
    state: State<'_, SteamAuthState>,
) -> Result<Option<SteamUser>, String> {
    let user = state.current_user.lock().await;
    Ok(user.clone())
}

/// 获取用户的 Steam 游戏库
#[tauri::command]
pub async fn fetch_steam_library(
    state: State<'_, SteamAuthState>,
    include_free_games: bool,
) -> Result<Vec<OwnedGame>, String> {
    // 1. 获取当前用户
    let user = state
        .current_user
        .lock()
        .await
        .clone()
        .ok_or_else(|| "用户未登录".to_string())?;

    // 2. 使用编译时的 API Key 创建客户端
    let client = get_steam_client()?;

    // 3. 获取游戏列表
    let games = client
        .get_owned_games(&user.steamid, true, include_free_games)
        .await?;

    // 4. 保存游戏列表
    let mut owned_games = state.owned_games.lock().await;
    *owned_games = games.clone();

    Ok(games)
}

/// 获取最近玩过的游戏
#[tauri::command]
pub async fn fetch_recently_played_games(
    state: State<'_, SteamAuthState>,
    count: Option<u32>,
) -> Result<Vec<OwnedGame>, String> {
    // 1. 获取当前用户
    let user = state
        .current_user
        .lock()
        .await
        .clone()
        .ok_or_else(|| "用户未登录".to_string())?;

    // 2. 使用编译时的 API Key 创建客户端
    let client = get_steam_client()?;

    // 3. 获取最近游戏
    let games = client
        .get_recently_played_games(&user.steamid, count)
        .await?;

    Ok(games)
}

/// 获取已缓存的游戏库
#[tauri::command]
pub async fn get_cached_steam_library(
    state: State<'_, SteamAuthState>,
) -> Result<Vec<OwnedGame>, String> {
    let games = state.owned_games.lock().await;
    Ok(games.clone())
}

/// Steam 登出
#[tauri::command]
pub async fn steam_logout(state: State<'_, SteamAuthState>) -> Result<(), String> {
    // 1. 清除配置文件中的 Steam 用户数据
    let mut settings = AppSettings::load().map_err(|e| format!("加载配置失败: {}", e))?;
    settings.user.steam = None;
    settings.save().map_err(|e| format!("保存配置失败: {}", e))?;

    // 2. 清除内存状态
    let mut user = state.current_user.lock().await;
    *user = None;

    let mut games = state.owned_games.lock().await;
    games.clear();

    log::info!("✅ 已登出 Steam 账号并清除配置");

    Ok(())
}

/// 验证 OpenID 回调
#[tauri::command]
pub async fn verify_steam_login(callback_params: HashMap<String, String>) -> Result<bool, String> {
    openid::verify_openid_response(callback_params).await
}

/// 分页获取 Steam 游戏库
/// page: 页码（从 0 开始）
/// page_size: 每页数量
#[tauri::command]
pub async fn get_steam_library_paginated(
    state: State<'_, SteamAuthState>,
    page: usize,
    page_size: usize,
) -> Result<serde_json::Value, String> {
    let games = state.owned_games.lock().await;
    
    let total = games.len();
    let start = page * page_size;
    let end = (start + page_size).min(total);
    
    let page_games: Vec<OwnedGame> = if start < total {
        games[start..end].to_vec()
    } else {
        Vec::new()
    };
    
    Ok(serde_json::json!({
        "games": page_games,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": end < total,
    }))
}

/// 从配置文件加载 Steam 用户（应用启动时调用）
#[tauri::command]
pub async fn load_steam_user_from_config(state: State<'_, SteamAuthState>) -> Result<Option<SteamUser>, String> {
    // 1. 从配置加载
    let settings = AppSettings::load().map_err(|e| format!("加载配置失败: {}", e))?;
    
    let steam_data = match settings.user.steam {
        Some(data) => data,
        None => {
            log::info!("配置中无 Steam 用户信息");
            return Ok(None);
        }
    };

    // 2. 使用 API 获取最新用户信息（确保头像等数据是最新的）
    let client = get_steam_client()?;
    let user = client
        .get_player_summaries(&steam_data.steamid)
        .await?
        .ok_or_else(|| "无法获取 Steam 用户信息".to_string())?;

    // 3. 保存到状态
    *state.current_user.lock().await = Some(user.clone());

    log::info!("✅ 从配置加载 Steam 用户: {}", user.personaname);

    Ok(Some(user))
}
