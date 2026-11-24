import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react';
import type { DirectoryNode } from '../bridge/types';

interface SidebarProps {
  tree: DirectoryNode | null;
  activePath: string | null;
  recentFiles: string[];
  onOpenFolder: () => void;
  onOpenFile: (path: string) => void;
  onCreateFileInFolder: (folderPath: string) => void;
}

function filterTree(node: DirectoryNode, query: string): DirectoryNode | null {
  if (!query) return node;
  if (!node.isDirectory) {
    return node.name.toLowerCase().includes(query) ? node : null;
  }
  const kids = (node.children ?? [])
    .map((c) => filterTree(c, query))
    .filter((c): c is DirectoryNode => c !== null);
  if (kids.length > 0 || node.name.toLowerCase().includes(query)) {
    return { ...node, children: kids };
  }
  return null;
}

function TreeBranch({
  node,
  depth,
  activePath,
  onOpenFile,
  forceExpand,
}: {
  node: DirectoryNode;
  depth: number;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  forceExpand: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isExpanded = forceExpand || expanded;

  if (!node.isDirectory) {
    const isActive =
      activePath !== null &&
      activePath.toLowerCase() === node.path.toLowerCase();
    return (
      <button
        type="button"
        className={`tree-row ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={() => onOpenFile(node.path)}
        title={node.path}
      >
        <FileText size={13} style={{ flexShrink: 0, opacity: 0.75 }} />
        <span className="tree-label">{node.name}</span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="tree-row"
        style={{ paddingLeft: `${8 + depth * 14}px`, fontWeight: 550 }}
        onClick={() => setExpanded((prev) => !prev)}
        title={node.path}
      >
        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Folder size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
        <span className="tree-label">{node.name}</span>
      </button>
      {isExpanded &&
        (node.children ?? []).map((child) => (
          <TreeBranch
            key={child.path}
            node={child}
            depth={depth + 1}
            activePath={activePath}
            onOpenFile={onOpenFile}
            forceExpand={forceExpand}
          />
        ))}
    </div>
  );
}

export function Sidebar({
  tree,
  activePath,
  recentFiles,
  onOpenFolder,
  onOpenFile,
  onCreateFileInFolder,
}: SidebarProps) {
  const [filter, setFilter] = useState('');
  const normalizedFilter = filter.trim().toLowerCase();
  const filteredTree = tree ? filterTree(tree, normalizedFilter) : null;

  return (
    <aside className="sidebar" aria-label="Files Sidebar">
      <div className="panel-header">
        <span>Explorer</span>
        <div className="sidebar-actions">
          {tree && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onCreateFileInFolder(tree.path)}
              title="New Markdown File in Folder"
            >
              <FilePlus size={14} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenFolder}
            title="Open Folder"
          >
            <FolderOpen size={14} />
          </button>
        </div>
      </div>

      <div className="sidebar-search-wrap">
        <input
          type="text"
          className="sidebar-search"
          placeholder="Filter files…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="sidebar-tree">
        {filteredTree ? (
          <TreeBranch
            node={filteredTree}
            depth={0}
            activePath={activePath}
            onOpenFile={onOpenFile}
            forceExpand={normalizedFilter.length > 0}
          />
        ) : (
          <div className="outline-empty">
            No folder opened. Click the folder icon above to browse local Markdown notes.
          </div>
        )}

        {recentFiles.length > 0 && (
          <>
            <div className="sidebar-section-label">Recent</div>
            {recentFiles.slice(0, 8).map((filePath) => {
              const fileName = filePath.split(/[\\/]/).pop() || filePath;
              const isActive =
                activePath !== null &&
                activePath.toLowerCase() === filePath.toLowerCase();
              return (
                <button
                  key={filePath}
                  type="button"
                  className={`tree-row ${isActive ? 'active' : ''}`}
                  onClick={() => onOpenFile(filePath)}
                  title={filePath}
                >
                  <FileText size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                  <span className="tree-label">{fileName}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}
