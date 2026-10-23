import { describe, expect, it } from "vitest";
import { BackendContractError, BackendUnavailableError } from "./errors";

describe.each([
  ["BackendUnavailableError", BackendUnavailableError],
  ["BackendContractError", BackendContractError],
])("%s", (name, ErrorClass) => {
  it("is an Error carrying its name and message", () => {
    const error = new ErrorClass("boom");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error.name).toBe(name);
    expect(error.message).toBe("boom");
  });

  it("keeps the original error as cause", () => {
    const cause = new TypeError("original");
    expect(new ErrorClass("boom", { cause }).cause).toBe(cause);
  });

  it("has no cause when none is given", () => {
    expect(new ErrorClass("boom").cause).toBeUndefined();
  });
});

describe("error classes", () => {
  it("are distinguishable from each other", () => {
    expect(new BackendUnavailableError("x")).not.toBeInstanceOf(
      BackendContractError,
    );
    expect(new BackendContractError("x")).not.toBeInstanceOf(
      BackendUnavailableError,
    );
  });
});
