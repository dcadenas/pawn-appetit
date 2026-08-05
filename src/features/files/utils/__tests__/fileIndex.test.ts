import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    readDir: vi.fn<() => Promise<Array<{ name: string; isFile: boolean; isDirectory: boolean }>>>(),
    exists: vi.fn<() => Promise<boolean>>(),
    readTextFile: vi.fn<() => Promise<string>>(),
    writeTextFile: vi.fn<() => Promise<void>>(),
    basename: vi.fn<(path: string) => Promise<string>>(),
    join: vi.fn<(...parts: string[]) => Promise<string>>(),
    getFileMetadata: vi.fn<() => Promise<{ status: "ok"; data: { last_modified: bigint } }>>(),
    countPgnGames: vi.fn<() => Promise<{ status: "ok"; data: number }>>(),
}));

vi.mock("@tauri-apps/api/path", () => ({
    BaseDirectory: { AppLocalData: "AppLocalData" },
    basename: mocks.basename,
    join: mocks.join,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
    exists: mocks.exists,
    readDir: mocks.readDir,
    readTextFile: mocks.readTextFile,
    writeTextFile: mocks.writeTextFile,
}));

vi.mock("@/bindings", () => ({
    commands: {
        getFileMetadata: mocks.getFileMetadata,
        countPgnGames: mocks.countPgnGames,
    },
}));

describe("file index cache", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { invalidateFileIndex } = await import("../file");
        invalidateFileIndex();

        mocks.readDir.mockResolvedValue([
            { name: "first.pgn", isFile: true, isDirectory: false },
            { name: "notes.txt", isFile: true, isDirectory: false },
        ]);
        mocks.exists.mockResolvedValue(true);
        mocks.readTextFile.mockResolvedValue(JSON.stringify({ type: "game", tags: ["rapid"] }));
        mocks.basename.mockImplementation(async (path) => path.split("/").pop() ?? path);
        mocks.join.mockImplementation(async (...parts) => parts.join("/"));
        mocks.getFileMetadata.mockResolvedValue({
            status: "ok",
            data: { last_modified: 1_700_000_000n },
        });
        mocks.countPgnGames.mockResolvedValue({ status: "ok", data: 42 });
    });

    test("reuses indexed file metadata until invalidated", async () => {
        const { getCachedFileIndex, invalidateFileIndex } = await import("../file");

        const first = await getCachedFileIndex("/docs");
        const second = await getCachedFileIndex("/docs");

        expect(first).toEqual(second);
        expect(first).toHaveLength(1);
        expect(first[0]).toEqual(
            expect.objectContaining({
                name: "first",
                path: "/docs/first.pgn",
                numGames: 42,
                metadata: { type: "game", tags: ["rapid"] },
            }),
        );
        expect(mocks.readDir).toHaveBeenCalledTimes(1);
        expect(mocks.countPgnGames).toHaveBeenCalledTimes(1);

        invalidateFileIndex("/docs");
        await getCachedFileIndex("/docs");

        expect(mocks.readDir).toHaveBeenCalledTimes(2);
        expect(mocks.countPgnGames).toHaveBeenCalledTimes(2);
    });
});
