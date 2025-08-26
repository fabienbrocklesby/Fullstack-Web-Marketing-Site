const CMS_URL = document.documentElement.getAttribute("data-cms-url") || "http://localhost:1337";

function getAuthHeaders() {
  const jwt = localStorage.getItem("jwt");
  if (!jwt) throw new Error("User not authenticated");
  return new Headers({ Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" });
}

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { status: response.status, name: "UnknownError", message: "An unknown error occurred" } }));
    throw new Error(errorData.error.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.data;
}

function transformStrapiData(strapiData) {
  if (Array.isArray(strapiData)) return strapiData.map((item) => transformStrapiItem(item));
  return transformStrapiItem(strapiData);
}

function transformStrapiItem(item) {
  if (!item || typeof item !== "object") return item;
  if (item.attributes && item.id !== undefined) {
    return { id: item.id, ...item.attributes };
  }
  return item;
}

export async function fetchPage(id) {
  const response = await fetch(`${CMS_URL}/api/pages/${id}?populate[sections][populate]=*`, { headers: getAuthHeaders() });
  const rawData = await handleResponse(response);
  return transformStrapiData(rawData);
}

export async function fetchPages() {
  const response = await fetch(`${CMS_URL}/api/pages?populate[sections][populate]=*`, { headers: getAuthHeaders() });
  const rawData = await handleResponse(response);
  return transformStrapiData(rawData);
}

export async function updatePage(id, sections) {
  const response = await fetch(`${CMS_URL}/api/pages/${id}`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ data: { sections } }) });
  const rawData = await handleResponse(response);
  return transformStrapiData(rawData);
}

export async function createPage(title, slug, sections = []) {
  const response = await fetch(`${CMS_URL}/api/pages`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ data: { title, slug, sections, publishedAt: new Date().toISOString() } }) });
  const rawData = await handleResponse(response);
  return transformStrapiData(rawData);
}

export async function deletePage(id) {
  const response = await fetch(`${CMS_URL}/api/pages/${id}`, { method: "DELETE", headers: getAuthHeaders() });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export async function updatePageSettings(id, settings) {
  const response = await fetch(`${CMS_URL}/api/pages/${id}`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ data: { title: settings.title, slug: settings.slug, seoDescription: settings.seoDescription || "", seoKeywords: settings.seoKeywords || "" } }) });
  const rawData = await handleResponse(response);
  return transformStrapiData(rawData);
}
