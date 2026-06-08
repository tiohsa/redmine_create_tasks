import { MindMapNode, Connection, TaskRegistrationTask } from '../types';
import { RegistrationSettings } from '../components/RegistrationSettingsDialog';

const flattenNodes = (node: MindMapNode): MindMapNode[] => [
  node,
  ...node.children.flatMap(flattenNodes)
];

const buildDependencyMap = (_root: MindMapNode, connections: Connection[]): Map<string, Set<string>> => {
  const depMap = new Map<string, Set<string>>();
  const addDep = (dependsOn: string, target: string) => {
    if (!dependsOn || !target || dependsOn === target) return;
    const current = depMap.get(target) || new Set<string>();
    current.add(dependsOn);
    depMap.set(target, current);
  };

  connections.forEach(conn => {
    if ((conn.type ?? 'dependency') === 'dependency') {
      addDep(conn.fromId, conn.toId);
    }
  });
  return depMap;
};

export function buildTaskRegistrationPayload(
  data: MindMapNode,
  connections: Connection[],
  registrationSettings: RegistrationSettings
): { tasks: TaskRegistrationTask[]; defaults: Record<string, any> } {
  const parentMap = new Map<string, string>();
  const buildParentMap = (node: MindMapNode) => {
    node.children.forEach(child => {
      parentMap.set(child.id, node.id);
      buildParentMap(child);
    });
  };
  buildParentMap(data);

  const nodes = flattenNodes(data).filter(node => {
    // Root node handling
    if (node.id === 'root') {
      // If settings explicitly say do NOT create root issue, exclude it
      if (registrationSettings.create_root_issue === false) {
        return false;
      }
      return true;
    }

    // Existing node handling (for children or any non-root)
    if (/^\d+$/.test(node.id)) return false;

    return true;
  });

  const depMap = buildDependencyMap(data, connections);

  const tasksPayload = nodes.map(node => {
    const deps = Array.from(depMap.get(node.id) || []);
    let parentId = parentMap.get(node.id);
    const isRootDependencyPredecessor = parentId === 'root' && connections.some(conn =>
      (conn.type ?? 'dependency') === 'dependency' &&
      conn.fromId === node.id &&
      conn.toId === 'root'
    );

    if (isRootDependencyPredecessor) {
      parentId = undefined;
    } else if (parentId === 'root') {
      if (registrationSettings.create_root_issue) {
        parentId = 'root';
      } else if (registrationSettings.existing_root_issue_id) {
        parentId = registrationSettings.existing_root_issue_id;
      } else {
        parentId = undefined;
      }
    }

    // Map 'root' dependency to actual root ID if needed
    let finalDeps = [...deps];
    if (finalDeps.includes('root')) {
      finalDeps = finalDeps.map(d => {
        if (d === 'root') {
          if (registrationSettings.create_root_issue) return 'root';
          if (registrationSettings.existing_root_issue_id) return registrationSettings.existing_root_issue_id;
          return undefined;
        }
        return d;
      }).filter(Boolean) as string[];
    }

    // Ensure unique dependencies
    const uniqueDeps = Array.from(new Set(finalDeps));

    return {
      id: node.id,
      subject: node.text,
      start_date: node.startDate,
      due_date: node.endDate,
      man_days: node.effort,
      dependencies: uniqueDeps.length > 0 ? uniqueDeps : undefined,
      parent_task_id: parentId
    };
  });

  const registrationDefaults = Object.fromEntries(
    Object.entries(registrationSettings).filter(([key]) => key !== 'relation_' + 'mode')
  );

  return { tasks: tasksPayload, defaults: registrationDefaults };
}
