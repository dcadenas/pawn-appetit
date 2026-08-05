import { beforeEach, describe, expect, test, vi } from "vitest";
import {
    clearBoardCommandRegistryForTests,
    getBoardCommandTarget,
    registerBoardCommands,
    runBoardCommand,
} from "../boardCommandRegistry";

describe("board command registry", () => {
    beforeEach(() => {
        clearBoardCommandRegistryForTests();
    });

    test("uses the active tab id to choose the command target", () => {
        const firstFlip = vi.fn<() => void>();
        const secondFlip = vi.fn<() => void>();

        registerBoardCommands("tab-a", {
            engineRunning: false,
            commands: {
                flip: { id: "flip", run: firstFlip },
            },
        });
        registerBoardCommands("tab-b", {
            engineRunning: true,
            commands: {
                flip: { id: "flip", run: secondFlip },
            },
        });

        expect(getBoardCommandTarget("tab-a")?.engineRunning).toBe(false);
        expect(getBoardCommandTarget("tab-b")?.engineRunning).toBe(true);
        expect(runBoardCommand("tab-b", "flip")).toBe(true);

        expect(firstFlip).not.toHaveBeenCalled();
        expect(secondFlip).toHaveBeenCalledOnce();
    });

    test("does not run unavailable or disabled commands", () => {
        const stopEngine = vi.fn<() => void>();

        registerBoardCommands("tab-a", {
            engineRunning: false,
            commands: {
                stopEngine: { id: "stopEngine", run: stopEngine, disabled: true },
            },
        });

        expect(runBoardCommand("tab-a", "stopEngine")).toBe(false);
        expect(runBoardCommand("tab-a", "copyFen")).toBe(false);
        expect(runBoardCommand("missing", "stopEngine")).toBe(false);
        expect(stopEngine).not.toHaveBeenCalled();
    });

    test("cleans up only the registration that created the cleanup callback", () => {
        const staleCleanup = registerBoardCommands("tab-a", {
            engineRunning: false,
            commands: {
                flip: { id: "flip", run: vi.fn<() => void>() },
            },
        });
        const latestFlip = vi.fn<() => void>();
        const latestCleanup = registerBoardCommands("tab-a", {
            engineRunning: false,
            commands: {
                flip: { id: "flip", run: latestFlip },
            },
        });

        staleCleanup();
        expect(runBoardCommand("tab-a", "flip")).toBe(true);
        expect(latestFlip).toHaveBeenCalledOnce();

        latestCleanup();
        expect(getBoardCommandTarget("tab-a")).toBeNull();
    });
});
