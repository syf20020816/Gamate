/// 测试 Steam API 数据获取
/// 
/// 运行方式：
/// ```bash
/// cargo run --example test_steam_api
/// ```

use gamate_lib::steam_api::*;

#[tokio::main]
async fn main() {
    env_logger::init();
    
    println!("🎮 Steam API 数据获取测试\n");
    println!("{}", "=".repeat(60));
    
    // 测试 1: 获取热门游戏数据
    test_fetch_popular_games().await;
    
    println!("\n{}", "=".repeat(60));
    
    // 测试 2: 小规模采集（前 100 个应用）
    // test_small_collection().await;
}

/// 测试获取热门游戏数据
async fn test_fetch_popular_games() {
    println!("\n📦 测试 1: 获取热门游戏数据\n");
    
    let client = SteamApiClient::new();
    let rules = FilterRules {
        min_recommendations: 1000,      // 至少 1000 个推荐
        min_metacritic_score: Some(60), // Metacritic 至少 60 分
        excluded_types: vec![
            "dlc".to_string(),
            "demo".to_string(),
            "advertising".to_string(),
            "music".to_string(),
            "video".to_string(),
        ],
    };

    // 一些热门游戏的 Steam AppID
    let popular_game_ids = vec![
        // 恐怖游戏
        739630,  // Phasmophobia (恐鬼症)
        413150,  // Stardew Valley (星露谷物语)
        
        // RPG
        1245620, // Elden Ring (艾尔登法环)
        1086940, // Baldur's Gate 3 (博德之门3)
        292030,  // The Witcher 3 (巫师3)
        
        // 动作
        570,     // Dota 2
        730,     // Counter-Strike 2
        1091500, // Cyberpunk 2077 (赛博朋克2077)
        
        // 生存/建造
        221100,  // DayZ
        105600,  // Terraria (泰拉瑞亚)
        
        // 策略
        1240440, // Hades (哈迪斯)
        367520,  // Hollow Knight (空洞骑士)
    ];

    println!("🔍 开始获取 {} 个游戏的详细信息...\n", popular_game_ids.len());
    
    let results = client.get_batch_details(&popular_game_ids, 1500).await;

    let mut filtered_games = Vec::new();
    let mut stats = CollectionStats::default();

    for (appid, details) in results {
        stats.total += 1;

        if let Some(game) = details {
            println!("📦 {} (AppID: {})", game.name, appid);
            println!("   类型: {}", game.app_type);
            
            if let Some(recommendations) = &game.recommendations {
                println!("   👍 推荐数: {}", recommendations.total);
            } else {
                println!("   👍 推荐数: N/A");
            }
            
            if let Some(metacritic) = &game.metacritic {
                println!("   ⭐ Metacritic: {} 分", metacritic.score);
            } else {
                println!("   ⭐ Metacritic: N/A");
            }
            
            if let Some(genres) = &game.genres {
                let genre_names: Vec<_> = genres.iter().map(|g| g.description.as_str()).collect();
                println!("   🎯 类型: {}", genre_names.join(", "));
            }

            if game.app_type == "game" {
                stats.games += 1;

                if let Some(filtered) = filter_game(&game, &rules) {
                    stats.passed += 1;
                    filtered_games.push(filtered);
                    println!("   ✅ 通过过滤");
                } else {
                    stats.filtered += 1;
                    println!("   ❌ 未通过过滤");
                }
            } else {
                stats.other_types += 1;
                println!("   ⚠️  非游戏类型");
            }
            
            println!();
        } else {
            stats.failed += 1;
            println!("❌ AppID {} - 无法获取详情\n", appid);
        }
    }

    // 输出统计信息
    println!("\n{}", "─".repeat(60));
    println!("📊 统计信息:");
    println!("   总计: {}", stats.total);
    println!("   游戏: {}", stats.games);
    println!("   ✅ 通过过滤: {}", stats.passed);
    println!("   ❌ 被过滤: {}", stats.filtered);
    println!("   ⚠️  其他类型: {}", stats.other_types);
    println!("   💥 获取失败: {}", stats.failed);
    println!("{}", "─".repeat(60));

    // 保存到 JSON 文件
    let output_path = "steam_games_popular.json";
    let json = serde_json::to_string_pretty(&filtered_games).unwrap();
    std::fs::write(output_path, json).unwrap();
    println!("\n💾 已保存 {} 个游戏到 {}", filtered_games.len(), output_path);
}

/// 测试小规模数据采集（前 100 个应用）
#[allow(dead_code)]
async fn test_small_collection() {
    println!("\n📦 测试 2: 小规模数据采集（前 100 个应用）\n");
    
    let client = SteamApiClient::new();
    
    println!("🌐 正在获取 Steam 应用列表...");
    let apps = match client.get_app_list().await {
        Ok(apps) => apps,
        Err(e) => {
            eprintln!("❌ 获取应用列表失败: {}", e);
            return;
        }
    };
    
    println!("✅ 获取到 {} 个应用", apps.len());

    // 只取前 100 个进行测试
    let sample_size = 100;
    let sample_apps: Vec<u32> = apps.iter().take(sample_size).map(|a| a.appid).collect();

    println!("🔍 开始采集前 {} 个应用的详细信息（延迟 2 秒/个）...", sample_size);
    println!("⏱️  预计耗时: 约 {} 分钟\n", sample_size * 2 / 60);
    
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
    let mut stats = CollectionStats::default();

    for (appid, details) in results {
        stats.total += 1;

        if let Some(game) = details {
            if game.app_type == "game" {
                stats.games += 1;

                if let Some(filtered) = filter_game(&game, &rules) {
                    stats.passed += 1;
                    filtered_games.push(filtered);
                    println!("✅ {} (推荐: {})", game.name, 
                        game.recommendations.as_ref().map(|r| r.total).unwrap_or(0));
                } else {
                    stats.filtered += 1;
                }
            } else {
                stats.other_types += 1;
            }
        } else {
            stats.failed += 1;
        }

        // 每处理 10 个显示进度
        if stats.total % 10 == 0 {
            println!("📈 进度: {}/{}", stats.total, sample_size);
        }
    }

    println!("\n{}", "─".repeat(60));
    println!("📊 统计信息:");
    println!("   总计: {}", stats.total);
    println!("   游戏: {}", stats.games);
    println!("   ✅ 通过过滤: {}", stats.passed);
    println!("   ❌ 被过滤: {}", stats.filtered);
    println!("   ⚠️  其他类型: {}", stats.other_types);
    println!("   💥 获取失败: {}", stats.failed);
    println!("{}", "─".repeat(60));

    // 保存到 JSON
    let output_path = "steam_games_sample_100.json";
    let json = serde_json::to_string_pretty(&filtered_games).unwrap();
    std::fs::write(output_path, json).unwrap();
    println!("\n💾 已保存 {} 个游戏到 {}", filtered_games.len(), output_path);
}

#[derive(Default)]
struct CollectionStats {
    total: usize,
    games: usize,
    passed: usize,
    filtered: usize,
    other_types: usize,
    failed: usize,
}
