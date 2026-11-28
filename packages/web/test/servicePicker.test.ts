import { describe, expect, it } from 'vitest';
import { SERVICES } from '@dart-times/core';
import { SERVICE_ORDER } from '../src/screens/ServicePicker';

describe('service picker order', () => {
  it('lists every train service exactly once, and not the Luas (trams have their own home page)', () => {
    expect([...SERVICE_ORDER].sort()).toEqual(
      Object.keys(SERVICES)
        .filter((id) => id !== 'luas')
        .sort(),
    );
  });
});
