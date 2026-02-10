// Audio module for voice input functionality

pub mod continuous_listener;
pub mod recorder;
pub mod vad;

#[cfg(windows)]
pub mod stt_windows;
