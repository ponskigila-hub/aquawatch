export interface AlertRule {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rainfall3hMm: number;
  windGustKmh: number;
  enabled: boolean;
}

export type ObservationKind = 'street flooding' | 'power outage' | 'hail' | 'strong wind' | 'other';

export interface GroundObservation {
  id: string;
  kind: ObservationKind;
  note: string;
  lat: number;
  lng: number;
  observedAt: string;
  photoDataUrl?: string;
}

const RULES_KEY = 'aquawatch.alert-rules.v1';
const DB_NAME = 'aquawatch-community.v1';
const STORE_NAME = 'observations';

export function readAlertRules(): AlertRule[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAlertRule) : [];
  } catch {
    return [];
  }
}

export function writeAlertRules(rules: AlertRule[]): void {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

const isAlertRule = (value: unknown): value is AlertRule => {
  if (typeof value !== 'object' || value === null) return false;
  const rule = value as Partial<AlertRule>;
  return typeof rule.id === 'string' && typeof rule.name === 'string'
    && typeof rule.lat === 'number' && typeof rule.lng === 'number'
    && typeof rule.rainfall3hMm === 'number' && typeof rule.windGustKmh === 'number'
    && typeof rule.enabled === 'boolean';
};

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) return reject(new Error('This browser does not support local observation storage.'));
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Could not open local observation storage.'));
});

export async function readObservations(): Promise<GroundObservation[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as GroundObservation[]).sort((a, b) => b.observedAt.localeCompare(a.observedAt)));
    request.onerror = () => reject(request.error ?? new Error('Could not read saved observations.'));
    request.transaction.oncomplete = () => db.close();
  });
}

export async function saveObservation(observation: GroundObservation): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(observation);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Could not save this observation.')); };
  });
}

export async function removeObservation(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error('Could not remove this observation.')); };
  });
}

export async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this image.'));
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('This image could not be opened.'));
    element.src = dataUrl;
  });
  const scale = Math.min(1, 960 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image compression is not available in this browser.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL('image/jpeg', 0.68);
  if (compressed.length > 600_000) throw new Error('This photo is too large after compression. Try a smaller image.');
  return compressed;
}
