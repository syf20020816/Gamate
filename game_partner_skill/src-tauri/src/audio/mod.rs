// Audio module for voice input functionality

pub mod vad;
pub mod continuous_listener;
pub mod recorder;

#[cfg(windows)]
pub mod stt_windows;
