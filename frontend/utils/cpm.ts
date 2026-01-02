import { MindMapNode, Connection } from '../types';

/**
 * 簡易的なCPM(Critical Path Method)計算を行う
 * 
 * 手順:
 * 1. ノードをフラット化し、IDマップを作成
 * 2. 接続情報からグラフ（隣接リスト）を構築
 * 3. 各ノードの所要時間（Duration）を決定
 *    - effortがあればそれを使用
 *    - なければ startDate ~ endDate の日数
 *    - それもなければデフォルト1日
 * 4. Forward Pass (ES, EF計算)
 * 5. Backward Pass (LS, LF計算)
 * 6. Float計算 (LS - ES)
 * 7. Floatが0 (または閾値以下) のノードと、その間をつなぐエッジをクリティカルと判定
 */

type GraphNode = {
    id: string;
    duration: number; // days
    es: number; // Earliest Start relative to project start
    ef: number; // Earliest Finish
    ls: number; // Latest Start
    lf: number; // Latest Finish
    float: number;
    predecessors: string[];
    successors: string[];
};

// ヘルパー: 日数差分計算
const getDiffDays = (start: string, end: string): number => {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 1;
    const diffTime = e.getTime() - s.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // 当日含む
};

export const calculateCriticalPath = (
    rootNode: MindMapNode,
    connections: Connection[]
): { criticalNodeIds: Set<string>; criticalConnIds: Set<string> } => {
    const nodesMap = new Map<string, MindMapNode>();
    const flatNodes: MindMapNode[] = [];

    // 1. フラット化 & 親子関係の依存関係追加
    const traverse = (node: MindMapNode) => {
        nodesMap.set(node.id, node);
        flatNodes.push(node);
        node.children.forEach(child => {
            // 親と子の依存関係
            // Leftの子: 子 -> 親 (子が終わらないと親が始まらない = 前提)
            // Rightの子: 親 -> 子 (親が終わらないと子が始まらない = 詳細化/後工程)
            // ※ただしRightの子が単なる「内訳」なら並行かもしれないが、
            // 「ノードの位置（右→左）がそのまま作業順（後→先）」というガイドに従うと、
            // 右にあるものほど後工程、左にあるものほど先工程となる。
            // よって Right Child は Parent の Successor。

            if (child.direction === 'left') {
                // child -> node
                // まだgraphができていないので、ここでは依存ペアのリストを作るか、
                // 後でgraph構築時に再訪するか。
                // Simpleに、graph構築後に親子関係を注入する方がきれい。
            }
            traverse(child);
        });
    };
    traverse(rootNode);

    // グラフ構築用データ初期化
    const graph = new Map<string, GraphNode>();
    flatNodes.forEach(node => {
        // Duration決定ロジック
        let duration = 1;
        if (node.effort && node.effort > 0) {
            duration = node.effort;
        } else if (node.startDate && node.endDate) {
            duration = getDiffDays(node.startDate, node.endDate);
        }

        graph.set(node.id, {
            id: node.id,
            duration,
            es: 0,
            ef: duration,
            ls: Infinity,
            lf: Infinity,
            float: 0,
            predecessors: [],
            successors: []
        });
    });

    // 2. 接続関係の構築 (Connections)
    connections.forEach(conn => {
        const fromNode = graph.get(conn.fromId);
        const toNode = graph.get(conn.toId);
        if (fromNode && toNode) {
            fromNode.successors.push(toNode.id);
            toNode.predecessors.push(fromNode.id);
        }
    });

    // 2.1 親子関係の依存関係構築 (Hierarchy)
    flatNodes.forEach(node => {
        const parentNode = graph.get(node.id);
        if (!parentNode) return;

        node.children.forEach(child => {
            const childNode = graph.get(child.id);
            if (!childNode) return;

            if (child.direction === 'left') {
                // Left Child (Predecessor) -> Parent
                childNode.successors.push(parentNode.id);
                parentNode.predecessors.push(childNode.id);
            } else {
                // Parent -> Right Child (Successor) or Default (Right)
                parentNode.successors.push(childNode.id);
                childNode.predecessors.push(parentNode.id);
            }
        });
    });

    // トポロジカルソート (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    graph.forEach(n => inDegree.set(n.id, n.predecessors.length));

    const queue: string[] = [];
    inDegree.forEach((count, id) => {
        if (count === 0) queue.push(id);
    });

    const sortedOrder: string[] = [];
    while (queue.length > 0) {
        const uId = queue.shift()!;
        sortedOrder.push(uId);
        const u = graph.get(uId)!;

        u.successors.forEach(vId => {
            inDegree.set(vId, (inDegree.get(vId) || 0) - 1);
            if (inDegree.get(vId) === 0) {
                queue.push(vId);
            }
        });
    }

    // サイクルがある場合は計算不可（あるいはサイクル部分は無視）
    if (sortedOrder.length !== graph.size) {
        console.warn("Cycle detected or disconnected components in custom connections, CPM calculation might be partial.");
        // サイクルがある場合、依存関係を無視してsortedOrderに入っていないノードも処理対象にするか、
        // ここで打ち切るか。一旦、sortedOrderに入ったものだけで計算する。
    }

    // 3. Forward Pass (ES, EF)
    sortedOrder.forEach(id => {
        const node = graph.get(id)!;
        let maxPrevEF = 0;

        node.predecessors.forEach(pId => {
            const p = graph.get(pId);
            if (p && p.ef > maxPrevEF) {
                maxPrevEF = p.ef;
            }
        });

        node.es = maxPrevEF;
        node.ef = node.es + node.duration;
    });

    // プロジェクト全体の完了日 (Max EF)
    let projectDuration = 0;
    graph.forEach(node => {
        if (node.ef > projectDuration) projectDuration = node.ef;
    });

    // 4. Backward Pass (LS, LF)
    // 逆順で走査
    for (let i = sortedOrder.length - 1; i >= 0; i--) {
        const id = sortedOrder[i];
        const node = graph.get(id)!;

        if (node.successors.length === 0) {
            // 後続がない場合、プロジェクト完了日がLFになる
            node.lf = projectDuration;
        } else {
            let minNextLS = Infinity;
            node.successors.forEach(sId => {
                const s = graph.get(sId);
                if (s && s.ls < minNextLS) {
                    minNextLS = s.ls;
                }
            });
            node.lf = minNextLS;
        }

        node.ls = node.lf - node.duration;
        node.float = node.ls - node.es;
    }

    // 5. 結果抽出
    // Floatが0（計算誤差考慮してごく小さい値）以下のパスをクリティカルとする
    const criticalNodeIds = new Set<string>();
    const criticalConnIds = new Set<string>();

    graph.forEach(node => {
        // 浮動小数点の誤差を考慮し、ごく小さな閾値を使用してもよいが、今回は整数日単位なので0判定でOK
        if (node.float <= 0.001) {
            criticalNodeIds.add(node.id);
        }
    });

    // クリティカルパス上の接続(Edge)を特定
    // Fromがクリティカル かつ Toがクリティカル かつ From.EF == To.ES (密結合) である場合
    connections.forEach(conn => {
        if (criticalNodeIds.has(conn.fromId) && criticalNodeIds.has(conn.toId)) {
            const fromNode = graph.get(conn.fromId);
            const toNode = graph.get(conn.toId);
            if (fromNode && toNode) {
                // 余裕がない接続かどうか
                if (Math.abs(fromNode.ef - toNode.es) <= 0.001) {
                    criticalConnIds.add(conn.id);
                }
            }
        }
    });

    return { criticalNodeIds, criticalConnIds };
};
