import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface EnvironmentPaths {
  currentDirectory: string;
  repositoryRoot: string;
  rootEnvPath: string;
  serverEnvPath: string;
}

export function getEnvironmentPaths(moduleUrl: string = import.meta.url): EnvironmentPaths {
  const currentDirectory = path.dirname(fileURLToPath(moduleUrl));
  const repositoryRoot = path.resolve(currentDirectory, "../../..");

  return {
    currentDirectory,
    repositoryRoot,
    rootEnvPath: path.join(repositoryRoot, ".env"),
    serverEnvPath: path.join(repositoryRoot, "server", ".env")
  };
}

export function loadEnvironment(moduleUrl: string = import.meta.url): EnvironmentPaths {
  const paths = getEnvironmentPaths(moduleUrl);

  dotenv.config({ path: paths.rootEnvPath });
  dotenv.config({ path: paths.serverEnvPath });

  return paths;
}
