import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound, { metadata } from "./not-found";

describe("not found page", () => {
  it("[BR-B7] not found page shows heading, message and link", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(screen.getByText("We couldn't find that page.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to shop" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("[BR-B7] has the not found title and keeps the default description", () => {
    expect(metadata).toEqual({ title: "Page not found | Wick & Co. Candles" });
  });

  it("[BR-B7] offers one way back and no cart messages", () => {
    render(<NotFound />);

    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
