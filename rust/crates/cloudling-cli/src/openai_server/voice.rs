//! Voice output for the built-in UI ("Speak" under an answer): turn a saved assistant message
//! into speech through any OpenAI-compatible text-to-speech backend and stream the audio back.
//!
//! Split of roles: Cloudling decides *what* is said and *when* — it drops the parts of a message
//! that are not meant to be heard (reasoning / tool / question blocks, code), strips the markdown,
//! cuts the text into sentence groups and paces the requests. The TTS backend decides *how* it
//! sounds. Only the standard `POST {base}/audio/speech` is required from the backend; options a
//! particular server understands travel opaquely in `CLOUDLING_TTS_EXTRA` and are dropped again if
//! the server rejects them. Audio reaches the client as raw 16-bit mono PCM
//! (`audio/L16; rate=…`) as soon as the backend produces it, piece after piece.
//!
//! The [`Segmenter`] takes text in parts (`push` … `finish`) so a later live mode can feed it a
//! reply while the model is still writing it; the "Speak" button feeds a whole message at once.
//!
//! Voice input (the microphone button) is the mirror image: the browser records an utterance and
//! posts it to `/ui/transcribe`, Cloudling passes it to any OpenAI-compatible speech-to-text
//! backend (`POST {base}/audio/transcriptions`) and returns the text. Cloudling neither decodes
//! nor converts the audio — the recording goes on in the container the browser produced.

use std::sync::OnceLock;
use std::time::Instant;

use axum::body::{Body, Bytes};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
use serde::Deserialize;
use serde_json::{Map, Value};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

/// The first piece is kept short so the voice starts early, but not shorter than this: a very
/// short input sounds weak on neural TTS models.
const FIRST_PIECE_MIN_CHARS: usize = 40;
/// Later pieces pack whole sentences up to this size (longer input makes TTS models less stable;
/// a single longer sentence is never cut).
const PIECE_MAX_CHARS: usize = 400;
const PAUSE_BETWEEN_PIECES_SECS: f32 = 0.2;
const PAUSE_BETWEEN_PARAGRAPHS_SECS: f32 = 0.5;
/// OpenAI's `pcm` contract: 24 kHz, 16-bit, mono, no header — assumed when the backend does not
/// state its rate.
const DEFAULT_PCM_RATE: u32 = 24_000;
/// A WAV header bigger than this without reaching the `data` chunk is treated as broken.
const MAX_WAV_HEADER_BYTES: usize = 64 * 1024;

/// TTS backend settings, read from the environment per request so a UI "Save" applies live.
#[derive(Debug, Clone)]
pub(crate) struct TtsConfig {
    base_url: String,
    api_key: String,
    model: String,
    voice: String,
    extra: Map<String, Value>,
}

impl TtsConfig {
    /// `None` when `CLOUDLING_TTS_BASE_URL` is empty — voice output is off.
    pub(crate) fn from_env() -> Option<Self> {
        let get = |key: &str| std::env::var(key).unwrap_or_default().trim().to_string();
        let base_url = get("CLOUDLING_TTS_BASE_URL").trim_end_matches('/').to_string();
        if base_url.is_empty() {
            return None;
        }
        Some(Self {
            base_url,
            api_key: get("CLOUDLING_TTS_API_KEY"),
            model: get("CLOUDLING_TTS_MODEL"),
            voice: get("CLOUDLING_TTS_VOICE"),
            extra: parse_extra(&get("CLOUDLING_TTS_EXTRA")),
        })
    }
}

/// `CLOUDLING_TTS_EXTRA`: `key=value` pairs separated by commas or semicolons, added to every
/// speech request (e.g. `stream=true, stream_mode=model, sample_rate=48000`). Deliberately not
/// JSON: the env file is also read by systemd (`EnvironmentFile`), which strips double quotes
/// inside values. `true`/`false` become booleans, numbers become numbers, the rest strings.
pub(crate) fn parse_extra(raw: &str) -> Map<String, Value> {
    let mut map = Map::new();
    for pair in raw.split([',', ';']) {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        let (key, value) = (key.trim(), value.trim());
        if key.is_empty() {
            continue;
        }
        let parsed = match value {
            "true" => Value::Bool(true),
            "false" => Value::Bool(false),
            _ => {
                if let Ok(int) = value.parse::<i64>() {
                    Value::from(int)
                } else if let Some(num) = value
                    .parse::<f64>()
                    .ok()
                    .filter(|n| n.is_finite())
                    .and_then(serde_json::Number::from_f64)
                {
                    Value::Number(num)
                } else {
                    Value::String(value.to_string())
                }
            }
        };
        map.insert(key.to_string(), parsed);
    }
    map
}

// ---------------------------------------------------------------------------------------------
// What is spoken: a saved message → plain text
// ---------------------------------------------------------------------------------------------

/// Text of a saved assistant message as it should be heard: `<details>` blocks (reasoning, tool
/// calls, questions) and code are dropped, markdown is stripped, links keep their text, bare URLs
/// are dropped, list items / headings / table rows become sentences. Paragraphs stay separated
/// by a blank line; text written between tool calls stays (it is part of what the agent says).
pub(crate) fn speakable_text(markup: &str) -> String {
    static URL: OnceLock<regex::Regex> = OnceLock::new();
    let url = URL.get_or_init(|| {
        regex::Regex::new(r"(?i)\b(?:https?://|www\.)\S+").expect("static URL regex is valid")
    });
    let plain = markdown_to_speech(&strip_details_blocks(markup));
    let plain = url.replace_all(&plain, "");
    let mut paragraphs = Vec::new();
    for para in plain.split("\n\n") {
        let lines: Vec<String> = para
            .lines()
            .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
            .filter(|line| !line.is_empty() && line.chars().any(char::is_alphanumeric))
            .collect();
        if !lines.is_empty() {
            paragraphs.push(lines.join("\n"));
        }
    }
    paragraphs.join("\n\n")
}

/// Remove every `<details …>…</details>` block (nesting-aware); an unclosed block runs to the end.
/// The gap becomes a paragraph break, so the text before and after a tool call stay apart.
fn strip_details_blocks(text: &str) -> String {
    // ASCII lowercasing keeps byte offsets identical, so indices into `lower` are valid in `text`.
    let lower = text.to_ascii_lowercase();
    let mut out = String::with_capacity(text.len());
    let (mut depth, mut i, mut keep_from) = (0usize, 0usize, 0usize);
    while i < text.len() {
        if lower[i..].starts_with("<details") {
            if depth == 0 {
                out.push_str(&text[keep_from..i]);
            }
            depth += 1;
            i += "<details".len();
        } else if depth > 0 && lower[i..].starts_with("</details>") {
            depth -= 1;
            i += "</details>".len();
            if depth == 0 {
                out.push_str("\n\n");
                keep_from = i;
            }
        } else {
            i += text[i..].chars().next().map_or(1, char::len_utf8);
        }
    }
    if depth == 0 {
        out.push_str(&text[keep_from..]);
    }
    out
}

fn markdown_to_speech(markdown: &str) -> String {
    let mut out = String::new();
    let mut skip = 0usize; // inside a code block or an image
    let options = Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH;
    for event in Parser::new_ext(markdown, options) {
        match event {
            Event::Start(Tag::CodeBlock(_) | Tag::Image { .. }) => skip += 1,
            Event::End(TagEnd::CodeBlock | TagEnd::Image) => skip = skip.saturating_sub(1),
            _ if skip > 0 => {}
            Event::Text(text) | Event::Code(text) => out.push_str(&text),
            Event::SoftBreak => out.push(' '),
            Event::HardBreak => out.push('\n'),
            Event::End(TagEnd::TableCell) => out.push_str(", "),
            Event::End(TagEnd::Item | TagEnd::TableRow | TagEnd::TableHead) => end_line(&mut out),
            Event::End(
                TagEnd::Paragraph
                | TagEnd::Heading(..)
                | TagEnd::BlockQuote(..)
                | TagEnd::List(..)
                | TagEnd::Table,
            ) => end_block(&mut out),
            _ => {}
        }
    }
    out
}

/// Close the current sentence: drop trailing spaces/commas, add a full stop unless the text
/// already ends with sentence punctuation (headings, list items, table rows are read as
/// sentences — the voice then stops between them).
fn close_sentence(out: &mut String) {
    let kept = out
        .trim_end_matches(|c: char| c.is_whitespace() || c == ',')
        .len();
    out.truncate(kept);
    if let Some(last) = out.chars().last() {
        if !matches!(last, '.' | '!' | '?' | '…' | ':' | ';') {
            out.push('.');
        }
    }
}

fn end_line(out: &mut String) {
    close_sentence(out);
    if !out.is_empty() {
        out.push('\n');
    }
}

fn end_block(out: &mut String) {
    close_sentence(out);
    if !out.is_empty() {
        out.push_str("\n\n");
    }
}

// ---------------------------------------------------------------------------------------------
// When it is spoken: plain text → pieces for the TTS backend
// ---------------------------------------------------------------------------------------------

/// One request's worth of text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Piece {
    pub(crate) text: String,
    /// Starts a new paragraph (a longer pause before it).
    pub(crate) new_paragraph: bool,
}

/// Cuts speakable text into pieces: the first is short (sentences up to at least
/// `first_min` characters), the next ones pack whole sentences up to `max_chars`, and no piece
/// crosses a paragraph. Text may arrive in parts; until [`Segmenter::finish`] only sentences that
/// are surely complete are handed out — an unsure boundary ("т. е.", "г.", initials) is not cut.
pub(crate) struct Segmenter {
    buf: String,
    finished: bool,
    handed_any: bool,
    paragraph_pending: bool,
    first_min: usize,
    max_chars: usize,
}

impl Segmenter {
    pub(crate) fn new(first_min: usize, max_chars: usize) -> Self {
        Self {
            buf: String::new(),
            finished: false,
            handed_any: false,
            paragraph_pending: false,
            first_min,
            max_chars,
        }
    }

    pub(crate) fn push(&mut self, text: &str) {
        self.buf.push_str(text);
    }

    pub(crate) fn finish(&mut self) {
        self.finished = true;
    }

    /// The next piece ready to be spoken, or `None` (nothing complete yet / all handed out).
    pub(crate) fn next_piece(&mut self) -> Option<Piece> {
        loop {
            let lead = self.buf.len() - self.buf.trim_start().len();
            if lead > 0 {
                if self.handed_any && self.buf[..lead].matches('\n').count() >= 2 {
                    self.paragraph_pending = true;
                }
                self.buf.drain(..lead);
            }
            if self.buf.is_empty() {
                return None;
            }
            let para_end = self.buf.find("\n\n");
            let para_complete = para_end.is_some() || self.finished;
            let para = &self.buf[..para_end.unwrap_or(self.buf.len())];
            let ends = sentence_ends(para, para_complete);
            let cut = self.choose_cut(para, &ends, para_complete)?;
            let text = self.buf[..cut].trim().to_string();
            self.buf.drain(..cut);
            if text.is_empty() {
                continue;
            }
            self.handed_any = true;
            return Some(Piece {
                text,
                new_paragraph: std::mem::take(&mut self.paragraph_pending),
            });
        }
    }

    fn choose_cut(&self, para: &str, ends: &[usize], para_complete: bool) -> Option<usize> {
        let first = *ends.first()?;
        let chars_to = |end: usize| para[..end].chars().count();
        if !self.handed_any {
            // the first piece: the shortest run of sentences that reaches `first_min`
            if let Some(&end) = ends.iter().find(|&&end| chars_to(end) >= self.first_min) {
                return Some(end);
            }
            return para_complete.then(|| *ends.last().unwrap_or(&first));
        }
        // later pieces: as many whole sentences as fit, at least one
        Some(
            ends.iter()
                .copied()
                .take_while(|&end| chars_to(end) <= self.max_chars)
                .last()
                .unwrap_or(first),
        )
    }
}

/// Byte offsets just past each sentence end in `text` (terminal punctuation plus closing quotes /
/// brackets). A boundary needs whitespace after it and a next word that does not start in lower
/// case; after a single "." it must not follow an abbreviation, an initial or a list number. The
/// end of the text counts only when the text is complete.
fn sentence_ends(text: &str, complete: bool) -> Vec<usize> {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let mut ends = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if !matches!(chars[i].1, '.' | '!' | '?' | '…') {
            i += 1;
            continue;
        }
        let mut j = i + 1;
        while j < chars.len() && matches!(chars[j].1, '.' | '!' | '?' | '…') {
            j += 1;
        }
        let single_dot = j == i + 1 && chars[i].1 == '.';
        while j < chars.len() && matches!(chars[j].1, '»' | '"' | '\'' | ')' | ']' | '”' | '’') {
            j += 1;
        }
        if j >= chars.len() {
            break; // at the very end — handled below
        }
        if !chars[j].1.is_whitespace() {
            i = j; // "0.5", "т.е", "file.txt": not an end
            continue;
        }
        let end = chars[j].0;
        let mut k = j;
        while k < chars.len() && chars[k].1.is_whitespace() {
            k += 1;
        }
        if k >= chars.len() {
            break; // only whitespace follows — the next word is not known yet
        }
        let next = chars[k].1;
        let unsure = next.is_lowercase() || (single_dot && is_abbreviation_before(text, chars[i].0));
        if !unsure {
            ends.push(end);
        }
        i = j;
    }
    if complete && !text.trim().is_empty() && ends.last() != Some(&text.len()) {
        ends.push(text.len());
    }
    ends
}

/// Whether the "." at byte `dot` ends a known abbreviation, an initial ("А. С."), a single
/// lower-case letter ("т. е.", "г.") or a number at the start of a line (a list marker).
fn is_abbreviation_before(text: &str, dot: usize) -> bool {
    const ABBREVIATIONS: &[&str] = &[
        "см", "напр", "др", "пр", "стр", "рис", "табл", "гл", "гг", "вв", "ул", "пл", "пер", "им",
        "тыс", "млн", "млрд", "руб", "коп", "мин", "сек", "проф", "акад", "доц", "ок", "св", "ср",
        "ред", "изд", "англ", "рус", "лат", "etc", "vs", "mr", "mrs", "ms", "dr", "st", "no",
    ];
    let before = &text[..dot];
    let word: String = before
        .chars()
        .rev()
        .take_while(|c| c.is_alphanumeric())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    if word.is_empty() {
        return false;
    }
    if word.chars().all(|c| c.is_ascii_digit()) {
        let line_start = before[..before.len() - word.len()].trim_end_matches([' ', '\t']);
        return line_start.is_empty() || line_start.ends_with('\n');
    }
    if word.chars().count() == 1 {
        return true;
    }
    ABBREVIATIONS.contains(&word.to_lowercase().as_str())
}

// ---------------------------------------------------------------------------------------------
// The TTS backend
// ---------------------------------------------------------------------------------------------

/// Talks to the TTS backend for one utterance. Remembers what the backend refused (the extra
/// fields, the `pcm` format) so later pieces do not repeat a failing request.
#[derive(Clone)]
struct TtsSession {
    config: TtsConfig,
    client: reqwest::Client,
    use_extra: bool,
    format: &'static str,
}

/// A started speech response: the PCM rate, any audio bytes already read (behind a WAV header),
/// and the rest of the body still to be read.
struct TtsAudio {
    rate: u32,
    pending: Vec<u8>,
    response: reqwest::Response,
}

impl TtsSession {
    fn new(config: TtsConfig, client: reqwest::Client) -> Self {
        let use_extra = !config.extra.is_empty();
        Self {
            config,
            client,
            use_extra,
            format: "pcm",
        }
    }

    fn body(&self, text: &str) -> Value {
        let mut body = if self.use_extra {
            self.config.extra.clone()
        } else {
            Map::new()
        };
        body.insert("input".into(), Value::from(text));
        body.insert("response_format".into(), Value::from(self.format));
        if !self.config.model.is_empty() {
            body.insert("model".into(), Value::from(self.config.model.as_str()));
        }
        if !self.config.voice.is_empty() {
            body.insert("voice".into(), Value::from(self.config.voice.as_str()));
        }
        Value::Object(body)
    }

    /// Ask for speech; on a "bad request" answer retry once without the extra fields, then once
    /// with `wav` instead of `pcm` — any OpenAI-compatible server is reachable this way.
    async fn request(&mut self, text: &str) -> Result<TtsAudio, String> {
        loop {
            let mut request = self
                .client
                .post(format!("{}/audio/speech", self.config.base_url))
                .json(&self.body(text));
            if !self.config.api_key.is_empty() {
                request = request.bearer_auth(&self.config.api_key);
            }
            let response = request
                .send()
                .await
                .map_err(|error| format!("TTS backend unreachable: {error}"))?;
            let status = response.status().as_u16();
            if (200..300).contains(&status) {
                return self.start_audio(response).await;
            }
            let detail = response.text().await.unwrap_or_default();
            let rejected = status == 400 || status == 422;
            if rejected && self.use_extra {
                eprintln!(
                    "cloudling openai-serve: speak: TTS rejected the request (HTTP {status}); \
                     retrying without CLOUDLING_TTS_EXTRA"
                );
                self.use_extra = false;
                continue;
            }
            if rejected && self.format == "pcm" {
                eprintln!(
                    "cloudling openai-serve: speak: TTS rejected pcm (HTTP {status}); retrying with wav"
                );
                self.format = "wav";
                continue;
            }
            let detail: String = detail.chars().take(300).collect();
            return Err(format!("TTS backend answered HTTP {status}: {detail}"));
        }
    }

    async fn start_audio(&self, mut response: reqwest::Response) -> Result<TtsAudio, String> {
        if self.format == "pcm" {
            let rate = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .and_then(rate_from_content_type)
                .unwrap_or(DEFAULT_PCM_RATE);
            return Ok(TtsAudio {
                rate,
                pending: Vec::new(),
                response,
            });
        }
        // WAV: read until the header is complete, keep the audio bytes that came with it
        let mut buf = Vec::new();
        loop {
            match parse_wav_header(&buf)? {
                Some((rate, data_at)) => {
                    return Ok(TtsAudio {
                        rate,
                        pending: buf.split_off(data_at),
                        response,
                    })
                }
                None if buf.len() > MAX_WAV_HEADER_BYTES => {
                    return Err("TTS backend sent a WAV header that never ends".into())
                }
                None => match response.chunk().await {
                    Ok(Some(bytes)) => buf.extend_from_slice(&bytes),
                    Ok(None) => return Err("TTS backend sent an incomplete WAV header".into()),
                    Err(error) => return Err(format!("TTS backend stream failed: {error}")),
                },
            }
        }
    }
}

/// `audio/L16; rate=48000; channels=1` → 48000.
fn rate_from_content_type(value: &str) -> Option<u32> {
    value.split(';').find_map(|param| {
        let (key, val) = param.split_once('=')?;
        if key.trim().eq_ignore_ascii_case("rate") {
            val.trim().parse().ok()
        } else {
            None
        }
    })
}

/// `Ok(Some((rate, offset of the audio data)))` once the header is complete, `Ok(None)` when more
/// bytes are needed, `Err` for a WAV this path cannot pass on (only 16-bit mono PCM is).
fn parse_wav_header(buf: &[u8]) -> Result<Option<(u32, usize)>, String> {
    if buf.len() < 12 {
        return Ok(None);
    }
    if &buf[0..4] != b"RIFF" || &buf[8..12] != b"WAVE" {
        return Err("TTS backend answer is not a WAV stream".into());
    }
    let mut pos = 12;
    let mut rate = None;
    loop {
        if buf.len() < pos + 8 {
            return Ok(None);
        }
        let id = &buf[pos..pos + 4];
        let size = u32::from_le_bytes([buf[pos + 4], buf[pos + 5], buf[pos + 6], buf[pos + 7]]);
        let size = usize::try_from(size).unwrap_or(usize::MAX);
        if id == b"data" {
            let rate = rate.ok_or("TTS backend WAV has no fmt chunk before the data")?;
            return Ok(Some((rate, pos + 8)));
        }
        if id == b"fmt " {
            if buf.len() < pos + 8 + 16 {
                return Ok(None);
            }
            let fmt = &buf[pos + 8..pos + 24];
            let format = u16::from_le_bytes([fmt[0], fmt[1]]);
            let channels = u16::from_le_bytes([fmt[2], fmt[3]]);
            let sample_rate = u32::from_le_bytes([fmt[4], fmt[5], fmt[6], fmt[7]]);
            let bits = u16::from_le_bytes([fmt[14], fmt[15]]);
            if !(format == 1 || format == 0xFFFE) || channels != 1 || bits != 16 {
                return Err(format!(
                    "TTS backend WAV is not 16-bit mono PCM (format {format}, {channels} ch, {bits} bit)"
                ));
            }
            rate = Some(sample_rate);
        }
        pos = pos
            .saturating_add(8)
            .saturating_add(size)
            .saturating_add(size & 1);
    }
}

fn silence(rate: u32, secs: f32) -> Bytes {
    // whole samples only, so the 16-bit stream stays aligned
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss, clippy::cast_precision_loss)]
    let samples = (rate as f32 * secs) as usize;
    Bytes::from(vec![0u8; samples * 2])
}

type AudioSender = mpsc::Sender<Result<Bytes, std::io::Error>>;

/// Forward one speech response to the client. `Err` when the client went away (the dropped
/// response then closes the connection to the TTS backend, which stops generating) or the
/// backend stream broke. `first_audio` is set when the first audio bytes of the utterance go out.
async fn pump(
    mut audio: TtsAudio,
    tx: &AudioSender,
    first_audio: &mut Option<Instant>,
) -> Result<u64, ()> {
    let mut sent = 0u64;
    if !audio.pending.is_empty() {
        sent += audio.pending.len() as u64;
        first_audio.get_or_insert_with(Instant::now);
        tx.send(Ok(Bytes::from(std::mem::take(&mut audio.pending))))
            .await
            .map_err(|_| ())?;
    }
    loop {
        match audio.response.chunk().await {
            Ok(Some(bytes)) => {
                if !bytes.is_empty() {
                    first_audio.get_or_insert_with(Instant::now);
                }
                sent += bytes.len() as u64;
                tx.send(Ok(bytes)).await.map_err(|_| ())?;
            }
            Ok(None) => return Ok(sent),
            Err(error) => {
                eprintln!("cloudling openai-serve: speak: TTS stream broke: {error}");
                return Err(());
            }
        }
    }
}

#[derive(Deserialize)]
pub(super) struct SpeakRequest {
    text: String,
}

/// `POST /ui/speak {text}` → the message as speech, streamed (`audio/L16; rate=…; channels=1`).
/// The first piece is requested before answering, so a backend error comes back as a readable
/// HTTP error instead of an empty stream. When the client disconnects the remaining pieces are
/// dropped and the open backend request is closed.
pub(super) async fn ui_speak(Json(request): Json<SpeakRequest>) -> Response {
    let Some(config) = TtsConfig::from_env() else {
        return (
            StatusCode::CONFLICT,
            "voice output is not configured (CLOUDLING_TTS_BASE_URL is empty)",
        )
            .into_response();
    };
    let text = speakable_text(&request.text);
    let chars = text.chars().count();
    let mut segmenter = Segmenter::new(FIRST_PIECE_MIN_CHARS, PIECE_MAX_CHARS);
    segmenter.push(&text);
    segmenter.finish();
    let Some(first) = segmenter.next_piece() else {
        return (StatusCode::BAD_REQUEST, "nothing to speak in this message").into_response();
    };
    let started = Instant::now();
    let mut session = TtsSession::new(config, api::build_http_client_or_default());
    let audio = match session.request(&first.text).await {
        Ok(audio) => audio,
        Err(error) => {
            eprintln!("cloudling openai-serve: speak: {error}");
            return (StatusCode::BAD_GATEWAY, error).into_response();
        }
    };
    let rate = audio.rate;
    let (tx, rx) = mpsc::channel::<Result<Bytes, std::io::Error>>(32);
    tokio::spawn(async move {
        let mut pieces = 1usize;
        let mut bytes = 0u64;
        let mut first_audio = None;
        let mut current = audio;
        let mut prefetch: Option<(Piece, tokio::task::JoinHandle<_>)> = None;
        let status = loop {
            // Ask for the next piece while this one plays, so the backend starts on it right
            // away (a backend that serialises its GPU work queues it behind the current one).
            if let Some(piece) = segmenter.next_piece() {
                let mut ahead = session.clone();
                let text = piece.text.clone();
                prefetch = Some((
                    piece,
                    tokio::spawn(async move {
                        let result = ahead.request(&text).await;
                        (ahead, result)
                    }),
                ));
            }
            match pump(current, &tx, &mut first_audio).await {
                Ok(sent) => bytes += sent,
                Err(()) => break "stopped",
            }
            let Some((piece, handle)) = prefetch.take() else {
                break "done";
            };
            let pause = if piece.new_paragraph {
                PAUSE_BETWEEN_PARAGRAPHS_SECS
            } else {
                PAUSE_BETWEEN_PIECES_SECS
            };
            if tx.send(Ok(silence(rate, pause))).await.is_err() {
                handle.abort();
                break "stopped";
            }
            let next = match handle.await {
                Ok((learned, Ok(next))) => {
                    session = learned;
                    next
                }
                Ok((_, Err(error))) => {
                    eprintln!("cloudling openai-serve: speak: {error}");
                    break "TTS error";
                }
                Err(error) => {
                    eprintln!("cloudling openai-serve: speak: TTS request task failed: {error}");
                    break "TTS error";
                }
            };
            if next.rate != rate {
                eprintln!(
                    "cloudling openai-serve: speak: TTS changed its rate mid-utterance ({rate} → {})",
                    next.rate
                );
                break "rate changed";
            }
            pieces += 1;
            current = next;
        };
        if let Some((_, handle)) = prefetch {
            handle.abort(); // the client left: drop the request already sent for the next piece
        }
        #[allow(clippy::cast_precision_loss)]
        let secs = bytes as f64 / 2.0 / f64::from(rate);
        let first = first_audio.map_or_else(
            || "-".to_string(),
            |at: Instant| format!("{} ms", at.duration_since(started).as_millis()),
        );
        eprintln!(
            "cloudling openai-serve: speak: {chars} chars, {pieces} piece(s), {secs:.1}s audio at {rate} Hz, \
             first audio after {first}, {status}"
        );
    });
    Response::builder()
        .header(header::CONTENT_TYPE, format!("audio/L16; rate={rate}; channels=1"))
        .header(header::CACHE_CONTROL, "no-store")
        .body(Body::from_stream(ReceiverStream::new(rx)))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

// ---------------------------------------------------------------------------------------------
// Voice input: a recorded utterance → text
// ---------------------------------------------------------------------------------------------

/// Largest recording `/ui/transcribe` accepts (the route's body limit). 25 MB is also the cap of
/// OpenAI's own transcription endpoint, so a compatible backend is not expected to take more.
pub(super) const MAX_TRANSCRIBE_BYTES: usize = 25 * 1024 * 1024;

/// STT backend settings, read from the environment per request so a UI "Save" applies live.
#[derive(Debug, Clone)]
pub(crate) struct SttConfig {
    base_url: String,
    api_key: String,
    model: String,
    extra: Map<String, Value>,
}

impl SttConfig {
    /// `None` when `CLOUDLING_STT_BASE_URL` is empty — voice input is off.
    pub(crate) fn from_env() -> Option<Self> {
        let get = |key: &str| std::env::var(key).unwrap_or_default().trim().to_string();
        let base_url = get("CLOUDLING_STT_BASE_URL").trim_end_matches('/').to_string();
        if base_url.is_empty() {
            return None;
        }
        Some(Self {
            base_url,
            api_key: get("CLOUDLING_STT_API_KEY"),
            model: get("CLOUDLING_STT_MODEL"),
            // same `key=value` list as `CLOUDLING_TTS_EXTRA` (e.g. `language=ru`)
            extra: parse_extra(&get("CLOUDLING_STT_EXTRA")),
        })
    }

    /// The text fields of the transcription form: the model (when set) and, unless the backend
    /// has refused them, the extra fields.
    fn form_fields(&self, with_extra: bool) -> Vec<(String, String)> {
        let mut fields = Vec::new();
        if !self.model.is_empty() {
            fields.push(("model".to_string(), self.model.clone()));
        }
        if with_extra {
            for (key, value) in &self.extra {
                let value = match value {
                    Value::String(text) => text.clone(),
                    other => other.to_string(),
                };
                fields.push((key.clone(), value));
            }
        }
        fields
    }
}

/// File name for the uploaded recording. The media type the browser recorded in decides the
/// extension: OpenAI-compatible backends tell the container by it.
fn recording_file_name(content_type: &str) -> &'static str {
    let essence = content_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    match essence.as_str() {
        "audio/webm" | "video/webm" => "audio.webm",
        "audio/ogg" | "application/ogg" => "audio.ogg",
        "audio/mp4" | "audio/m4a" | "audio/x-m4a" | "audio/aac" | "video/mp4" => "audio.mp4",
        "audio/wav" | "audio/x-wav" | "audio/wave" => "audio.wav",
        "audio/mpeg" | "audio/mp3" => "audio.mp3",
        "audio/flac" | "audio/x-flac" => "audio.flac",
        _ => "audio.bin",
    }
}

/// A boundary that does not occur in the recording (a multipart body is cut at its boundary).
fn multipart_boundary(audio: &[u8]) -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |since| since.as_nanos());
    let mut attempt = 0u32;
    loop {
        let boundary = format!("cloudling-{nanos:032x}-{attempt}");
        let needle = boundary.as_bytes();
        if !audio.windows(needle.len()).any(|window| window == needle) {
            return boundary;
        }
        attempt += 1;
    }
}

/// `multipart/form-data` body of a transcription request: the text fields, then the recording as
/// the `file` part. Built by hand — it is a few lines, and the `multipart` feature of the HTTP
/// client would add third-party crates for nothing else. Field names and values come from the
/// settings; control characters and quotes that would break a part header are dropped.
fn multipart_body(
    boundary: &str,
    fields: &[(String, String)],
    file_name: &str,
    content_type: &str,
    audio: &[u8],
) -> Vec<u8> {
    let header_safe = |text: &str| -> String {
        text.chars()
            .filter(|ch| !ch.is_control() && *ch != '"')
            .collect()
    };
    let mut body = Vec::with_capacity(audio.len() + 1024);
    for (name, value) in fields {
        let name = header_safe(name);
        if name.is_empty() {
            continue;
        }
        body.extend_from_slice(
            format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{}\r\n",
                value.replace(['\r', '\n'], " ")
            )
            .as_bytes(),
        );
    }
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{}\"\r\n\
             Content-Type: {}\r\n\r\n",
            header_safe(file_name),
            header_safe(content_type)
        )
        .as_bytes(),
    );
    body.extend_from_slice(audio);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

/// The recognised text of a backend answer: the `text` field of the JSON answer, or the body as
/// it is when the backend answered with plain text.
fn transcript_from_answer(answer: &str) -> Result<String, String> {
    match serde_json::from_str::<Value>(answer) {
        Ok(Value::Object(map)) => match map.get("text") {
            Some(Value::String(text)) => Ok(text.trim().to_string()),
            _ => Err("STT backend answer has no `text` field".into()),
        },
        Ok(Value::String(text)) => Ok(text.trim().to_string()),
        Ok(_) => Err("STT backend answer is not a transcription".into()),
        Err(_) => Ok(answer.trim().to_string()),
    }
}

/// Send the recording to the STT backend; on a "bad request" answer retry once without the extra
/// fields (same rule as for speech), so a setting one backend needs does not break another.
async fn transcribe(
    config: &SttConfig,
    client: &reqwest::Client,
    content_type: &str,
    audio: &[u8],
) -> Result<String, String> {
    let mut with_extra = !config.extra.is_empty();
    loop {
        let boundary = multipart_boundary(audio);
        let body = multipart_body(
            &boundary,
            &config.form_fields(with_extra),
            recording_file_name(content_type),
            content_type,
            audio,
        );
        let mut request = client
            .post(format!("{}/audio/transcriptions", config.base_url))
            .header(
                reqwest::header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(body);
        if !config.api_key.is_empty() {
            request = request.bearer_auth(&config.api_key);
        }
        let response = request
            .send()
            .await
            .map_err(|error| format!("STT backend unreachable: {error}"))?;
        let status = response.status().as_u16();
        let answer = response
            .text()
            .await
            .map_err(|error| format!("STT backend answer could not be read: {error}"))?;
        if (200..300).contains(&status) {
            return transcript_from_answer(&answer);
        }
        if (status == 400 || status == 422) && with_extra {
            eprintln!(
                "cloudling openai-serve: transcribe: STT rejected the request (HTTP {status}); \
                 retrying without CLOUDLING_STT_EXTRA"
            );
            with_extra = false;
            continue;
        }
        let detail: String = answer.chars().take(300).collect();
        return Err(format!("STT backend answered HTTP {status}: {detail}"));
    }
}

/// `POST /ui/transcribe` — body: the recording as the browser produced it, `Content-Type`: its
/// media type → `{"text": "…"}`. An empty `text` means the backend heard no speech.
pub(super) async fn ui_transcribe(headers: HeaderMap, audio: Bytes) -> Response {
    let Some(config) = SttConfig::from_env() else {
        return (
            StatusCode::CONFLICT,
            "voice input is not configured (CLOUDLING_STT_BASE_URL is empty)",
        )
            .into_response();
    };
    if audio.is_empty() {
        return (StatusCode::BAD_REQUEST, "the recording is empty").into_response();
    }
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("application/octet-stream");
    let started = Instant::now();
    let client = api::build_http_client_or_default();
    match transcribe(&config, &client, content_type, &audio).await {
        Ok(text) => {
            eprintln!(
                "cloudling openai-serve: transcribe: {} bytes of {content_type} → {} chars in {} ms",
                audio.len(),
                text.chars().count(),
                started.elapsed().as_millis()
            );
            Json(serde_json::json!({ "text": text })).into_response()
        }
        Err(error) => {
            eprintln!("cloudling openai-serve: transcribe: {error}");
            (StatusCode::BAD_GATEWAY, error).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pieces(text: &str) -> Vec<Piece> {
        let mut seg = Segmenter::new(FIRST_PIECE_MIN_CHARS, PIECE_MAX_CHARS);
        seg.push(text);
        seg.finish();
        std::iter::from_fn(|| seg.next_piece()).collect()
    }

    #[test]
    fn speakable_text_drops_blocks_code_and_markup() {
        let saved = "Сейчас посмотрю логи.\n<details type=\"tool_calls\" done=\"true\" id=\"1\" name=\"bash\" arguments=\"x\">\n<summary>bash</summary>\nвывод с точками. И ещё.\n</details>\n\
                     **Готово**: сервис [перезапущен](https://example.org/x) и работает, см. https://example.org.\n\n\
                     ```bash\nsystemctl restart x\n```\n\n## Итоги\n- первый пункт\n- второй пункт";
        let text = speakable_text(saved);
        assert!(text.starts_with("Сейчас посмотрю логи."), "{text}");
        assert!(!text.contains("вывод"), "{text}");
        assert!(!text.contains("systemctl"), "{text}");
        assert!(!text.contains("http"), "{text}");
        assert!(!text.contains('*'), "{text}");
        assert!(text.contains("Готово: сервис перезапущен и работает"), "{text}");
        assert!(text.contains("Итоги."), "{text}");
        assert!(text.contains("первый пункт.\nвторой пункт."), "{text}");
        assert!(text.contains("\n\n"), "paragraphs stay apart: {text}");
    }

    #[test]
    fn speakable_text_handles_reasoning_and_unclosed_blocks() {
        let saved = "<details type=\"reasoning\" done=\"true\">\n<summary>Reasoning</summary>\nдумаю\n</details>\nОтвет здесь.\n<details type=\"reasoning\" done=\"false\">\nнедописано";
        assert_eq!(speakable_text(saved), "Ответ здесь.");
        assert_eq!(speakable_text("```\nтолько код\n```"), "");
        assert_eq!(speakable_text("Inline `cloudling` works"), "Inline cloudling works.");
    }

    #[test]
    fn first_piece_is_short_and_later_pieces_are_packed() {
        let text = "Привет! Я Кора. Готова помочь с домашней инфраструктурой и заметками. \
                    Что нужно сделать? Могу начать с разведки. Менять ничего не буду без команды.";
        let got = pieces(text);
        assert_eq!(got[0].text, "Привет! Я Кора. Готова помочь с домашней инфраструктурой и заметками.");
        assert_eq!(got.len(), 2, "{got:?}");
        assert!(got[1].text.starts_with("Что нужно сделать?"));
        assert!(!got[1].new_paragraph);
    }

    #[test]
    fn short_text_is_one_piece() {
        assert_eq!(pieces("Готово."), vec![Piece { text: "Готово.".into(), new_paragraph: false }]);
        assert!(pieces("   \n\n ").is_empty());
    }

    #[test]
    fn paragraphs_split_pieces_and_mark_the_pause() {
        let got = pieces("Первый абзац достаточно длинный, чтобы стать куском.\n\nВторой абзац.");
        assert_eq!(got.len(), 2);
        assert!(!got[0].new_paragraph);
        assert_eq!(got[1], Piece { text: "Второй абзац.".into(), new_paragraph: true });
    }

    #[test]
    fn abbreviations_initials_and_numbers_are_not_cut() {
        let ends = |s: &str| {
            sentence_ends(s, false)
                .into_iter()
                .map(|e| s[..e].trim().to_string())
                .collect::<Vec<_>>()
        };
        assert!(ends("Это т. е. пример. Дальше").last().unwrap().ends_with("пример."));
        assert_eq!(ends("Было в 1914 г. Потом пришло. Ещё"), vec!["Было в 1914 г. Потом пришло."]);
        assert_eq!(ends("Писал А. С. Пушкин. Далее"), vec!["Писал А. С. Пушкин."]);
        assert_eq!(ends("Цена 0.5 руб. за штуку. Да"), vec!["Цена 0.5 руб. за штуку."]);
        assert_eq!(ends("Список:\n1. Первый. Второй"), vec!["Список:\n1. Первый."]);
        assert_eq!(ends("Закончили в 2024. Потом"), vec!["Закончили в 2024."]);
        assert_eq!(ends("Он сказал «да». Потом"), vec!["Он сказал «да»."]);
        assert_eq!(ends("Правда? нет, не правда. Итак"), vec!["Правда? нет, не правда."]);
        assert_eq!(ends("Ждём... Готово! Ещё"), vec!["Ждём...", "Ждём... Готово!"]);
    }

    #[test]
    fn incremental_text_waits_for_sure_boundaries() {
        let mut seg = Segmenter::new(10, PIECE_MAX_CHARS);
        seg.push("Первое предложение готово. Второе ещё пиш");
        assert_eq!(seg.next_piece().unwrap().text, "Первое предложение готово.");
        assert_eq!(seg.next_piece(), None, "an unfinished sentence waits");
        seg.push("ется, т.");
        assert_eq!(seg.next_piece(), None, "\"т.\" may be an abbreviation");
        seg.push(" е. дописано. Тре");
        assert_eq!(seg.next_piece().unwrap().text, "Второе ещё пишется, т. е. дописано.");
        seg.push("тье.");
        assert_eq!(seg.next_piece(), None, "the end of the buffer is not a sure end");
        seg.finish();
        assert_eq!(seg.next_piece().unwrap().text, "Третье.");
        assert_eq!(seg.next_piece(), None);
    }

    #[test]
    fn a_long_sentence_is_never_cut() {
        let long = format!("Слово {} конец.", "слово ".repeat(120));
        let text = format!("Короткое начало для первого куска нашей речи. {long} Хвост.");
        let got = pieces(&text);
        assert_eq!(got.len(), 3, "{got:?}");
        assert!(got[1].text.ends_with("конец."));
    }

    #[test]
    fn extra_fields_parse_without_json() {
        let extra = parse_extra("stream=true, stream_mode=model; sample_rate=48000,speed=1.1,bad,=x");
        assert_eq!(extra.get("stream"), Some(&Value::Bool(true)));
        assert_eq!(extra.get("stream_mode"), Some(&Value::from("model")));
        assert_eq!(extra.get("sample_rate"), Some(&Value::from(48000)));
        assert_eq!(extra.get("speed"), Some(&Value::from(1.1)));
        assert_eq!(extra.len(), 4);
        assert!(parse_extra("").is_empty());
    }

    #[test]
    fn content_type_rate_and_wav_header() {
        assert_eq!(rate_from_content_type("audio/L16; rate=48000; channels=1"), Some(48000));
        assert_eq!(rate_from_content_type("audio/pcm"), None);
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF\xff\xff\xff\xffWAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&24000u32.to_le_bytes());
        wav.extend_from_slice(&48000u32.to_le_bytes());
        wav.extend_from_slice(&2u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        assert_eq!(parse_wav_header(&wav).unwrap(), None, "needs the data chunk");
        wav.extend_from_slice(b"data\xff\xff\xff\xff\x01\x00");
        assert_eq!(parse_wav_header(&wav).unwrap(), Some((24000, 44)));
        assert!(parse_wav_header(b"ID3\x04\x00\x00\x00\x00\x00\x00\x00\x00").is_err());
    }

    #[test]
    fn recording_is_named_by_its_media_type() {
        assert_eq!(recording_file_name("audio/webm;codecs=opus"), "audio.webm");
        assert_eq!(recording_file_name("Audio/OGG; codecs=opus"), "audio.ogg");
        assert_eq!(recording_file_name("audio/mp4"), "audio.mp4");
        assert_eq!(recording_file_name("audio/wav"), "audio.wav");
        assert_eq!(recording_file_name("application/octet-stream"), "audio.bin");
        assert_eq!(recording_file_name(""), "audio.bin");
    }

    #[test]
    fn multipart_body_carries_fields_then_the_recording() {
        let audio = b"\x1aE\xdf\xa3 not text \r\n--x";
        let boundary = multipart_boundary(audio);
        assert!(!audio.windows(boundary.len()).any(|w| w == boundary.as_bytes()));
        let fields = vec![
            ("model".to_string(), "stt-1".to_string()),
            ("lang\"uage\r\n".to_string(), "r\nu".to_string()),
        ];
        let body = multipart_body(&boundary, &fields, "audio.webm", "audio/webm;codecs=opus", audio);
        let head = format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"model\"\r\n\r\nstt-1\r\n\
             --{boundary}\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nr u\r\n\
             --{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"audio.webm\"\r\n\
             Content-Type: audio/webm;codecs=opus\r\n\r\n"
        );
        let tail = format!("\r\n--{boundary}--\r\n");
        assert!(body.starts_with(head.as_bytes()));
        assert!(body.ends_with(tail.as_bytes()));
        assert_eq!(&body[head.len()..body.len() - tail.len()], audio);
    }

    #[test]
    fn transcript_is_read_from_json_or_plain_text() {
        assert_eq!(transcript_from_answer("{\"text\": \" Привет. \"}").unwrap(), "Привет.");
        assert_eq!(transcript_from_answer("{\"text\":\"\"}").unwrap(), "");
        assert_eq!(transcript_from_answer("Привет.\n").unwrap(), "Привет.");
        assert_eq!(transcript_from_answer("\"Привет.\"").unwrap(), "Привет.");
        assert!(transcript_from_answer("{\"error\":\"x\"}").is_err());
        assert!(transcript_from_answer("[1]").is_err());
    }
}
