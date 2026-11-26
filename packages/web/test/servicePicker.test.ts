import { describe, expect, it } from 'vitest';
import { SERVICES } from '@dart-times/core';
import { SERVICE_ORDER } from '../src/ServicePicker';

describe('service picker order', () => {
  it('lists every service exactly once', () => {
    expect([...SERVICE_ORDER].sort()).toEqual(Object.keys(SERVICES).sort());
  });
});
