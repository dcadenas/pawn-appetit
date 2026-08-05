import { parseUci } from "chessops";
import { INITIAL_FEN } from "chessops/fen";
import { expect, test } from "vitest";
import { buildPlayGamePgn, collectMainlineSanMoves } from "../playGamePgn";
import { defaultTree, type GameHeaders, type TreeNode } from "@/utils/treeReducer";

function headers(overrides: Partial<GameHeaders> = {}): GameHeaders {
    return {
        id: 0,
        fen: INITIAL_FEN,
        event: "",
        site: "",
        white: "Alice",
        black: "Bob",
        result: "*",
        ...overrides,
    };
}

function node(fen: string, san: string | null, children: TreeNode[] = []): TreeNode {
    return {
        fen,
        move: null,
        san,
        children,
        score: null,
        depth: null,
        halfMoves: 0,
        shapes: [],
        annotations: [],
        comment: "",
    };
}

test("buildPlayGamePgn serializes headers and paired SAN moves", () => {
    const tree = defaultTree();
    tree.root.children = [
        node("after e4", "e4", [node("after e5", "e5", [node("after Nf3", "Nf3")])]),
    ];

    expect(
        buildPlayGamePgn({
            root: tree.root,
            headers: headers({
                event: "Casual Game",
                site: "Local",
                date: "2026.08.05",
                round: "1",
                result: "1-0",
                time_control: "180+2",
            }),
        }),
    ).toBe(
        [
            '[Event "Casual Game"]',
            '[Site "Local"]',
            '[Date "2026.08.05"]',
            '[Round "1"]',
            '[White "Alice"]',
            '[Black "Bob"]',
            '[Result "1-0"]',
            '[TimeControl "180+2"]',
            "",
            "1. e4 e5 2. Nf3 1-0",
        ].join("\n"),
    );
});

test("buildPlayGamePgn includes setup and FEN for custom starting positions", () => {
    const customFen = "8/8/8/8/8/8/4K3/4k3 w - - 0 1";
    const tree = defaultTree(customFen);
    tree.root.children = [node("after Kf2", "Kf2")];

    const pgn = buildPlayGamePgn({
        root: tree.root,
        headers: headers({ fen: customFen, variant: "Chess960" }),
        now: new Date("2026-08-05T00:00:00.000Z"),
    });

    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain(`[FEN "${customFen}"]`);
    expect(pgn).toContain('[Variant "Chess960"]');
    expect(pgn).toContain('[Date "2026.08.05"]');
});

test("collectMainlineSanMoves generates SAN from moves when missing", () => {
    const tree = defaultTree();
    const move = parseUci("e2e4")!;
    tree.root.children = [
        {
            ...node("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", null),
            move,
        },
    ];

    expect(collectMainlineSanMoves(tree.root)).toEqual(["e4"]);
});

test("buildPlayGamePgn returns null for games without serializable moves", () => {
    const emptyTree = defaultTree();
    expect(buildPlayGamePgn({ root: emptyTree.root, headers: headers() })).toBeNull();

    emptyTree.root.children = [node("missing move", null)];
    expect(buildPlayGamePgn({ root: emptyTree.root, headers: headers() })).toBeNull();
});
