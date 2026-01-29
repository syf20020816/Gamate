use reqwest::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_url = "https://phasmophobia.fandom.com/api.php";
    
    println!("🧪 测试 Fandom MediaWiki API\n");

    let client = Client::builder()
        .user_agent("GamePartnerSkill/1.0 (Educational)")
        .build()?;

    // 测试 1: 获取页面列表
    println!("📋 测试 1: 获取页面列表...");
    let params = vec![
        ("action", "query"),
        ("format", "json"),
        ("list", "allpages"),
        ("aplimit", "5"),
        ("apnamespace", "0"),
    ];

    let response = client.get(api_url).query(&params).send().await?;
    println!("  状态码: {}", response.status());

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await?;
        
        if let Some(pages) = json["query"]["allpages"].as_array() {
            println!("  ✅ 成功获取 {} 个页面:", pages.len());
            for page in pages {
                println!("     - {}", page["title"].as_str().unwrap_or("Unknown"));
            }
        }
    } else {
        println!("  ❌ 失败: {}", response.status());
        return Ok(());
    }

    // 测试 2: 获取页面内容
    println!("\n📄 测试 2: 获取页面内容...");
    let params2 = vec![
        ("action", "query"),
        ("format", "json"),
        ("prop", "extracts|categories"),
        ("titles", "Ghost"),
        ("exintro", ""),
        ("explaintext", ""),
    ];

    let response2 = client.get(api_url).query(&params2).send().await?;
    println!("  状态码: {}", response2.status());

    if response2.status().is_success() {
        let json2: serde_json::Value = response2.json().await?;
        
        if let Some(pages) = json2["query"]["pages"].as_object() {
            for (_, page_data) in pages {
                if let Some(title) = page_data["title"].as_str() {
                    println!("  ✅ 页面标题: {}", title);
                    
                    if let Some(extract) = page_data["extract"].as_str() {
                        let preview = if extract.len() > 200 {
                            &extract[..200]
                        } else {
                            extract
                        };
                        println!("  📝 内容预览:\n{}\n     ...", preview);
                    }

                    if let Some(cats) = page_data["categories"].as_array() {
                        println!("  🏷️  分类:");
                        for cat in cats {
                            if let Some(cat_title) = cat["title"].as_str() {
                                println!("     - {}", cat_title);
                            }
                        }
                    }
                }
            }
        }
    }

    println!("\n✅ API 测试完成！");
    println!("💡 提示: Fandom API 可以正常使用，不受 Cloudflare 限制");

    Ok(())
}
