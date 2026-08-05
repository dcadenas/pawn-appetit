use std::time::Duration;

use diesel::{
    connection::SimpleConnection,
    r2d2::{ConnectionManager, Pool},
    SqliteConnection,
};
use tauri::State;

use crate::{error::Result, AppState};

const PRAGMA_JOURNAL_MODE_DELETE: &str =
    include_str!("../../../database/pragmas/journal_mode_delete.sql");
const PRAGMA_JOURNAL_MODE_OFF: &str =
    include_str!("../../../database/pragmas/journal_mode_off.sql");
const PRAGMA_FOREIGN_KEYS_ON: &str = include_str!("../../../database/pragmas/foreign_keys_on.sql");
const PRAGMA_BUSY_TIMEOUT: &str = include_str!("../../../database/pragmas/busy_timeout.sql");

#[derive(Debug)]
pub enum JournalMode {
    Delete,
    Off,
}

#[derive(Debug)]
pub struct ConnectionOptions {
    pub journal_mode: JournalMode,
    pub enable_foreign_keys: bool,
    pub busy_timeout: Option<Duration>,
}

impl Default for ConnectionOptions {
    fn default() -> Self {
        Self {
            journal_mode: JournalMode::Delete,
            enable_foreign_keys: true,
            busy_timeout: Some(Duration::from_secs(30)),
        }
    }
}

impl diesel::r2d2::CustomizeConnection<SqliteConnection, diesel::r2d2::Error>
    for ConnectionOptions
{
    fn on_acquire(
        &self,
        conn: &mut SqliteConnection,
    ) -> std::result::Result<(), diesel::r2d2::Error> {
        (|| {
            match self.journal_mode {
                JournalMode::Delete => conn.batch_execute(PRAGMA_JOURNAL_MODE_DELETE)?,
                JournalMode::Off => conn.batch_execute(PRAGMA_JOURNAL_MODE_OFF)?,
            }
            if self.enable_foreign_keys {
                conn.batch_execute(PRAGMA_FOREIGN_KEYS_ON)?;
            }
            if let Some(d) = self.busy_timeout {
                conn.batch_execute(
                    &PRAGMA_BUSY_TIMEOUT.replace("{0}", &d.as_millis().to_string()),
                )?;
            }
            Ok(())
        })()
        .map_err(diesel::r2d2::Error::QueryError)
    }
}

pub type PooledSqliteConnection =
    diesel::r2d2::PooledConnection<diesel::r2d2::ConnectionManager<diesel::SqliteConnection>>;

pub(crate) fn get_db_or_create(
    state: &State<AppState>,
    db_path: &str,
    options: ConnectionOptions,
) -> Result<PooledSqliteConnection> {
    let pool = match state.connection_pool.get(db_path) {
        Some(pool) => pool.clone(),
        None => {
            let pool = Pool::builder()
                .max_size(16)
                .connection_customizer(Box::new(options))
                .build(ConnectionManager::<SqliteConnection>::new(db_path))?;
            state
                .connection_pool
                .insert(db_path.to_string(), pool.clone());
            pool
        }
    };

    Ok(pool.get()?)
}
