export type RecentFile = {
    path: string;
    name: string;
    openedAt: number;
};

export const RECENT_FILES_STORAGE_KEY = "pawn-appetit.recentFiles";
export const MAX_RECENT_FILES = 10;

export function isSupportedPgnFilePath(path: string): boolean {
    return path.toLowerCase().endsWith(".pgn");
}

export function getDisplayNameFromPath(path: string): string {
    const fileName = path.split(/[\\/]/).pop() || path;
    return fileName.replace(/\.pgn$/i, "");
}

export function getRecentFiles(): RecentFile[] {
    try {
        const raw = localStorage.getItem(RECENT_FILES_STORAGE_KEY);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter(
                (entry): entry is RecentFile =>
                    typeof entry?.path === "string" &&
                    typeof entry?.name === "string" &&
                    typeof entry?.openedAt === "number",
            )
            .filter((entry) => isSupportedPgnFilePath(entry.path))
            .slice(0, MAX_RECENT_FILES);
    } catch {
        return [];
    }
}

export function setRecentFiles(files: RecentFile[]): RecentFile[] {
    const nextFiles = files.slice(0, MAX_RECENT_FILES);
    localStorage.setItem(RECENT_FILES_STORAGE_KEY, JSON.stringify(nextFiles));
    return nextFiles;
}

export function recordRecentFile(path: string, openedAt = Date.now()): RecentFile[] {
    if (!isSupportedPgnFilePath(path)) return getRecentFiles();

    const entry: RecentFile = {
        path,
        name: getDisplayNameFromPath(path),
        openedAt,
    };

    return setRecentFiles([entry, ...getRecentFiles().filter((recent) => recent.path !== path)]);
}

export function removeRecentFile(path: string): RecentFile[] {
    return setRecentFiles(getRecentFiles().filter((recent) => recent.path !== path));
}

export function clearRecentFiles(): void {
    localStorage.removeItem(RECENT_FILES_STORAGE_KEY);
}
