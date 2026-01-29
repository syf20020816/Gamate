pub mod web_crawler;
pub mod github_crawler;
pub mod fandom_api;
pub mod types;
pub mod utils;

pub use types::*;
pub use web_crawler::WebCrawler;
pub use github_crawler::GitHubCrawler;
pub use fandom_api::FandomApiCrawler;
