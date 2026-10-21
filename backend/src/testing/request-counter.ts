import type { NextFunction, Request, Response } from "express";

export type RequestCounter = {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
  count: () => number;
  reset: () => void;
};

function isCounted(path: string): boolean {
  return (
    path.startsWith("/api/") &&
    !path.startsWith("/api/test") &&
    path !== "/api/health"
  );
}

export function createRequestCounter(): RequestCounter {
  let total = 0;
  return {
    middleware: (req, _res, next) => {
      if (isCounted(req.path)) total += 1;
      next();
    },
    count: () => total,
    reset: () => {
      total = 0;
    },
  };
}
