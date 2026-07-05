use std::time::Duration;

use crate::error::ApiError;

const HTTP_PROXY_KEYS: [&str; 2] = ["HTTP_PROXY", "http_proxy"];
const HTTPS_PROXY_KEYS: [&str; 2] = ["HTTPS_PROXY", "https_proxy"];
const NO_PROXY_KEYS: [&str; 2] = ["NO_PROXY", "no_proxy"];

/// Env var bounding how long we wait to *establish* a connection to the model
/// backend. Guards against an unreachable host hanging the request forever.
/// A value of `0` disables it; unset falls back to [`DEFAULT_CONNECT_TIMEOUT`].
const CONNECT_TIMEOUT_ENV: &str = "CLOUDLING_BACKEND_CONNECT_TIMEOUT_SECS";
/// Env var bounding the maximum *idle* time between received bytes of a
/// response (not the total response time). Disabled by default so long or
/// slow streaming generations — and the multi-call tool/agent loop — are never
/// cut off; set a positive value to opt into stall detection. `0` also disables.
const READ_TIMEOUT_ENV: &str = "CLOUDLING_BACKEND_READ_TIMEOUT_SECS";
/// Default connect timeout when [`CONNECT_TIMEOUT_ENV`] is unset.
const DEFAULT_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Timeouts applied to the outbound model-backend HTTP client. Kept separate
/// from [`ProxyConfig`] and resolved from the environment up front so the
/// parsing is unit-testable without touching the process environment.
///
/// We deliberately never set a *total* request timeout: a single backend call
/// can stream tokens for a long time, and the agent loop issues many such
/// calls, so a wall-clock cap would truncate legitimate long answers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TimeoutConfig {
    /// Max time to establish the TCP/TLS connection. `None` disables it.
    pub connect_timeout: Option<Duration>,
    /// Max idle time between response bytes. `None` (default) disables it.
    pub read_timeout: Option<Duration>,
}

impl Default for TimeoutConfig {
    fn default() -> Self {
        Self {
            connect_timeout: Some(DEFAULT_CONNECT_TIMEOUT),
            read_timeout: None,
        }
    }
}

impl TimeoutConfig {
    /// Resolve timeouts from the live process environment.
    #[must_use]
    pub fn from_env() -> Self {
        Self::from_lookup(|key| std::env::var(key).ok())
    }

    fn from_lookup<F>(mut lookup: F) -> Self
    where
        F: FnMut(&str) -> Option<String>,
    {
        Self {
            connect_timeout: parse_timeout_secs(
                lookup(CONNECT_TIMEOUT_ENV).as_deref(),
                Some(DEFAULT_CONNECT_TIMEOUT),
            ),
            read_timeout: parse_timeout_secs(lookup(READ_TIMEOUT_ENV).as_deref(), None),
        }
    }
}

/// Parse a whole-seconds timeout env value. Empty/missing → `default`,
/// `0` → `None` (explicitly disabled), positive integer → that many seconds,
/// unparseable garbage → `default` (so a typo never silently removes a guard).
fn parse_timeout_secs(raw: Option<&str>, default: Option<Duration>) -> Option<Duration> {
    match raw {
        None => default,
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return default;
            }
            match trimmed.parse::<u64>() {
                Ok(0) => None,
                Ok(secs) => Some(Duration::from_secs(secs)),
                Err(_) => default,
            }
        }
    }
}

/// Env var: maximum number of retries for a retryable backend failure
/// (connection refused, timeout, 429/5xx). Unset → [`DEFAULT_MAX_RETRIES`].
const MAX_RETRIES_ENV: &str = "CLOUDLING_BACKEND_MAX_RETRIES";
/// Env var: initial backoff in whole seconds (doubled each attempt up to the
/// cap). Unset → [`DEFAULT_INITIAL_BACKOFF`].
const INITIAL_BACKOFF_ENV: &str = "CLOUDLING_BACKEND_INITIAL_BACKOFF_SECS";
/// Env var: maximum backoff cap in whole seconds. Unset → [`DEFAULT_MAX_BACKOFF`].
const MAX_BACKOFF_ENV: &str = "CLOUDLING_BACKEND_MAX_BACKOFF_SECS";

/// Retry budget defaults tuned so a *down* backend surfaces an error to the
/// user in seconds, not minutes: 3 retries with a 1s→8s capped backoff means a
/// connection-refused failure is reported in roughly 7–15s (vs the previous
/// 8 retries / 128s cap that took 4–8 minutes). Transient 429/5xx are still
/// retried. All three are overridable via the `CLOUDLING_BACKEND_*` env vars.
const DEFAULT_MAX_RETRIES: u32 = 3;
const DEFAULT_INITIAL_BACKOFF: Duration = Duration::from_secs(1);
const DEFAULT_MAX_BACKOFF: Duration = Duration::from_secs(8);

/// Retry/backoff policy for backend calls, resolved from the environment.
/// Shared so the parsing is unit-testable without the process environment.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RetryPolicy {
    pub max_retries: u32,
    pub initial_backoff: Duration,
    pub max_backoff: Duration,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_retries: DEFAULT_MAX_RETRIES,
            initial_backoff: DEFAULT_INITIAL_BACKOFF,
            max_backoff: DEFAULT_MAX_BACKOFF,
        }
    }
}

impl RetryPolicy {
    /// Resolve the retry policy from the live process environment.
    #[must_use]
    pub fn from_env() -> Self {
        Self::from_lookup(|key| std::env::var(key).ok())
    }

    fn from_lookup<F>(mut lookup: F) -> Self
    where
        F: FnMut(&str) -> Option<String>,
    {
        let max_retries = lookup(MAX_RETRIES_ENV)
            .and_then(|value| value.trim().parse::<u32>().ok())
            .unwrap_or(DEFAULT_MAX_RETRIES);
        Self {
            max_retries,
            initial_backoff: parse_secs_or(
                lookup(INITIAL_BACKOFF_ENV).as_deref(),
                DEFAULT_INITIAL_BACKOFF,
            ),
            max_backoff: parse_secs_or(lookup(MAX_BACKOFF_ENV).as_deref(), DEFAULT_MAX_BACKOFF),
        }
    }
}

/// Parse a whole-seconds duration env value, falling back to `default` for
/// missing/empty/unparseable input. Unlike [`parse_timeout_secs`], `0` is a
/// valid zero-length duration (a zero backoff is meaningful; a zero timeout is
/// not — that means "disabled").
fn parse_secs_or(raw: Option<&str>, default: Duration) -> Duration {
    raw.and_then(|value| value.trim().parse::<u64>().ok())
        .map_or(default, Duration::from_secs)
}

/// Snapshot of the proxy-related environment variables that influence the
/// outbound HTTP client. Captured up front so callers can inspect, log, and
/// test the resolved configuration without re-reading the process environment.
///
/// When `proxy_url` is set it acts as a single catch-all proxy for both
/// HTTP and HTTPS traffic, taking precedence over the per-scheme fields.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProxyConfig {
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub no_proxy: Option<String>,
    /// Optional unified proxy URL that applies to both HTTP and HTTPS.
    /// When set, this takes precedence over `http_proxy` and `https_proxy`.
    pub proxy_url: Option<String>,
}

impl ProxyConfig {
    /// Read proxy settings from the live process environment, honouring both
    /// the upper- and lower-case spellings used by curl, git, and friends.
    #[must_use]
    pub fn from_env() -> Self {
        Self::from_lookup(|key| std::env::var(key).ok())
    }

    /// Create a proxy configuration from a single URL that applies to both
    /// HTTP and HTTPS traffic. This is the config-file alternative to setting
    /// `HTTP_PROXY` and `HTTPS_PROXY` environment variables separately.
    #[must_use]
    pub fn from_proxy_url(url: impl Into<String>) -> Self {
        Self {
            proxy_url: Some(url.into()),
            ..Self::default()
        }
    }

    fn from_lookup<F>(mut lookup: F) -> Self
    where
        F: FnMut(&str) -> Option<String>,
    {
        Self {
            http_proxy: first_non_empty(&HTTP_PROXY_KEYS, &mut lookup),
            https_proxy: first_non_empty(&HTTPS_PROXY_KEYS, &mut lookup),
            no_proxy: first_non_empty(&NO_PROXY_KEYS, &mut lookup),
            proxy_url: None,
        }
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.proxy_url.is_none() && self.http_proxy.is_none() && self.https_proxy.is_none()
    }
}

/// Build a `reqwest::Client` that honours the standard `HTTP_PROXY`,
/// `HTTPS_PROXY`, and `NO_PROXY` environment variables. When no proxy is
/// configured the client behaves identically to `reqwest::Client::new()`.
pub fn build_http_client() -> Result<reqwest::Client, ApiError> {
    build_http_client_with(&ProxyConfig::from_env())
}

/// Infallible counterpart to [`build_http_client`] for constructors that
/// historically returned `Self` rather than `Result<Self, _>`. When the proxy
/// configuration is malformed we fall back to a default client so that
/// callers retain the previous behaviour and the failure surfaces on the
/// first outbound request instead of at construction time.
#[must_use]
pub fn build_http_client_or_default() -> reqwest::Client {
    build_http_client().unwrap_or_else(|_| {
        reqwest::Client::builder()
            .user_agent("clawd-rust-tools/0.1")
            .build()
            .expect("default client with user_agent should always succeed")
    })
}

/// Build a `reqwest::Client` from an explicit [`ProxyConfig`]. Used by tests
/// and by callers that want to override process-level environment lookups.
///
/// When `config.proxy_url` is set it overrides the per-scheme `http_proxy`
/// and `https_proxy` fields and is registered as both an HTTP and HTTPS
/// proxy so a single value can route every outbound request.
pub fn build_http_client_with(config: &ProxyConfig) -> Result<reqwest::Client, ApiError> {
    let mut builder = reqwest::Client::builder()
        .no_proxy()
        .user_agent("clawd-rust-tools/0.1");

    // Apply backend timeouts (connect on by default, read off by default).
    // No total request timeout — see `TimeoutConfig` docs.
    let timeouts = TimeoutConfig::from_env();
    if let Some(connect_timeout) = timeouts.connect_timeout {
        builder = builder.connect_timeout(connect_timeout);
    }
    if let Some(read_timeout) = timeouts.read_timeout {
        builder = builder.read_timeout(read_timeout);
    }

    let no_proxy = config
        .no_proxy
        .as_deref()
        .and_then(reqwest::NoProxy::from_string);

    let (http_proxy_url, https_url) = match config.proxy_url.as_deref() {
        Some(unified) => (Some(unified), Some(unified)),
        None => (config.http_proxy.as_deref(), config.https_proxy.as_deref()),
    };

    if let Some(url) = https_url {
        let mut proxy = reqwest::Proxy::https(url)?;
        if let Some(filter) = no_proxy.clone() {
            proxy = proxy.no_proxy(Some(filter));
        }
        builder = builder.proxy(proxy);
    }

    if let Some(url) = http_proxy_url {
        let mut proxy = reqwest::Proxy::http(url)?;
        if let Some(filter) = no_proxy.clone() {
            proxy = proxy.no_proxy(Some(filter));
        }
        builder = builder.proxy(proxy);
    }

    Ok(builder.build()?)
}

fn first_non_empty<F>(keys: &[&str], lookup: &mut F) -> Option<String>
where
    F: FnMut(&str) -> Option<String>,
{
    keys.iter()
        .find_map(|key| lookup(key).filter(|value| !value.is_empty()))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use std::time::Duration;

    use super::{build_http_client_with, ProxyConfig, RetryPolicy, TimeoutConfig};

    fn config_from_map(pairs: &[(&str, &str)]) -> ProxyConfig {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect();
        ProxyConfig::from_lookup(|key| map.get(key).cloned())
    }

    fn lookup_from(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect();
        move |key: &str| map.get(key).cloned()
    }

    #[test]
    fn timeout_config_defaults_when_env_unset() {
        // given / when
        let timeouts = TimeoutConfig::from_lookup(lookup_from(&[]));

        // then: connect on (10s), read disabled so long answers are never cut
        assert_eq!(timeouts.connect_timeout, Some(Duration::from_secs(10)));
        assert_eq!(timeouts.read_timeout, None);
        assert_eq!(timeouts, TimeoutConfig::default());
    }

    #[test]
    fn timeout_config_reads_env_overrides() {
        // given
        let lookup = lookup_from(&[
            ("CLOUDLING_BACKEND_CONNECT_TIMEOUT_SECS", "3"),
            ("CLOUDLING_BACKEND_READ_TIMEOUT_SECS", "120"),
        ]);

        // when
        let timeouts = TimeoutConfig::from_lookup(lookup);

        // then
        assert_eq!(timeouts.connect_timeout, Some(Duration::from_secs(3)));
        assert_eq!(timeouts.read_timeout, Some(Duration::from_secs(120)));
    }

    #[test]
    fn timeout_config_zero_disables_and_garbage_falls_back() {
        // zero explicitly disables the connect timeout
        let zero = TimeoutConfig::from_lookup(lookup_from(&[(
            "CLOUDLING_BACKEND_CONNECT_TIMEOUT_SECS",
            "0",
        )]));
        assert_eq!(zero.connect_timeout, None);

        // garbage falls back to the default rather than silently removing the guard
        let garbage = TimeoutConfig::from_lookup(lookup_from(&[
            ("CLOUDLING_BACKEND_CONNECT_TIMEOUT_SECS", "abc"),
            ("CLOUDLING_BACKEND_READ_TIMEOUT_SECS", "  "),
        ]));
        assert_eq!(garbage.connect_timeout, Some(Duration::from_secs(10)));
        assert_eq!(garbage.read_timeout, None);
    }

    #[test]
    fn retry_policy_defaults_when_env_unset() {
        // given / when
        let policy = RetryPolicy::from_lookup(lookup_from(&[]));

        // then: tuned to surface a down backend in seconds, not minutes
        assert_eq!(policy.max_retries, 3);
        assert_eq!(policy.initial_backoff, Duration::from_secs(1));
        assert_eq!(policy.max_backoff, Duration::from_secs(8));
        assert_eq!(policy, RetryPolicy::default());
    }

    #[test]
    fn retry_policy_reads_env_overrides() {
        // given
        let lookup = lookup_from(&[
            ("CLOUDLING_BACKEND_MAX_RETRIES", "5"),
            ("CLOUDLING_BACKEND_INITIAL_BACKOFF_SECS", "2"),
            ("CLOUDLING_BACKEND_MAX_BACKOFF_SECS", "30"),
        ]);

        // when
        let policy = RetryPolicy::from_lookup(lookup);

        // then
        assert_eq!(policy.max_retries, 5);
        assert_eq!(policy.initial_backoff, Duration::from_secs(2));
        assert_eq!(policy.max_backoff, Duration::from_secs(30));
    }

    #[test]
    fn retry_policy_garbage_falls_back_to_defaults() {
        // given
        let lookup = lookup_from(&[
            ("CLOUDLING_BACKEND_MAX_RETRIES", "not-a-number"),
            ("CLOUDLING_BACKEND_MAX_BACKOFF_SECS", ""),
        ]);

        // when
        let policy = RetryPolicy::from_lookup(lookup);

        // then
        assert_eq!(policy, RetryPolicy::default());
    }

    #[test]
    fn proxy_config_is_empty_when_no_env_vars_are_set() {
        // given
        let config = config_from_map(&[]);

        // when
        let empty = config.is_empty();

        // then
        assert!(empty);
        assert_eq!(config, ProxyConfig::default());
    }

    #[test]
    fn proxy_config_reads_uppercase_http_https_and_no_proxy() {
        // given
        let pairs = [
            ("HTTP_PROXY", "http://proxy.internal:3128"),
            ("HTTPS_PROXY", "http://secure.internal:3129"),
            ("NO_PROXY", "localhost,127.0.0.1,.corp"),
        ];

        // when
        let config = config_from_map(&pairs);

        // then
        assert_eq!(
            config.http_proxy.as_deref(),
            Some("http://proxy.internal:3128")
        );
        assert_eq!(
            config.https_proxy.as_deref(),
            Some("http://secure.internal:3129")
        );
        assert_eq!(
            config.no_proxy.as_deref(),
            Some("localhost,127.0.0.1,.corp")
        );
        assert!(!config.is_empty());
    }

    #[test]
    fn proxy_config_falls_back_to_lowercase_keys() {
        // given
        let pairs = [
            ("http_proxy", "http://lower.internal:3128"),
            ("https_proxy", "http://lower-secure.internal:3129"),
            ("no_proxy", ".lower"),
        ];

        // when
        let config = config_from_map(&pairs);

        // then
        assert_eq!(
            config.http_proxy.as_deref(),
            Some("http://lower.internal:3128")
        );
        assert_eq!(
            config.https_proxy.as_deref(),
            Some("http://lower-secure.internal:3129")
        );
        assert_eq!(config.no_proxy.as_deref(), Some(".lower"));
    }

    #[test]
    fn proxy_config_prefers_uppercase_over_lowercase_when_both_set() {
        // given
        let pairs = [
            ("HTTP_PROXY", "http://upper.internal:3128"),
            ("http_proxy", "http://lower.internal:3128"),
        ];

        // when
        let config = config_from_map(&pairs);

        // then
        assert_eq!(
            config.http_proxy.as_deref(),
            Some("http://upper.internal:3128")
        );
    }

    #[test]
    fn proxy_config_treats_empty_strings_as_unset() {
        // given
        let pairs = [("HTTP_PROXY", ""), ("http_proxy", "")];

        // when
        let config = config_from_map(&pairs);

        // then
        assert!(config.http_proxy.is_none());
    }

    #[test]
    fn build_http_client_succeeds_when_no_proxy_is_configured() {
        // given
        let config = ProxyConfig::default();

        // when
        let result = build_http_client_with(&config);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn build_http_client_succeeds_with_valid_http_and_https_proxies() {
        // given
        let config = ProxyConfig {
            http_proxy: Some("http://proxy.internal:3128".to_string()),
            https_proxy: Some("http://secure.internal:3129".to_string()),
            no_proxy: Some("localhost,127.0.0.1".to_string()),
            proxy_url: None,
        };

        // when
        let result = build_http_client_with(&config);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn build_http_client_returns_http_error_for_invalid_proxy_url() {
        // given
        let config = ProxyConfig {
            http_proxy: None,
            https_proxy: Some("not a url".to_string()),
            no_proxy: None,
            proxy_url: None,
        };

        // when
        let result = build_http_client_with(&config);

        // then
        let error = result.expect_err("invalid proxy URL must be reported as a build failure");
        assert!(
            matches!(error, crate::error::ApiError::Http(_)),
            "expected ApiError::Http for invalid proxy URL, got: {error:?}"
        );
    }

    #[test]
    fn from_proxy_url_sets_unified_field_and_leaves_per_scheme_empty() {
        // given / when
        let config = ProxyConfig::from_proxy_url("http://unified.internal:3128");

        // then
        assert_eq!(
            config.proxy_url.as_deref(),
            Some("http://unified.internal:3128")
        );
        assert!(config.http_proxy.is_none());
        assert!(config.https_proxy.is_none());
        assert!(!config.is_empty());
    }

    #[test]
    fn build_http_client_succeeds_with_unified_proxy_url() {
        // given
        let config = ProxyConfig {
            proxy_url: Some("http://unified.internal:3128".to_string()),
            no_proxy: Some("localhost".to_string()),
            ..ProxyConfig::default()
        };

        // when
        let result = build_http_client_with(&config);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn proxy_url_takes_precedence_over_per_scheme_fields() {
        // given – both per-scheme and unified are set
        let config = ProxyConfig {
            http_proxy: Some("http://per-scheme.internal:1111".to_string()),
            https_proxy: Some("http://per-scheme.internal:2222".to_string()),
            no_proxy: None,
            proxy_url: Some("http://unified.internal:3128".to_string()),
        };

        // when – building succeeds (the unified URL is valid)
        let result = build_http_client_with(&config);

        // then
        assert!(result.is_ok());
    }

    #[test]
    fn build_http_client_returns_error_for_invalid_unified_proxy_url() {
        // given
        let config = ProxyConfig::from_proxy_url("not a url");

        // when
        let result = build_http_client_with(&config);

        // then
        assert!(
            matches!(result, Err(crate::error::ApiError::Http(_))),
            "invalid unified proxy URL should fail: {result:?}"
        );
    }
}
