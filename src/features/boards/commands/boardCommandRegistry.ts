import { useEffect, useSyncExternalStore } from "react";

export type BoardCommandId =
    | "save"
    | "copyFen"
    | "copyPgn"
    | "flip"
    | "clearAnnotations"
    | "setupPosition"
    | "snapshot"
    | "toggleEngine"
    | "stopEngine";

export type BoardCommand = {
    id: BoardCommandId;
    run: () => void;
    disabled?: boolean;
    disabledReason?: string;
};

export type BoardCommandRegistration = {
    engineRunning: boolean;
    commands: Partial<Record<BoardCommandId, BoardCommand>>;
};

export type BoardCommandTarget = BoardCommandRegistration & {
    tabId: string;
};

const registry = new Map<string, BoardCommandTarget>();
const listeners = new Set<() => void>();

function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function registerBoardCommands(
    tabId: string,
    registration: BoardCommandRegistration,
): () => void {
    const entry: BoardCommandTarget = {
        tabId,
        engineRunning: registration.engineRunning,
        commands: registration.commands,
    };

    registry.set(tabId, entry);
    emitChange();

    return () => {
        if (registry.get(tabId) === entry) {
            registry.delete(tabId);
            emitChange();
        }
    };
}

export function getBoardCommandTarget(tabId: string | null | undefined): BoardCommandTarget | null {
    if (!tabId) return null;
    return registry.get(tabId) ?? null;
}

export function getRunnableBoardCommand(
    target: BoardCommandTarget | null,
    commandId: BoardCommandId,
): (() => void) | undefined {
    const command = target?.commands[commandId];
    if (!command || command.disabled) return undefined;
    return command.run;
}

export function runBoardCommand(
    tabId: string | null | undefined,
    commandId: BoardCommandId,
): boolean {
    const command = getRunnableBoardCommand(getBoardCommandTarget(tabId), commandId);
    if (!command) return false;

    command();
    return true;
}

export function useActiveBoardCommands(
    tabId: string | null | undefined,
): BoardCommandTarget | null {
    return useSyncExternalStore(
        subscribe,
        () => getBoardCommandTarget(tabId),
        () => null,
    );
}

export function useRegisterBoardCommands(
    tabId: string | null | undefined,
    registration: BoardCommandRegistration,
): void {
    useEffect(() => {
        if (!tabId) return undefined;
        return registerBoardCommands(tabId, registration);
    }, [tabId, registration]);
}

export function clearBoardCommandRegistryForTests(): void {
    registry.clear();
    emitChange();
}
