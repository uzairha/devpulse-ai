import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from './api.js';

// The interceptors are registered on the axios instance at import time; pull
// them straight off the handler arrays and call them directly rather than
// standing up a fake HTTP layer.
const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;
const onResponse = api.interceptors.response.handlers[0].fulfilled;
const onResponseError = api.interceptors.response.handlers[0].rejected;

let originalLocation;

beforeEach(() => {
  localStorage.clear();
  originalLocation = window.location;
  Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('request interceptor', () => {
  it('attaches a bearer token when one is stored', () => {
    localStorage.setItem('token', 'abc123');
    const config = requestInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer abc123');
  });

  it('leaves the headers alone when no token is stored', () => {
    const config = requestInterceptor({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('response interceptor', () => {
  it('passes a successful response straight through', () => {
    const response = { data: { ok: true } };
    expect(onResponse(response)).toBe(response);
  });

  it('rejects with the server-provided error message', async () => {
    await expect(
      onResponseError({ response: { status: 400, data: { error: 'Bad input' } } })
    ).rejects.toThrow('Bad input');
  });

  it('rejects with a generic message when the server sends none', async () => {
    await expect(onResponseError({ response: { status: 500, data: {} } })).rejects.toThrow(
      'Something went wrong'
    );
  });

  it('rejects with a generic message when there is no response at all (network error)', async () => {
    await expect(onResponseError({ message: 'Network Error' })).rejects.toThrow('Something went wrong');
  });

  it('on 401, clears the stored token and redirects to /login', async () => {
    localStorage.setItem('token', 'stale');
    await expect(
      onResponseError({ response: { status: 401, data: { error: 'Unauthorized' } } })
    ).rejects.toThrow('Unauthorized');
    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('does not touch the token or location for a non-401 error', async () => {
    localStorage.setItem('token', 'keep-me');
    await expect(
      onResponseError({ response: { status: 403, data: { error: 'Forbidden' } } })
    ).rejects.toThrow('Forbidden');
    expect(localStorage.getItem('token')).toBe('keep-me');
    expect(window.location.href).toBe('');
  });
});
