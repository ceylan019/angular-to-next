import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

let container: StartedPostgreSqlContainer | undefined;

export async function setup(project: TestProject) {
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
