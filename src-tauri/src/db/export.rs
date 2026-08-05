use std::{
    fs::OpenOptions,
    io::{BufWriter, Write},
    path::PathBuf,
};

use diesel::{connection::DefaultLoadingMode, prelude::*};
use shakmaty::{fen::Fen, CastlingMode, Chess, FromSetup};

use crate::{
    db::{
        connection::{get_db_or_create, ConnectionOptions},
        models::{Event, Game, Player, Site},
        pgn::GameTree,
        schema::{events, games, players, sites},
    },
    error::Result,
    AppState,
};

struct PgnGame {
    event: Option<String>,
    site: Option<String>,
    date: Option<String>,
    round: Option<String>,
    white: Option<String>,
    black: Option<String>,
    result: Option<String>,
    time_control: Option<String>,
    eco: Option<String>,
    white_elo: Option<String>,
    black_elo: Option<String>,
    ply_count: Option<String>,
    fen: Option<String>,
    moves: String,
}

impl PgnGame {
    fn write(&self, writer: &mut impl Write) -> Result<()> {
        writeln!(
            writer,
            "[Event \"{}\"]",
            self.event.as_deref().unwrap_or("")
        )?;
        writeln!(writer, "[Site \"{}\"]", self.site.as_deref().unwrap_or(""))?;
        writeln!(writer, "[Date \"{}\"]", self.date.as_deref().unwrap_or(""))?;
        writeln!(
            writer,
            "[Round \"{}\"]",
            self.round.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[White \"{}\"]",
            self.white.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[Black \"{}\"]",
            self.black.as_deref().unwrap_or("")
        )?;
        writeln!(
            writer,
            "[Result \"{}\"]",
            self.result.as_deref().unwrap_or("*")
        )?;
        if let Some(time_control) = self.time_control.as_deref() {
            writeln!(writer, "[TimeControl \"{}\"]", time_control)?;
        }
        if let Some(eco) = self.eco.as_deref() {
            writeln!(writer, "[ECO \"{}\"]", eco)?;
        }
        if let Some(white_elo) = self.white_elo.as_deref() {
            writeln!(writer, "[WhiteElo \"{}\"]", white_elo)?;
        }
        if let Some(black_elo) = self.black_elo.as_deref() {
            writeln!(writer, "[BlackElo \"{}\"]", black_elo)?;
        }
        if let Some(ply_count) = self.ply_count.as_deref() {
            writeln!(writer, "[PlyCount \"{}\"]", ply_count)?;
        }
        if let Some(fen) = self.fen.as_deref() {
            writeln!(writer, "[SetUp \"1\"]")?;
            writeln!(writer, "[FEN \"{}\"]", fen)?;
        }
        writeln!(writer)?;
        writer.write_all(self.moves.as_bytes())?;
        match self.result.as_deref() {
            Some("1-0") => writeln!(writer, "1-0"),
            Some("0-1") => writeln!(writer, "0-1"),
            Some("1/2-1/2") => writeln!(writer, "1/2-1/2"),
            _ => writeln!(writer, "*"),
        }?;
        writeln!(writer)?;
        Ok(())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn export_to_pgn(
    file: PathBuf,
    dest_file: PathBuf,
    state: tauri::State<'_, AppState>,
) -> Result<()> {
    let db = &mut get_db_or_create(&state, file.to_str().unwrap(), ConnectionOptions::default())?;

    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(dest_file)?;

    let mut writer = BufWriter::new(file);

    let (white_players, black_players) = diesel::alias!(players as white, players as black);
    games::table
        .inner_join(white_players.on(games::white_id.eq(white_players.field(players::id))))
        .inner_join(black_players.on(games::black_id.eq(black_players.field(players::id))))
        .inner_join(events::table.on(games::event_id.eq(events::id)))
        .inner_join(sites::table.on(games::site_id.eq(sites::id)))
        .load_iter::<(Game, Player, Player, Event, Site), DefaultLoadingMode>(db)?
        .flatten()
        .map(|(game, white, black, event, site)| {
            let pgn = PgnGame {
                event: event.name,
                site: site.name,
                date: game.date,
                round: game.round,
                white: white.name,
                black: black.name,
                result: game.result,
                time_control: game.time_control,
                eco: game.eco,
                white_elo: game.white_elo.map(|e| e.to_string()),
                black_elo: game.black_elo.map(|e| e.to_string()),
                ply_count: game.ply_count.map(|e| e.to_string()),
                fen: game.fen.clone(),
                moves: GameTree::from_bytes(
                    &game.moves,
                    game.fen
                        .and_then(|fen| Fen::from_ascii(fen.as_bytes()).ok())
                        .and_then(|fen| Chess::from_setup(fen.into(), CastlingMode::Chess960).ok()),
                )?
                .to_string(),
            };

            pgn.write(&mut writer)?;

            Ok(())
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_core_tags_and_result() {
        let game = PgnGame {
            event: Some("Candidates".to_string()),
            site: Some("Toronto".to_string()),
            date: Some("2024.04.01".to_string()),
            round: Some("1".to_string()),
            white: Some("White".to_string()),
            black: Some("Black".to_string()),
            result: Some("1-0".to_string()),
            time_control: None,
            eco: Some("C42".to_string()),
            white_elo: Some("2750".to_string()),
            black_elo: None,
            ply_count: Some("3".to_string()),
            fen: None,
            moves: "1. e4 e5 2. Nf3 ".to_string(),
        };

        let mut bytes = Vec::new();
        game.write(&mut bytes).unwrap();
        let output = String::from_utf8(bytes).unwrap();

        assert!(output.contains("[Event \"Candidates\"]"));
        assert!(output.contains("[ECO \"C42\"]"));
        assert!(output.contains("1. e4 e5 2. Nf3 1-0"));
    }
}
