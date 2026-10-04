import type { Prisma } from "@prisma/client";

export const REGISTRATION_SORT_FIELDS = ["name", "email", "date", "track", "phone"] as const;
export const REGISTRATION_SEARCH_FIELDS = ["all", "name", "email", "date"] as const;

export type RegistrationSortField = (typeof REGISTRATION_SORT_FIELDS)[number];
export type RegistrationSearchField = (typeof REGISTRATION_SEARCH_FIELDS)[number];
export type SortOrder = "asc" | "desc";

export const DEFAULT_SORT: RegistrationSortField = "date";
export const DEFAULT_ORDER: SortOrder = "desc";
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 200;

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  phone: string;
  techSkill: string;
  email: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeSortField(value: unknown): RegistrationSortField {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (REGISTRATION_SORT_FIELDS as readonly string[]).includes(raw)
    ? (raw as RegistrationSortField)
    : DEFAULT_SORT;
}

export function normalizeSearchField(value: unknown): RegistrationSearchField {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (REGISTRATION_SEARCH_FIELDS as readonly string[]).includes(raw)
    ? (raw as RegistrationSearchField)
    : "all";
}

export function normalizeOrder(value: unknown): SortOrder {
  return typeof value === "string" && value.trim().toLowerCase() === "asc" ? "asc" : "desc";
}

export function startOfUtcDay(value: string): Date | null {
  if (!DAY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function endOfUtcDay(value: string): Date | null {
  const start = startOfUtcDay(value);
  return start ? new Date(start.getTime() + 86_400_000 - 1) : null;
}

function nameFilter(term: string): Prisma.RegistrationWhereInput {
  return {
    OR: [
      { firstName: { contains: term, mode: "insensitive" } },
      { lastName: { contains: term, mode: "insensitive" } },
    ],
  };
}

export function buildRegistrationListQuery(
  params: URLSearchParams,
  scope?: { techSkill: string }
): {
  where: Prisma.RegistrationWhereInput;
  orderBy: Prisma.RegistrationOrderByWithRelationInput[];
  take: number;
  skip: number;
  sort: RegistrationSortField;
  order: SortOrder;
  search: RegistrationSearchField;
  query: string;
} {
  const query = (params.get("q") ?? "").trim();
  const search = normalizeSearchField(params.get("field"));
  const sort = normalizeSortField(params.get("sort"));
  const order = normalizeOrder(params.get("order"));

  const requestedLimit = Number(params.get("limit"));
  const take = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const requestedOffset = Number(params.get("offset"));
  const skip = Number.isFinite(requestedOffset) ? Math.max(Math.trunc(requestedOffset), 0) : 0;

  const filters: Prisma.RegistrationWhereInput[] = [];
  if (scope) filters.push({ techSkill: scope.techSkill });

  const from = startOfUtcDay(params.get("from") ?? "");
  const to = endOfUtcDay(params.get("to") ?? "");
  if (from || to) {
    filters.push({
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }

  if (query) {
    if (search === "email") {
      filters.push({ email: { contains: query, mode: "insensitive" } });
    } else if (search === "name") {
      filters.push(nameFilter(query));
    } else if (search === "date") {
      const dayStart = startOfUtcDay(query);
      const dayEnd = endOfUtcDay(query);
      if (dayStart && dayEnd) {
        filters.push({ createdAt: { gte: dayStart, lte: dayEnd } });
      }
    } else {
      filters.push({
        OR: [
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
      });
    }
  }

  const orderBy: Prisma.RegistrationOrderByWithRelationInput[] =
    sort === "name"
      ? [{ firstName: order }, { lastName: order }]
      : sort === "track"
        ? [{ techSkill: order }, { firstName: "asc" }]
        : sort === "email"
          ? [{ email: order }]
          : sort === "phone"
            ? [{ phone: order }]
            : [{ createdAt: order }];

  return { where: { AND: filters }, orderBy, take, skip, sort, order, search, query };
}

export function parseRegistrationInput(
  body: unknown,
  options: { partial?: boolean; lockedTechSkill?: string } = {}
): { ok: true; value: Partial<RegistrationInput> } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid JSON body." };
  }

  const raw = body as Record<string, unknown>;
  const readString = (key: keyof RegistrationInput): string | undefined => {
    if (!(key in raw)) return undefined;
    const value = raw[key];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : "";
  };

  const value: Partial<RegistrationInput> = {};
  const partial = options.partial === true;

  for (const key of ["firstName", "lastName", "phone", "techSkill"] as const) {
    const field = readString(key);
    if (field === undefined) continue;
    if (!field && !partial) return { ok: false, error: "All fields are required." };
    if (field) value[key] = field;
  }

  const email = readString("email");
  if (email !== undefined) {
    if (!email && !partial) return { ok: false, error: "All fields are required." };
    if (email && !EMAIL_PATTERN.test(email)) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    if (email) value.email = email.toLowerCase();
  }

  if (options.lockedTechSkill !== undefined) {
    value.techSkill = options.lockedTechSkill;
  }

  if (!partial && Object.keys(value).length < 5) {
    return { ok: false, error: "All fields are required." };
  }

  return { ok: true, value };
}