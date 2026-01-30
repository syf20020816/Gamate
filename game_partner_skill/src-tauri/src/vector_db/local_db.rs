use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::collections::HashMap;

/// 本地文件型向量数据库（无需外部依赖）
pub struct LocalVectorDB {
    storage_path: PathBuf,
    collection_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VectorEntry {
    id: u64,
    vector: Vec<f32>,
    payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct CollectionData {
    vectors: Vec<VectorEntry>,
    dimension: usize,
}

impl LocalVectorDB {
    /// 创建本地向量数据库实例
    pub fn new(storage_path: PathBuf, collection_name: &str) -> Result<Self> {
        std::fs::create_dir_all(&storage_path)?;
        Ok(Self {
            storage_path,
            collection_name: collection_name.to_string(),
        })
    }

    fn collection_file(&self) -> PathBuf {
        self.storage_path.join(format!("{}.json", self.collection_name))
    }

    /// 检查集合是否存在
    pub fn collection_exists(&self) -> bool {
        self.collection_file().exists()
    }

    /// 创建集合
    pub fn create_collection(&self, vector_size: usize) -> Result<()> {
        let data = CollectionData {
            vectors: Vec::new(),
            dimension: vector_size,
        };
        let json = serde_json::to_string_pretty(&data)?;
        std::fs::write(self.collection_file(), json)?;
        log::info!("✅ 创建本地集合: {}", self.collection_name);
        Ok(())
    }

    /// 删除集合
    pub fn delete_collection(&self) -> Result<()> {
        if self.collection_exists() {
            std::fs::remove_file(self.collection_file())?;
            log::info!("🗑️ 删除本地集合: {}", self.collection_name);
        }
        Ok(())
    }

    /// 插入向量数据
    pub fn upsert_points(&self, entries: Vec<(u64, Vec<f32>, serde_json::Value)>) -> Result<()> {
        let mut data = if self.collection_exists() {
            let json = std::fs::read_to_string(self.collection_file())?;
            serde_json::from_str::<CollectionData>(&json)?
        } else {
            return Err(anyhow::anyhow!("集合不存在"));
        };

        // 转换为 HashMap 以便快速查找和更新
        let mut map: HashMap<u64, VectorEntry> = data
            .vectors
            .into_iter()
            .map(|entry| (entry.id, entry))
            .collect();

        // 更新或插入
        for (id, vector, payload) in entries {
            map.insert(id, VectorEntry { id, vector, payload });
        }

        // 转回 Vec 并保存
        data.vectors = map.into_values().collect();
        let json = serde_json::to_string_pretty(&data)?;
        std::fs::write(self.collection_file(), json)?;

        Ok(())
    }

    /// 向量相似度搜索（余弦相似度）
    pub fn search(&self, query_vector: Vec<f32>, limit: usize) -> Result<Vec<super::SearchResult>> {
        if !self.collection_exists() {
            return Ok(Vec::new());
        }

        let json = std::fs::read_to_string(self.collection_file())?;
        let data: CollectionData = serde_json::from_str(&json)?;

        if data.vectors.is_empty() {
            return Ok(Vec::new());
        }

        // 计算所有向量的相似度
        let mut results: Vec<(f32, VectorEntry)> = data
            .vectors
            .into_iter()
            .map(|entry| {
                let score = cosine_similarity(&query_vector, &entry.vector);
                (score, entry)
            })
            .collect();

        // 按相似度降序排序
        results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        // 取前 limit 个结果
        Ok(results
            .into_iter()
            .take(limit)
            .map(|(score, entry)| super::SearchResult {
                score,
                payload: entry.payload,
            })
            .collect())
    }

    /// 获取集合信息
    pub fn get_collection_info(&self) -> Result<super::CollectionInfo> {
        if !self.collection_exists() {
            return Ok(super::CollectionInfo {
                vectors_count: 0,
                points_count: 0,
            });
        }

        let json = std::fs::read_to_string(self.collection_file())?;
        let data: CollectionData = serde_json::from_str(&json)?;

        Ok(super::CollectionInfo {
            vectors_count: data.vectors.len() as u64,
            points_count: data.vectors.len() as u64,
        })
    }
}

/// 计算余弦相似度
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot_product / (norm_a * norm_b)
}
