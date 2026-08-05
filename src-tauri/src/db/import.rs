use diesel::SqliteConnection;
use shakmaty::{Board, Piece, Position};

use crate::{
    db::{core, models::NewGame, ops::*, pgn::TempGame},
    error::Result,
};

const WHITE_PAWN: Piece = Piece {
    color: shakmaty::Color::White,
    role: shakmaty::Role::Pawn,
};

const BLACK_PAWN: Piece = Piece {
    color: shakmaty::Color::Black,
    role: shakmaty::Role::Pawn,
};

/// Returns the bit representation of the pawns on the second and seventh rank
/// of the given board.
pub(crate) fn get_pawn_home(board: &Board) -> u16 {
    let white_pawns = board.by_piece(WHITE_PAWN);
    let black_pawns = board.by_piece(BLACK_PAWN);
    let second_rank_pawns = (white_pawns.0 >> 8) as u8;
    let seventh_rank_pawns = (black_pawns.0 >> 48) as u8;
    (second_rank_pawns as u16) | ((seventh_rank_pawns as u16) << 8)
}

pub fn insert_to_db(db: &mut SqliteConnection, game: &TempGame) -> Result<()> {
    let pawn_home = get_pawn_home(game.position.board());

    let white_id = if let Some(name) = &game.white_name {
        create_player(db, name)?.id
    } else {
        0
    };

    let black_id = if let Some(name) = &game.black_name {
        create_player(db, name)?.id
    } else {
        0
    };

    let event_id = if let Some(name) = &game.event_name {
        create_event(db, name)?.id
    } else {
        0
    };

    let site_id = if let Some(name) = &game.site_name {
        create_site(db, name)?.id
    } else {
        0
    };

    let ply_count = game.tree.count_main_line_moves() as i32;
    let final_material = super::pgn::get_material_count(game.position.board());
    let minimal_white_material = game.material_count.white.min(final_material.white) as i32;
    let minimal_black_material = game.material_count.black.min(final_material.black) as i32;

    let new_game = NewGame {
        white_id,
        black_id,
        ply_count,
        eco: game.eco.as_deref(),
        round: game.round.as_deref(),
        white_elo: game.white_elo,
        black_elo: game.black_elo,
        white_material: minimal_white_material,
        black_material: minimal_black_material,
        date: game.date.as_deref(),
        time: game.time.as_deref(),
        time_control: game.time_control.as_deref(),
        site_id,
        event_id,
        fen: game.fen.as_deref(),
        result: game.result.as_deref(),
        moves: game.moves.as_slice(),
        pawn_home: pawn_home as i32,
    };

    core::add_game(db, new_game)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn home_row() {
        let pawn_home = get_pawn_home(&Board::default());
        assert_eq!(pawn_home, 0b1111111111111111);

        let pawn_home = get_pawn_home(
            &Board::from_ascii_board_fen(b"8/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/8").unwrap(),
        );
        assert_eq!(pawn_home, 0b1110111111101111);

        let pawn_home = get_pawn_home(&Board::from_ascii_board_fen(b"8/8/8/8/8/8/8/8").unwrap());
        assert_eq!(pawn_home, 0b0000000000000000);
    }
}
