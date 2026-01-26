
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MindMapNode, Connection, TaskRegistrationResult, Page } from './types';
import MindMapCanvas, { MindMapCanvasHandle } from './components/MindMapCanvas';
import { Plus, Trash2, Cpu, Download, Undo, CalendarRange, Workflow, Target, Map as MapIcon, Send, Settings, Save, X, Maximize, Minimize } from 'lucide-react';
import { expandNodeWithAI } from './services/geminiService';
import { expandNodeWithAzureOpenAi } from './services/azureOpenAiService';
import { calculateCriticalPath } from './utils/cpm';
import AiTaskExtractModal from './components/AiTaskExtractModal';
import { fetchAiSettings, updateAiSettings, fetchAiDefaults } from './services/aiSettingsService';
import { registerTasks, fetchIssue } from './services/taskRegistrationService';
import { fetchMasterData, MasterData } from './services/masterDataService';
import RegistrationSettingsDialog, { RegistrationSettings } from './components/RegistrationSettingsDialog';
import { t } from './i18n';
import PageTabBar from './components/PageTabBar';

const todayIso = () => new Date().toISOString().split('T')[0];
const createId = () => Math.random().toString(36).slice(2, 11);
const cloneDeep = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const updateNodeById = (
  node: MindMapNode,
  id: string,
  updater: (node: MindMapNode) => MindMapNode
): MindMapNode => {
  if (node.id === id) {
    return updater(node);
  }
  return {
    ...node,
    children: node.children.map((child) => updateNodeById(child, id, updater)),
  };
};

const findNodeById = (node: MindMapNode, id: string): MindMapNode | null => {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
};

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return todayIso();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const createInitialData = (): MindMapNode => ({
  id: 'root',
  text: t('redmine_create_tasks.app.root_title', 'Final Deliverable'),
  endDate: todayIso(),
  startDate: todayIso(),
  effort: 1,
  children: []
});

const createInitialPage = (): Page => ({
  id: createId(),
  title: t('redmine_create_tasks.pages.new_page', 'New Page'),
  data: createInitialData(),
  connections: []
});

const getProjectId = () => {
  return window.RedmineCreateTasks?.projectIdentifier || 'default';
};

const STORAGE_KEY = `gemini_mindmap_data_${getProjectId()}`;

const flattenNodes = (node: MindMapNode): MindMapNode[] => [
  node,
  ...node.children.flatMap(flattenNodes)
];

const buildDependencyMap = (root: MindMapNode, connections: Connection[]): Map<string, Set<string>> => {
  const depMap = new Map<string, Set<string>>();
  const addDep = (dependsOn: string, target: string) => {
    if (!dependsOn || !target || dependsOn === target) return;
    const current = depMap.get(target) || new Set<string>();
    current.add(dependsOn);
    depMap.set(target, current);
  };

  const walkTree = (node: MindMapNode) => {
    node.children.forEach(child => {
      addDep(child.id, node.id);
      walkTree(child);
    });
  };
  walkTree(root);

  connections.forEach(conn => addDep(conn.fromId, conn.toId));
  return depMap;
};

const App: React.FC = () => {
  const [pages, setPages] = useState<Page[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration from old format
        if (parsed.pages) {
          return parsed.pages;
        } else if (parsed.data) {
          return [{
            id: createId(),
            title: parsed.mapTitle || t('redmine_create_tasks.pages.new_page', 'New Page'),
            data: parsed.data,
            connections: parsed.connections || []
          }];
        }
      }
      return [createInitialPage()];
    } catch { return [createInitialPage()]; }
  });
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // currentPageIndex を ref で保持し、常に最新の値を取得できるようにする
  const currentPageIndexRef = useRef(currentPageIndex);
  currentPageIndexRef.current = currentPageIndex;

  // Derived state from current page
  const currentPage = pages[currentPageIndex] || pages[0];
  const data = currentPage?.data || createInitialData();
  const connections = currentPage?.connections || [];

  const setData = useCallback((updater: MindMapNode | ((prev: MindMapNode) => MindMapNode)) => {
    setPages(prevPages => {
      const idx = currentPageIndexRef.current;
      const newPages = [...prevPages];
      if (!newPages[idx]) return prevPages; // 安全チェック
      const newData = typeof updater === 'function' ? updater(newPages[idx].data) : updater;
      newPages[idx] = { ...newPages[idx], data: newData };
      return newPages;
    });
  }, []);

  const setConnections = useCallback((updater: Connection[] | ((prev: Connection[]) => Connection[])) => {
    setPages(prevPages => {
      const idx = currentPageIndexRef.current;
      const newPages = [...prevPages];
      if (!newPages[idx]) return prevPages; // 安全チェック
      const newConns = typeof updater === 'function' ? updater(newPages[idx].connections) : updater;
      newPages[idx] = { ...newPages[idx], connections: newConns };
      return newPages;
    });
  }, []);
  const [history, setHistory] = useState<{ data: MindMapNode, conns: Connection[] }[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState<string | null>(null);
  const [criticalNodeIds, setCriticalNodeIds] = useState<Set<string>>(new Set());
  const [criticalConnIds, setCriticalConnIds] = useState<Set<string>>(new Set());
  const [aiProvider, setAiProvider] = useState<'gemini' | 'azure-openai'>('gemini');
  const [aiPrompt, setAiPrompt] = useState(t('redmine_create_tasks.app.default_prompt', 'Default prompt'));
  const [aiTasks, setAiTasks] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTargetNodeId, setAiTargetNodeId] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [registerResult, setRegisterResult] = useState<TaskRegistrationResult | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const canvasRef = useRef<MindMapCanvasHandle>(null);

  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [registrationSettings, setRegistrationSettings] = useState<RegistrationSettings>(() => {
    try {
      const saved = localStorage.getItem(`redmine_create_tasks_settings_${getProjectId()}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const data = await fetchMasterData(getProjectId());
        setMasterData(data);
      } catch (e) {
        console.error('Failed to load master data', e);
      }
    };
    loadMasterData();
  }, []);



  useEffect(() => {
    const saveData = {
      pages
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  }, [pages]);

  const saveToHistory = useCallback(() => {
    setHistory(prev => [...prev, {
      data: cloneDeep(data),
      conns: cloneDeep(connections)
    }].slice(-20));
  }, [data, connections]);

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setData(prev.data);
    setConnections(prev.conns);
    setHistory(prevHistory => prevHistory.slice(0, -1));
    setCriticalNodeIds(new Set());
    setCriticalConnIds(new Set());
  };

  const handleAddNode = useCallback((parentId: string, direction?: 'left' | 'right') => {
    saveToHistory();
    const newNodeId = createId();

    const findDirection = (node: MindMapNode): 'left' | 'right' | undefined => {
      if (node.id === parentId) return node.direction;
      for (const child of node.children) {
        const d = findDirection(child);
        if (d) return d;
      }
      return undefined;
    };

    const parentDirection = parentId === 'root' ? direction : findDirection(data);
    const finalDirection = parentDirection || direction || 'right';

    const newNode: MindMapNode = {
      id: newNodeId,
      text: t('redmine_create_tasks.app.new_task', 'New Task'),
      startDate: todayIso(),
      endDate: todayIso(),
      effort: 1,
      children: [],
      direction: finalDirection
    };

    setData(prev => updateNodeById(prev, parentId, node => ({
      ...node,
      children: [...node.children, newNode]
    })));

    setSelectedNodeId(newNodeId);
    setNodeToEdit(newNodeId);
  }, [data, saveToHistory]);

  const handleDeleteNode = useCallback((id: string) => {
    if (id === 'root') return;
    saveToHistory();
    const removeNodeFromTree = (node: MindMapNode): MindMapNode => ({
      ...node,
      children: node.children
        .filter(child => child.id !== id)
        .map(removeNodeFromTree)
    });
    setData(prev => removeNodeFromTree(prev));
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
    setSelectedNodeId(null);
    setCriticalNodeIds(new Set());
  }, [saveToHistory]);

  const handleAddConnection = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (connections.some(c => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId))) {
      return;
    }
    saveToHistory();
    setConnections(prev => [...prev, {
      id: `conn-${Date.now()}`,
      fromId,
      toId
    }]);
  }, [connections, saveToHistory]);

  const handleDeleteConnection = useCallback((connId: string) => {
    saveToHistory();
    setConnections(prev => prev.filter(c => c.id !== connId));
  }, [saveToHistory]);

  const handleDetachNode = useCallback((id: string) => {
    if (id === 'root') return;
    saveToHistory();

    setData(prev => {
      // 1. 移動対象のノードを探す
      let targetNode: MindMapNode | null = null;
      const findNode = (node: MindMapNode) => {
        if (node.id === id) {
          targetNode = node;
          return;
        }
        node.children.forEach(findNode);
      };
      findNode(prev);

      if (!targetNode) return prev;

      // 2. 元の親から削除
      const removeNodeFromTree = (node: MindMapNode): MindMapNode => ({
        ...node,
        children: node.children
          .filter(child => child.id !== id)
          .map(removeNodeFromTree)
      });
      const newRoot = removeNodeFromTree(prev);

      // 3. ルートの子として追加し、directionを適宜設定
      // ルートに追加されるため、デフォルトでright、あるいはバランスを取るロジックを入れても良い
      // ここではシンプルに元のdirectionを維持、または未定義ならright
      const detachedNode = { ...targetNode, direction: targetNode.direction || 'right' };

      return {
        ...newRoot,
        children: [...newRoot.children, detachedNode]
      };
    });

    // 今回の要件は「接続のみ削除」= 親子関係の解除なので、これでOK。
  }, [saveToHistory]);

  const handleMoveNode = useCallback((childId: string, newParentId: string) => {
    if (childId === newParentId) return;
    if (childId === 'root') return; // rootは移動不可

    saveToHistory();

    setData(prev => {
      // 1. 移動対象のノードを探す
      let targetNode: MindMapNode | null = null;
      const findNode = (n: MindMapNode) => {
        if (n.id === childId) {
          targetNode = n;
          return;
        }
        n.children.forEach(findNode);
      };
      findNode(prev);

      if (!targetNode) return prev;

      // 2. 循環参照チェック: newParentId が childId の子孫でないか確認
      let isCircular = false;
      const checkCircular = (n: MindMapNode) => {
        if (n.id === newParentId) isCircular = true;
        n.children.forEach(checkCircular);
      };
      checkCircular(targetNode);

      if (isCircular) {
        alert(t('redmine_create_tasks.app.move_invalid', 'Cannot move because the destination is a descendant.'));
        return prev;
      }

      // 3. 元の親から削除
      const removeNodeFromTree = (node: MindMapNode): MindMapNode => ({
        ...node,
        children: node.children
          .filter(child => child.id !== childId)
          .map(removeNodeFromTree)
      });
      const rootWithoutChild = removeNodeFromTree(prev);

      // 4. 新しい親に追加
      // 親のdirectionを継承するか、デフォルト(right)にするか。
      // ここでは既存のdirectionを維持しつつ、もし未定義なら親に合わせる等のケアを入れる
      // ただしMindMapNodeはdirection任意なので、そのままでも描画ロジックがよしなに計らう場合もあるが、
      // 念のため、親がrootなら childのdirectionを再評価する余地がある。
      // ひとまずシンプルに追加する。
      const addChildToTree = (node: MindMapNode): MindMapNode => {
        if (node.id === newParentId) {
          return {
            ...node,
            children: [...node.children, targetNode!]
          };
        }
        return {
          ...node,
          children: node.children.map(addChildToTree)
        };
      };

      return addChildToTree(rootWithoutChild);
    });
  }, [saveToHistory]);

  const handleUpdateNodeData = useCallback((id: string, updates: Partial<MindMapNode>) => {
    setData(prev => updateNodeById(prev, id, node => ({ ...node, ...updates })));
    setCriticalNodeIds(new Set());
  }, []);

  const handleSaveRegistrationSettings = useCallback(async (settings: RegistrationSettings) => {
    setRegistrationSettings(settings);
    localStorage.setItem(`redmine_create_tasks_settings_${getProjectId()}`, JSON.stringify(settings));

    // If using existing issue, update root node text
    if (settings.create_root_issue === false && settings.existing_root_issue_id) {
      try {
        const issue = await fetchIssue(settings.existing_root_issue_id);
        if (issue) {
          handleUpdateNodeData('root', { text: issue.subject });
        }
      } catch (e) {
        console.error('Failed to fetch issue for root node update', e);
      }
    }
  }, [handleUpdateNodeData]);

  const handleAIExpand = useCallback(async (id: string) => {
    const targetNode = findNodeById(data, id);
    if (!targetNode) return;

    setAiModalOpen(true);
    setAiTargetNodeId(id);
    setAiTasks([]);
    setAiError(null);
  }, [data]);

  const handleExecuteAI = useCallback(async () => {
    if (!aiTargetNodeId) return;
    const targetNode = findNodeById(data, aiTargetNodeId);
    if (!targetNode) return;

    setIsExpanding(true);
    setAiError(null);

    try {
      const tasks = aiProvider === 'gemini'
        ? await expandNodeWithAI(targetNode.text, aiPrompt)
        : await expandNodeWithAzureOpenAi(targetNode.text, aiPrompt);
      setAiTasks(tasks);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : t('redmine_create_tasks.app.ai_extract_failed', 'Failed to extract tasks with AI.');
      setAiError(message);
    } finally {
      setIsExpanding(false);
    }
  }, [aiPrompt, aiProvider, data, aiTargetNodeId]);

  const handleApplyAiTasks = useCallback((tasksToApply: string[]) => {
    if (!aiTargetNodeId || tasksToApply.length === 0) return;

    saveToHistory();
    const direction: 'left' | 'right' = 'left';

    let headOfChain: MindMapNode | null = null;
    for (const taskText of tasksToApply) {
      const newNode: MindMapNode = {
        id: createId(),
        text: taskText,
        effort: 1,
        direction,
        children: headOfChain ? [headOfChain] : []
      };
      headOfChain = newNode;
    }

    if (headOfChain) {
      setData(prev => updateNodeById(prev, aiTargetNodeId!, node => ({
        ...node,
        children: [...node.children, headOfChain!]
      })));
    }
    setAiModalOpen(false);
    setAiTasks([]);
    setAiTargetNodeId(null);
  }, [aiTargetNodeId, saveToHistory]);

  const handleLoadSettings = useCallback(async () => {
    try {
      setSettingsError(null);
      const settings = await fetchAiSettings(getProjectId());
      setAiProvider(settings.provider);
      setAiPrompt(settings.prompt);
    } catch (error) {
      setSettingsError(t('redmine_create_tasks.app.ai_settings_load_failed', 'Failed to load AI settings.'));
    }
  }, []);

  const handleSaveSettings = useCallback(async () => {
    try {
      setSettingsError(null);
      setIsSavingSettings(true);
      const settings = await updateAiSettings(getProjectId(), { provider: aiProvider, prompt: aiPrompt });
      setAiProvider(settings.provider);
      setAiPrompt(settings.prompt);
    } catch (error) {
      setSettingsError(t('redmine_create_tasks.app.ai_settings_save_failed', 'Failed to save AI settings.'));
    } finally {
      setIsSavingSettings(false);
    }
  }, [aiProvider, aiPrompt]);

  const handleLoadDefaults = useCallback(async () => {
    try {
      setSettingsError(null);
      const defaults = await fetchAiDefaults(getProjectId());
      setAiProvider(defaults.provider);
      setAiPrompt(defaults.prompt);
    } catch (error) {
      setSettingsError(t('redmine_create_tasks.app.ai_defaults_load_failed', 'Failed to load defaults.'));
    }
  }, []);

  useEffect(() => {
    handleLoadSettings();
  }, [handleLoadSettings]);

  const handleRegisterIssues = useCallback(async () => {
    // Parent map construction
    const parentMap = new Map<string, string>();
    const buildParentMap = (node: MindMapNode) => {
      node.children.forEach(child => {
        parentMap.set(child.id, node.id);
        buildParentMap(child);
      });
    };
    buildParentMap(data);

    const nodes = flattenNodes(data).filter(node =>
      registrationSettings.create_root_issue ? true : node.id !== 'root'
    );

    if (nodes.length === 0) {
      setRegisterError(t('redmine_create_tasks.app.register_no_tasks', 'No tasks to register.'));
      setRegisterResult(null);
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);
    setRegisterResult(null);

    try {
      const depMap = buildDependencyMap(data, connections);
      const isDependencyMode = registrationSettings.relation_mode === 'dependency';

      const tasksPayload = nodes.map(node => {
        // Get explicit dependencies from connections
        const deps = Array.from(depMap.get(node.id) || []);
        let parentId = parentMap.get(node.id);

        // Handle root parent
        if (parentId === 'root') {
          if (registrationSettings.create_root_issue) {
            parentId = 'root';
          } else if (registrationSettings.existing_root_issue_id) {
            parentId = registrationSettings.existing_root_issue_id;
          } else {
            parentId = undefined;
          }
        }

        if (isDependencyMode) {
          // In dependency mode, convert parent-child relationships to dependencies
          // Parent becomes a dependency (child depends on parent completing first)
          const allDeps = [...deps];
          if (parentId && !allDeps.includes(parentId)) {
            allDeps.push(parentId);
          }
          return {
            id: node.id,
            subject: node.text,
            start_date: node.startDate,
            due_date: node.endDate,
            man_days: node.effort,
            dependencies: allDeps.length > 0 ? allDeps : undefined,
            // No parent_task_id in dependency mode
          };
        } else {
          // Child mode: use parent_task_id for hierarchy
          return {
            id: node.id,
            subject: node.text,
            start_date: node.startDate,
            due_date: node.endDate,
            man_days: node.effort,
            dependencies: deps.length > 0 ? deps : undefined,
            parent_task_id: parentId
          };
        }
      });

      const finalPayload = { tasks: tasksPayload, defaults: registrationSettings };
      const result = await registerTasks(getProjectId(), finalPayload);
      setRegisterResult(result);
    } catch (error) {
      setRegisterError(t('redmine_create_tasks.app.register_failed', 'Failed to register issues.'));
    } finally {
      setIsRegistering(false);
    }
  }, [data, connections, registrationSettings]);

  const handleCalculateSchedule = useCallback(() => {
    saveToHistory();

    const nodesMap = new Map<string, MindMapNode>();
    const flatten = (node: MindMapNode) => {
      nodesMap.set(node.id, { ...node });
      node.children.forEach(flatten);
    };
    flatten(data);

    const rootNode = nodesMap.get('root');
    if (!rootNode || !rootNode.endDate) {
      handleUpdateNodeData('root', { endDate: todayIso() });
    }

    const dependentsOf = new Map<string, string[]>();
    const addDep = (pre: string, dep: string) => {
      const existing = dependentsOf.get(pre) || [];
      if (!existing.includes(dep)) dependentsOf.set(pre, [...existing, dep]);
    };

    const buildHierarchyDeps = (node: MindMapNode) => {
      node.children.forEach(child => {
        addDep(child.id, node.id);
        buildHierarchyDeps(child);
      });
    };
    buildHierarchyDeps(data);

    connections.forEach(conn => {
      addDep(conn.fromId, conn.toId);
    });

    const calculatedDates = new Map<string, { start: string, end: string }>();

    const calculateForNode = (id: string): { start: string, end: string } => {
      if (calculatedDates.has(id)) return calculatedDates.get(id)!;

      const node = nodesMap.get(id);
      if (!node) return { start: '', end: '' };

      let endDate = node.endDate || '';

      if (id !== 'root') {
        const nextTasks = dependentsOf.get(id) || [];
        if (nextTasks.length > 0) {
          const nextResults = nextTasks.map(nextId => calculateForNode(nextId));
          const validStarts = nextResults.filter(r => r.start !== '').map(r => r.start);

          if (validStarts.length > 0) {
            const earliestNextStart = validStarts.reduce((min, cur) => cur < min ? cur : min, validStarts[0]);
            endDate = addDays(earliestNextStart, -1);
          }
        }
      }

      if (!endDate) {
        endDate = node.endDate || todayIso();
      }

      const effort = node.effort || 1;
      const startDate = addDays(endDate, -(effort - 1));

      const result = { start: startDate, end: endDate };
      calculatedDates.set(id, result);
      return result;
    };

    nodesMap.forEach((_, id) => {
      calculateForNode(id);
    });

    const updateTreeWithDates = (node: MindMapNode): MindMapNode => {
      const dates = calculatedDates.get(node.id);
      return {
        ...node,
        startDate: dates?.start || node.startDate,
        endDate: dates?.end || node.endDate,
        children: node.children.map(updateTreeWithDates)
      };
    };

    setData(prev => updateTreeWithDates(prev));
    setCriticalNodeIds(new Set());
    setCriticalConnIds(new Set());
  }, [data, connections, saveToHistory, handleUpdateNodeData]);

  const handleDetectCriticalPath = useCallback(() => {
    if (criticalNodeIds.size > 0) {
      setCriticalNodeIds(new Set());
      setCriticalConnIds(new Set());
      return;
    }
    const { criticalNodeIds: cNodes, criticalConnIds: cConns } = calculateCriticalPath(data, connections);
    if (cNodes.size === 0) {
      alert(t('redmine_create_tasks.app.cpm_not_found', 'No critical path found. Check task dates or dependencies.'));
    }
    setCriticalNodeIds(cNodes);
    setCriticalConnIds(cConns);
  }, [data, connections, criticalNodeIds]);

  const handleExport = () => {
    const exportData = { title: currentPage.title, pages };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${currentPage.title}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Page management handlers
  const handleAddPage = useCallback(() => {
    const newPage = createInitialPage();
    let newIndex = 0;
    setPages(prev => {
      newIndex = prev.length; // 新しいページのインデックス（追加後の配列の最後）
      return [...prev, newPage];
    });
    // setPages の後に、取得した newIndex を使用して setCurrentPageIndex を呼ぶ
    // React の batching により、同じイベントハンドラ内の複数の setState は一緒に処理される
    setCurrentPageIndex(newIndex);
    setSelectedNodeId(null);
    setNodeToEdit(null);
    setCriticalNodeIds(new Set());
    setCriticalConnIds(new Set());
    setHistory([]);
  }, []);

  const handleDeletePage = useCallback((index: number) => {
    if (pages.length <= 1) return;
    setPages(prev => prev.filter((_, i) => i !== index));
    if (currentPageIndex >= index && currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
    setSelectedNodeId(null);
    setNodeToEdit(null);
    setCriticalNodeIds(new Set());
    setCriticalConnIds(new Set());
    setHistory([]);
  }, [pages.length, currentPageIndex]);

  const handleSwitchPage = useCallback((index: number) => {
    if (index === currentPageIndex) return;
    setCurrentPageIndex(index);
    setSelectedNodeId(null);
    setNodeToEdit(null);
    setCriticalNodeIds(new Set());
    setCriticalConnIds(new Set());
    setHistory([]);
  }, [currentPageIndex]);

  const handleRenamePageTitle = useCallback((index: number, newTitle: string) => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[index] = { ...newPages[index], title: newTitle };
      return newPages;
    });
  }, []);

  return (
    <div className="create-tasks-app flex flex-col h-screen w-full overflow-hidden">
      <main className="flex-1 relative bg-slate-50 p-4">
        <MindMapCanvas
          ref={canvasRef}
          data={data}
          connections={connections}
          selectedNodeId={selectedNodeId}
          editingNodeId={nodeToEdit}
          criticalNodeIds={criticalNodeIds}
          criticalConnIds={criticalConnIds}
          onSelectNode={setSelectedNodeId}
          onUpdateNodeData={handleUpdateNodeData}
          onAddNode={handleAddNode}
          onDeleteNode={handleDeleteNode}
          onSetEditingId={setNodeToEdit}
          onAddConnection={handleAddConnection}
          onDeleteConnection={handleDeleteConnection}
          onDetachNode={handleDetachNode}
          onMoveNode={handleMoveNode}
        />

        <div className="absolute top-4 right-4 md:top-8 md:right-8 flex flex-col gap-4 items-end pointer-events-none">
          {/* Tools Group - Horizontal Layout */}
          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={() => canvasRef.current?.focusRoot()}
              className="p-3 bg-white text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all"
              title={t('redmine_create_tasks.app.focus_root', 'Focus Root')}
            >
              <Target size={20} />
            </button>
            <button
              onClick={() => canvasRef.current?.focusLeafNodes()}
              className="p-3 bg-white text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all"
              title={t('redmine_create_tasks.app.focus_leaves', 'Focus Leaves')}
            >
              <MapIcon size={20} />
            </button>
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`p-3 rounded-full shadow-md transition-all ${history.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              title={t('redmine_create_tasks.app.undo', 'Undo')}
            >
              <Undo size={20} />
            </button>
            <button
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  document.documentElement.requestFullscreen();
                }
              }}
              className="p-3 bg-white text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all"
              title={t('redmine_create_tasks.app.fullscreen', 'Toggle Fullscreen')}
            >
              {document.fullscreenElement ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 bg-white text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all"
              title={t('redmine_create_tasks.app.register_settings', 'Registration Settings')}
            >
              <Settings size={20} />
            </button>
            <button
              onClick={handleExport}
              className="p-3 bg-white text-slate-600 rounded-full shadow-md hover:bg-slate-50 transition-all"
              title={t('redmine_create_tasks.app.export', 'Export')}
            >
              <Download size={20} />
            </button>
          </div>

          {/* Action Buttons Group - Vertical Layout */}
          <div className="flex flex-col gap-3 items-end pointer-events-auto">
            <button
              onClick={() => selectedNodeId && handleAddNode(selectedNodeId, 'left')}
              disabled={!selectedNodeId}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-full shadow-lg text-sm font-bold transition-all w-46 ${!selectedNodeId
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }`}
            >
              <Plus size={20} />
              {t('redmine_create_tasks.app.add_prereq', 'Add Prerequisite')}
            </button>

            <button
              onClick={() => selectedNodeId && selectedNodeId !== 'root' && handleDeleteNode(selectedNodeId)}
              disabled={!selectedNodeId || selectedNodeId === 'root'}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-full shadow-lg text-sm font-bold transition-all w-46 ${!selectedNodeId || selectedNodeId === 'root'
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-50'
                : 'bg-white text-rose-600 border border-rose-100 hover:bg-rose-50 active:scale-95'
                }`}
            >
              <Trash2 size={16} />
              {t('redmine_create_tasks.app.delete', 'Delete')}
            </button>

            <button
              onClick={handleCalculateSchedule}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-full shadow-lg font-medium hover:bg-emerald-700 active:scale-95 transition-all w-46"
              title={t('redmine_create_tasks.app.schedule_calc', 'Calculate Schedule')}
            >
              <CalendarRange size={20} />
              <span className="text-sm font-bold text-center leading-tight">
                {t('redmine_create_tasks.app.schedule_calc', 'Calculate Schedule')}
              </span>
            </button>

            <button
              onClick={handleDetectCriticalPath}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-full shadow-lg font-medium transition-all w-46 ${criticalNodeIds.size > 0
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              title={t('redmine_create_tasks.app.critical_path', 'Critical Path')}
            >
              <Workflow size={20} className={criticalNodeIds.size > 0 ? 'animate-pulse' : ''} />
              <span className="text-sm font-bold text-center leading-tight">
                {t('redmine_create_tasks.app.critical_path', 'Critical Path')}
              </span>
            </button>

            <button
              onClick={() => selectedNodeId && handleAIExpand(selectedNodeId)}
              disabled={!selectedNodeId || isExpanding}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-full shadow-lg text-sm font-bold transition-all w-46 ${!selectedNodeId || isExpanding
                ? 'bg-purple-100 text-purple-400 cursor-not-allowed opacity-50'
                : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
                }`}
            >
              <Cpu size={20} className={isExpanding ? 'animate-spin' : ''} />
              {isExpanding
                ? t('redmine_create_tasks.app.ai_extracting', 'Extracting...')
                : t('redmine_create_tasks.app.ai_extract', 'Extract with AI')}
            </button>

            <button
              onClick={handleRegisterIssues}
              disabled={isRegistering}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-full shadow-lg font-medium transition-all w-46 ${isRegistering
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                }`}
              title={t('redmine_create_tasks.app.register_button', 'Register Issues')}
            >
              <Send size={20} className={isRegistering ? 'animate-pulse' : ''} />
              <span className="text-sm font-bold text-center leading-tight">
                {isRegistering
                  ? t('redmine_create_tasks.app.registering', 'Registering...')
                  : t('redmine_create_tasks.app.register_button', 'Register Issues')}
              </span>
            </button>
          </div>
        </div>



        {(registerResult || registerError) && (
          <div className="absolute top-4 right-4 md:top-8 md:right-8 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-lg p-4 w-[320px] text-xs text-slate-600 z-10">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-slate-800">{t('redmine_create_tasks.app.register_title', 'Registration Result')}</p>
              <button
                onClick={() => { setRegisterResult(null); setRegisterError(null); }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                aria-label={t('redmine_create_tasks.common.close', 'Close')}
              >
                ×
              </button>
            </div>
            {registerError && (
              <p className="text-rose-600 font-semibold">{registerError}</p>
            )}
            {registerResult && (
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">{t('redmine_create_tasks.app.success_count', 'Success Count')}:</span> {registerResult.success_count}
                </div>
                <div>
                  <span className="font-semibold">{t('redmine_create_tasks.app.sample_ids', 'Sample Issue IDs')}:</span>{' '}
                  {registerResult.success_sample_ids.length > 0
                    ? registerResult.success_sample_ids.join(', ')
                    : t('redmine_create_tasks.common.none', 'None')}
                </div>
                <div>
                  <span className="font-semibold">{t('redmine_create_tasks.app.failures', 'Failures')}:</span>
                  {registerResult.failures.length === 0 ? (
                    <span> {t('redmine_create_tasks.common.none', 'None')}</span>
                  ) : (
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {registerResult.failures.map((failure, index) => (
                        <li key={`failure-${index}`}>
                          {failure.task_id}: {failure.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <span className="font-semibold">{t('redmine_create_tasks.app.warnings', 'Warnings')}:</span>
                  {registerResult.warnings.length === 0 ? (
                    <span> {t('redmine_create_tasks.common.none', 'None')}</span>
                  ) : (
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      {registerResult.warnings.map((warning, index) => (
                        <li key={`warning-${index}`}>
                          {warning.task_id}: {warning.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <PageTabBar
          pages={pages}
          currentPageIndex={currentPageIndex}
          onSwitchPage={handleSwitchPage}
          onAddPage={handleAddPage}
          onDeletePage={handleDeletePage}
          onRenamePageTitle={handleRenamePageTitle}
        />
      </main>

      <AiTaskExtractModal
        open={aiModalOpen}
        provider={aiProvider}
        prompt={aiPrompt}
        tasks={aiTasks}
        loading={isExpanding}
        error={aiError}
        onProviderChange={setAiProvider}
        onPromptChange={setAiPrompt}
        onConfirm={handleApplyAiTasks}
        onGenerate={handleExecuteAI}
        onSaveSettings={handleSaveSettings}
        onLoadDefaults={handleLoadDefaults}
        onClose={() => {
          setAiModalOpen(false);
          setAiTargetNodeId(null);
          setAiTasks([]);
        }}
      />

      <RegistrationSettingsDialog
        open={isSettingsOpen}
        masterData={masterData}
        currentSettings={registrationSettings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveRegistrationSettings}
      />
    </div>
  );
};

export default App;
