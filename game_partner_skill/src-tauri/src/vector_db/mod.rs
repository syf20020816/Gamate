use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::json;

/// 向量数据库服务 (使用 Qdrant REST API)
pub struct VectorDB {
    client: reqwest::Client,
    base_url: String,
    collection_name: String,
}

/// 搜索结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SearchResult {
    pub score: f32,
    pub payload: serde_json::Value,
}

/// 集合信息
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CollectionInfo {
    pub vectors_count: u64,
    pub points_count: u64,
}

#[derive(Serialize)]
struct CreateCollectionRequest {
    vectors: VectorConfig,
}

#[derive(Serialize)]
struct VectorConfig {
    size: u64,
    distance: String,
}

#[derive(Serialize)]
struct UpsertRequest {
    points: Vec<PointData>,
}

#[derive(Serialize)]
struct PointData {
    id: u64,
    vector: Vec<f32>,
    payload: serde_json::Map<String, serde_json::Value>,
}

#[derive(Serialize)]
struct SearchRequest {
    vector: Vec<f32>,
    limit: usize,
    with_payload: bool,
}

#[derive(Deserialize)]
struct SearchResponse {
    result: Vec<SearchResultItem>,
}

#[derive(Deserialize)]
struct SearchResultItem {
    score: f32,
    payload: serde_json::Map<String, serde_json::Value>,
}

#[derive(Deserialize)]
struct CollectionInfoResponse {
    result: CollectionInfoResult,
}

#[derive(Deserialize)]
struct CollectionInfoResult {
    points_count: Option<u64>,
    vectors_count: Option<u64>,
}

#[derive(Deserialize)]
struct CollectionsResponse {
    result: CollectionsResult,
}

#[derive(Deserialize)]
struct CollectionsResult {
    collections: Vec<CollectionItem>,
}

#[derive(Deserialize)]
struct CollectionItem {
    name: String,
}

impl VectorDB {
    pub async fn new(url: &str, collection_name: &str) -> Result<Self> {
        log::info!(" 连接 Qdrant: {}", url);
        let client = reqwest::Client::new();
        let base_url = url.trim_end_matches('/').to_string();
        let response = client.get(format!("{}/collections", base_url)).send().await?;
        if !response.status().is_success() {
            anyhow::bail!("无法连接到 Qdrant: HTTP {}", response.status());
        }
        log::info!(" Qdrant 连接成功");
        Ok(Self { client, base_url, collection_name: collection_name.to_string() })
    }

    pub async fn collection_exists(&self) -> Result<bool> {
        let response = self.client.get(format!("{}/collections", self.base_url)).send().await?;
        if !response.status().is_success() { return Ok(false); }
        let collections: CollectionsResponse = response.json().await?;
        Ok(collections.result.collections.iter().any(|c| c.name == self.collection_name))
    }

    pub async fn create_collection(&self, vector_size: u64) -> Result<()> {
        log::info!(" 创建集合: {}", self.collection_name);
        let request = CreateCollectionRequest {
            vectors: VectorConfig { size: vector_size, distance: "Cosine".to_string() }
        };
        let response = self.client.put(format!("{}/collections/{}", self.base_url, self.collection_name))
            .json(&request).send().await?;
        if !response.status().is_success() {
            anyhow::bail!("创建集合失败: {}", response.text().await?);
        }
        log::info!(" 集合创建成功");
        Ok(())
    }

    pub async fn delete_collection(&self) -> Result<()> {
        log::info!("  删除集合: {}", self.collection_name);
        let response = self.client.delete(format!("{}/collections/{}", self.base_url, self.collection_name)).send().await?;
        if !response.status().is_success() {
            anyhow::bail!("删除集合失败: {}", response.text().await?);
        }
        log::info!(" 集合删除成功");
        Ok(())
    }

    pub async fn upsert_points(&self, entries: Vec<(u64, Vec<f32>, serde_json::Value)>) -> Result<()> {
        if entries.is_empty() { return Ok(()); }
        let points: Vec<PointData> = entries.into_iter().map(|(id, vector, payload)| PointData {
            id, vector, payload: payload.as_object().unwrap().clone()
        }).collect();
        let request = UpsertRequest { points };
        let response = self.client.put(format!("{}/collections/{}/points", self.base_url, self.collection_name))
            .json(&request).send().await?;
        if !response.status().is_success() {
            anyhow::bail!("插入数据失败: {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn search(&self, query_vector: Vec<f32>, limit: usize) -> Result<Vec<SearchResult>> {
        let request = SearchRequest { vector: query_vector, limit, with_payload: true };
        let response = self.client.post(format!("{}/collections/{}/points/search", self.base_url, self.collection_name))
            .json(&request).send().await?;
        if !response.status().is_success() {
            anyhow::bail!("搜索失败: {}", response.text().await?);
        }
        let search_response: SearchResponse = response.json().await?;
        let results = search_response.result.into_iter().map(|item| SearchResult {
            score: item.score, payload: serde_json::to_value(item.payload).unwrap_or_default()
        }).collect();
        Ok(results)
    }

    pub async fn get_collection_info(&self) -> Result<CollectionInfo> {
        let response = self.client.get(format!("{}/collections/{}", self.base_url, self.collection_name)).send().await?;
        if !response.status().is_success() {
            anyhow::bail!("获取集合信息失败: {}", response.text().await?);
        }
        let info: CollectionInfoResponse = response.json().await?;
        let points_count = info.result.points_count.unwrap_or(0);
        Ok(CollectionInfo { vectors_count: points_count, points_count })
    }
}
