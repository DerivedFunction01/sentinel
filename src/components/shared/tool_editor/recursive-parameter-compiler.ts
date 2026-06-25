/**
 * RECURSIVE PARAMETER COMPILER
 *
 * Converts the recursive ParameterNode tree structure into
 * OpenAI-compliant JSON Schema while preserving all information
 * at every nesting level.
 */

import type { ParameterNode } from "./recursive-parameter-editor";

/**
 * Represents compiled JSON Schema for a single parameter
 */
interface CompiledSchema {
  type: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: CompiledSchema;
  properties?: Record<string, CompiledSchema>;
  required?: string[];
}

/**
 * Compile a single parameter node to JSON Schema
 * Handles recursion for nested objects and arrays
 */
function compileNode(node: ParameterNode): CompiledSchema {
  const schema: CompiledSchema = {
    type: node.type,
    ...(node.description ? { description: node.description } : {}),
  };

  // STRING: Enums
  if (node.type === "string" && node.enumOptions?.trim()) {
    schema.enum = node.enumOptions
      .split(",")
      .map((opt) => opt.trim())
      .filter(Boolean);
  }

  // NUMBER/INTEGER: Min/Max constraints
  if (node.type === "number" || node.type === "integer") {
    if (node.minimum !== undefined && !isNaN(node.minimum)) {
      schema.minimum = node.minimum;
    }
    if (node.maximum !== undefined && !isNaN(node.maximum)) {
      schema.maximum = node.maximum;
    }
  }

  // ARRAY: Compile item schema
  if (node.type === "array") {
    const itemType = node.arrayItemType || "string";

    // If array items are objects or arrays, they have children
    if (node.children && node.children.length > 0) {
      if (node.arrayItemType === "object") {
        schema.items = {
          type: "object",
          properties: {},
          required: [],
        };

        node.children.forEach((child) => {
          schema.items!.properties![child.name] = compileNode(child);
          if (child.required) {
            schema.items!.required!.push(child.name);
          }
        });

        // Remove required array if empty
        if (schema.items.required!.length === 0) {
          delete schema.items.required;
        }
      } else if (node.arrayItemType === "array") {
        // Nested arrays
        schema.items = compileNode({
          ...node.children[0],
          type: "array",
        });
      }
    } else {
      // Simple array without complex items
      const itemSchema: CompiledSchema = {
        type: itemType,
      };

      // Apply constraints to array items (enum, min/max)
      if (itemType === "string" && node.enumOptions?.trim()) {
        itemSchema.enum = node.enumOptions
          .split(",")
          .map((opt) => opt.trim())
          .filter(Boolean);
      }

      if (itemType === "number" || itemType === "integer") {
        if (node.minimum !== undefined && !isNaN(node.minimum))
          itemSchema.minimum = node.minimum;
        if (node.maximum !== undefined && !isNaN(node.maximum))
          itemSchema.maximum = node.maximum;
      }

      schema.items = itemSchema;
    }
  }

  // OBJECT: Compile nested properties
  if (node.type === "object" && node.children && node.children.length > 0) {
    schema.properties = {};
    schema.required = [];

    node.children.forEach((child) => {
      schema.properties![child.name] = compileNode(child);
      if (child.required) {
        schema.required!.push(child.name);
      }
    });

    // Remove required array if empty
    if (schema.required!.length === 0) {
      delete schema.required;
    }
  }

  return schema;
}

/**
 * Compile all parameter nodes into OpenAI function schema
 *
 * @param nodes Root-level parameter nodes
 * @param functionName Tool function name
 * @param functionDescription Tool function description
 * @returns Complete OpenAI function definition
 */
export function compileParametersToSchema(
  nodes: ParameterNode[],
  functionName: string,
  functionDescription: string,
): any {
  const properties: Record<string, CompiledSchema> = {};
  const required: string[] = [];

  nodes.forEach((node) => {
    if (!node.name.trim()) return;

    properties[node.name] = compileNode(node);
    if (node.required) {
      required.push(node.name);
    }
  });

  return {
    type: "function",
    function: {
      name: functionName,
      description: functionDescription,
      parameters: {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    },
  };
}

/**
 * Reverse operation: Parse JSON Schema back into ParameterNode tree
 *
 * Useful for loading existing tools into the editor
 */
export function parseSchemaToNodes(
  properties: Record<string, any>,
  required: string[] = [],
  parentId = "root",
): ParameterNode[] {
  return Object.entries(properties).map(([key, schema], index) => {
    const node: ParameterNode = {
      id: `${parentId}-${key}-${index}`,
      name: key,
      type: schema.type || "string",
      description: schema.description || "",
      required: required.includes(key),
    };

    // Parse STRING: enums
    if (schema.type === "string" && schema.enum) {
      node.enumOptions = schema.enum.join(", ");
    }

    // Parse NUMBER/INTEGER: min/max
    if (
      (schema.type === "number" || schema.type === "integer") &&
      schema.minimum !== undefined
    ) {
      node.minimum = schema.minimum;
    }
    if (
      (schema.type === "number" || schema.type === "integer") &&
      schema.maximum !== undefined
    ) {
      node.maximum = schema.maximum;
    }

    // Parse ARRAY: item type and nested properties
    if (schema.type === "array" && schema.items) {
      node.arrayItemType = schema.items.type || "string";

      // Parse array item constraints (enum, min/max)
      if (schema.items.type === "string" && schema.items.enum) {
        node.enumOptions = schema.items.enum.join(", ");
      }

      if (
        (schema.items.type === "number" || schema.items.type === "integer") &&
        schema.items.minimum !== undefined
      ) {
        node.minimum = schema.items.minimum;
      }
      if (
        (schema.items.type === "number" || schema.items.type === "integer") &&
        schema.items.maximum !== undefined
      ) {
        node.maximum = schema.items.maximum;
      }

      if (schema.items.type === "object" && schema.items.properties) {
        node.children = parseSchemaToNodes(
          schema.items.properties,
          schema.items.required || [],
          node.id,
        );
      } else if (schema.items.type === "array" && schema.items.items) {
        // Nested arrays - recursively parse
        node.children = [
          parseSchemaToNodes({ [key]: schema.items }, [], node.id)[0],
        ];
      }
    }

    // Parse OBJECT: nested properties
    if (schema.type === "object" && schema.properties) {
      node.children = parseSchemaToNodes(
        schema.properties,
        schema.required || [],
        node.id,
      );
    }

    return node;
  });
}

/**
 * Validate parameter nodes for issues
 * Returns array of error messages (empty if valid)
 */
export function validateNodes(nodes: ParameterNode[]): string[] {
  const errors: string[] = [];
  const seenNames = new Set<string>();

  function validateRecursive(nodes: ParameterNode[], path: string = "root") {
    nodes.forEach((node, index) => {
      const nodePath = `${path}[${index}]`;

      // Check for empty names
      if (!node.name.trim()) {
        errors.push(`${nodePath}: Parameter name cannot be empty`);
      }

      // Check for duplicate names
      const fullPath = `${path}.${node.name}`;
      if (seenNames.has(fullPath)) {
        errors.push(`${nodePath}: Duplicate parameter name "${node.name}"`);
      }
      seenNames.add(fullPath);

      // Check enum format
      if (node.type === "string" && node.enumOptions?.trim()) {
        const enums = node.enumOptions
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        if (enums.length === 0) {
          errors.push(
            `${nodePath}: Enum options provided but all empty after trim`,
          );
        }
      }

      // Check numeric constraints
      if (
        (node.type === "number" || node.type === "integer") &&
        node.minimum !== undefined &&
        node.maximum !== undefined &&
        node.minimum > node.maximum
      ) {
        errors.push(
          `${nodePath}: Minimum (${node.minimum}) cannot be greater than maximum (${node.maximum})`,
        );
      }

      // Validate children recursively
      if (node.children && node.children.length > 0) {
        if (node.type !== "object" && node.type !== "array") {
          errors.push(
            `${nodePath}: Only "object" and "array" types can have children, got "${node.type}"`,
          );
        }
        validateRecursive(node.children, nodePath);
      }

      // Check array item type with children mismatch
      if (
        node.type === "array" &&
        node.children &&
        node.children.length > 0 &&
        node.arrayItemType &&
        node.arrayItemType !== "object" &&
        node.arrayItemType !== "array"
      ) {
        errors.push(
          `${nodePath}: Array has children but arrayItemType is "${node.arrayItemType}", expected "object" or "array"`,
        );
      }
    });
  }

  validateRecursive(nodes);
  return errors;
}
