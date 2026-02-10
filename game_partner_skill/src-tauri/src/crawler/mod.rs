pub mod fandom_api;
pub mod github_crawler;
pub mod types;
pub mod utils;
pub mod web_crawler;

pub use fandom_api::FandomApiCrawler;
pub use github_crawler::GitHubCrawler;
pub use types::*;
pub use web_crawler::WebCrawler;
