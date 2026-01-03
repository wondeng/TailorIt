type JobData = {
  url: string;
  title: string;
  description: string;
};
function isScrollable(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const oy = style.overflowY;
  return (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 20;
}

function findBestScrollerNearDescription(): HTMLElement | null {
  const desc = document.querySelector(
    ".jobs-description__content, .jobs-box__html-content, .jobs-description-content__text"
  ) as HTMLElement | null;

  // Walk up parents to find the first scrollable container
  let cur: HTMLElement | null = desc;
  while (cur && cur !== document.body) {
    if (isScrollable(cur)) return cur;
    cur = cur.parentElement;
  }

  // Fallback: common LinkedIn panes
  const candidates = [
    ".jobs-search__job-details",
    ".jobs-details__main-content",
    ".scaffold-layout__detail",
    ".scaffold-layout__main",
  ];

  for (const sel of candidates) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el && isScrollable(el)) return el;
  }

  return null;
}

async function scrollToForceRender(scroller: HTMLElement) {
  // Start at top
  scroller.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 200));

  let lastLen = -1;

  // Scroll down in chunks; after each chunk, check if JD grew
  for (let i = 0; i < 40; i++) {
    scroller.scrollTop += Math.floor(scroller.clientHeight * 0.9);
    await new Promise((r) => setTimeout(r, 220));

    const currentTextLen =
      (document.querySelector(".jobs-description__content, .jobs-box__html-content, .jobs-description-content__text") as HTMLElement | null)
        ?.textContent?.length ?? 0;

    // If it stopped changing for a bit, we're likely done
    if (currentTextLen === lastLen) {
      // Give it one extra nudge + wait
      await new Promise((r) => setTimeout(r, 300));
      break;
    }
    lastLen = currentTextLen;

    // If we're at bottom, stop
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 5;
    if (atBottom) break;
  }

  // small settle time
  await new Promise((r) => setTimeout(r, 400));
}

async function prepareLinkedInForExtraction() {
  const scroller = findBestScrollerNearDescription();
  if (!scroller) return;

  // Focus the pane (sometimes needed for LinkedIn to render more)
  scroller.focus?.();

  await scrollToForceRender(scroller);
}

function textFrom(el: Element | null | undefined): string {
  if (!el) return "";
  const raw = (el as HTMLElement).textContent ?? "";
  return raw
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function pickLongest(selectors: string[]): Element | null {
  let best: Element | null = null;
  let bestLen = 0;

  for (const sel of selectors) {
    const nodes = Array.from(document.querySelectorAll(sel));
    for (const n of nodes) {
      const t = textFrom(n);
      if (t.length > bestLen) {
        bestLen = t.length;
        best = n;
      }
    }
  }
  return best;
}

function extractLinkedInJobData(): { title: string; description: string } {
  const titleEl = pickLongest([
    ".jobs-unified-top-card__job-title",
    '[data-test-id="job-details-job-title"]',
    "h1"
  ]);

  const descEl = pickLongest([
    ".jobs-description__content",
    ".jobs-box__html-content",
    ".jobs-description-content__text",
    '[data-test-id="job-details-description"]',
    "section[class*='jobs-description']",
    "div[class*='jobs-description']"
  ]);

  const title = textFrom(titleEl) || document.title || "";
  let description = textFrom(descEl);

  if (!description) {
    const detailsPane = pickLongest([
      ".jobs-search__job-details",
      ".jobs-details__main-content",
      ".scaffold-layout__detail"
    ]);
    description = textFrom(detailsPane);
  }

  if (!description) description = document.body.textContent?.trim() ?? "";
  if (description.length > 20000) description = description.slice(0, 20000);

  return { title, description };
}

function extractJobData(): JobData {
  const url = location.href;

  if (location.hostname.includes("linkedin.com")) {
    const { title, description } = extractLinkedInJobData();
    return { url, title, description };
  }

  const title =
    document.querySelector("h1")?.textContent?.trim() ||
    document.title ||
    "";

  const descEl = pickLongest([
    "[class*='description' i]",
    "[id*='description' i]",
    "[data-test*='description' i]",
    "[data-testid*='description' i]",
    "[role='main'] article",
    "article",
    "main"
  ]);

  let description = textFrom(descEl);
  if (!description) description = document.body.textContent?.trim() ?? "";
  if (description.length > 20000) description = description.slice(0, 20000);

  return { url, title, description };
}

// ---- runtime wiring (required) ----
chrome.runtime.onMessage.addListener((msg: any) => {
  if (msg?.type === "EXTRACT_JD") {
    (async () => {
      if (location.hostname.includes("linkedin.com")) {
        await prepareLinkedInForExtraction();
      }
      const data = extractJobData();
      console.log("[Tailorit] JD length:", data.description.length, "title:", data.title);

      chrome.runtime.sendMessage({ type: "JD_EXTRACTED", payload: data });
    })();
  }
});


console.log("[Tailorit] content script loaded:", location.href);
