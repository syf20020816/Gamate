/// 测试 Fandom API 响应结构
use reqwest::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🧪 测试 Fandom API 响应结构\n");

    let client = Client::new();
    let api_url = "https://phasmophobia.fandom.com/api.php";

    // 测试 1: 获取单个页面的完整内容
    println!("📋 测试 1: 获取 'Ghost' 页面（使用 revisions）...");
    let params = vec![
        ("action", "query"),
        ("format", "json"),
        ("prop", "revisions|categories"),
        ("titles", "Ghost"),
        ("rvprop", "content"),
        ("rvslots", "main"),
    ];

    let response = client
        .get(api_url)
        .query(&params)
        .send()
        .await?;

    println!("  状态码: {}", response.status());
    
    let json: serde_json::Value = response.json().await?;
    println!("\n📄 完整响应:");
    println!("{}\n", serde_json::to_string_pretty(&json)?);

    // 分析结构
    if let Some(query) = json.get("query") {
        if let Some(pages) = query.get("pages") {
            if let Some(pages_obj) = pages.as_object() {
                for (page_id, page_data) in pages_obj {
                    println!("📌 页面 ID: {}", page_id);
                    println!("   标题: {}", page_data.get("title").and_then(|v| v.as_str()).unwrap_or("N/A"));
                    
                    if let Some(revisions) = page_data.get("revisions") {
                        if let Some(rev_array) = revisions.as_array() {
                            if let Some(first_rev) = rev_array.first() {
                                // 检查 slots.main.* 格式
                                if let Some(slots) = first_rev.get("slots") {
                                    if let Some(main) = slots.get("main") {
                                        if let Some(content) = main.get("*") {
                                            if let Some(text) = content.as_str() {
                                                println!("   ✅ 有 slots.main.* 内容");
                                                println!("   内容长度: {} 字符", text.len());
                                                println!("   前200字符: {}", &text.chars().take(200).collect::<String>());
                                            }
                                        }
                                    }
                                }
                                // 检查旧格式 *
                                else if let Some(content) = first_rev.get("*") {
                                    if let Some(text) = content.as_str() {
                                        println!("   ✅ 有旧格式 * 内容");
                                        println!("   内容长度: {} 字符", text.len());
                                        println!("   前200字符: {}", &text.chars().take(200).collect::<String>());
                                    }
                                }
                            }
                        }
                    } else {
                        println!("   ❌ 没有 revisions 字段");
                        println!("   可用字段: {:?}", page_data.as_object().map(|o| o.keys().collect::<Vec<_>>()));
                    }
                }
            }
        }
    }

    println!("\n✅ 测试完成！");
    Ok(())
}
