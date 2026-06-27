import path from "node:path";
import { fileURLToPath } from "node:url";

export interface RuntimePaths {
  currentDirectory: string;
  repositoryRoot: string;
  clientDistPath: string;
}

export function getRuntimePaths(moduleUrl: string = import.meta.url): RuntimePaths {
  const currentDirectory = path.dirname(fileURLToPath(moduleUrl));
  const repositoryRoot = path.resolve(currentDirectory, "../../..");

  return {
    currentDirectory,
    repositoryRoot,
    clientDistPath: path.join(repositoryRoot, "client", "dist")
  };
}
