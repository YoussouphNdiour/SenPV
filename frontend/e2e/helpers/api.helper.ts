/**
 * Helpers pour appeler l'API backend directement dans les tests.
 * Utilisés pour le setup/teardown (créer projets, zones, etc. sans passer par l'UI).
 */

const API_URL = process.env.API_URL || "http://localhost:8000";

export interface APIHelper {
  token: string;
  baseUrl: string;
}

export function createAPIHelper(token: string): APIHelper {
  return { token, baseUrl: API_URL };
}

async function apiRequest(
  helper: APIHelper,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(`${helper.baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${helper.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export async function createProject(
  helper: APIHelper,
  data: {
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }
): Promise<{ id: string; name: string }> {
  const res = await apiRequest(helper, "POST", "/projects", {
    name: data.name,
    address: data.address || "Dakar, Sénégal",
    latitude: data.latitude || 14.7167,
    longitude: data.longitude || -17.4677,
    notes: data.notes || "",
  });

  if (!res.ok) {
    throw new Error(`Create project failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function deleteProject(
  helper: APIHelper,
  projectId: string
): Promise<void> {
  await apiRequest(helper, "DELETE", `/projects/${projectId}`);
}

export async function createZone(
  helper: APIHelper,
  projectId: string,
  data: {
    name: string;
    polygon: number[][];
    tilt?: number;
    azimuth?: number;
  }
): Promise<{ id: string }> {
  const geojson = {
    type: "Polygon",
    coordinates: [[...data.polygon, data.polygon[0]]],
  };

  const res = await apiRequest(
    helper,
    "POST",
    `/projects/${projectId}/zones`,
    {
      name: data.name,
      polygon: geojson,
      tilt: data.tilt || 15,
      azimuth: data.azimuth || 180,
    }
  );

  if (!res.ok) {
    throw new Error(`Create zone failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function listEquipment(
  helper: APIHelper,
  type?: string
): Promise<{ items: Array<{ id: string; name: string; type: string }> }> {
  const query = type ? `?type=${type}` : "";
  const res = await apiRequest(helper, "GET", `/equipment${query}`);
  if (!res.ok) {
    throw new Error(
      `List equipment failed: ${res.status} ${await res.text()}`
    );
  }
  return res.json();
}

export async function runSimulation(
  helper: APIHelper,
  projectId: string
): Promise<unknown> {
  const res = await apiRequest(
    helper,
    "POST",
    `/projects/${projectId}/simulate`
  );
  if (!res.ok) {
    throw new Error(`Simulation failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function generateSchematic(
  helper: APIHelper,
  projectId: string
): Promise<unknown> {
  const res = await apiRequest(
    helper,
    "POST",
    `/projects/${projectId}/schematic/generate`
  );
  if (!res.ok) {
    throw new Error(
      `Schematic generation failed: ${res.status} ${await res.text()}`
    );
  }
  return res.json();
}
