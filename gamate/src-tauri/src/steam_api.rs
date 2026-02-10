use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Steam 游戏基本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamAppInfo {
    pub appid: u32,
    pub name: String,
}

/// Steam 应用列表响应
#[derive(Debug, Deserialize)]
pub struct SteamAppListResponse {
    pub applist: SteamAppList,
}

#[derive(Debug, Deserialize)]
pub struct SteamAppList {
    pub apps: Vec<SteamAppInfo>,
}

/// Steam 游戏详细信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGameDetails {
    pub steam_appid: u32,
    pub name: String,
    #[serde(rename = "type")]
    pub app_type: String,
    pub short_description: Option<String>,
    pub header_image: Option<String>,
    pub developers: Option<Vec<String>>,
    pub publishers: Option<Vec<String>>,
    pub categories: Option<Vec<SteamCategory>>,
    pub genres: Option<Vec<SteamGenre>>,
    pub release_date: Option<SteamReleaseDate>,
    pub metacritic: Option<SteamMetacritic>,
    pub recommendations: Option<SteamRecommendations>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamCategory {
    pub id: u32,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGenre {
    pub id: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamReleaseDate {
    pub coming_soon: bool,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamMetacritic {
    pub score: u32,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamRecommendations {
    pub total: u32,
}

/// Steam API 详情响应
#[derive(Debug, Deserialize)]
pub struct SteamAppDetailsResponse {
    pub success: bool,
    pub data: Option<SteamGameDetails>,
}

/// 过滤后的游戏数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilteredGameData {
    pub appid: u32,
    pub name: String,
    pub description: String,
    pub header_image: String,
    pub developers: Vec<String>,
    pub publishers: Vec<String>,
    pub genres: Vec<String>,
    pub release_date: String,
    pub metacritic_score: Option<u32>,
    pub recommendations: u32,
}

/// Steam API 客户端
pub struct SteamApiClient {
    client: reqwest::Client,
}

impl SteamApiClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap(),
        }
    }

    /// 获取所有 Steam 应用列表
    pub async fn get_app_list(&self) -> Result<Vec<SteamAppInfo>, String> {
        let url = "https://api.steampowered.com/ISteamApps/GetAppList/v2/";
        
        let response = self.client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        let app_list: SteamAppListResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        Ok(app_list.applist.apps)
    }

    /// 获取单个游戏的详细信息
    pub async fn get_app_details(&self, appid: u32) -> Result<Option<SteamGameDetails>, String> {
        let url = format!(
            "https://store.steampowered.com/api/appdetails?appids={}&cc=cn&l=schinese",
            appid
        );

        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        let text = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
        
        // Steam API 返回的格式是 {"appid": {"success": true, "data": {...}}}
        let mut response_map: HashMap<String, SteamAppDetailsResponse> = serde_json::from_str(&text)
            .map_err(|e| format!("解析响应失败: {} (appid: {})", e, appid))?;

        if let Some(app_response) = response_map.remove(&appid.to_string()) {
            if app_response.success {
                return Ok(app_response.data);
            }
        }

        Ok(None)
    }

    /// 批量获取游戏详情（带延迟避免被限流）
    pub async fn get_batch_details(
        &self,
        appids: &[u32],
        delay_ms: u64,
    ) -> Vec<(u32, Option<SteamGameDetails>)> {
        let mut results = Vec::new();

        for &appid in appids {
            match self.get_app_details(appid).await {
                Ok(details) => {
                    results.push((appid, details));
                }
                Err(e) => {
                    eprintln!("❌ 获取 appid {} 失败: {}", appid, e);
                    results.push((appid, None));
                }
            }

            // 延迟避免被限流
            tokio::time::sleep(tokio::time::Duration::from_millis(delay_ms)).await;
        }

        results
    }
}

/// 过滤规则
pub struct FilterRules {
    /// 最低推荐数（点赞数）
    pub min_recommendations: u32,
    /// 最低 Metacritic 分数
    pub min_metacritic_score: Option<u32>,
    /// 排除的应用类型（如 dlc, demo 等）
    pub excluded_types: Vec<String>,
}

impl Default for FilterRules {
    fn default() -> Self {
        Self {
            min_recommendations: 1000,        // 至少 1000 个推荐
            min_metacritic_score: Some(60),   // Metacritic 至少 60 分
            excluded_types: vec![
                "dlc".to_string(),
                "demo".to_string(),
                "advertising".to_string(),
                "music".to_string(),
                "video".to_string(),
            ],
        }
    }
}

/// 过滤游戏数据
pub fn filter_game(game: &SteamGameDetails, rules: &FilterRules) -> Option<FilteredGameData> {
    // 1. 检查应用类型
    if rules.excluded_types.contains(&game.app_type.to_lowercase()) {
        return None;
    }

    // 2. 检查推荐数
    let recommendations = game.recommendations.as_ref()?.total;
    if recommendations < rules.min_recommendations {
        return None;
    }

    // 3. 检查 Metacritic 分数（如果有要求）
    if let Some(min_score) = rules.min_metacritic_score {
        if let Some(metacritic) = &game.metacritic {
            if metacritic.score < min_score {
                return None;
            }
        } else {
            // 如果没有 Metacritic 分数但要求有，则跳过
            // 注意：很多好游戏也没有 Metacritic 分数，所以这里可以选择保留
            // return None;
        }
    }

    // 4. 提取数据
    Some(FilteredGameData {
        appid: game.steam_appid,
        name: game.name.clone(),
        description: game.short_description.clone().unwrap_or_default(),
        header_image: game.header_image.clone().unwrap_or_default(),
        developers: game.developers.clone().unwrap_or_default(),
        publishers: game.publishers.clone().unwrap_or_default(),
        genres: game
            .genres
            .as_ref()
            .map(|g| g.iter().map(|genre| genre.description.clone()).collect())
            .unwrap_or_default(),
        release_date: game
            .release_date
            .as_ref()
            .map(|r| r.date.clone())
            .unwrap_or_default(),
        metacritic_score: game.metacritic.as_ref().map(|m| m.score),
        recommendations,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // 标记为 ignore，避免每次测试都调用 API
    async fn test_get_app_list() {
        let client = SteamApiClient::new();
        let apps = client.get_app_list().await.unwrap();
        println!("✅ 获取到 {} 个应用", apps.len());
        
        // 打印前 10 个
        for app in apps.iter().take(10) {
            println!("  - {} ({})", app.name, app.appid);
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_app_details() {
        let client = SteamApiClient::new();
        
        // 测试恐鬼症 (Phasmophobia) - appid: 739630
        let details = client.get_app_details(739630).await.unwrap();
        
        if let Some(game) = details {
            println!("✅ 游戏名称: {}", game.name);
            println!("   类型: {}", game.app_type);
            println!("   描述: {:?}", game.short_description);
            println!("   开发商: {:?}", game.developers);
            println!("   发行商: {:?}", game.publishers);
            println!("   推荐数: {:?}", game.recommendations);
            println!("   Metacritic: {:?}", game.metacritic);
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_fetch_and_filter_games() {
        let client = SteamApiClient::new();
        let rules = FilterRules::default();

        // 测试一些热门游戏的 appid
        let test_appids = vec![
            739630,  // Phasmophobia (恐鬼症)
            1245620, // Elden Ring (艾尔登法环)
            1086940, // Baldur's Gate 3 (博德之门3)
            570,     // Dota 2
            730,     // Counter-Strike 2
        ];

        println!("🔍 开始获取游戏数据...\n");
        let results = client.get_batch_details(&test_appids, 1500).await;

        let mut filtered_games = Vec::new();

        for (appid, details) in results {
            if let Some(game) = details {
                println!("📦 {} ({})", game.name, appid);
                println!("   类型: {}", game.app_type);
                println!("   推荐数: {:?}", game.recommendations.as_ref().map(|r| r.total));
                println!("   Metacritic: {:?}", game.metacritic.as_ref().map(|m| m.score));

                if let Some(filtered) = filter_game(&game, &rules) {
                    println!("   ✅ 通过过滤");
                    filtered_games.push(filtered);
                } else {
                    println!("   ❌ 未通过过滤");
                }
                println!();
            } else {
                println!("❌ {} - 无法获取详情\n", appid);
            }
        }

        // 保存到 JSON 文件
        let output_path = "steam_games_filtered.json";
        let json = serde_json::to_string_pretty(&filtered_games).unwrap();
        std::fs::write(output_path, json).unwrap();
        println!("💾 已保存 {} 个游戏到 {}", filtered_games.len(), output_path);
    }

    /// 完整的数据采集测试（需要很长时间，谨慎运行）
    #[tokio::test]
    #[ignore]
    async fn test_full_data_collection() {
        let client = SteamApiClient::new();
        
        println!("🌐 正在获取 Steam 应用列表...");
        let apps = client.get_app_list().await.unwrap();
        println!("✅ 获取到 {} 个应用", apps.len());

        // 只取前 1000 个进行测试（完整采集需要很长时间）
        let sample_apps: Vec<u32> = apps.iter().take(1000).map(|a| a.appid).collect();

        println!("🔍 开始采集详细信息（延迟 2 秒/个）...");
        let results = client.get_batch_details(&sample_apps, 2000).await;

        let rules = FilterRules {
            min_recommendations: 500,
            min_metacritic_score: Some(50),
            excluded_types: vec![
                "dlc".to_string(),
                "demo".to_string(),
                "advertising".to_string(),
                "music".to_string(),
                "video".to_string(),
            ],
        };

        let mut filtered_games = Vec::new();
        let mut stats = Stats::default();

        for (appid, details) in results {
            stats.total += 1;

            if let Some(game) = details {
                if game.app_type == "game" {
                    stats.games += 1;

                    if let Some(filtered) = filter_game(&game, &rules) {
                        stats.passed += 1;
                        filtered_games.push(filtered);
                    } else {
                        stats.filtered += 1;
                    }
                } else {
                    stats.other_types += 1;
                }
            } else {
                stats.failed += 1;
            }
        }

        println!("\n📊 统计信息:");
        println!("   总计: {}", stats.total);
        println!("   游戏: {}", stats.games);
        println!("   通过过滤: {}", stats.passed);
        println!("   被过滤: {}", stats.filtered);
        println!("   其他类型: {}", stats.other_types);
        println!("   失败: {}", stats.failed);

        // 保存到 JSON
        let output_path = "steam_games_collection.json";
        let json = serde_json::to_string_pretty(&filtered_games).unwrap();
        std::fs::write(output_path, json).unwrap();
        println!("\n💾 已保存 {} 个游戏到 {}", filtered_games.len(), output_path);
    }

    #[derive(Default)]
    struct Stats {
        total: usize,
        games: usize,
        passed: usize,
        filtered: usize,
        other_types: usize,
        failed: usize,
    }
}
