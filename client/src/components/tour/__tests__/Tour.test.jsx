import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Tour from "../Tour";
import useFirstRunTour, { startTour } from "../useFirstRunTour";
import { adminSteps } from "../adminSteps";
import { shopSteps } from "../shopSteps";

// jsdom has no layout: give the elements we point at a size.
function target(id, { hidden = false } = {}) {
  const el = document.createElement("button");
  el.setAttribute("data-tour", id);
  el.textContent = id;
  el.getBoundingClientRect = () => (hidden
    ? { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
    : { top: 100, left: 100, right: 220, bottom: 140, width: 120, height: 40 });
  document.body.appendChild(el);
  return el;
}

const STEPS = [
  { id: "hello", title: "Welcome", body: <p>Hi</p> },
  { id: "a", target: '[data-tour="a"]', title: "Step A", body: <p>A</p> },
  { id: "missing", target: '[data-tour="nowhere"]', title: "Missing", body: <p>Never shown</p> },
  { id: "b", target: ['[data-tour="b-desktop"]', '[data-tour="b-phone"]'], title: "Step B", body: <p>B</p> },
  { id: "bye", title: "Done!", body: <p>Bye</p> },
];

beforeEach(() => { document.body.innerHTML = ""; localStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe("Tour", () => {
  it("walks through the steps, skipping ones whose target isn't on the page", () => {
    target("a");
    target("b-desktop", { hidden: true }); // e.g. a desktop link hidden on phones
    target("b-phone");
    const onClose = vi.fn();
    render(<Tour steps={STEPS} open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Welcome" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show me around" }));
    expect(screen.getByRole("dialog", { name: "Step A" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    // "Missing" is skipped; B uses the first visible of its two targets.
    expect(screen.getByRole("dialog", { name: "Step B" })).toBeInTheDocument();
    expect(document.querySelector(".tour-spotlight")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Step A" })).toBeInTheDocument(); // skips back over "Missing" too
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Done!" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ completed: true }));
  });

  it("closes on Escape or Not now", () => {
    const onClose = vi.fn();
    render(<Tour steps={STEPS} open onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ completed: false }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("puts the focus on the main button, for keyboard and screen-reader users", () => {
    render(<Tour steps={STEPS} open onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show me around" }));
  });
});

function FirstRun({ storageKey, enabled = true }) {
  const { open, close } = useFirstRunTour({ name: "shop", storageKey, enabled, delay: 10 });
  return open ? <button type="button" onClick={close}>TOUR OPEN</button> : <p>closed</p>;
}

describe("first visit only", () => {
  it("opens once, remembers it was seen, and can be replayed", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<FirstRun storageKey="t1" />);
    await act(async () => { vi.advanceTimersByTime(20); });
    fireEvent.click(screen.getByRole("button", { name: "TOUR OPEN" }));
    expect(localStorage.getItem("t1")).toBe("done");
    unmount();

    render(<FirstRun storageKey="t1" />);
    await act(async () => { vi.advanceTimersByTime(50); });
    expect(screen.getByText("closed")).toBeInTheDocument();
    act(() => startTour("shop"));
    expect(screen.getByRole("button", { name: "TOUR OPEN" })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("tour content", () => {
  it("gives staff a staff welcome and owner-only wording only to the owner", () => {
    const owner = adminSteps({ name: "Gracia Okafor", isAdmin: true });
    const staff = adminSteps({ name: "Chioma Eze", role: "staff" });
    expect(owner[0].title).toBe("Welcome, Gracia");
    expect(staff[0].eyebrow).toBe("Staff portal");
    // Owner-only sections are skipped for staff because their menu items
    // aren't rendered; the steps exist but point at those items.
    expect(owner.find((s) => s.id === "suppliers").target).toBe('[data-tour="nav-suppliers"]');
    expect(owner.at(-1).body.props.children.filter(Boolean)).toHaveLength(2);
    expect(staff.at(-1).body.props.children.filter(Boolean)).toHaveLength(1);
  });

  it("uses only confirmed store facts in the shop tour", () => {
    const text = JSON.stringify(shopSteps(null).map((s) => [s.title, s.body]));
    expect(text).toContain("₦2,500");
    expect(text).toContain("Monday to Saturday, 8am to 6pm");
    expect(text).not.toMatch(/guarantee|certified|award|best in nigeria/i);
  });
});
