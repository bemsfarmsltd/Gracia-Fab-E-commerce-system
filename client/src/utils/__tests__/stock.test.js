import { describe, it, expect } from "vitest";
import { isOutOfStock, stockLabel } from "../stock";

describe("isOutOfStock", () => {
  it("treats a product with no stock value as out of stock", () => {
    // Older products in the live database have no `stock` field at all, and
    // the shop API (a lean query) returns them without one.
    expect(isOutOfStock({ name: "CURL UP Defining Cream", isInStock: null })).toBe(true);
  });

  it("is out of stock at 0 or when flagged unavailable", () => {
    expect(isOutOfStock({ stock: 0 })).toBe(true);
    expect(isOutOfStock({ stock: 5, isInStock: false })).toBe(true);
  });

  it("is in stock with a positive count", () => {
    expect(isOutOfStock({ stock: 3 })).toBe(false);
    expect(isOutOfStock({ stock: 3, isInStock: true })).toBe(false);
  });

  it("handles a missing product", () => {
    expect(isOutOfStock(null)).toBe(true);
    expect(isOutOfStock(undefined)).toBe(true);
  });
});

describe("stockLabel", () => {
  it("shows the real count when stock is low, never an invented one", () => {
    expect(stockLabel({ stock: 3 })).toBe("In stock · only 3 left");
    expect(stockLabel({ stock: 40 })).toBe("In stock");
    expect(stockLabel({ stock: 0 })).toBe("Out of stock");
    expect(stockLabel({})).toBe("Out of stock");
  });
});
