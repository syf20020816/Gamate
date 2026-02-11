/// 测试 Steam 登录集成
/// 
/// 功能测试：
/// 1. 生成 Steam 登录 URL
/// 2. 模拟回调处理
/// 3. 获取用户信息
/// 4. 获取游戏库

use gamate_lib::steam_auth::{openid, SteamAuthClient};

#[tokio::main]
async fn main() {
    env_logger::init();

    println!("🎮 Steam 登录集成测试\n");
    println!("{}", "=".repeat(60));

    // 测试 1: 生成登录 URL
    test_generate_login_url();

    println!("\n{}", "=".repeat(60));

    // 测试 2: Steam ID 提取（需要手动测试）
    test_extract_steamid();

    println!("\n{}", "=".repeat(60));

    // 测试 3: 获取用户信息（需要 API Key）
    if let Ok(api_key) = std::env::var("STEAM_API_KEY") {
        test_get_user_info(&api_key).await;
        println!("\n{}", "=".repeat(60));
        test_get_user_library(&api_key).await;
    } else {
        println!("\n⚠️  未设置 STEAM_API_KEY 环境变量，跳过 API 测试");
        println!("   设置方法: $env:STEAM_API_KEY=\"YOUR_API_KEY\"");
    }

    println!("\n{}", "=".repeat(60));
    print_instructions();
}

fn test_generate_login_url() {
    println!("\n📦 测试 1: 生成 Steam 登录 URL\n");

    let return_url = "http://localhost:1420/auth/steam/callback";
    
    match openid::generate_login_url(return_url) {
        Ok(login_url) => {
            println!("✅ 生成成功！");
            println!("\n🔗 Steam 登录 URL:");
            println!("{}", login_url);
            println!("\n💡 使用说明:");
            println!("   1. 复制上面的 URL");
            println!("   2. 在浏览器中打开");
            println!("   3. 使用 Steam 账号登录");
            println!("   4. 登录后会跳转到回调 URL");
        }
        Err(e) => {
            eprintln!("❌ 生成失败: {}", e);
        }
    }
}

fn test_extract_steamid() {
    println!("\n📦 测试 2: 从回调 URL 提取 Steam ID\n");

    // 模拟回调 URL
    let test_callback = "http://localhost:1420/auth/steam/callback?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=id_res&openid.claimed_id=https://steamcommunity.com/openid/id/76561198123456789&openid.identity=https://steamcommunity.com/openid/id/76561198123456789";

    match openid::extract_steamid_from_callback(test_callback) {
        Ok(steamid) => {
            println!("✅ 提取成功！");
            println!("   Steam ID: {}", steamid);
        }
        Err(e) => {
            eprintln!("❌ 提取失败: {}", e);
        }
    }

    println!("\n💡 实际使用时:");
    println!("   前端接收到回调 URL 后，调用 handle_steam_callback 命令");
    println!("   Tauri 会自动提取 Steam ID 并获取用户信息");
}

async fn test_get_user_info(api_key: &str) {
    println!("\n📦 测试 3: 获取用户信息（使用真实 API）\n");

    let client = SteamAuthClient::new(api_key.to_string());

    // 测试 Steam ID (Gabe Newell 的公开 Steam ID)
    let test_steamid = "76561197960287930";
    
    println!("🔍 获取用户信息: {}", test_steamid);

    match client.get_player_summaries(test_steamid).await {
        Ok(Some(user)) => {
            println!("✅ 获取成功！\n");
            println!("   Steam ID: {}", user.steamid);
            println!("   用户名: {}", user.personaname);
            println!("   个人资料: {}", user.profileurl);
            println!("   头像: {}", user.avatar);
            println!("   在线状态: {}", user.personastate);
            
            if let Some(created) = user.timecreated {
                let datetime = chrono::DateTime::from_timestamp(created as i64, 0);
                if let Some(dt) = datetime {
                    println!("   账号创建时间: {}", dt.format("%Y-%m-%d %H:%M:%S"));
                }
            }
        }
        Ok(None) => {
            println!("⚠️  未找到用户信息（可能是私密账号）");
        }
        Err(e) => {
            eprintln!("❌ 获取失败: {}", e);
        }
    }
}

async fn test_get_user_library(api_key: &str) {
    println!("\n📦 测试 4: 获取用户游戏库\n");

    let client = SteamAuthClient::new(api_key.to_string());

    // 测试 Steam ID
    let test_steamid = "76561197960287930";
    
    println!("🔍 获取游戏库: {}", test_steamid);

    match client.get_owned_games(test_steamid, true, true).await {
        Ok(games) => {
            if games.is_empty() {
                println!("⚠️  游戏库为空或设置为私密");
                println!("\n提示:");
                println!("   1. 确保 Steam 个人资料设置为公开");
                println!("   2. 游戏详情设置为公开");
                println!("   3. 或使用自己的 Steam ID 测试");
            } else {
                println!("✅ 获取成功！共 {} 个游戏\n", games.len());

                // 按游戏时长排序
                let mut sorted_games = games.clone();
                sorted_games.sort_by(|a, b| b.playtime_forever.cmp(&a.playtime_forever));

                // 显示前 10 个最常玩的游戏
                println!("🎮 游戏时长 TOP 10:\n");
                for (i, game) in sorted_games.iter().take(10).enumerate() {
                    let hours = game.playtime_forever / 60;
                    let minutes = game.playtime_forever % 60;
                    
                    println!(
                        "   {}. {} (AppID: {})",
                        i + 1,
                        game.name,
                        game.appid
                    );
                    println!("      游戏时长: {} 小时 {} 分钟", hours, minutes);
                    
                    if let Some(playtime_2weeks) = game.playtime_2weeks {
                        let hours_2w = playtime_2weeks / 60;
                        println!("      最近两周: {} 小时", hours_2w);
                    }
                    println!();
                }

                // 统计信息
                let total_playtime: u32 = games.iter().map(|g| g.playtime_forever).sum();
                let total_hours = total_playtime / 60;
                println!("📊 统计信息:");
                println!("   总游戏数: {}", games.len());
                println!("   总游戏时长: {} 小时 ({:.1} 天)", total_hours, total_hours as f64 / 24.0);
            }
        }
        Err(e) => {
            eprintln!("❌ 获取失败: {}", e);
        }
    }
}

fn print_instructions() {
    println!("\n📚 Steam 登录集成使用指南\n");

    println!("1️⃣  获取 Steam API Key:");
    println!("   访问: https://steamcommunity.com/dev/apikey");
    println!("   填写域名（可以填 localhost）");
    println!("   复制生成的 API Key\n");

    println!("2️⃣  设置环境变量:");
    println!("   PowerShell: $env:STEAM_API_KEY=\"YOUR_API_KEY\"");
    println!("   或在应用设置中配置\n");

    println!("3️⃣  前端集成步骤:");
    println!("   a) 调用 set_steam_api_key() 设置 API Key");
    println!("   b) 调用 generate_steam_login_url() 生成登录链接");
    println!("   c) 用户点击链接，跳转到 Steam 登录页");
    println!("   d) 登录成功后跳转回应用（回调 URL）");
    println!("   e) 调用 handle_steam_callback() 处理回调");
    println!("   f) 调用 fetch_steam_library() 获取游戏库\n");

    println!("4️⃣  注意事项:");
    println!("   - API Key 需要保密，不要提交到代码仓库");
    println!("   - 用户的 Steam 个人资料需要设置为公开");
    println!("   - 游戏库需要设置为公开才能获取");
    println!("   - 建议将 API Key 存储在配置文件中\n");

    println!("5️⃣  隐私说明:");
    println!("   - 本地化架构，所有数据存储在本地");
    println!("   - Steam API Key 仅用于调用 Steam Web API");
    println!("   - 不会上传用户数据到任何服务器");
    println!("   - 用户可以随时登出清除数据\n");
}
