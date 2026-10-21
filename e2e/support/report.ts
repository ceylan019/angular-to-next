const FLAG = "--project";

function projectsFrom(argv: readonly string[]): string[] {
  return argv.flatMap((arg, index) => {
    if (arg.startsWith(`${FLAG}=`)) {
      return [arg.slice(FLAG.length + 1)];
    }
    const next = argv[index + 1];
    if (arg === FLAG && next !== undefined && !next.startsWith("-")) {
      return [next];
    }
    return [];
  });
}

export function reportFolder(argv: readonly string[]): string {
  const projects = projectsFrom(argv).filter((project) => project !== "");
  return `playwright-report/${projects.length > 0 ? projects.join("-") : "all"}`;
}
