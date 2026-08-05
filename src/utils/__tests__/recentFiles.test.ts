import { beforeEach, describe, expect, test } from "vitest";
import {
    clearRecentFiles,
    getDisplayNameFromPath,
    getRecentFiles,
    isSupportedPgnFilePath,
    MAX_RECENT_FILES,
    RECENT_FILES_STORAGE_KEY,
    recordRecentFile,
    removeRecentFile,
} from "../recentFiles";

describe("recent PGN files", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test("accepts only PGN paths and derives display names", () => {
        expect(isSupportedPgnFilePath("/games/worlds.PGN")).toBe(true);
        expect(isSupportedPgnFilePath("/games/notes.txt")).toBe(false);
        expect(getDisplayNameFromPath("/games/worlds.pgn")).toBe("worlds");
    });

    test("records unique recent files with newest first and a fixed limit", () => {
        for (let index = 0; index < MAX_RECENT_FILES + 2; index += 1) {
            recordRecentFile(`/games/${index}.pgn`, index);
        }

        recordRecentFile("/games/3.pgn", 99);
        recordRecentFile("/games/readme.txt", 100);

        const recentFiles = getRecentFiles();

        expect(recentFiles).toHaveLength(MAX_RECENT_FILES);
        expect(recentFiles[0]).toEqual({
            path: "/games/3.pgn",
            name: "3",
            openedAt: 99,
        });
        expect(recentFiles.filter((file) => file.path === "/games/3.pgn")).toHaveLength(1);
        expect(recentFiles.some((file) => file.path.endsWith(".txt"))).toBe(false);
    });

    test("removes and clears recent files", () => {
        recordRecentFile("/games/one.pgn", 1);
        recordRecentFile("/games/two.pgn", 2);

        removeRecentFile("/games/one.pgn");
        expect(getRecentFiles().map((file) => file.path)).toEqual(["/games/two.pgn"]);

        clearRecentFiles();
        expect(localStorage.getItem(RECENT_FILES_STORAGE_KEY)).toBeNull();
    });
});
