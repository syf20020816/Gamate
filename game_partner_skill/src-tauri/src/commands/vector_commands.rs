use crate::{
    crawler::WikiEntry,
    embeddings::EmbeddingService,
    vector_db::{CollectionInfo, SearchResult, VectorDB},
};
use anyhow::Result;
use serde_json::json;
use std::path::PathBuf;

/// 导入 Wiki 数据到向量数据库
#[tauri::command]
pub async fn import_wiki_to_vector_db(
    jsonl_path: String,
    game_id: String,
) -> Result<String, String> {
    import_wiki_to_vector_db_impl(jsonl_path, game_id)
        .await
        .map_err(|e| format!("导入失败: {}", e))
}

async fn import_wiki_to_vector_db_impl(jsonl_path: String, game_id: String) -> Result<String> {
    log::info!("📖 开始导入 Wiki 数据到向量数据库...");
    log::info!("   文件: {}", jsonl_path);
    log::info!("   游戏: {}", game_id);

    // 1. 读取 JSONL 文件
    let content = std::fs::read_to_string(&jsonl_path)?;
    let entries: Vec<WikiEntry> = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();

    if entries.is_empty() {
        anyhow::bail!("JSONL 文件为空或格式错误");
    }

    log::info!("✅ 读取 {} 条 Wiki 条目", entries.len());

    // 2. 初始化 Embedding 服务
    let embedding_service = EmbeddingService::new().await?;

    // 3. 连接 Qdrant
    let qdrant_url = std::env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".to_string());
    let collection_name = format!("game_wiki_{}", game_id);
    let vector_db = VectorDB::new(&qdrant_url, &collection_name).await?;

    // 4. 如果集合已存在，删除它
    if vector_db.collection_exists().await? {
        log::warn!("⚠️  集合已存在，正在删除...");
        vector_db.delete_collection().await?;
    }

    // 5. 创建集合
    let vector_size = embedding_service.dimension() as u64;
    vector_db.create_collection(vector_size).await?;

    // 6. 批量生成 Embedding 并插入
    let batch_size = 50;
    let mut total_imported = 0;

    for (batch_idx, chunk) in entries.chunks(batch_size).enumerate() {
        log::info!(
            "📝 处理批次 {}/{} ({} 条)...",
            batch_idx + 1,
            (entries.len() + batch_size - 1) / batch_size,
            chunk.len()
        );

        // 生成 embedding
        let texts: Vec<&str> = chunk.iter().map(|e| e.content.as_str()).collect();
        let vectors = embedding_service.embed_batch(texts).await?;

        // 准备插入数据
        let points: Vec<_> = chunk
            .iter()
            .zip(vectors)
            .enumerate()
            .map(|(i, (entry, vector))| {
                let id = (batch_idx * batch_size + i) as u64;
                let payload = json!({
                    "id": entry.id,
                    "title": entry.title,
                    "content": entry.content,
                    "url": entry.url,
                    "timestamp": entry.timestamp,
                    "categories": entry.categories,
                    "game_id": game_id,
                });
                (id, vector, payload)
            })
            .collect();

        // 插入向量
        vector_db.upsert_points(points).await?;
        total_imported += chunk.len();

        log::info!("✅ 批次 {} 完成，累计导入 {} 条", batch_idx + 1, total_imported);
    }

    let summary = format!(
        "成功导入 {} 条 Wiki 条目到向量数据库 (集合: {})",
        total_imported, collection_name
    );

    log::info!("🎉 {}", summary);

    Ok(summary)
}

/// 搜索 Wiki 知识
#[tauri::command]
pub async fn search_wiki(
    query: String,
    game_id: String,
    top_k: Option<usize>,
) -> Result<Vec<WikiSearchResult>, String> {
    search_wiki_impl(query, game_id, top_k)
        .await
        .map_err(|e| format!("搜索失败: {}", e))
}

async fn search_wiki_impl(
    query: String,
    game_id: String,
    top_k: Option<usize>,
) -> Result<Vec<WikiSearchResult>> {
    let top_k = top_k.unwrap_or(5);

    log::info!("🔍 搜索 Wiki 知识...");
    log::info!("   查询: {}", query);
    log::info!("   游戏: {}", game_id);
    log::info!("   Top-K: {}", top_k);

    // 1. 初始化 Embedding 服务
    let embedding_service = EmbeddingService::new().await?;

    // 2. 连接 Qdrant
    let qdrant_url = std::env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".to_string());
    let collection_name = format!("game_wiki_{}", game_id);
    let vector_db = VectorDB::new(&qdrant_url, &collection_name).await?;

    // 3. 检查集合是否存在
    if !vector_db.collection_exists().await? {
        anyhow::bail!("游戏 {} 的知识库不存在，请先导入 Wiki 数据", game_id);
    }

    // 4. 生成查询向量
    let query_vector = embedding_service.embed_text(&query).await?;

    // 5. 检索
    let results = vector_db.search(query_vector, top_k).await?;

    // 6. 解析结果
    let wiki_results: Vec<WikiSearchResult> = results
        .into_iter()
        .filter_map(|r| {
            let payload = r.payload;
            Some(WikiSearchResult {
                score: r.score,
                id: payload.get("id")?.as_str()?.to_string(),
                title: payload.get("title")?.as_str()?.to_string(),
                content: payload.get("content")?.as_str()?.to_string(),
                url: payload.get("url")?.as_str()?.to_string(),
                categories: payload
                    .get("categories")?
                    .as_array()?
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect(),
            })
        })
        .collect();

    log::info!("✅ 找到 {} 个相关结果", wiki_results.len());

    Ok(wiki_results)
}

/// 获取向量数据库统计信息
#[tauri::command]
pub async fn get_vector_db_stats(game_id: String) -> Result<VectorDBStats, String> {
    get_vector_db_stats_impl(game_id)
        .await
        .map_err(|e| format!("获取统计信息失败: {}", e))
}

async fn get_vector_db_stats_impl(game_id: String) -> Result<VectorDBStats> {
    let qdrant_url = std::env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".to_string());
    let collection_name = format!("game_wiki_{}", game_id);
    let vector_db = VectorDB::new(&qdrant_url, &collection_name).await?;

    if !vector_db.collection_exists().await? {
        return Ok(VectorDBStats {
            exists: false,
            vectors_count: 0,
            points_count: 0,
            game_id,
        });
    }

    let info = vector_db.get_collection_info().await?;

    Ok(VectorDBStats {
        exists: true,
        vectors_count: info.vectors_count,
        points_count: info.points_count,
        game_id,
    })
}

/// 检查游戏的向量数据库是否已导入
#[tauri::command]
pub async fn check_game_vector_db(game_id: String) -> Result<bool, String> {
    check_game_vector_db_impl(game_id)
        .await
        .map_err(|e| format!("检查失败: {}", e))
}

async fn check_game_vector_db_impl(game_id: String) -> Result<bool> {
    let qdrant_url = std::env::var("QDRANT_URL")
        .unwrap_or_else(|_| "http://localhost:6333".to_string());
    let collection_name = format!("game_wiki_{}", game_id);
    
    let vector_db = VectorDB::new(&qdrant_url, &collection_name).await?;
    let exists = vector_db.collection_exists().await?;
    
    Ok(exists)
}

/// 获取所有已导入向量数据库的游戏列表
#[tauri::command]
pub async fn list_imported_games() -> Result<Vec<String>, String> {
    list_imported_games_impl()
        .await
        .map_err(|e| format!("获取列表失败: {}", e))
}

async fn list_imported_games_impl() -> Result<Vec<String>> {
    let qdrant_url = std::env::var("QDRANT_URL")
        .unwrap_or_else(|_| "http://localhost:6333".to_string());
    
    // 连接到 Qdrant (使用临时集合名)
    let vector_db = VectorDB::new(&qdrant_url, "temp").await?;
    
    // 获取所有集合
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/collections", qdrant_url))
        .send()
        .await?;
    
    if !response.status().is_success() {
        anyhow::bail!("获取集合列表失败");
    }
    
    #[derive(serde::Deserialize)]
    struct CollectionsResponse {
        result: CollectionsResult,
    }
    
    #[derive(serde::Deserialize)]
    struct CollectionsResult {
        collections: Vec<CollectionItem>,
    }
    
    #[derive(serde::Deserialize)]
    struct CollectionItem {
        name: String,
    }
    
    let collections: CollectionsResponse = response.json().await?;
    
    // 筛选出 game_wiki_ 开头的集合
    let game_ids: Vec<String> = collections
        .result
        .collections
        .into_iter()
        .filter_map(|c| {
            if c.name.starts_with("game_wiki_") {
                Some(c.name.strip_prefix("game_wiki_").unwrap().to_string())
            } else {
                None
            }
        })
        .collect();
    
    Ok(game_ids)
}

/// Wiki 搜索结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiSearchResult {
    /// 相似度分数 (0-1)
    pub score: f32,
    /// 条目 ID
    pub id: String,
    /// 标题
    pub title: String,
    /// 内容
    pub content: String,
    /// URL
    pub url: String,
    /// 分类
    pub categories: Vec<String>,
}

/// 向量数据库统计信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorDBStats {
    /// 集合是否存在
    pub exists: bool,
    /// 向量数量
    pub vectors_count: u64,
    /// 点数量
    pub points_count: u64,
    /// 游戏 ID
    pub game_id: String,
}
