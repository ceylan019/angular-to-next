import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";
import { generateImagesIfMissing } from "../../scripts/generate-images.js";

let container: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject) {
  await generateImagesIfMissing();
  container = await new PostgreSqlContainer("postgres:18-alpine").start();
  project.provide("databaseUrl", container.getConnectionUri());
}

export async function teardown() {
  await container?.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
