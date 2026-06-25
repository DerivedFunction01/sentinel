/**
 * RECURSIVE PARAMETER EDITOR
 *
 * Replaces flat ParameterRow[] with a tree structure that:
 * - Preserves all nested information
 * - Allows recursive add/delete at each level
 * - Compiles cleanly to OpenAI JSON Schema
 * - No information loss during nested object editing
 */

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Trash2, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Recursive tree node for parameters
 * Handles objects and arrays at any depth
 */
export interface ParameterNode {
  id: string; // Unique ID for React keys
  name: string;
  type: "string" | "number" | "boolean" | "integer" | "array" | "object";
  description: string;
  required: boolean;

  // Type-specific constraints
  enumOptions?: string; // "option1, option2" for strings
  minimum?: number;
  maximum?: number;

  // For arrays: type of items
  arrayItemType?:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "object"
    | "array";

  // For objects and array items that are objects: child properties
  children?: ParameterNode[];
}

interface RecursiveParameterEditorProps {
  nodes: ParameterNode[];
  onChange: (nodes: ParameterNode[]) => void;
  depth?: number;
  maxDepth?: number;
}

interface ParameterNodeEditorProps {
  node: ParameterNode;
  index: number;
  parentNodes: ParameterNode[];
  onUpdate: (updatedNode: ParameterNode) => void;
  onDelete: () => void;
  depth: number;
  maxDepth?: number;
}

/**
 * Single Parameter Node Editor
 * Handles one parameter with recursive children
 */
export function ParameterNodeEditor({
  node,
  index,
  parentNodes,
  onUpdate,
  onDelete,
  depth,
  maxDepth = 10,
}: ParameterNodeEditorProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const canAddChildren =
    (node.type === "object" || node.type === "array") && depth < maxDepth;
  const isMaxDepth = depth >= maxDepth;

  const updateNode = (fields: Partial<ParameterNode>) => {
    onUpdate({ ...node, ...fields });
  };

  const addChild = () => {
    const newChild: ParameterNode = {
      id: `${node.id}-child-${Date.now()}`,
      name: "",
      type: "string",
      description: "",
      required: false,
    };
    updateNode({
      children: [...(node.children || []), newChild],
    });
  };

  const updateChild = (index: number, updatedChild: ParameterNode) => {
    const newChildren = [...(node.children || [])];
    newChildren[index] = updatedChild;
    updateNode({ children: newChildren });
  };

  const deleteChild = (index: number) => {
    const newChildren = node.children?.filter((_, i) => i !== index) || [];
    updateNode({
      children: newChildren.length > 0 ? newChildren : undefined,
    });
  };

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div
      className="group border border-slate-800 bg-slate-950/30 rounded-lg p-3 space-y-2 relative transition-all hover:border-slate-700"
      style={{ marginLeft: `${depth * 20}px` }}
    >
      {/* Header Row: name, type, required, actions */}
      <div className="flex gap-2 items-center flex-wrap">
        {/* Expander for children */}
        {canAddChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 flex items-center justify-center text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800/50 transition-colors shrink-0"
          >
            {hasChildren && !isExpanded && <ChevronRight className="h-4 w-4" />}
            {hasChildren && isExpanded && <ChevronDown className="h-4 w-4" />}
            {!hasChildren && <div className="w-4" />}
          </button>
        )}

        {/* Name Input */}
        <Input
          className="h-8 text-xs font-mono bg-slate-900 border-slate-800 flex-1 min-w-40"
          placeholder="property_name (snake_case)"
          value={node.name}
          onChange={(e) =>
            updateNode({
              name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
            })
          }
        />

        {/* Type Selector */}
        <select
          value={node.type}
          onChange={(e) =>
            updateNode({
              type: e.target.value as any,
              // Reset children if switching away from object/array
              ...(e.target.value !== "object" && e.target.value !== "array"
                ? { children: undefined, arrayItemType: undefined }
                : {}),
            })
          }
          className="h-8 text-xs bg-slate-900 border border-slate-800 rounded px-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30 shrink-0"
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="integer">integer</option>
          <option value="array">array</option>
          <option value="object">object</option>
        </select>

        {/* Required Checkbox */}
        <div className="flex items-center gap-1 bg-slate-900 px-2 h-8 rounded border border-slate-800 shrink-0">
          <Checkbox
            id={`req-${node.id}`}
            checked={node.required}
            onCheckedChange={(checked) => updateNode({ required: !!checked })}
          />
          <label
            htmlFor={`req-${node.id}`}
            className="text-[10px] font-bold uppercase text-slate-400 cursor-pointer select-none"
          >
            Req
          </label>
        </div>

        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-slate-500 hover:text-red-400 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Description Input */}
      <Input
        className="h-7 text-[11px] bg-slate-900/50 border-slate-800/80 text-slate-300"
        placeholder="Parameter documentation..."
        value={node.description}
        onChange={(e) => updateNode({ description: e.target.value })}
      />

      {/* Type-Specific Constraints */}
      <div className="grid grid-cols-1 gap-2 pt-1 border-t border-slate-800/40 mt-1.5">
        {/* ENUMS: String Constraints */}
        {node.type === "string" && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              Enum Options (comma-separated)
            </span>
            <Input
              className="h-7 text-xs bg-slate-900 border-slate-800"
              placeholder="e.g. processing, completed, failed"
              value={node.enumOptions || ""}
              onChange={(e) => updateNode({ enumOptions: e.target.value })}
            />
          </div>
        )}

        {/* NUMERIC: Min / Max */}
        {(node.type === "number" || node.type === "integer") && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Min
              </span>
              <Input
                className="h-7 text-xs bg-slate-900 border-slate-800"
                type="number"
                placeholder="Min value"
                value={node.minimum ?? ""}
                onChange={(e) =>
                  updateNode({
                    minimum: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Max
              </span>
              <Input
                className="h-7 text-xs bg-slate-900 border-slate-800"
                type="number"
                placeholder="Max value"
                value={node.maximum ?? ""}
                onChange={(e) =>
                  updateNode({
                    maximum: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>
        )}

        {/* ARRAY: Item Type Selector */}
        {node.type === "array" && (
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">
                Array Item Type
              </span>
              <select
                value={node.arrayItemType || "string"}
                onChange={(e) =>
                  updateNode({
                    arrayItemType: e.target.value as any,
                    // Reset children if switching away from object/array items
                    ...(e.target.value !== "object" &&
                    e.target.value !== "array"
                      ? { children: undefined }
                      : {}),
                  })
                }
                className="h-7 text-xs bg-slate-900 border border-slate-800 rounded px-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="integer">integer</option>
                <option value="object">object</option>
                <option value="array">array</option>
              </select>
            </div>

            {/* ARRAY ITEM ENUMS: If array items are strings, allow enum options */}
            {node.arrayItemType === "string" && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Array Item Enum Options (comma-separated)
                </span>
                <Input
                  className="h-7 text-xs bg-slate-900 border-slate-800"
                  placeholder="e.g. red, green, blue"
                  value={node.enumOptions || ""}
                  onChange={(e) => updateNode({ enumOptions: e.target.value })}
                />
              </div>
            )}

            {/* ARRAY ITEM MIN/MAX: If array items are numbers/integers */}
            {(node.arrayItemType === "number" ||
              node.arrayItemType === "integer") && (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Item Min
                  </span>
                  <Input
                    className="h-7 text-xs bg-slate-900 border-slate-800"
                    type="number"
                    placeholder="Min value"
                    value={node.minimum ?? ""}
                    onChange={(e) =>
                      updateNode({
                        minimum: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Item Max
                  </span>
                  <Input
                    className="h-7 text-xs bg-slate-900 border-slate-800"
                    type="number"
                    placeholder="Max value"
                    value={node.maximum ?? ""}
                    onChange={(e) =>
                      updateNode({
                        maximum: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children Section */}
      {canAddChildren && (
        <div className="pt-2 border-t border-slate-800/40 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase text-slate-500">
              {node.type === "array"
                ? "Array Item Schema"
                : "Nested Properties"}
              {hasChildren && ` (${node.children!.length})`}
            </span>
            <Button
              size="sm"
              onClick={addChild}
              disabled={isMaxDepth}
              className="h-6 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 px-2"
            >
              <Plus className="w-3 h-3" />
              Add
            </Button>
          </div>

          {isExpanded && hasChildren && (
            <div className="space-y-2 bg-slate-900/20 p-2 rounded border border-slate-800/30">
              {node.children!.map((child, childIndex) => (
                <ParameterNodeEditor
                  key={child.id}
                  node={child}
                  index={childIndex}
                  parentNodes={node.children!}
                  onUpdate={(updated) => updateChild(childIndex, updated)}
                  onDelete={() => deleteChild(childIndex)}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main Recursive Parameter Editor Component
 */
export function RecursiveParameterEditor({
  nodes,
  onChange,
  depth = 0,
  maxDepth = 10,
}: RecursiveParameterEditorProps) {
  const addParameter = () => {
    const newNode: ParameterNode = {
      id: `root-${Date.now()}`,
      name: "",
      type: "string",
      description: "",
      required: false,
    };
    onChange([...nodes, newNode]);
  };

  const updateNode = (index: number, updated: ParameterNode) => {
    const newNodes = [...nodes];
    newNodes[index] = updated;
    onChange(newNodes);
  };

  const deleteNode = (index: number) => {
    onChange(nodes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-800">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
          Parameters & Nested Properties ({nodes.length})
        </span>
        <Button
          size="sm"
          onClick={addParameter}
          className="h-7 text-[11px] bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 px-2.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Field
        </Button>
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {nodes.map((node, index) => (
          <ParameterNodeEditor
            key={node.id}
            node={node}
            index={index}
            parentNodes={nodes}
            onUpdate={(updated) => updateNode(index, updated)}
            onDelete={() => deleteNode(index)}
            depth={0}
            maxDepth={maxDepth}
          />
        ))}
      </div>
    </div>
  );
}
