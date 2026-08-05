//! Typed engine-session lifecycle state.
//!
//! This module is intentionally process-agnostic so lifecycle transitions can be
//! tested without spawning a UCI engine binary.

use serde::Serialize;
use specta::Type;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Type)]
pub struct EngineSessionId(String);

impl EngineSessionId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }

    #[cfg(test)]
    fn from_static(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl std::fmt::Display for EngineSessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EngineSessionState {
    Idle,
    Starting,
    Ready,
    Searching,
    Stopping,
    Stopped,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EngineLifecycle {
    pub session_id: EngineSessionId,
    pub state: EngineSessionState,
    pub search_generation: u64,
    pub last_error: Option<String>,
}

impl EngineLifecycle {
    pub fn new() -> Self {
        Self {
            session_id: EngineSessionId::new(),
            state: EngineSessionState::Idle,
            search_generation: 0,
            last_error: None,
        }
    }

    #[cfg(test)]
    fn for_test(session_id: &str) -> Self {
        Self {
            session_id: EngineSessionId::from_static(session_id),
            state: EngineSessionState::Idle,
            search_generation: 0,
            last_error: None,
        }
    }

    pub fn mark_starting(&mut self) {
        self.last_error = None;
        self.state = EngineSessionState::Starting;
    }

    pub fn mark_ready(&mut self) {
        if self.state != EngineSessionState::Stopped {
            self.last_error = None;
            self.state = EngineSessionState::Ready;
        }
    }

    pub fn start_search(&mut self) -> u64 {
        self.last_error = None;
        self.search_generation += 1;
        self.state = EngineSessionState::Searching;
        self.search_generation
    }

    pub fn begin_search_stop(&mut self) -> bool {
        if self.state != EngineSessionState::Searching {
            return false;
        }
        self.state = EngineSessionState::Stopping;
        true
    }

    pub fn begin_shutdown(&mut self) -> bool {
        if self.state == EngineSessionState::Stopped {
            return false;
        }
        self.state = EngineSessionState::Stopping;
        true
    }

    pub fn mark_stopped(&mut self) {
        self.state = EngineSessionState::Stopped;
    }

    pub fn mark_failed(&mut self, error: impl Into<String>) {
        self.last_error = Some(error.into());
        self.state = EngineSessionState::Failed;
    }
}

#[cfg(test)]
mod tests {
    use super::{EngineLifecycle, EngineSessionState};

    #[test]
    fn lifecycle_tracks_start_ready_and_search_generation() {
        let mut lifecycle = EngineLifecycle::for_test("session-a");

        lifecycle.mark_starting();
        assert_eq!(lifecycle.state, EngineSessionState::Starting);

        lifecycle.mark_ready();
        assert_eq!(lifecycle.state, EngineSessionState::Ready);

        assert_eq!(lifecycle.start_search(), 1);
        assert_eq!(lifecycle.state, EngineSessionState::Searching);
        assert_eq!(lifecycle.start_search(), 2);
        assert_eq!(lifecycle.search_generation, 2);
    }

    #[test]
    fn stopping_a_search_returns_to_ready_without_changing_session_id() {
        let mut lifecycle = EngineLifecycle::for_test("stable-session");
        lifecycle.mark_ready();
        lifecycle.start_search();

        assert!(lifecycle.begin_search_stop());
        assert_eq!(lifecycle.state, EngineSessionState::Stopping);

        lifecycle.mark_ready();
        assert_eq!(lifecycle.session_id.to_string(), "stable-session");
        assert_eq!(lifecycle.state, EngineSessionState::Ready);
    }

    #[test]
    fn shutdown_is_idempotent() {
        let mut lifecycle = EngineLifecycle::for_test("session-a");
        lifecycle.mark_ready();

        assert!(lifecycle.begin_shutdown());
        lifecycle.mark_stopped();
        assert_eq!(lifecycle.state, EngineSessionState::Stopped);

        assert!(!lifecycle.begin_shutdown());
        lifecycle.mark_ready();
        assert_eq!(lifecycle.state, EngineSessionState::Stopped);
    }

    #[test]
    fn failures_preserve_context_until_next_start() {
        let mut lifecycle = EngineLifecycle::for_test("session-a");
        lifecycle.mark_failed("uci timeout");

        assert_eq!(lifecycle.state, EngineSessionState::Failed);
        assert_eq!(lifecycle.last_error.as_deref(), Some("uci timeout"));

        lifecycle.mark_starting();
        assert_eq!(lifecycle.state, EngineSessionState::Starting);
        assert_eq!(lifecycle.last_error, None);
    }
}
