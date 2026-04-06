import { PartnerApiClient } from './sdk/api-client';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

let token: string | null = null;

export function setToken(t: string | null) { token = t; }
export function getToken() { return token; }

export const api = new PartnerApiClient(API_BASE, () => token);
