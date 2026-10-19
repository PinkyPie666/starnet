import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/bus';

type E = { ping: number; msg: string };

describe('EventBus', () => {
  it('delivers payloads to subscribers in order', () => {
    const bus = new EventBus<E>();
    const seen: string[] = [];
    bus.on('ping', (n) => seen.push(`a${n}`));
    bus.on('ping', (n) => seen.push(`b${n}`));
    bus.emit('ping', 1);
    expect(seen).toEqual(['a1', 'b1']);
  });

  it('unsubscribes via the returned function and off()', () => {
    const bus = new EventBus<E>();
    const fn = vi.fn();
    const off = bus.on('msg', fn);
    off();
    bus.emit('msg', 'x');
    const fn2 = vi.fn();
    bus.on('msg', fn2);
    bus.off('msg', fn2);
    bus.emit('msg', 'y');
    expect(fn).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
    expect(bus.count('msg')).toBe(0);
  });

  it('once() fires a single time', () => {
    const bus = new EventBus<E>();
    const fn = vi.fn();
    bus.once('ping', fn);
    bus.emit('ping', 1);
    bus.emit('ping', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('isolates a throwing handler from the rest', () => {
    const bus = new EventBus<E>();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', after);
    bus.emit('ping', 3);
    expect(after).toHaveBeenCalledWith(3);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('tolerates handlers that unsubscribe during emit', () => {
    const bus = new EventBus<E>();
    const calls: number[] = [];
    const offA = bus.on('ping', () => {
      calls.push(1);
      offA();
    });
    bus.on('ping', () => calls.push(2));
    bus.emit('ping', 0);
    bus.emit('ping', 0);
    expect(calls).toEqual([1, 2, 2]);
  });
});
