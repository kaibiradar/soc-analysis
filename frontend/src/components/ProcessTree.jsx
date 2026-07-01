import { useMemo, useState } from "react";

function TreeNode({ node, query }) {
  const [open, setOpen] = useState(true);
  const text = `${node.name} ${node.command_line} ${node.user}`.toLowerCase();
  const match = query && text.includes(query.toLowerCase());
  const children = node.children || [];

  return (
    <div className="process-node">
      <button
        className={`process-card ${node.suspicious ? "suspicious" : ""} ${match ? "match" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span>{children.length ? (open ? "▾" : "▸") : "•"}</span>
        <strong>{node.name}</strong>
        <small>PID {node.pid || "--"} · PPID {node.ppid || "--"} · {node.user || "unknown"}</small>
        <em>{node.command_line || "No command line captured"}</em>
      </button>
      {open && children.length > 0 && (
        <div className="process-children">
          {children.map((child) => (
            <TreeNode key={child.id} node={child} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessTree({ tree }) {
  const [query, setQuery] = useState("");
  const hasTree = useMemo(() => Boolean(tree), [tree]);

  return (
    <div>
      <div className="tool-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search process tree"
        />
      </div>
      {!hasTree ? (
        <div className="empty-state">No process tree available</div>
      ) : (
        <div className="process-tree">
          <TreeNode node={tree} query={query} />
        </div>
      )}
    </div>
  );
}

export default ProcessTree;
