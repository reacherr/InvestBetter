const NSE_BASE_URL = "https://www.nseindia.com";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown) {
  return (
    err instanceof Error &&
    (err.name === "AbortError" ||
      err.message.toLowerCase().includes("aborted") ||
      err.message.toLowerCase().includes("aborterror"))
  );
}

function formatIstDateParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to compute IST date parts");
  }

  return { year, month, day };
}

export function getIstDateString(d: Date = new Date()) {
  const { year, month, day } = formatIstDateParts(d);
  return `${year}-${month}-${day}`;
}

function formatIstDdMmYyyy(d: Date) {
  const { year, month, day } = formatIstDateParts(d);
  return `${day}-${month}-${year}`;
}

function toFiniteNumber(value: unknown) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, ""))
        : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function buildNseHeaders(cookie: string | null) {
  return {
    accept: "application/json,text/plain,*/*",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    referer: `${NSE_BASE_URL}/`,
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    ...(cookie ? { cookie } : {}),
  } satisfies Record<string, string>;
}

export async function fetchNseCookies() {
  const res = await fetch(NSE_BASE_URL, {
    method: "GET",
    headers: buildNseHeaders(null),
    redirect: "follow",
  });

  // undici/Node supports getSetCookie(); fall back to single header if unavailable
  const setCookies =
    typeof (res.headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];

  const cookie = setCookies
    .map((c) => c.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");

  if (!cookie) {
    throw new Error("Failed to obtain NSE cookies");
  }

  return cookie;
}

async function nseFetchJson<T>(path: string, init?: { signal?: AbortSignal }) {
  const url = path.startsWith("http") ? path : `${NSE_BASE_URL}${path}`;

  let cookie: string | null = null;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      if (!cookie) {
        cookie = await fetchNseCookies();
      }

      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 12_000);
      const signal = init?.signal
        ? AbortSignal.any([init.signal, controller.signal])
        : controller.signal;

      const res = await fetch(url, {
        method: "GET",
        headers: buildNseHeaders(cookie),
        redirect: "follow",
        signal,
      });
      clearTimeout(timeout);

      if (res.status === 401 || res.status === 403) {
        cookie = null;
        throw new Error(`NSE request blocked (${res.status})`);
      }

      if (res.status === 429) {
        throw new Error("NSE rate limited (429)");
      }

      if (!res.ok) {
        throw new Error(`NSE request failed (${res.status})`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (init?.signal?.aborted) {
        throw err;
      }
      const backoffMs = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      await sleep(backoffMs);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("NSE request failed");
}

type NseAllIndicesRow = {
  indexSymbol?: string;
  last?: string | number;
  pe?: string | number;
};

type NseAllIndicesResponse = {
  data?: NseAllIndicesRow[];
  timestamp?: string;
  lastUpdateTime?: string;
};

async function fetchAllIndices() {
  return await nseFetchJson<NseAllIndicesResponse>("/api/allIndices");
}

function parseNseAsOfIstDateString(value: string | undefined | null) {
  if (!value) return null;

  // Common NSE formats include:
  // - "01-Apr-2026 15:30:00"
  // - "01-Apr-2026"
  // - "01 Apr 2026 15:30:00"
  const m = value.match(/(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})/);
  if (!m) return null;

  const dd = m[1].padStart(2, "0");
  const mon = m[2].toLowerCase();
  const yyyy = m[3];

  const monthMap: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  const mm = monthMap[mon];
  if (!mm) return null;

  return `${yyyy}-${mm}-${dd}`;
}

export async function fetchNseMarketSnapshot(): Promise<{
  asOfIstDate: string | null;
  niftyClose: number;
  niftyPE: number;
  indiaVix: number;
}> {
  const json = await fetchAllIndices();
  const rows = Array.isArray(json.data) ? json.data : [];

  const nifty = rows.find(
    (r) => (r.indexSymbol || "").toUpperCase().trim() === "NIFTY 50",
  );
  const vix = rows.find(
    (r) => (r.indexSymbol || "").toUpperCase().trim() === "INDIA VIX",
  );

  const niftyClose = toFiniteNumber(nifty?.last);
  const niftyPE = toFiniteNumber(nifty?.pe);
  const indiaVix = toFiniteNumber(vix?.last);

  if (niftyClose == null || niftyPE == null || indiaVix == null) {
    throw new Error("NSE returned incomplete market snapshot data");
  }

  const asOfIstDate = parseNseAsOfIstDateString(
    json.timestamp ?? json.lastUpdateTime,
  );

  return { asOfIstDate, niftyClose, niftyPE, indiaVix };
}

async function fetchNiftySnapshot(): Promise<{
  niftyClose: number;
  niftyPE: number;
}> {
  const json = await fetchAllIndices();
  const rows = Array.isArray(json.data) ? json.data : [];
  const nifty = rows.find(
    (r) => (r.indexSymbol || "").toUpperCase().trim() === "NIFTY 50",
  );

  const niftyClose = toFiniteNumber(nifty?.last);
  const niftyPE = toFiniteNumber(nifty?.pe);

  if (niftyClose == null || niftyPE == null) {
    throw new Error("NSE returned no Nifty snapshot data");
  }

  return { niftyClose, niftyPE };
}

async function fetchIndiaVix(): Promise<number> {
  const json = await fetchAllIndices();
  const rows = Array.isArray(json.data) ? json.data : [];
  const vix = rows.find(
    (r) => (r.indexSymbol || "").toUpperCase().trim() === "INDIA VIX",
  );

  const indiaVix = toFiniteNumber(vix?.last);
  if (indiaVix == null) {
    throw new Error("NSE returned no India VIX data");
  }

  return indiaVix;
}

type NseIndicesHistoryRow = {
  // Observed field names vary; handle common variants defensively.
  close?: string | number;
  CLOSE?: string | number;
};

type NseIndicesHistoryResponse = {
  data?: NseIndicesHistoryRow[];
};

export async function fetchNiftyHistory(params: {
  from: string; // DD-MM-YYYY
  to: string; // DD-MM-YYYY
}) {
  const query = new URLSearchParams({
    indexType: "NIFTY 50",
    from: params.from,
    to: params.to,
  });

  // Spec says: /api/historical/indicesHistory
  return await nseFetchJson<NseIndicesHistoryResponse>(
    `/api/historical/indicesHistory?${query.toString()}`,
  );
}

export async function computeNifty200Dma(): Promise<number | null> {
  // NSE provides trading days only. Fetch ~18 months to reliably cover 200 trading sessions.
  const to = new Date();
  const from = new Date(Date.now() - 540 * 24 * 60 * 60 * 1000);

  const json = await fetchNiftyHistory({
    from: formatIstDdMmYyyy(from),
    to: formatIstDdMmYyyy(to),
  });

  const rows = Array.isArray(json.data) ? json.data : [];
  const closes = rows
    .map((r) => toFiniteNumber(r.close ?? r.CLOSE))
    .filter((x): x is number => x != null);

  if (closes.length < 200) {
    return null;
  }

  const last200 = closes.slice(-200);
  const sum = last200.reduce((acc, v) => acc + v, 0);
  return sum / 200;
}

