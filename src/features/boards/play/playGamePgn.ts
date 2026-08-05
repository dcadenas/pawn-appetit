import { INITIAL_FEN } from "chessops/fen";
import { makeSan } from "chessops/san";
import { positionFromFen } from "@/utils/chessops";
import type { GameHeaders, TreeNode } from "@/utils/treeReducer";

const MAX_MAINLINE_MOVES = 500;

function formatPgnDate(date: Date): string {
    return date.toISOString().split("T")[0].replace(/-/g, ".");
}

export function collectMainlineSanMoves(root: TreeNode): string[] {
    const sanMoves: string[] = [];
    let currentNode = root;
    let moveCount = 0;

    while (currentNode.children.length > 0 && moveCount < MAX_MAINLINE_MOVES) {
        const child = currentNode.children[0];

        if (child.san) {
            sanMoves.push(child.san);
            moveCount++;
        } else if (child.move) {
            const [pos, posError] = positionFromFen(currentNode.fen);
            if (pos && !posError) {
                try {
                    const san = makeSan(pos, child.move);
                    if (san && san !== "--") {
                        sanMoves.push(san);
                    }
                } catch {
                    // Keep existing play-session behavior: skip invalid generated SAN and continue.
                }
            }
            moveCount++;
        } else {
            break;
        }

        currentNode = child;
    }

    return sanMoves;
}

function formatMoveText(sanMoves: string[], result: GameHeaders["result"]): string {
    if (sanMoves.length === 0) {
        return result;
    }

    const movePairs: string[] = [];
    for (let i = 0; i < sanMoves.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = sanMoves[i];
        const blackMove = sanMoves[i + 1];
        movePairs.push(
            blackMove ? `${moveNumber}. ${whiteMove} ${blackMove}` : `${moveNumber}. ${whiteMove}`,
        );
    }

    return `${movePairs.join(" ")} ${result}`;
}

export function buildPlayGamePgn({
    root,
    headers,
    now = new Date(),
}: {
    root: TreeNode;
    headers: GameHeaders;
    now?: Date;
}): string | null {
    if (root.children.length === 0) {
        return null;
    }

    const sanMoves = collectMainlineSanMoves(root);
    if (sanMoves.length === 0) {
        return null;
    }

    const gameResult = headers.result && headers.result !== "*" ? headers.result : "*";
    const initialFen = headers.fen || root.fen;
    const pgnHeaders = [
        `[Event "${headers.event || "Local Game"}"]`,
        `[Site "${headers.site || "Pawn Appetit"}"]`,
        `[Date "${headers.date || formatPgnDate(now)}"]`,
        `[Round "${headers.round || "?"}"]`,
        `[White "${headers.white || "?"}"]`,
        `[Black "${headers.black || "?"}"]`,
        `[Result "${gameResult}"]`,
    ];

    if (headers.time_control) {
        pgnHeaders.push(`[TimeControl "${headers.time_control}"]`);
    }
    if (headers.variant) {
        pgnHeaders.push(`[Variant "${headers.variant}"]`);
    }
    if (initialFen !== INITIAL_FEN) {
        pgnHeaders.push(`[SetUp "1"]`, `[FEN "${initialFen}"]`);
    }

    return `${pgnHeaders.join("\n")}\n\n${formatMoveText(sanMoves, gameResult)}`.trim();
}
