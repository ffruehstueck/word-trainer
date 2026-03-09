interface StrapiConfig {
  baseUrl: string;
  token: string;
  internalToken: string;
}

export function getStrapiConfig(): StrapiConfig {
  const baseUrl = process.env.STRAPI_URL;
  const token = process.env.STRAPI_TOKEN;
  const internalToken = process.env.STRAPI_INTERNAL_TOKEN;

  if (!baseUrl || !token || !internalToken) {
    throw new Error(
      "STRAPI_URL, STRAPI_TOKEN and STRAPI_INTERNAL_TOKEN must be configured",
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    token,
    internalToken,
  };
}

export async function postToStrapiCollection<T>(
  collection: string,
  data: T,
): Promise<Response> {
  const { baseUrl, token, internalToken } = getStrapiConfig();

  return fetch(`${baseUrl}/api/${collection}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Internal-Token": internalToken,
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });
}

interface StrapiCollectionResponse<T> {
  data: T[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export async function getFromStrapiCollection<T>(
  collection: string,
  queryParams = "",
): Promise<StrapiCollectionResponse<T>> {
  const { baseUrl, token, internalToken } = getStrapiConfig();
  const query = queryParams ? `?${queryParams}` : "";
  const response = await fetch(`${baseUrl}/api/${collection}${query}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Internal-Token": internalToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Strapi GET ${collection} failed (${response.status}): ${responseText}`,
    );
  }

  return response.json();
}

export async function getAllFromStrapiCollection<T>(
  collection: string,
  pageSize = 100,
): Promise<T[]> {
  const rows: T[] = [];
  let currentPage = 1;
  let pageCount = 1;

  while (currentPage <= pageCount) {
    const params = new URLSearchParams();
    params.set("pagination[page]", String(currentPage));
    params.set("pagination[pageSize]", String(pageSize));
    params.set("sort", "createdAt:desc");

    const response = await getFromStrapiCollection<T>(collection, params.toString());
    rows.push(...(response.data || []));

    pageCount = response.meta?.pagination?.pageCount ?? currentPage;
    currentPage += 1;
  }

  return rows;
}
